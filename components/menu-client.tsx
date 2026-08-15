"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Hand,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { Brand } from "@/components/brand";
import { ProductImage } from "@/components/product-image";
import { StatusPill } from "@/components/status-pill";
import { dailyCourseOrder, getCourseOptions, resolveDailyCourseGroups } from "@/lib/daily-menu";
import {
  categories,
  isProductAvailable,
  mexicoCityMinutes,
  money,
  products as seedProducts,
  timeToMinutes
} from "@/lib/menu";
import { connectOrderChannel, readDemoOrders } from "@/lib/order-store";
import { calculateCartTotal, cartItemTotal } from "@/lib/order-utils";
import type { CartItem, DailyMenuConfig, Order, Product, Promotion, TableSession } from "@/lib/types";

type MenuMode = "fixed" | "lunch";

function normalizeProduct(raw: Record<string, unknown>): Product {
  const product = raw as unknown as Product;
  const normalized = {
    ...product,
    slug: (raw.slug as string) || (raw.id as string) || product.slug || product.id,
    image:
      (raw.image as string) ||
      (raw.image_url as string) ||
      (raw.imageUrl as string) ||
      product.image ||
      "/menu/imperio/chilaquiles-sencillos.jpg"
  };
  // DEBUG TEMPORAL: log para chilaquiles-suizos
  if (raw.slug === "chilaquiles-suizos" || raw.id === "chilaquiles-suizos") {
    console.log("[DEBUG normalizeProduct] chilaquiles-suizos:", {
      "raw.image": raw.image,
      "raw.image_url": raw.image_url,
      "raw.imageUrl": raw.imageUrl,
      "product.image": product.image,
      "normalized.image": normalized.image,
      "raw completo": raw
    });
  }
  return normalized;
}

export function MenuClient({
  tableCode,
  customerName,
  customerPhone
}: {
  tableCode: string;
  customerName?: string;
  customerPhone?: string;
}) {
  const [mode, setMode] = useState<MenuMode>("fixed");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Desayunos");
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [sending, setSending] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [dailyMenu, setDailyMenu] = useState<DailyMenuConfig | null>(null);
  const [dailyMenuLoading, setDailyMenuLoading] = useState(true);
  const [catalog, setCatalog] = useState<Product[]>(seedProducts);
  const [serviceMinutes, setServiceMinutes] = useState<number | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [session, setSession] = useState<TableSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionExisted, setSessionExisted] = useState(false);
  const [sendTogether, setSendTogether] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<CartItem[][]>([]);
  const [drinkFlavors, setDrinkFlavors] = useState<Array<{drinkType: string; name: string; priceModifier: number}>>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const channelRef = useRef<ReturnType<typeof connectOrderChannel> | null>(null);
  const latestOrderRef = useRef<Order | null>(null);

  useEffect(() => {
    latestOrderRef.current = order;
  }, [order]);

  const promotionBySlug = useMemo(() => {
    const map = new Map<string, Promotion>();
    for (const promo of promotions) {
      if (promo.productSlug) map.set(promo.productSlug, promo);
    }
    return map;
  }, [promotions]);

  useEffect(() => {
    const updateClock = () => setServiceMinutes(mexicoCityMinutes());
    updateClock();
    const timer = window.setInterval(updateClock, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const loadDailyMenu = useCallback(async () => {
    const response = await fetch("/api/daily-menu", { cache: "no-store" });
    if (!response.ok) return null;
    const menu = (await response.json()) as DailyMenuConfig | null;
    setDailyMenu(menu);
    return menu;
  }, []);

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) return;
    const raw = (await response.json()) as Array<Record<string, unknown>>;
    if (!raw.length) return;
    const next = raw.map(normalizeProduct);
    if (next.length) setCatalog(next);
  }, []);

  const loadPromotions = useCallback(async () => {
    const response = await fetch("/api/promotions", { cache: "no-store" });
    if (!response.ok) return;
    const rows = (await response.json()) as Promotion[];
    if (Array.isArray(rows)) setPromotions(rows);
  }, []);

  const loadSession = useCallback(async () => {
    if (!tableCode) return;
    // Para llevar: no hay mesa física ni sesión; no crear sesiones falsas.
    if (tableCode === "LLEVAR") {
      setSession(null);
      setSessionExisted(false);
      setSessionLoading(false);
      return;
    }
    const response = await fetch(`/api/sessions?tableCode=${encodeURIComponent(tableCode)}`, {
      cache: "no-store"
    });
    if (response.ok) {
      const data = (await response.json()) as TableSession | null;
      if (data) {
        setSession(data);
        setSessionExisted(true);
        // Auto-enable sendTogether when joining an existing session
        setSendTogether(true);
        const activeOrders = (data.orders || []).filter(
          (item) => !["delivered", "cancelled"].includes(item.status)
        );
        if (activeOrders.length) {
          const mostRecent = activeOrders.reduce((a, b) =>
            +new Date(a.updatedAt) >= +new Date(b.updatedAt) ? a : b
          );
          setOrder((current) => {
            if (!current) return mostRecent;
            if (current.id !== mostRecent.id) return mostRecent;
            return +new Date(mostRecent.updatedAt) >= +new Date(current.updatedAt)
              ? mostRecent
              : current;
          });
        }
      } else {
        setSessionExisted(false);
        const createResponse = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tableCode })
        });
        if (createResponse.ok) {
          const created = (await createResponse.json()) as TableSession;
          setSession(created);
          setSessionExisted(false);
        }
      }
    }
    setSessionLoading(false);
  }, [tableCode]);

  useEffect(() => {
    let active = true;
    const initialTimer = window.setTimeout(() => {
      void loadDailyMenu().finally(() => {
        if (active) setDailyMenuLoading(false);
      });
      void loadCatalog();
      void loadPromotions();
      void loadSession();
      void fetch("/api/drink-flavors", { cache: "no-store" })
        .then((r) => r.json().catch(() => []))
        .then((data) => { if (active && Array.isArray(data)) setDrinkFlavors(data); })
        .catch(() => {});
    }, 0);
    const timer = window.setInterval(() => {
      void loadDailyMenu();
      void loadCatalog();
      void loadPromotions();
      void loadSession();
    }, 15000);
    return () => {
      active = false;
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, [loadCatalog, loadDailyMenu, loadPromotions, loadSession]);

  useEffect(() => {
    channelRef.current = connectOrderChannel(({ type, order: incoming, product, dailyMenu: menu }) => {
      if ((type === "status" || type === "edited") && incoming) {
        const nextOrder = incoming;
        setOrder((current) => {
          if (!current || current.id !== nextOrder.id) return current;
          if (nextOrder.status !== current.status) return nextOrder;
          return +new Date(nextOrder.updatedAt) >= +new Date(current.updatedAt)
            ? nextOrder
            : current;
        });
      }
      if (type === "menu" && product) {
        const normalized = normalizeProduct(product as unknown as Record<string, unknown>);
        setCatalog((current) => [
          normalized,
          ...current.filter((item) => item.id !== normalized.id)
        ]);
      }
      if (type === "menu-delete" && product) {
        setCatalog((current) => current.filter((item) => item.id !== product.id));
      }
      if (type === "daily-menu") {
        if (menu) setDailyMenu(menu);
        else void loadDailyMenu();
      }
      if (type === "database_change") {
        void loadCatalog();
        void loadDailyMenu();
        void loadSession();
        const current = latestOrderRef.current;
        if (current?.id) {
          const token = current.accessToken || "";
          void fetch(`/api/orders/${current.id}?token=${encodeURIComponent(token)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data && data.id === current.id) setOrder(data);
            })
            .catch(() => undefined);
        }
      }
    });
    return () => channelRef.current?.close();
  }, [loadCatalog, loadDailyMenu, loadSession]);

  useEffect(() => {
    if (!order) return;
    if (order.source === "demo") {
      const demoTimer = window.setInterval(() => {
        const latest = readDemoOrders().find((item) => item.id === order.id);
        if (latest) {
          setOrder((current) =>
            !current || +new Date(latest.updatedAt) >= +new Date(current.updatedAt)
              ? latest
              : current
          );
        }
      }, 1500);
      return () => window.clearInterval(demoTimer);
    }
    if (!order.accessToken || !order.id) return;
    const orderId = order.id;
    const token = order.accessToken;
    const pollOrder = async () => {
      try {
        const response = await fetch(
          `/api/orders/${orderId}?token=${encodeURIComponent(token)}`
        );
        if (response.ok) {
          const updated = await response.json();
          if (updated && updated.id === orderId) setOrder(updated);
        }
      } catch {
        // ignore polling errors
      }
    };
    const timer = window.setInterval(pollOrder, 4000);
    void pollOrder();
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id, order?.accessToken]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return catalog.filter((product) => {
      const matchesQuery =
        !normalized ||
        `${product.name} ${product.description}`.toLocaleLowerCase("es").includes(normalized);
      const matchesCategory =
        normalized ||
        (category === "Favoritos" ? product.popular : product.category === category);
      return matchesQuery && matchesCategory;
    });
  }, [catalog, category, query]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = calculateCartTotal(cart);

  function addItem(
    product: Product,
    quantity: number,
    notes: string,
    option?: string,
    extras?: Array<{ name: string; price: number }>,
    priceModifier?: number
  ) {
    setCart((current) => [
      ...current,
      {
        productId: product.slug || product.id,
        name: product.name,
        unitPrice: product.price + (priceModifier || 0),
        quantity,
        notes,
        option,
        priceModifier,
        extras: extras && extras.length > 0 ? extras : undefined,
        image: product.image
      }
    ]);
    setSelected(null);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  }

  function addDailyMenu(
    menu: DailyMenuConfig,
    selections: Record<string, string>,
    quantity: number,
    extras: Array<{ name: string; price: number }>
  ) {
    const notes = Object.entries(selections)
      .sort(
        ([left], [right]) =>
          dailyCourseOrder.indexOf(left as (typeof dailyCourseOrder)[number]) -
          dailyCourseOrder.indexOf(right as (typeof dailyCourseOrder)[number])
      )
      .map(([course, choice]) => `${course}: ${choice}`)
      .join(" · ")
      .slice(0, 200);
    const extraTotal = extras.reduce((sum, extra) => sum + extra.price, 0);
    addItem(
      {
        id: "comida-corrida",
        slug: "comida-corrida",
        name: "Comida corrida",
        description: "Menú completo del día",
        price: menu.price + extraTotal,
        category: "Comida corrida",
        image: "/menu/imperio/pechuga-rellena.jpg"
      },
      quantity,
      notes,
      undefined,
      extras
    );
  }

  async function submitOrder() {
    if (sending || cart.length === 0) return;

    if (sendTogether) {
      // Queue mode: accumulate orders, send all at once later
      setPendingOrders((current) => [...current, [...cart]]);
      setCart([]);
      setCartOpen(false);
      setGeneralNotes("");
      return;
    }

    if (!window.confirm(`¿Enviar este pedido de ${money(subtotal)} a cocina?`)) return;
    setSending(true);
    try {
      const created = await sendOrderToApi(cart, generalNotes);
      setCart([]);
      setCartOpen(false);
      setGeneralNotes("");
      if (created) {
        setOrder(created);
      }
    } catch {
      // Error already shown by sendOrderToApi
    } finally {
      setSending(false);
    }
  }

  async function sendAllTogether() {
    if (sending || pendingOrders.length === 0) return;
    const totalItems = pendingOrders.reduce((sum, items) => sum + items.reduce((s, i) => s + i.quantity, 0), 0);
    if (!window.confirm(`¿Enviar ${pendingOrders.length} pedidos (${totalItems} productos) juntos a cocina?`)) return;
    setSending(true);
    let successCount = 0;
    for (const items of pendingOrders) {
      try {
        await sendOrderToApi(items, "");
        successCount++;
      } catch {
        // Continue with remaining orders
      }
    }
    setPendingOrders([]);
    setSending(false);
    if (successCount > 0) {
      setOrder({ id: "batch", folio: `${successCount} pedidos`, tableCode, status: "accepted", items: [], notes: "", subtotal: 0, total: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), source: "supabase" });
    }
  }

  async function sendOrderToApi(items: CartItem[], notes: string) {
    const idempotencyKey = crypto.randomUUID();
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          tableCode,
          items: items.map(({ productId, quantity, notes: n, option, extras, priceModifier }) => ({
            productId,
            quantity,
            notes: n,
            option,
            optionPriceModifier: priceModifier,
            extras: extras?.map((extra) => ({ name: extra.name }))
          })),
          notes,
          idempotencyKey,
          sessionId: session?.id ?? null,
          customerName: tableCode === "LLEVAR" ? (customerName?.trim() || undefined) : undefined
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No fue posible registrar el pedido");
      }
      const created = payload as Order;
      void channelRef.current?.send({ type: "new", order: created });
      return created;
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "El sistema tardó demasiado en responder."
          : error instanceof Error
            ? error.message
            : "No fue posible enviar el pedido";
      window.alert(message);
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function callWaiter() {
    if (waiterCalled) return;
    setWaiterCalled(true);
    const call = {
      id: crypto.randomUUID(),
      tableCode,
      timestamp: new Date().toISOString()
    };
    void channelRef.current?.send({ type: "waiter-call", waiterCall: call });
    window.setTimeout(() => setWaiterCalled(false), 30000);
  }

  if (order) {
    return (
      <OrderTracking
        order={order}
        tableCode={tableCode}
        session={session}
        customerName={customerName}
        customerPhone={customerPhone}
        onOrderAgain={() => {
          setOrder(null);
          setMode("fixed");
          setCategory("Desayunos");
          setCart([]);
          setGeneralNotes("");
        }}
      />
    );
  }

  return (
    <main className="min-h-screen pb-32">
      <header className="premium-header relative overflow-hidden text-white">
        <div className="absolute -right-20 -top-36 h-80 w-80 rounded-full border-[64px] border-white/[0.035]" />
        <div className="absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-[var(--gold)]/40 to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-5 sm:px-6 sm:pb-10">
          <div className="flex items-center justify-between">
            <Brand compact inverse />
            <div className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-sm backdrop-blur">
              <span
                className={`mr-2 inline-block h-2 w-2 rounded-full ${
                  tableCode === "LLEVAR"
                    ? "bg-[#fbbf24] shadow-[0_0_0_4px_rgba(251,191,36,0.14)]"
                    : "bg-[#9acb8a] shadow-[0_0_0_4px_rgba(154,203,138,0.12)]"
                }`}
              />
              {tableCode === "LLEVAR" ? "Para llevar 🥡" : "Servicio en mesa"}
            </div>
          </div>
          <div className="mt-9 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow text-[var(--gold)]">
                Cocina hecha al momento
              </p>
              <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold leading-[0.98] sm:text-5xl">
                ¿Qué se te antoja hoy?
              </h1>
              <p className="mt-3 text-sm text-white/65">
                {tableCode === "LLEVAR"
                  ? customerName
                    ? `¡Hola, ${customerName}! Te llamamos en mostrador cuando esté listo.`
                    : "Arma tu pedido y te llamamos en mostrador cuando esté listo."
                  : `Ordena desde la mesa ${tableCode} y sigue tu pedido en tiempo real.`}
              </p>
            </div>
            <div className="hidden min-w-24 rounded-3xl border border-white/15 bg-white/10 px-5 py-4 text-center text-white shadow-xl backdrop-blur sm:block">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                {tableCode === "LLEVAR" ? "Llevar" : "Mesa"}
              </span>
              <strong className="mt-1 block font-display text-3xl">
                {tableCode === "LLEVAR" ? "🥡" : tableCode}
              </strong>
            </div>
            {session && session.status === "active" && (
              <div className="hidden min-w-32 rounded-3xl border border-white/15 bg-white/10 px-5 py-4 text-center text-white shadow-xl backdrop-blur sm:block">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                  Sesión
                </span>
                <strong className="mt-1 block font-display text-3xl">{sessionExisted ? "compartida" : "activa"}</strong>
              </div>
            )}
            {!session && !sessionLoading && (
              <div className="hidden min-w-32 rounded-3xl border border-white/15 bg-white/10 px-5 py-4 text-center text-white shadow-xl backdrop-blur sm:block">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/55">
                  Sin sesión
                </span>
                <strong className="mt-1 block font-display text-3xl">—</strong>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {sessionExisted && session && (
          <div className="animate-fade-in glass-card -mt-3 relative z-10 mb-4 flex items-center justify-between gap-3 rounded-2xl px-5 py-3.5">
            <div className="flex items-center gap-2.5 text-sm">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--gold-light)] text-xs font-bold text-[#5c3d2e]">👥</span>
              <span className="font-bold text-[var(--ink)]">Mesa compartida</span>
              <span className="text-[var(--muted)]">· Los pedidos se agrupan para cocina</span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-[var(--muted)]">Enviar juntos</span>
              <button
                role="switch"
                aria-checked={sendTogether}
                aria-label="Enviar pedidos juntos"
                className={`relative h-7 w-12 rounded-full transition-colors ${
                  sendTogether ? "bg-[var(--green)]" : "bg-[var(--line)]"
                }`}
                onClick={() => setSendTogether((v) => !v)}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    sendTogether ? "translate-x-5.5" : "translate-x-0.5"
                  }`}
                  style={{
                    transform: sendTogether ? "translateX(22px)" : "translateX(2px)"
                  }}
                />
              </button>
            </label>
          </div>
        )}

        <section className="paper -mt-4 relative z-10 rounded-2xl p-1.5" aria-label="Tipo de menú">
          <div className="grid grid-cols-2">
            {[
              ["fixed", "Paquetes y carta · 9 a 5"],
              ["lunch", "Comida corrida · 1 a 5"]
            ].map(([value, label]) => (
              <button
                key={value}
                className={`focus-ring rounded-xl px-3 py-3 text-sm font-bold transition ${
                  mode === value
                    ? "bg-[var(--paper)] text-[var(--brown)] shadow-sm"
                    : "text-[var(--muted)]"
                }`}
                onClick={() => setMode(value as MenuMode)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {mode === "lunch" ? (
          <LunchMenu
            menu={dailyMenu}
            loading={dailyMenuLoading}
            serviceMinutes={serviceMinutes}
            onAdd={addDailyMenu}
            onShowFixed={() => setMode("fixed")}
          />
        ) : (
          <>
            <div className="sticky top-0 z-20 -mx-4 mt-5 border-b border-[var(--line)]/50 bg-[var(--cream)]/90 px-4 pb-4 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--charcoal)] px-4 py-3 text-sm text-white">
                  <strong className="block">Paquetes de desayuno</strong>
                  <span className="text-white/70">Con fruta y café · 9:00 a.m.–1:00 p.m.</span>
                </div>
                <div className="rounded-2xl bg-[var(--brown)] px-4 py-3 text-sm text-white">
                  <strong className="block">Comidas a la carta</strong>
                  <span className="text-white/70">Todos los días · 1:00–5:00 p.m.</span>
                </div>
              </div>
              <label className="paper search-glow flex items-center gap-3 rounded-2xl px-4 py-3 transition-shadow">
                <Search size={19} aria-hidden="true" />
                <span className="sr-only">Buscar platillos</span>
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8b938f]"
                  placeholder="Busca chilaquiles, molletes, café…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                {query && (
                  <button aria-label="Limpiar búsqueda" onClick={() => setQuery("")}>
                    <X size={18} />
                  </button>
                )}
              </label>
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                {categories.map((item) => (
                  <button
                    key={item}
                    className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-bold category-pill ${
                      category === item
                        ? "bg-[var(--brown)] text-white shadow-sm"
                        : "border border-[var(--line)] bg-[var(--paper)]"
                    }`}
                    onClick={() => setCategory(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4 mt-3 flex items-end justify-between">
              <div>
              <p className="eyebrow text-[var(--brown)]">
                Hecho al momento
              </p>
                <h2 className="font-display text-3xl font-bold">{category}</h2>
              </div>
              <span className="text-sm text-[var(--muted)]">{visible.length} opciones</span>
            </div>

            {visible.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((product) => (
                   <ProductCard
                     key={product.id}
                     product={product}
                     promotion={promotionBySlug.get(product.id)}
                     currentMinutes={serviceMinutes}
                     onOpen={setSelected}
                     dailyMenu={dailyMenu}
                   />
                ))}
              </div>
            ) : (
              <div className="animate-fade-in paper rounded-3xl px-6 py-14 text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#f4dfb4]/60">
                  <Search className="text-[var(--brown)]" size={28} />
                </div>
                <h3 className="mt-5 font-display text-2xl font-bold">No encontramos ese platillo</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  Intenta con otro nombre o cambia de categoría.
                </p>
                <button
                  className="focus-ring mt-4 rounded-full bg-[var(--brown)] px-5 py-2.5 text-sm font-bold text-white"
                  onClick={() => { setQuery(""); setCategory("Favoritos"); }}
                >
                  Ver todo el menú
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {justAdded && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="toast-enter flex items-center gap-2.5 rounded-full bg-[var(--charcoal)] px-5 py-3.5 text-sm font-bold text-white shadow-2xl ring-1 ring-white/10">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--gold)]">
              <Check size={14} strokeWidth={3} className="text-[var(--charcoal)]" />
            </span>
            Producto agregado al pedido
          </div>
        </div>
      )}

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <button
            className="focus-ring flex w-full max-w-md items-center justify-between gap-3 rounded-full border border-white/20 bg-white/80 p-2 pl-5 text-left shadow-2xl backdrop-blur-xl transition-all hover:bg-white/90 active:scale-95"
            onClick={() => setCartOpen(true)}
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--brown)] font-bold text-white ${justAdded ? "animate-bounce-in" : ""}`}>
                {itemCount}
              </span>
              <span className="truncate text-sm font-bold text-[var(--ink)]">
                {sendTogether ? "Agregar al grupo" : "Ver mi pedido"}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-[var(--charcoal)] px-4 py-2.5 font-extrabold text-white">
              {money(subtotal)}
            </span>
          </button>
        </div>
      )}

      {/* Pending orders queue + Send all button */}
      {pendingOrders.length > 0 && (
        <div className="fixed inset-x-0 bottom-24 z-30 mx-auto max-w-xl space-y-2 px-3 sm:bottom-28">
          {pendingOrders.map((items, index) => {
            const orderTotal = calculateCartTotal(items);
            return (
              <div key={index} className="animate-fade-in glass-card flex items-center justify-between rounded-xl px-4 py-2.5 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--gold-light)] text-xs font-bold">{index + 1}</span>
                  <span className="truncate font-bold">{items.length} productos</span>
                </div>
                <div className="flex items-center gap-2">
                  <strong className="text-sm">{money(orderTotal)}</strong>
                  <button
                    className="focus-ring grid h-6 w-6 place-items-center rounded-full bg-[#f1d0ca] text-[#7a2c22]"
                    aria-label="Quitar pedido"
                    onClick={() => setPendingOrders((current) => current.filter((_, i) => i !== index))}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}
          <button
            className="focus-ring btn-press flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--green)] px-5 py-3.5 font-bold text-white shadow-xl transition hover:opacity-90 disabled:opacity-50"
            disabled={sending}
            onClick={sendAllTogether}
          >
            <ShoppingBag size={18} />
            {sending ? "Enviando…" : `Enviar todos (${pendingOrders.length}) a cocina`}
          </button>
        </div>
      )}

      {selected && (
        <ProductDialog
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={addItem}
          dailyMenu={dailyMenu}
          drinkFlavors={drinkFlavors}
        />
      )}
      {/* Botón flotante Llamar mesero */}
      <div className="fixed bottom-20 right-4 z-40 sm:bottom-24">
        <button
          className={`focus-ring flex items-center gap-2.5 rounded-full px-5 py-4 font-bold text-white shadow-2xl transition-all ${
            waiterCalled
              ? "bg-[var(--green)] cursor-default"
              : "bg-[var(--terracotta)] hover:bg-[#b03a2a] hover:scale-105 active:scale-95"
          }`}
          onClick={callWaiter}
          disabled={waiterCalled}
        >
          {waiterCalled ? (
            <>
              <Check size={20} strokeWidth={3} />
              <span className="text-sm">Mesero avisado</span>
            </>
          ) : (
            <>
              <Hand size={20} />
              <span className="text-sm">Llamar mesero</span>
            </>
          )}
        </button>
      </div>

      <Drawer open={cartOpen} onOpenChange={setCartOpen} showSwipeHandle>
        <DrawerContent className="rounded-t-[2.5rem] border-[var(--line)] bg-[var(--paper)] text-[var(--ink)]">
          <CartDrawer
            cart={cart}
            notes={generalNotes}
            sending={sending}
            onNotes={setGeneralNotes}
            onClose={() => setCartOpen(false)}
            onChange={setCart}
            onSubmit={submitOrder}
          />
        </DrawerContent>
      </Drawer>
    </main>
  );
}

function ProductCard({
  product,
  promotion,
  currentMinutes,
  onOpen,
  dailyMenu
}: {
  product: Product;
  promotion?: Promotion;
  currentMinutes: number | null;
  onOpen: (product: Product) => void;
  dailyMenu: DailyMenuConfig | null;
}) {
  const isComidaALaCarta = product.category === "Comidas a la carta";
  const available = isProductAvailable(
    product,
    currentMinutes,
    isComidaALaCarta ? dailyMenu?.availableFrom : undefined,
    isComidaALaCarta ? dailyMenu?.availableUntil : undefined
  );
  const effectiveFrom = isComidaALaCarta ? dailyMenu?.availableFrom : product.availableFrom;
  const effectiveUntil = isComidaALaCarta ? dailyMenu?.availableUntil : product.availableUntil;
  const promoPrice = promotion
    ? promotion.discountType === "percent"
      ? Math.max(0, Math.round(product.price * (1 - promotion.discountValue / 100)))
      : Math.max(0, product.price - promotion.discountValue)
    : null;
  const recommended =
    !product.popular && product.category === "Comidas a la carta" && !product.soldOut && available;
  return (
    <article className="paper menu-card group relative overflow-hidden rounded-[1.75rem]">
      <button
        className="focus-ring block w-full text-left disabled:opacity-65"
        onClick={() => onOpen(product)}
        disabled={product.soldOut || !available}
      >
        <div className="relative">
          <ProductImage src={product.image} alt={product.name} category={product.category} className="aspect-[4/3] w-full" />
          <span className="absolute left-3 top-3 rounded-full border border-white/40 bg-[#24211f]/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur-md">
            {product.category}
          </span>
          {promotion && (
            <span className="animate-pulse absolute right-3 top-3 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#7c2d00] shadow-[0_0_16px_rgba(245,158,11,0.5)]">
              ¡PROMO!
            </span>
          )}
          <div className="absolute bottom-2 left-3 flex flex-wrap gap-1.5">
            {product.popular && (
              <span className="rounded-full bg-[#f4dfb4]/95 px-2.5 py-1 text-[10px] font-bold uppercase text-[#694500] shadow-md">
                🔥 Popular
              </span>
            )}
            {recommended && (
              <span className="rounded-full bg-[#d9ebe1]/95 px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--green)] shadow-md">
                ⭐ Recomendado
              </span>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/25 to-transparent" />
        </div>
        <div className="p-5">
          <div className="mb-2 flex min-h-6 flex-wrap gap-2">
            {product.isNew && (
              <span className="rounded-full bg-[#d9ebe1] px-2 py-1 text-[10px] font-bold uppercase text-[var(--green)]">
                Nuevo
              </span>
            )}
            {product.packageIncludes?.length && (
              <span className="rounded-full bg-[#e4ece6] px-2 py-1 text-[10px] font-bold uppercase text-[var(--green)]">
                Paquete completo
              </span>
            )}
            {(product.optionGroups?.length || product.options?.length) && (
              <span className="rounded-full bg-[#efe3d7] px-2 py-1 text-[10px] font-bold uppercase text-[var(--brown)]">
                Personalizable
              </span>
            )}
            {product.soldOut && (
              <span className="rounded-full bg-[#f1d0ca] px-2 py-1 text-[10px] font-bold uppercase text-[#7a2c22]">
                Agotado
              </span>
            )}
            {!product.soldOut && !available && (
              <span className="rounded-full bg-[var(--mist)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--brown)]">
                Fuera de horario
              </span>
            )}
          </div>
          <h3 className="font-display text-[1.35rem] font-bold leading-[1.05]">{product.name}</h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--muted)]">
            {product.description}
          </p>
          {product.packageIncludes?.length && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {product.packageIncludes.map((item) => (
                <span
                  className="rounded-full border border-[var(--line)] bg-[var(--cream)] px-2.5 py-1 text-[11px] font-bold text-[var(--brown)]"
                  key={item}
                >
                  ✓ {item}
                </span>
              ))}
            </div>
          )}
          <div className="mt-5 flex items-center justify-between border-t border-[var(--line)]/65 pt-4">
            <p className="text-lg font-extrabold text-[var(--brown-dark)]">
              {promoPrice !== null ? money(promoPrice) : money(product.price)}
              {(promoPrice !== null || product.compareAt) && (
                <span className="ml-2 text-xs font-normal text-[#929a96] line-through">
                  {money(promoPrice !== null ? product.price : (product.compareAt ?? 0))}
                </span>
              )}
            </p>
            {product.soldOut ? (
              <span className="rounded-full bg-[#e0ddd6] px-3 py-2 text-xs font-bold text-[#777]">
                Agotado
              </span>
            ) : !available ? (
              <span className="rounded-full bg-[var(--mist)] px-3 py-2 text-xs font-bold text-[var(--brown)]">
                {effectiveFrom}–{effectiveUntil}
              </span>
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brown)] text-white shadow-lg transition group-hover:scale-105 group-hover:bg-[var(--brown-dark)] active:scale-90">
                <Plus size={20} />
              </span>
            )}
          </div>
        </div>
      </button>
    </article>
  );
}

function optionPrompt(product: Product) {
  if (product.id === "malteada" || product.id === "licuado") return "Elige tu sabor";
  if (product.id === "desayuno-combinado") return "¿Cómo quieres tus huevos?";
  if (product.id === "chilaquiles-pechuga") return "Elige cómo prefieres la pechuga";
  if (product.id === "taco-bistec-longaniza") return "Elige la preparación";
  if (product.id === "ensalada-fresca") return "Elige la proteína";
  if (product.id === "huevos-al-gusto") return "¿Cómo quieres tus huevos?";
  return "Elige salsa de tu preferencia";
}

function ProductDialog({
  product,
  onClose,
  onAdd,
  dailyMenu,
  drinkFlavors
}: {
  product: Product;
  onClose: () => void;
   onAdd: (
    product: Product,
    quantity: number,
    notes: string,
    option?: string,
    extras?: Array<{ name: string; price: number }>,
    priceModifier?: number
  ) => void;
  dailyMenu: DailyMenuConfig | null;
  drinkFlavors: Array<{drinkType: string; name: string; priceModifier: number}>;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [breakfastExtras, setBreakfastExtras] = useState<Array<{name: string; price: number; active: boolean}>>([]);
  const isBreakfast = product.category === "Desayunos";
  const isComidaALaCarta = product.category === "Comidas a la carta";

  // Load global breakfast extras for Desayunos products
  useEffect(() => {
    if (!isBreakfast) return;
    fetch("/api/breakfast-extras", { cache: "no-store" })
      .then((r) => r.json().catch(() => []))
      .then((data) => {
        if (Array.isArray(data)) setBreakfastExtras(data.filter((e: Record<string, unknown>) => e.active !== false));
      })
      .catch(() => setBreakfastExtras([]));
  }, [isBreakfast]);

  // Merge product extras + global breakfast extras
  const allExtras = useMemo(() => {
    if (isBreakfast && breakfastExtras.length > 0) {
      // Global breakfast extras take priority
      const globalNames = new Set(breakfastExtras.map((e) => e.name));
      const productExtras = (product.extrasConfig || []).filter((e) => e.active !== false && !globalNames.has(e.name));
      return [...breakfastExtras.map((e) => ({ name: e.name, price: e.price, active: true })), ...productExtras];
    }
    return (product.extrasConfig || []).filter((e) => e.active !== false);
  }, [isBreakfast, breakfastExtras, product.extrasConfig]);
  // Map product IDs to drink flavor types
  const drinkTypeMap: Record<string, string> = {
    cafe: "cafe",
    malteada: "malteada",
    licuado: "licuado",
    "agua-fruta": "agua-fruta"
  };
  const drinkType = drinkTypeMap[product.id];
  const dynamicFlavors = useMemo(() => {
    if (!drinkType || !drinkFlavors.length) return null;
    const flavors = drinkFlavors.filter((f) => f.drinkType === drinkType);
    if (!flavors.length) return null;
    return flavors;
  }, [drinkType, drinkFlavors]);

  const groups = useMemo(() => {
    // If this is a drink with dynamic flavors, use those instead of hardcoded options
    if (dynamicFlavors) {
      const flavorChoices = dynamicFlavors.map((f) => f.name);
      const flavorPrices = dynamicFlavors.map((f) => f.priceModifier);
      return [{
        id: "sabor",
        label: "Elige tu sabor",
        choices: flavorChoices,
        choicePrices: flavorPrices.some((p) => p > 0) ? flavorPrices : undefined,
        required: true
      }];
    }
    const baseGroups = product.optionGroups || (
      product.options?.length
        ? [{ id: "opcion", label: optionPrompt(product), choices: product.options, required: true }]
        : []
    );
    return isComidaALaCarta
      ? resolveDailyCourseGroups(baseGroups, dailyMenu?.courses)
      : baseGroups;
  }, [dynamicFlavors, isComidaALaCarta, product, dailyMenu?.courses]);
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((group) => [group.id, group.choices[0] || ""]))
  );
  const selectionsSynced = useRef(false);
  useEffect(() => {
    if (!selectionsSynced.current) {
      selectionsSynced.current = true;
      return;
    }
    setSelections((prev) =>
      Object.fromEntries(
        groups.map((group) => [
          group.id,
          prev[group.id] && group.choices.includes(prev[group.id])
            ? prev[group.id]
            : group.choices[0] || ""
        ])
      )
    );
  }, [groups]);
  const hasCompleteSelection = groups.every(
    (group) => group.choices.length > 0 && Boolean(selections[group.id])
  );
  const priceModifier = useMemo(() => {
    // Check both product.optionGroups and dynamic groups (drink flavors)
    const allGroups = groups;
    const pricedGroup = allGroups.find((g) => g.choicePrices && g.choicePrices.length > 0);
    if (!pricedGroup) return 0;
    const selectedIdx = pricedGroup.choices.indexOf(selections[pricedGroup.id]);
    if (selectedIdx < 0) return 0;
    return pricedGroup.choicePrices?.[selectedIdx] ?? 0;
  }, [groups, selections]);
  const selectionSummary = groups
    .map((group) => {
      const shortLabel =
        group.id === "salsa"
          ? "Salsa"
          : group.id === "queso"
            ? "Queso"
            : group.id === "huevos"
              ? "Huevos"
              : group.id === "plato"
                ? "Plato"
                : group.id === "bebida"
                  ? "Bebida"
                  : group.id === "pechuga"
                    ? "Pechuga"
                    : group.id === "opcion"
                      ? "Sabor"
                      : group.id === "primer-tiempo"
                        ? "Primer tiempo"
                        : group.id === "acompanamiento"
                          ? "Acompañamiento"
                          : group.id === "agua"
                            ? "Agua"
                            : group.id === "cafe-tipo"
                              ? "Tipo"
                              : "Opción";
      return `${shortLabel}: ${selections[group.id]}`;
    })
    .join(" · ")
    .slice(0, 80);
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end overflow-hidden bg-[#171411]/70 backdrop-blur-[3px] lg:items-center lg:justify-center lg:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-title"
        className="animate-scale-in max-h-[94dvh] w-full overflow-x-hidden overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] shadow-2xl lg:max-w-5xl lg:rounded-[2rem]"
      >
        <div className="relative grid min-w-0 lg:grid-cols-[0.9fr_1.1fr]">
          <button
            className="focus-ring absolute left-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-2xl bg-white/90 shadow-lg backdrop-blur"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X />
          </button>
          <ProductImage
            src={product.image}
            alt={product.name}
            category={product.category}
            className="h-56 w-full sm:h-72 lg:h-full lg:min-h-[34rem]"
          />
          <div className="min-w-0 p-5 sm:p-7 lg:flex lg:min-h-[34rem] lg:flex-col lg:justify-center lg:p-10">
            <p className="eyebrow mb-3 text-[var(--brown)]">{product.category}</p>
            <h2 id="product-title" className="break-words font-display text-3xl font-bold leading-none sm:text-4xl">
              {product.name}
            </h2>
            <p className="mt-3 leading-6 text-[var(--muted)]">{product.description}</p>
            {product.packageIncludes?.length && (
              <div className="mt-5 rounded-2xl border border-[#c9d7ca] bg-[#edf3ec] p-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--green)]">
                  Tu paquete ya incluye
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.packageIncludes.map((item) => (
                    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold" key={item}>
                      ✓ {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {groups.map((group, groupIndex) => (
              <fieldset className="mt-5" key={group.id}>
                <legend className="flex items-center gap-2 font-bold">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--brown)] text-xs text-white">
                    {groupIndex + 1}
                  </span>
                  {group.label}
                </legend>
                <p className="mb-3 ml-8 text-xs text-[var(--muted)]">
                  Selecciona 1 {group.required !== false && "· Obligatorio"}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {group.choices.map((item) => (
                    <label
                      key={item}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                        selections[group.id] === item
                          ? "border-[var(--brown)] bg-[#eee2d8] shadow-sm"
                          : "border-[var(--line)] hover:bg-[var(--cream)]"
                      }`}
                    >
                      {item}
                      <input
                        type="radio"
                        name={group.id}
                        value={item}
                        checked={selections[group.id] === item}
                        onChange={() =>
                          setSelections((current) => ({ ...current, [group.id]: item }))
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <label className="mt-5 block text-sm font-bold">
              Observaciones
              <textarea
                className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[var(--line)] bg-white p-3 font-normal outline-none focus:border-[var(--green)]"
                maxLength={180}
                placeholder="Ej. Sin cebolla, salsa aparte…"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
            {allExtras.length > 0 && (
              <fieldset className="mt-5 rounded-2xl border border-[var(--line)] bg-[#fbf7f1] p-4">
                <legend className="font-display text-xl font-bold">
                  {isBreakfast ? "Extras de desayuno" : "Extras con costo"}
                </legend>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Puedes sumar extras y el precio se actualizará al momento.
                </p>
                <div className="mt-3 grid gap-2">
                  {allExtras.map((extra) => {
                      const selected = selectedExtras.includes(extra.name);
                      return (
                        <label
                          className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                            selected
                              ? "border-[var(--brown)] bg-[#f4e6d8] shadow-sm"
                              : "border-[var(--line)] bg-white hover:bg-[var(--cream)]"
                          }`}
                          key={extra.name}
                        >
                          <span className="flex items-center gap-2">
                            <span
                              className={`grid h-5 w-5 place-items-center rounded border-2 ${
                                selected
                                  ? "border-[var(--brown)] bg-[var(--brown)] text-white"
                                  : "border-[var(--line)]"
                              }`}
                            >
                              {selected && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span className="font-medium">{extra.name}</span>
                          </span>
                          <strong className="text-sm text-[var(--brown)]">+{money(extra.price)}</strong>
                          <input
                            checked={selected}
                            type="checkbox"
                            className="sr-only"
                            onChange={() =>
                              setSelectedExtras((current) =>
                                selected
                                  ? current.filter((item) => item !== extra.name)
                                  : [...current, extra.name]
                              )
                            }
                          />
                        </label>
                      );
                    })}
                </div>
              </fieldset>
            )}
            <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]">
              <div className="flex items-center justify-center rounded-xl border border-[var(--line)]">
                <button
                  className="focus-ring grid h-12 w-11 place-items-center"
                  aria-label="Restar"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                >
                  <Minus size={18} />
                </button>
                <strong className="w-8 text-center">{quantity}</strong>
                <button
                  className="focus-ring grid h-12 w-11 place-items-center text-[var(--terracotta)]"
                  aria-label="Sumar"
                  onClick={() => setQuantity((value) => Math.min(10, value + 1))}
                >
                  <Plus size={18} />
                </button>
              </div>
              <button
                className="focus-ring flex flex-1 items-center justify-between rounded-xl bg-[var(--brown)] px-5 font-bold text-white shadow-lg transition hover:bg-[var(--brown-dark)] disabled:cursor-not-allowed disabled:opacity-45"
                disabled={isComidaALaCarta && !hasCompleteSelection}
                onClick={() => {
                  const chosenExtras = allExtras
                    .filter((extra) => selectedExtras.includes(extra.name))
                    .map((extra) => ({ name: extra.name, price: extra.price }));
                  onAdd(
                    product,
                    quantity,
                    notes.trim(),
                    selectionSummary || undefined,
                    chosenExtras.length > 0 ? chosenExtras : undefined,
                    priceModifier
                  );
                  setSelectedExtras([]);
                }}
              >
                <span>Agregar</span>
                <span>
                  {money(
                    (product.price + priceModifier +
                      allExtras
                        .filter((extra) => selectedExtras.includes(extra.name))
                        .reduce((sum, extra) => sum + extra.price, 0)) *
                    quantity
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CartDrawer({
  cart,
  notes,
  sending,
  onNotes,
  onClose,
  onChange,
  onSubmit
}: {
  cart: CartItem[];
  notes: string;
  sending: boolean;
  onNotes: (notes: string) => void;
  onClose: () => void;
  onChange: (items: CartItem[]) => void;
  onSubmit: () => void;
}) {
  const subtotal = calculateCartTotal(cart);
  const clearCart = () => {
    if (cart.length > 0 && window.confirm("¿Vaciar todo el pedido?")) {
      onChange([]);
      onClose();
    }
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 pb-4 pt-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
            Revisa antes de enviar
          </p>
          <DrawerTitle className="font-display text-2xl font-bold text-[var(--ink)]">
            Mi pedido
          </DrawerTitle>
        </div>
        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button
              className="focus-ring flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold text-[#8a3b30] transition hover:bg-[#f8e8e2] active:scale-95"
              onClick={clearCart}
            >
              <Trash2 size={14} /> Limpiar
            </button>
          )}
          <button
            className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-[#eee8dc] text-[var(--ink)] transition active:scale-90"
            aria-label="Cerrar pedido"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
        <ul className="divide-y divide-[var(--line)]/70">
          {cart.map((item, index) => (
            <li key={`${item.productId}-${index}`} className="flex gap-3 py-4 first:pt-1 last:pb-1">
              <ProductImage
                src={item.image}
                alt={item.name}
                className="h-20 w-20 shrink-0 rounded-2xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <h3 className="font-bold leading-tight">{item.name}</h3>
                  <strong className="shrink-0">{money(cartItemTotal(item))}</strong>
                </div>
                {item.option && (
                  <p className="mt-1 text-xs font-medium text-[var(--brown)]">{item.option}</p>
                )}
                {item.extras && item.extras.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {item.extras.map((extra, extraIndex) => (
                      <p key={extraIndex} className="text-xs text-[var(--terracotta)]">
                        + {extra.name} ({money(extra.price)})
                      </p>
                    ))}
                  </div>
                )}
                <input
                  className="mt-2 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--green)]"
                  placeholder="Nota para este platillo…"
                  maxLength={250}
                  value={item.notes || ""}
                  onChange={(event) => {
                    const next = [...cart];
                    next[index] = { ...item, notes: event.target.value };
                    onChange(next);
                  }}
                />
                <div className="mt-3 flex items-center gap-3">
                  <button
                    className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] transition active:scale-90"
                    aria-label={`Restar ${item.name}`}
                    onClick={() => {
                      const next = [...cart];
                      if (item.quantity === 1) next.splice(index, 1);
                      else next[index] = { ...item, quantity: item.quantity - 1 };
                      onChange(next);
                    }}
                  >
                    <Minus size={16} />
                  </button>
                  <strong className="min-w-6 text-center">{item.quantity}</strong>
                  <button
                    className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] bg-white text-[var(--ink)] transition active:scale-90"
                    aria-label={`Sumar ${item.name}`}
                    onClick={() => {
                      const next = [...cart];
                      next[index] = { ...item, quantity: Math.min(10, item.quantity + 1) };
                      onChange(next);
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <label className="mt-4 block text-sm font-bold">
          Observaciones generales
          <textarea
            className="mt-2 min-h-20 w-full resize-none rounded-2xl border border-[var(--line)] bg-white p-3 font-normal outline-none transition focus:border-[var(--green)]"
            maxLength={250}
            placeholder="Algo que debamos saber…"
            value={notes}
            onChange={(event) => onNotes(event.target.value)}
          />
        </label>
      </div>
      <div className="border-t border-[var(--line)] p-4 pb-6">
        <div className="mb-4 flex items-center justify-between text-lg">
          <span className="text-[var(--muted)]">Total estimado</span>
          <strong className="text-xl">{money(subtotal)}</strong>
        </div>
        <button
          className="focus-ring flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 py-4 font-semibold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={sending || cart.length === 0}
          onClick={onSubmit}
        >
          {sending ? (
            "Enviando…"
          ) : (
            <>
              <ShoppingBag size={20} />
              Enviar pedido
            </>
          )}
        </button>
      </div>
    </>
  );
}

function OrderTracking({
  order,
  tableCode,
  session,
  customerName,
  customerPhone,
  onOrderAgain
}: {
  order: Order;
  tableCode: string;
  session: TableSession | null;
  customerName?: string;
  customerPhone?: string;
  onOrderAgain: () => void;
}) {
  const steps = ["accepted", "preparing", "ready", "delivered"] as const;
  const current = steps.indexOf(
    order.status === "cancelled" || order.status === "sent"
      ? "accepted"
      : order.status
  );
  const trackingTitle =
    order.status === "accepted" || order.status === "preparing"
      ? "Tu pedido ya está en cocina"
      : order.status === "ready"
        ? "Tu pedido está listo para servir"
        : order.status === "delivered"
          ? "Tu pedido fue entregado"
          : "Este pedido fue cancelado";
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-6">
      <Brand />
      <section className="paper mt-8 overflow-hidden rounded-[2rem]">
        <div className="bg-[var(--green)] px-6 py-8 text-white">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#d9b65d] text-[var(--green)]">
            <Check size={30} strokeWidth={3} />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#e5cd90]">
            Pedido enviado
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold">{trackingTitle}</h1>
          <div className="mt-5 flex items-center gap-4">
            <StatusPill status={order.status} />
            <span className="text-sm">Folio {order.folio}</span>
          </div>
          {tableCode === "LLEVAR" && (customerName || order.customerName) && (
            <p className="mt-4 font-display text-2xl font-bold text-[#ffd166]">
              👤 {customerName || order.customerName}
              {customerPhone ? ` · 📞 ${customerPhone}` : ""}
            </p>
          )}
          {tableCode === "LLEVAR" && (
            <div className="mt-4 rounded-xl bg-white/10 p-3 backdrop-blur">
              <p className="text-xs text-white/70">
                📱 Guarda esta página o compártela para seguir tu pedido.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  className="focus-ring rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30"
                  onClick={() => {
                    const url = `${window.location.origin}/seguimiento/${order.folio}`;
                    void navigator.clipboard.writeText(url);
                    window.alert("Link copiado. Pégalo en WhatsApp o donde quieras.");
                  }}
                >
                  📋 Copiar link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`🍽️ Mi pedido en Imperio · ${order.folio}\n${typeof window !== "undefined" ? window.location.origin : ""}/seguimiento/${order.folio}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                >
                  📱 WhatsApp
                </a>
              </div>
            </div>
          )}
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between rounded-2xl bg-[#eee8dc] p-4">
            <span>
              <span className="block text-xs uppercase text-[var(--muted)]">
                {tableCode === "LLEVAR" ? "Para llevar" : "Mesa"}
              </span>
              <strong className="text-2xl">{tableCode === "LLEVAR" ? "🥡" : tableCode}</strong>
            </span>
            <span className="text-right">
              <span className="block text-xs uppercase text-[var(--muted)]">Total</span>
              <strong className="text-xl">{money(order.total)}</strong>
            </span>
          </div>
          {order.status === "cancelled" ? (
            <div className="mt-6 rounded-2xl bg-[#f1d0ca] p-4 text-[#7a2c22]">
              Este pedido fue cancelado. Solicita ayuda al personal.
            </div>
          ) : (
            <ol className="mt-7 space-y-0">
              {steps.map((step, index) => (
                <li className={`flex gap-4 ${index === current ? "step-active" : ""}`} key={step}>
                  <div className="flex flex-col items-center">
                    <span
                      className={`step-circle grid h-8 w-8 place-items-center rounded-full ${
                        index <= current
                          ? "bg-[var(--green)] text-white"
                          : "border-2 border-[var(--line)] bg-white"
                      }`}
                    >
                      {index < current ? <Check size={16} /> : index + 1}
                    </span>
                    {index < steps.length - 1 && (
                      <span
                        className={`h-9 w-0.5 ${
                          index < current ? "bg-[var(--green)]" : "bg-[var(--line)]"
                        }`}
                      />
                    )}
                  </div>
                  <div className="pt-1">
                    <strong className="capitalize">
                      {
{
                           accepted: "Confirmado y enviado a cocina",
                          preparing: "Preparando",
                          ready: "Listo para servir",
                          delivered: "Entregado"
                        }[step]
                      }
                    </strong>
                    {index === current && (
                      <p className="text-xs text-[var(--muted)]">Estado actual</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-7 flex items-center gap-2 rounded-xl bg-[#f4dfb4]/60 p-3 text-sm">
            <Clock3 size={18} />
            El estado se actualiza automáticamente.
          </div>
          {session && session.status === "active" && (
            <div className="mt-4 rounded-2xl bg-[#eee8dc] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase text-[var(--muted)]">Mesa en sesión</span>
                <span className="text-xs font-bold text-[var(--brown)]">#{session.id?.slice(0, 8)}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Puedes seguir ordenando y acumularemos todo en una sola cuenta.
              </p>
            </div>
          )}
          {(order.status === "delivered" || order.status === "cancelled") && (
            <button
              className="focus-ring mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--terracotta)] px-5 font-bold text-white"
              onClick={onOrderAgain}
            >
              <Plus size={20} />
              {order.status === "delivered" ? "Pedir algo más" : "Volver al menú"}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}

function LunchMenu({
  menu,
  loading,
  serviceMinutes,
  onAdd,
  onShowFixed
}: {
  menu: DailyMenuConfig | null;
  loading: boolean;
  serviceMinutes: number | null;
  onAdd: (
    menu: DailyMenuConfig,
    selections: Record<string, string>,
    quantity: number,
    extras: Array<{ name: string; price: number }>
  ) => void;
  onShowFixed: () => void;
}) {
  if (loading) {
    return (
      <section className="paper mt-6 overflow-hidden rounded-[2rem]">
        <div className="bg-[var(--brown)]/10 px-6 py-7">
          <div className="skeleton mb-4 h-6 w-36" />
          <div className="skeleton mb-2 h-10 w-80" />
          <div className="skeleton h-5 w-44" />
        </div>
        <div className="space-y-4 p-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3 border-b border-[var(--line)] py-4 last:border-0">
              <div className="skeleton h-6 w-32" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="skeleton h-12 rounded-xl" />
                <div className="skeleton h-12 rounded-xl" />
              </div>
            </div>
          ))}
          <div className="skeleton mt-4 h-14 w-full rounded-xl" />
        </div>
      </section>
    );
  }

  if (!menu || !menu.availableToday) {
    return (
      <section className="animate-fade-in paper mt-6 rounded-[2rem] p-7 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#f4dfb4]/60">
          <Clock3 className="text-[var(--terracotta)]" size={30} />
        </div>
        <h2 className="mt-5 font-display text-3xl font-bold">Hoy no hay comida corrida</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Puedes ordenar cualquiera de los productos del menú fijo.
        </p>
        <button
          className="focus-ring btn-press mt-5 rounded-2xl bg-[var(--green)] px-6 py-3 font-bold text-white shadow-md transition hover:opacity-90"
          onClick={onShowFixed}
        >
          Ver menú fijo
        </button>
      </section>
    );
  }

  return (
    <ConfiguredLunchMenu
      key={`${menu.serviceDate}-${menu.updatedAt || ""}`}
      menu={menu}
      serviceMinutes={serviceMinutes}
      onAdd={onAdd}
    />
  );
}

function ConfiguredLunchMenu({
  menu,
  serviceMinutes,
  onAdd
}: {
  menu: DailyMenuConfig;
  serviceMinutes: number | null;
  onAdd: (
    menu: DailyMenuConfig,
    selections: Record<string, string>,
    quantity: number,
    extras: Array<{ name: string; price: number }>
  ) => void;
}) {
  const courses = dailyCourseOrder.map(
    (course) => [course, getCourseOptions(course, menu.courses[course])] as const
  );
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      dailyCourseOrder.map((course) => {
        const options = getCourseOptions(course, menu.courses[course]);
        return [course, options.length === 1 ? options[0] : ""];
      })
    )
  );
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const hasCompleteSelection = courses.every(
    ([course, options]) => options.length > 0 && Boolean(selections[course])
  );
  const isOpen =
    serviceMinutes === null ||
    (serviceMinutes >= timeToMinutes(menu.availableFrom) &&
      serviceMinutes < timeToMinutes(menu.availableUntil));
  const extras = menu.extras || [];
  const chosenExtras = extras.filter((extra) => selectedExtras.includes(extra.name));
  const extraTotal = chosenExtras.reduce((sum, extra) => sum + extra.price, 0);
  const finalUnitPrice = menu.price + extraTotal;

  return (
    <section className="mt-6">
      <div className="paper overflow-hidden rounded-[2rem]">
        <div className="bg-[var(--brown)] px-6 py-7 text-white">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            {isOpen ? "Disponible ahora" : "Disponible hoy de 1:00 a 5:00 p.m."}
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold">Comida corrida del día</h2>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Clock3 size={16} /> {menu.availableFrom}–{menu.availableUntil}
          </p>
          <p className="mt-5 text-3xl font-bold">{money(menu.price)}</p>
        </div>
        <div className="p-6">
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#f4dfb4]/60 p-4 text-sm">
            <Sparkles className="shrink-0 text-[var(--brown)]" size={20} />
            Elige una opción de cada tiempo. Cocina y el mesero recibirán tus elecciones.
          </div>
          {courses.map(([course, options]) => (
            <fieldset className="border-b border-[var(--line)] py-4 last:border-0" key={course}>
              <legend className="font-display text-xl font-bold">
                {course}
                <span className="ml-2 font-sans text-xs font-bold text-[var(--muted)]">
                  Elige 1 de {options.length}
                </span>
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {options.map((option) => (
                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                      selections[course] === option
                        ? "border-[var(--green)] bg-[#e7efe9] shadow-sm"
                        : "border-[var(--line)] hover:bg-[var(--cream)]"
                    }`}
                    key={option}
                  >
                    <span>{option}</span>
                    <input
                      checked={selections[course] === option}
                      name={`daily-${course}`}
                      type="radio"
                      value={option}
                      onChange={() =>
                        setSelections((current) => ({ ...current, [course]: option }))
                      }
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          {extras.length > 0 && (
            <fieldset className="mt-5 rounded-2xl border border-[var(--line)] bg-[#fbf7f1] p-4">
              <legend className="font-display text-xl font-bold">Extras con costo</legend>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Puedes sumar extras y el precio se actualizará al momento.
              </p>
              <div className="mt-3 grid gap-2">
                {extras.map((extra) => {
                  const selected = selectedExtras.includes(extra.name);
                  return (
                    <label
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 transition ${
                        selected
                          ? "border-[var(--brown)] bg-[#f4e6d8] shadow-sm"
                          : "border-[var(--line)] bg-white hover:bg-[var(--cream)]"
                      }`}
                      key={extra.name}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={`grid h-5 w-5 place-items-center rounded border-2 ${
                            selected
                              ? "border-[var(--brown)] bg-[var(--brown)] text-white"
                              : "border-[var(--line)]"
                          }`}
                        >
                          {selected && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="font-medium">{extra.name}</span>
                      </span>
                      <strong className="text-sm text-[var(--brown)]">+{money(extra.price)}</strong>
                      <input
                        checked={selected}
                        type="checkbox"
                        className="sr-only"
                        onChange={() =>
                          setSelectedExtras((current) =>
                            selected
                              ? current.filter((item) => item !== extra.name)
                              : [...current, extra.name]
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>
              {extraTotal > 0 && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-[#f4e6d8] px-4 py-2.5 text-sm">
                  <span className="font-bold text-[var(--brown)]">Total de extras</span>
                  <strong className="text-[var(--brown)]">+{money(extraTotal)}</strong>
                </div>
              )}
            </fieldset>
          )}
          <div className="mt-6 grid gap-3 sm:grid-cols-[auto_1fr]">
            <div className="flex items-center justify-center rounded-xl border border-[var(--line)]">
              <button
                className="focus-ring grid h-14 w-12 place-items-center"
                aria-label="Restar comida corrida"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                <Minus size={18} />
              </button>
              <strong className="w-10 text-center">{quantity}</strong>
              <button
                className="focus-ring grid h-14 w-12 place-items-center text-[var(--brown)]"
                aria-label="Sumar comida corrida"
                onClick={() => setQuantity((value) => Math.min(10, value + 1))}
              >
                <Plus size={18} />
              </button>
            </div>
            <button
              className="focus-ring flex min-h-14 items-center justify-between rounded-xl bg-[var(--brown)] px-5 font-bold text-white transition hover:bg-[var(--brown-dark)] disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!isOpen || !hasCompleteSelection}
              onClick={() => onAdd(menu, selections, quantity, chosenExtras)}
            >
              <span>
                {!isOpen
                  ? "Disponible de 1 a 5"
                  : hasCompleteSelection
                    ? "Agregar al pedido"
                    : "Elige una opción de cada tiempo"}
              </span>
              <span>{money(finalUnitPrice * quantity)}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}