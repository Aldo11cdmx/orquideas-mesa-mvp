"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  Clock3,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  X
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductImage } from "@/components/product-image";
import { StatusPill } from "@/components/status-pill";
import { categories, demoLunch, money, products } from "@/lib/menu";
import { connectOrderChannel, readDemoOrders, saveDemoOrder } from "@/lib/order-store";
import type { CartItem, Order, Product } from "@/lib/types";

type MenuMode = "fixed" | "lunch";

export function MenuClient({ tableCode }: { tableCode: string }) {
  const [mode, setMode] = useState<MenuMode>("fixed");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Populares");
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [sending, setSending] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  const channelRef = useRef<ReturnType<typeof connectOrderChannel> | null>(null);

  useEffect(() => {
    channelRef.current = connectOrderChannel(({ type, order: incoming }) => {
      if (type === "status" && incoming.id === order?.id) {
        setOrder((current) =>
          !current || +new Date(incoming.updatedAt) >= +new Date(current.updatedAt)
            ? incoming
            : current
        );
      }
    });
    return () => channelRef.current?.close();
  }, [order?.id]);

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
    if (!order.accessToken) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(
        `/api/orders/${order.id}?token=${encodeURIComponent(order.accessToken!)}`
      );
      if (response.ok) setOrder(await response.json());
    }, 6000);
    return () => window.clearInterval(timer);
  }, [order]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return products.filter((product) => {
      const matchesQuery =
        !normalized ||
        `${product.name} ${product.description}`.toLocaleLowerCase("es").includes(normalized);
      const matchesCategory =
        category === "Populares" ? product.popular : product.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [category, query]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  function addItem(product: Product, quantity: number, notes: string, option?: string) {
    setCart((current) => [
      ...current,
      {
        productId: product.id,
        name: product.name,
        unitPrice: product.price,
        quantity,
        notes,
        option,
        image: product.image
      }
    ]);
    setSelected(null);
  }

  async function submitOrder() {
    if (sending || cart.length === 0) return;
    if (!window.confirm(`¿Enviar este pedido de ${money(subtotal)} a cocina?`)) return;
    setSending(true);
    const idempotencyKey = crypto.randomUUID();
    let created: Order;
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tableCode,
          items: cart.map(({ productId, quantity, notes, option }) => ({
            productId,
            quantity,
            notes,
            option
          })),
          notes: generalNotes,
          idempotencyKey
        })
      });
      if (!response.ok) throw new Error("Supabase schema not ready");
      created = await response.json();
    } catch {
      const now = new Date().toISOString();
      created = {
        id: idempotencyKey,
        folio: `D-${idempotencyKey.slice(-4).toUpperCase()}`,
        tableCode,
        status: "sent",
        items: cart,
        notes: generalNotes,
        subtotal,
        total: subtotal,
        createdAt: now,
        updatedAt: now,
        source: "demo"
      };
      saveDemoOrder(created);
    }
    setOrder(created);
    setCartOpen(false);
    setCart([]);
    await channelRef.current?.send({ type: "new", order: created });
    setSending(false);
  }

  if (order) {
    return <OrderTracking order={order} tableCode={tableCode} />;
  }

  return (
    <main className="min-h-screen pb-28">
      <header className="bg-[var(--paper)]">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6">
          <div className="flex items-center justify-between">
            <Brand compact />
            <div className="rounded-full bg-[#e3eee8] px-3 py-2 text-xs font-bold text-[var(--green)]">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3a8b65]" />
              Servicio en mesa
            </div>
          </div>
          <div className="mt-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--terracotta)]">
                Bienvenido
              </p>
              <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">
                Estás ordenando desde la mesa {tableCode}
              </h1>
            </div>
            <div className="hidden rounded-2xl bg-[var(--green)] px-5 py-3 text-center text-white sm:block">
              <span className="text-xs uppercase tracking-wider">Mesa</span>
              <strong className="block text-2xl">{tableCode}</strong>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="mt-5 rounded-2xl bg-[#e9e2d5] p-1" aria-label="Tipo de menú">
          <div className="grid grid-cols-2">
            {[
              ["fixed", "Menú fijo"],
              ["lunch", "Comida corrida"]
            ].map(([value, label]) => (
              <button
                key={value}
                className={`focus-ring rounded-xl px-3 py-3 text-sm font-bold transition ${
                  mode === value
                    ? "bg-[var(--paper)] text-[var(--green)] shadow-sm"
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
          <LunchMenu />
        ) : (
          <>
            <div className="sticky top-0 z-20 -mx-4 mt-5 bg-[var(--cream)]/95 px-4 pb-3 pt-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
              <label className="paper flex items-center gap-3 rounded-2xl px-4 py-3">
                <Search size={19} aria-hidden="true" />
                <span className="sr-only">Buscar platillos</span>
                <input
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8b938f]"
                  placeholder="Busca hamburguesas, boneless…"
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
                    className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                      category === item
                        ? "bg-[var(--green)] text-white"
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
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--terracotta)]">
                  Hecho al momento
                </p>
                <h2 className="font-display text-3xl font-bold">{category}</h2>
              </div>
              <span className="text-sm text-[var(--muted)]">{visible.length} opciones</span>
            </div>

            {visible.length ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((product) => (
                  <ProductCard key={product.id} product={product} onOpen={setSelected} />
                ))}
              </div>
            ) : (
              <div className="paper rounded-3xl px-6 py-14 text-center">
                <Search className="mx-auto text-[var(--terracotta)]" size={34} />
                <h3 className="mt-4 font-display text-2xl font-bold">No encontramos ese platillo</h3>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Intenta con otro nombre o cambia de categoría.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-5">
          <button
            className="focus-ring mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-[var(--terracotta)] px-5 py-4 font-bold text-white shadow-2xl"
            onClick={() => setCartOpen(true)}
          >
            <span className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20">
                {itemCount}
              </span>
              Ver mi pedido
            </span>
            <span>{money(subtotal)}</span>
          </button>
        </div>
      )}

      {selected && (
        <ProductDialog
          product={selected}
          onClose={() => setSelected(null)}
          onAdd={addItem}
        />
      )}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          notes={generalNotes}
          sending={sending}
          onNotes={setGeneralNotes}
          onClose={() => setCartOpen(false)}
          onChange={setCart}
          onSubmit={submitOrder}
        />
      )}
    </main>
  );
}

function ProductCard({
  product,
  onOpen
}: {
  product: Product;
  onOpen: (product: Product) => void;
}) {
  return (
    <article className="paper group overflow-hidden rounded-3xl">
      <button
        className="focus-ring block w-full text-left"
        onClick={() => onOpen(product)}
        disabled={product.soldOut}
      >
        <ProductImage src={product.image} alt="" className="aspect-[16/10] w-full" />
        <div className="p-4">
          <div className="mb-2 flex min-h-6 flex-wrap gap-2">
            {product.popular && (
              <span className="rounded-full bg-[#f4dfb4] px-2 py-1 text-[10px] font-bold uppercase text-[#694500]">
                Popular
              </span>
            )}
            {product.isNew && (
              <span className="rounded-full bg-[#d9ebe1] px-2 py-1 text-[10px] font-bold uppercase text-[var(--green)]">
                Nuevo
              </span>
            )}
            {product.soldOut && (
              <span className="rounded-full bg-[#f1d0ca] px-2 py-1 text-[10px] font-bold uppercase text-[#7a2c22]">
                Agotado
              </span>
            )}
          </div>
          <h3 className="font-display text-xl font-bold leading-tight">{product.name}</h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--muted)]">
            {product.description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <p className="font-bold">
              {money(product.price)}
              {product.compareAt && (
                <span className="ml-2 text-xs font-normal text-[#929a96] line-through">
                  {money(product.compareAt)}
                </span>
              )}
            </p>
            {product.soldOut ? (
              <span className="rounded-full bg-[#e0ddd6] px-3 py-2 text-xs font-bold text-[#777]">
                Agotado
              </span>
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--terracotta)] text-white transition group-hover:scale-105">
                <Plus size={20} />
              </span>
            )}
          </div>
        </div>
      </button>
    </article>
  );
}

function ProductDialog({
  product,
  onClose,
  onAdd
}: {
  product: Product;
  onClose: () => void;
  onAdd: (product: Product, quantity: number, notes: string, option?: string) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [option, setOption] = useState(product.options?.[0]);
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-[#10211b]/55 sm:items-center sm:justify-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-title"
        className="animate-pop max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-[var(--paper)] sm:max-w-3xl sm:rounded-[2rem]"
      >
        <div className="relative grid sm:grid-cols-[0.85fr_1.15fr]">
          <button
            className="focus-ring absolute left-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/90"
            aria-label="Cerrar"
            onClick={onClose}
          >
            <X />
          </button>
          <ProductImage
            src={product.image}
            alt={product.name}
            className="aspect-[4/3] min-h-64 sm:min-h-full"
          />
          <div className="p-5 sm:p-8">
            <h2 id="product-title" className="font-display text-3xl font-bold">
              {product.name}
            </h2>
            <p className="mt-3 leading-6 text-[var(--muted)]">{product.description}</p>
            {product.options && (
              <fieldset className="mt-6">
                <legend className="font-bold">Elige salsa de tu preferencia</legend>
                <p className="mb-3 text-xs text-[var(--muted)]">Selecciona 1 · Obligatorio</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {product.options.map((item) => (
                    <label
                      key={item}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border p-3 ${
                        option === item
                          ? "border-[var(--green)] bg-[#e7efe9]"
                          : "border-[var(--line)]"
                      }`}
                    >
                      {item}
                      <input
                        type="radio"
                        name="sauce"
                        value={item}
                        checked={option === item}
                        onChange={() => setOption(item)}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
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
            <div className="mt-5 flex gap-3">
              <div className="flex items-center rounded-xl border border-[var(--line)]">
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
                className="focus-ring flex flex-1 items-center justify-between rounded-xl bg-[var(--terracotta)] px-5 font-bold text-white"
                onClick={() => onAdd(product, quantity, notes.trim(), option)}
              >
                <span>Agregar</span>
                <span>{money(product.price * quantity)}</span>
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
  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[#10211b]/55">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="animate-pop flex h-full w-full max-w-lg flex-col bg-[var(--paper)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
          <button
            className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-[#eee8dc]"
            aria-label="Cerrar pedido"
            onClick={onClose}
          >
            <ChevronLeft />
          </button>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
              Revisa antes de enviar
            </p>
            <h2 id="cart-title" className="font-display text-2xl font-bold">
              Mi pedido
            </h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {cart.map((item, index) => (
              <article key={`${item.productId}-${index}`} className="rounded-2xl bg-[#f1ebdf] p-4">
                <div className="flex gap-3">
                  <ProductImage
                    src={item.image}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-3">
                      <h3 className="font-bold">{item.name}</h3>
                      <strong>{money(item.unitPrice * item.quantity)}</strong>
                    </div>
                    {item.option && <p className="mt-1 text-xs">{item.option}</p>}
                    {item.notes && (
                      <p className="mt-1 text-xs text-[var(--terracotta)]">{item.notes}</p>
                    )}
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-white"
                        aria-label={`Restar ${item.name}`}
                        onClick={() => {
                          const next = [...cart];
                          if (item.quantity === 1) next.splice(index, 1);
                          else next[index] = { ...item, quantity: item.quantity - 1 };
                          onChange(next);
                        }}
                      >
                        <Minus size={15} />
                      </button>
                      <strong>{item.quantity}</strong>
                      <button
                        className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-white"
                        aria-label={`Sumar ${item.name}`}
                        onClick={() => {
                          const next = [...cart];
                          next[index] = {
                            ...item,
                            quantity: Math.min(10, item.quantity + 1)
                          };
                          onChange(next);
                        }}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <label className="mt-5 block text-sm font-bold">
            Observaciones generales
            <textarea
              className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-[var(--line)] bg-white p-3 font-normal outline-none focus:border-[var(--green)]"
              maxLength={250}
              placeholder="Algo que cocina deba saber…"
              value={notes}
              onChange={(event) => onNotes(event.target.value)}
            />
          </label>
        </div>
        <div className="border-t border-[var(--line)] bg-white p-5">
          <div className="mb-4 flex items-center justify-between text-lg">
            <span>Total estimado</span>
            <strong className="text-xl">{money(subtotal)}</strong>
          </div>
          <button
            className="focus-ring flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--green)] px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={sending || cart.length === 0}
            onClick={onSubmit}
          >
            {sending ? (
              "Enviando…"
            ) : (
              <>
                <ShoppingBag size={20} />
                Enviar pedido a cocina
              </>
            )}
          </button>
        </div>
      </section>
    </div>
  );
}

function OrderTracking({ order, tableCode }: { order: Order; tableCode: string }) {
  const steps = ["sent", "accepted", "preparing", "ready", "delivered"] as const;
  const current = steps.indexOf(order.status === "cancelled" ? "sent" : order.status);
  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-6">
      <Brand />
      <section className="paper mt-8 overflow-hidden rounded-[2rem]">
        <div className="bg-[var(--green)] px-6 py-8 text-white">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[#d9b65d] text-[var(--green)]">
            <Check size={30} strokeWidth={3} />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#e5cd90]">
            Pedido recibido
          </p>
          <h1 className="mt-1 font-display text-4xl font-bold">¡Ya está en cocina!</h1>
          <div className="mt-5 flex items-center gap-4">
            <StatusPill status={order.status} />
            <span className="text-sm">Folio {order.folio}</span>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between rounded-2xl bg-[#eee8dc] p-4">
            <span>
              <span className="block text-xs uppercase text-[var(--muted)]">Mesa</span>
              <strong className="text-2xl">{tableCode}</strong>
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
                <li className="flex gap-4" key={step}>
                  <div className="flex flex-col items-center">
                    <span
                      className={`grid h-8 w-8 place-items-center rounded-full ${
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
                          sent: "Enviado",
                          accepted: "Aceptado",
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
        </div>
      </section>
    </main>
  );
}

function LunchMenu() {
  return (
    <section className="mt-6">
      <div className="paper overflow-hidden rounded-[2rem]">
        <div className="bg-[var(--terracotta)] px-6 py-7 text-white">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            {demoLunch.label}
          </span>
          <h2 className="mt-4 font-display text-4xl font-bold">Comida corrida del día</h2>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Clock3 size={16} /> {demoLunch.schedule}
          </p>
          <p className="mt-5 text-3xl font-bold">{money(demoLunch.price)}</p>
        </div>
        <div className="p-6">
          <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#f4dfb4]/60 p-4 text-sm">
            <Sparkles className="shrink-0 text-[var(--terracotta)]" size={20} />
            Esta sección usa opciones de demostración porque la comida corrida no apareció en las
            capturas recibidas.
          </div>
          {demoLunch.courses.map(([course, ...options]) => (
            <div className="border-b border-[var(--line)] py-4 last:border-0" key={course}>
              <h3 className="font-display text-xl font-bold">{course}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">{options.join(" · ")}</p>
            </div>
          ))}
          <button
            className="focus-ring mt-6 w-full rounded-2xl bg-[#d8d5cc] px-5 py-4 font-bold text-[#777]"
            disabled
          >
            Configuración pendiente del dueño
          </button>
        </div>
      </div>
    </section>
  );
}
