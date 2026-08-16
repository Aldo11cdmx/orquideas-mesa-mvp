"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Coffee,
  CupSoda,
  BadgePercent,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  FileDown,
  LayoutGrid,
  PackageCheck,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Settings2,
  Store,
  Trash2,
  TrendingUp,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductImage } from "@/components/product-image";
import { TrialBanner } from "@/components/trial-banner";
import { DrinksAdmin } from "@/components/drinks-admin";
import { PromosAdmin } from "@/components/promos-admin";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { TableQrModal } from "@/components/table-qr-modal";
import { connectOrderChannel } from "@/lib/order-store";
import { categories, money, products as seedProducts } from "@/lib/menu";
import type { DailyMenuConfig, DailyMenuDrink, Product, RestaurantTable, SalesReport } from "@/lib/types";

/* Estilos compartidos estilo Apple/iOS para el panel de administración */
const BTN_PRIMARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-neutral-800 active:scale-95 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200";
const BTN_SECONDARY =
  "focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-neutral-200 bg-white px-5 py-2.5 text-xs font-semibold text-neutral-700 shadow-sm transition-all duration-200 hover:bg-neutral-50 active:scale-95 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";
const BTN_ICON =
  "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700";
const BTN_ICON_DANGER =
  "focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-950/40 dark:hover:text-red-400";

export function AdminPanel() {
  const [pin, setPin] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("menu");
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const channelRef = useRef<ReturnType<typeof connectOrderChannel> | null>(null);

  useEffect(() => {
    const savedPin = sessionStorage.getItem("orquideas-admin-pin");
    queueMicrotask(() => {
      if (savedPin) {
        setPin(savedPin);
        setReady(true);
      }
    });
  }, []);

  const loadProducts = useCallback(async (enteredPin: string) => {
    const response = await fetch(
      `/api/admin/products?pin=${encodeURIComponent(enteredPin)}`,
      { cache: "no-store" }
    );
    if (!response.ok) return;
    const rows = (await response.json()) as Product[];
    if (rows.length) setProducts(rows);
  }, []);

  useEffect(() => {
    if (!ready || !pin) return;
    const initialTimer = window.setTimeout(() => void loadProducts(pin), 0);
    const timer = window.setInterval(() => void loadProducts(pin), 15000);
    channelRef.current = connectOrderChannel(({ type, product }) => {
      if (type === "database_change") {
        void loadProducts(pin);
        return;
      }
      if (!product) return;
      if (type === "menu-delete") {
        setProducts((current) => current.filter((item) => item.id !== product.id));
        return;
      }
      if (type !== "menu") return;
      setProducts((current) => [
        product,
        ...current.filter((item) => item.id !== product.id)
      ]);
    });
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
      channelRef.current?.close();
    };
  }, [loadProducts, pin, ready]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/admin/daily-menu?pin=${encodeURIComponent(pin)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return window.alert(payload?.error || "PIN incorrecto");
    }
    sessionStorage.setItem("orquideas-admin-pin", pin);
    setReady(true);
    await loadProducts(pin);
  }

  async function saveProduct(product: Product) {
    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, product })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      window.alert(payload?.error || "No fue posible guardar el producto");
      throw new Error("save_product_failed");
    }
    const saved = payload as Product;
    setProducts((current) => [
      saved,
      ...current.filter((item) => item.id !== saved.id)
    ]);
    await channelRef.current?.send({ type: "menu", product: saved });
    return saved;
  }

  async function deleteProduct(product: Product) {
    if (
      !window.confirm(
        `¿Quitar "${product.name}" del menú? Sus ventas anteriores se conservarán.`
      )
    ) {
      return;
    }

    const response = await fetch("/api/admin/products", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, productId: product.id })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      window.alert(payload?.error || "No fue posible borrar el producto");
      return;
    }

    setProducts((current) => current.filter((item) => item.id !== product.id));
    await channelRef.current?.send({ type: "menu-delete", product });
  }

  function persist(next: Product[]) {
    const changed = next.find((item) => {
      const current = products.find((product) => product.id === item.id);
      return !current || JSON.stringify(current) !== JSON.stringify(item);
    });
    if (changed) void saveProduct(changed);
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center px-5 dark:bg-neutral-950 admin-surface">
        <form className="paper w-full max-w-sm rounded-[2rem] p-8 shadow-2xl" onSubmit={login}>
          <Brand />
          <div className="mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--charcoal)] text-[var(--gold)] shadow-lg">
            <Settings2 size={28} />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold">Administración</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Configura el menú y consulta el resumen del servicio.
          </p>
          <label className="mt-6 block text-sm font-bold">
            PIN
            <input
              className="mt-2 h-14 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-xl tracking-[0.3em] outline-none focus:border-[var(--green)]"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <button className="focus-ring mt-4 h-14 w-full rounded-full bg-neutral-900 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.98] dark:bg-white dark:text-neutral-900">
            Entrar
          </button>
        </form>
      </main>
    );
  }

  const nav = [
    ["menu", "Menú", LayoutGrid],
    ["breakfast", "Desayunos", Coffee],
    ["drinks", "Bebidas", CupSoda],
    ["daily", "Comida corrida", Store],
    ["promos", "Promos", BadgePercent],
    ["tables", "Mesas", Settings2],
    ["sales", "Corte de caja", BarChart3]
  ] as const;

  return (
    <main className="min-h-screen dark:bg-neutral-950 admin-surface">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/92 px-5 py-4 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Brand compact />
          <span className="rounded-full bg-[#e4ece6] px-4 py-2 text-xs font-bold">
            Panel administrativo
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <Tabs value={tab} onValueChange={setTab} className="gap-0">
          <div className="sticky top-[73px] z-20 -mx-4 bg-[var(--paper)]/90 px-4 py-2 backdrop-blur-xl md:-mx-6 md:px-6">
            <TabsList className="flex w-full gap-1 overflow-x-auto rounded-2xl bg-neutral-100 p-1 dark:bg-neutral-900">
              {nav.map(([id, label, Icon]) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-500 transition-all data-active:bg-white data-active:text-neutral-900 data-active:shadow-sm dark:text-neutral-400 dark:data-active:bg-neutral-800 dark:data-active:text-white"
                >
                  <Icon size={17} /> {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <section className="mt-5">
            <TrialBanner compact />
            <div className="mt-5">
              <TabsContent value="menu">
                <MenuAdmin
                  products={products}
                  onEdit={setEditing}
                  onChange={persist}
                  onDelete={(product) => void deleteProduct(product)}
                  onCreate={() =>
                    setEditing({
                      id: `new-${Date.now()}`,
                      slug: `new-${Date.now()}`,
                      name: "",
                      description: "",
                      price: 0,
                      category: "Desayunos",
                      image: "/menu/imperio/chilaquiles-sencillos.jpg"
                    })
                  }
                />
              </TabsContent>
              <TabsContent value="breakfast">
                <BreakfastAdmin pin={pin} />
              </TabsContent>
              <TabsContent value="drinks">
                <DrinksAdmin pin={pin} />
              </TabsContent>
              <TabsContent value="daily">
                <DailyAdmin pin={pin} />
              </TabsContent>
              <TabsContent value="promos">
                <PromosAdmin pin={pin} />
              </TabsContent>
              <TabsContent value="tables">
                <TablesAdmin pin={pin} />
              </TabsContent>
              <TabsContent value="sales">
                <SalesAdmin pin={pin} />
              </TabsContent>
            </div>
          </section>
        </Tabs>
      </div>
      {editing && (
        <EditProduct
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(product) => {
            void saveProduct(product).then(() => setEditing(null));
          }}
        />
      )}
    </main>
  );
}

function MenuAdmin({
  products,
  onEdit,
  onChange,
  onDelete,
  onCreate
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onChange: (products: Product[]) => void;
  onDelete: (product: Product) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
            Menú fijo
          </p>
          <h1 className="font-display text-4xl font-bold">Productos</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Este es el mismo menú que ven las mesas. Los cambios se publican para todos.
          </p>
        </div>
        <button
          className={BTN_PRIMARY}
          onClick={onCreate}
        >
          <Plus size={16} /> Nuevo producto
        </button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((product) => (
          <article className="paper menu-card relative flex gap-3 rounded-2xl p-3" key={product.id}>
            <ProductImage
              src={product.image}
              alt=""
              className="h-24 w-24 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-bold">{product.name || "Producto nuevo"}</h2>
              <p className="mt-1 text-sm">{money(product.price)}</p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">{product.category}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <button
                  className={BTN_ICON}
                  aria-label={`Editar ${product.name}`}
                  onClick={() => onEdit(product)}
                >
                  <Pencil size={15} />
                </button>
                <button
                  className={BTN_ICON_DANGER}
                  aria-label={`Borrar ${product.name}`}
                  onClick={() => onDelete(product)}
                >
                  <Trash2 size={15} />
                </button>
                <button
                  className={`focus-ring ${product.soldOut ? "text-[var(--terracotta)]" : "text-[#377359]"}`}
                  aria-label={product.soldOut ? "Marcar disponible" : "Marcar agotado"}
                  onClick={() =>
                    onChange(
                      products.map((item) =>
                        item.id === product.id ? { ...item, soldOut: !item.soldOut } : item
                      )
                    )
                  }
                >
                  {product.soldOut ? <ToggleLeft size={26} /> : <ToggleRight size={26} />}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function EditProduct({
  product,
  onClose,
  onSave
}: {
  product: Product;
  onClose: () => void;
  onSave: (product: Product) => void;
}) {
  const [draft, setDraft] = useState(product);
  const [showExtraEditor, setShowExtraEditor] = useState(false);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");

  function toggleExtra(extraName: string) {
    const current = draft.extrasConfig ?? [];
    setDraft({
      ...draft,
      extrasConfig: current.map((e) => (e.name === extraName ? { ...e, active: !e.active } : e))
    });
  }

  function addExtra() {
    const name = extraName.trim();
    if (!name) return;
    const price = Number(extraPrice);
    if (isNaN(price) || price < 0) return;
    const current = draft.extrasConfig ?? [];
    setDraft({
      ...draft,
      extrasConfig: [...current, { name, price, active: true }]
    });
    setExtraName("");
    setExtraPrice("");
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#10211b]/55 p-4">
      <form
        className="paper max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-[2rem] p-7 shadow-2xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <h2 className="font-display text-3xl font-bold">Editar producto</h2>
        {[
          ["Nombre", "name"],
          ["Descripción", "description"],
          ["Imagen", "image"]
        ].map(([label, key]) => (
          <label className="mt-4 block text-sm font-bold" key={key}>
            {label}
            <input
              className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-3 font-normal outline-none focus:border-[var(--green)]"
              required
              value={String(draft[key as keyof Product] || "")}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          </label>
        ))}
        <label className="mt-4 block text-sm font-bold">
          Precio
          <input
            className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-3 font-normal outline-none focus:border-[var(--green)]"
            min="0"
            step="0.5"
            type="number"
            value={draft.price}
            onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) })}
          />
        </label>
        <label className="mt-4 block text-sm font-bold">
          Categoría
          <select
            className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-3 font-normal"
            value={draft.category}
            onChange={(event) => setDraft({ ...draft, category: event.target.value })}
          >
            {categories.slice(1).map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={draft.active !== false}
              onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
            />
            Activo
          </label>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={draft.soldOut === true}
              onChange={(event) => setDraft({ ...draft, soldOut: event.target.checked })}
            />
            Agotado
          </label>
        </div>

        {product.extrasConfig && product.extrasConfig.length > 0 && (
          <fieldset className="mt-4 rounded-2xl border border-[var(--line)] p-4">
            <legend className="px-1 font-display text-xl font-bold">Extras disponibles</legend>
            <p className="mb-3 text-xs text-[var(--muted)]">
              Estos extras se ofrecen al cliente al agregar este producto.
            </p>
            <div className="grid gap-2">
              {(draft.extrasConfig || []).map((extra) => (
                <div className="flex items-center justify-between rounded-xl border border-[var(--line)] px-3 py-2" key={extra.name}>
                  <span className="font-medium">{extra.name}</span>
                  <span className="text-sm text-[var(--muted)]">{money(extra.price)}</span>
                  <label className="flex items-center gap-1 text-xs font-bold">
                    <input
                      type="checkbox"
                      checked={extra.active !== false}
                      onChange={() => toggleExtra(extra.name)}
                    />
                    Activo
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        )}

        {showExtraEditor && (
          <fieldset className="mt-4 rounded-2xl border border-[var(--line)] bg-[#fbf7f1] p-4">
            <legend className="px-1 font-display text-xl font-bold">Agregar extra</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
              <input
                className="h-11 rounded-xl border border-[var(--line)] px-3 font-normal"
                placeholder="Nombre del extra"
                maxLength={80}
                value={extraName}
                onChange={(event) => setExtraName(event.target.value)}
              />
              <input
                className="h-11 rounded-xl border border-[var(--line)] px-3 font-normal"
                placeholder="Precio"
                min="0"
                step="0.5"
                type="number"
                value={extraPrice}
                onChange={(event) => setExtraPrice(event.target.value)}
              />
              <button
                className="focus-ring h-11 rounded-xl bg-[var(--green)] px-4 font-bold text-white"
                type="button"
                disabled={!extraName.trim() || !Number(extraPrice)}
                onClick={addExtra}
              >
                +
              </button>
            </div>
          </fieldset>
        )}

        {(draft.extrasConfig || []).length === 0 && product.category !== "Bebidas" && product.category !== "Comidas a la carta" && (
          <button
            className="focus-ring mt-4 text-sm font-bold text-[var(--brown)] hover:underline"
            type="button"
            onClick={() => setShowExtraEditor(!showExtraEditor)}
          >
            {showExtraEditor ? "Cancelar" : "+ Agregar extras con costo"}
          </button>
        )}
        <div className="mt-6 flex gap-3">
          <button
            className="focus-ring h-12 flex-1 rounded-xl border border-[var(--line)] font-bold"
            type="button"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button className="focus-ring flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--green)] font-bold text-white">
            <Save size={17} /> Guardar
          </button>
        </div>
      </form>
    </div>
  );
}

const defaultDailyMenu: DailyMenuConfig = {
  active: true,
  availableToday: true,
  serviceDate: "",
  availableFrom: "13:00",
  availableUntil: "17:00",
  price: 75,
  courses: {
    Entrada: ["Consomé", "Sopa"],
    Guarnición: ["Arroz", "Pasta"],
    "Plato fuerte": ["Pechuga empanizada", "Enchiladas verdes"],
    Bebida: [
      { name: "Agua de fruta", active: true },
      { name: "Agua simple", active: true }
    ]
  },
  extras: []
};

const mexicoToday = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

function DailyAdmin({ pin }: { pin: string }) {
  const [draft, setDraft] = useState<DailyMenuConfig>({
    ...defaultDailyMenu,
    serviceDate: mexicoToday()
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/admin/daily-menu?pin=${encodeURIComponent(pin)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("No fue posible cargar la comida corrida");
        return (await response.json()) as DailyMenuConfig;
      })
      .then((menu) => {
        if (active && menu) setDraft(menu);
      })
      .catch((error) => {
        if (active) setNotice(error instanceof Error ? error.message : "No fue posible cargar");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pin]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    const publishingDraft = {
      ...draft,
      serviceDate: mexicoToday(),
      courses: Object.fromEntries(
        Object.entries(draft.courses).map(([course, options]) => {
          if (course === "Bebida") {
            return [
              course,
              (options as DailyMenuDrink[])
                .filter((drink) => drink.name.trim())
                .map((drink) => ({ name: drink.name.trim(), active: drink.active !== false }))
            ];
          }
          return [
            course,
            (options as string[]).map((option) => option.trim()).filter(Boolean)
          ];
        })
      ),
      extras: (draft.extras || [])
        .map((extra) => ({ name: extra.name.trim(), price: Number(extra.price), active: extra.active !== false }))
        .filter((extra) => extra.name)
    };
    const response = await fetch("/api/admin/daily-menu", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, ...publishingDraft })
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setNotice(payload?.error || "No fue posible guardar");
      return;
    }
    const saved = payload as DailyMenuConfig;
    setDraft(saved);
    setNotice("Menú guardado y publicado para hoy.");
    const channel = connectOrderChannel(() => {});
    await channel.send({ type: "daily-menu", dailyMenu: saved });
    channel.close();
  }

  function setCourseOption(course: string, index: number, value: string) {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        [course]: (current.courses[course] as string[] || []).map((option, optionIndex) =>
          optionIndex === index ? value : option
        )
      }
    }));
  }

  function addCourseOption(course: string) {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        [course]: [...(current.courses[course] as string[] || []), ""]
      }
    }));
  }

  function removeCourseOption(course: string, index: number) {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        [course]: (current.courses[course] as string[] || []).filter(
          (_, optionIndex) => optionIndex !== index
        )
      }
    }));
  }

  function setDrinkOption(index: number, value: string) {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        Bebida: (current.courses.Bebida as DailyMenuDrink[] || []).map((drink, drinkIndex) =>
          drinkIndex === index ? { ...drink, name: value } : drink
        )
      }
    }));
  }

  function toggleDrink(index: number) {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        Bebida: (current.courses.Bebida as DailyMenuDrink[] || []).map((drink, drinkIndex) =>
          drinkIndex === index ? { ...drink, active: !drink.active } : drink
        )
      }
    }));
  }

  function addDrink() {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        Bebida: [...(current.courses.Bebida as DailyMenuDrink[] || []), { name: "", active: true }]
      }
    }));
  }

  function removeDrink(index: number) {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        Bebida: (current.courses.Bebida as DailyMenuDrink[] || []).filter(
          (_, drinkIndex) => drinkIndex !== index
        )
      }
    }));
  }

  function setExtra(index: number, field: "name" | "price", value: string) {
    setDraft((current) => ({
      ...current,
      extras: (current.extras || []).map((extra, extraIndex) =>
        extraIndex === index
          ? {
              ...extra,
              [field]: field === "price" ? Number(value || 0) : value
            }
          : extra
      )
    }));
  }

  function addExtra() {
    setDraft((current) => ({
      ...current,
      extras: [...(current.extras || []), { name: "", price: 0 }]
    }));
  }

  function removeExtra(index: number) {
    setDraft((current) => ({
      ...current,
      extras: (current.extras || []).filter((_, extraIndex) => extraIndex !== index)
    }));
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
        Configuración del día
      </p>
      <h1 className="font-display text-4xl font-bold">Comida corrida</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Agrega todas las opciones disponibles de cada tiempo. El cliente elegirá una opción de
        cada grupo antes de agregar la comida corrida.
      </p>
      <form className="paper mt-5 max-w-3xl rounded-3xl p-5 sm:p-6" onSubmit={save}>
        {loading ? (
          <p className="py-12 text-center text-[var(--muted)]">Cargando configuración…</p>
        ) : (
          <>
            <button
              className={`focus-ring flex w-full items-center justify-between rounded-2xl p-4 text-left font-bold ${
                draft.active
                  ? "bg-[#dce8c8] text-[#274a27]"
                  : "bg-[#f1d0ca] text-[#7a2c22]"
              }`}
              type="button"
              onClick={() => setDraft({ ...draft, active: !draft.active })}
            >
              <span>
                <span className="block text-xs uppercase tracking-wider">Estado</span>
                {draft.active ? "Disponible para los clientes" : "No disponible"}
              </span>
              {draft.active ? <ToggleRight size={34} /> : <ToggleLeft size={34} />}
            </button>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold">
                Fecha del menú
                <div className="mt-2 flex gap-2">
                  <input
                    className="h-12 min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 font-normal"
                    required
                    type="date"
                    value={draft.serviceDate}
                    onChange={(event) =>
                      setDraft({ ...draft, serviceDate: event.target.value })
                    }
                  />
                  <button
                    className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 dark:bg-white dark:text-neutral-900"
                    type="button"
                    onClick={() => setDraft({ ...draft, serviceDate: mexicoToday() })}
                  >
                    Hoy
                  </button>
                </div>
              </label>
              <label className="text-sm font-bold">
                Precio por persona
                <input
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-3 font-normal"
                  min="1"
                  required
                  step="0.5"
                  type="number"
                  value={draft.price}
                  onChange={(event) =>
                    setDraft({ ...draft, price: Number(event.target.value) })
                  }
                />
              </label>
              <label className="text-sm font-bold">
                Desde
                <input
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-3 font-normal"
                  required
                  type="time"
                  value={draft.availableFrom}
                  onChange={(event) =>
                    setDraft({ ...draft, availableFrom: event.target.value })
                  }
                />
              </label>
              <label className="text-sm font-bold">
                Hasta
                <input
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-3 font-normal"
                  required
                  type="time"
                  value={draft.availableUntil}
                  onChange={(event) =>
                    setDraft({ ...draft, availableUntil: event.target.value })
                  }
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4">
              {(["Entrada", "Guarnición", "Plato fuerte"] as const).map((course) => {
                const options = draft.courses[course] as string[] || [];
                return (
                  <fieldset className="rounded-2xl border border-[var(--line)] p-4" key={course}>
                    <legend className="px-1 font-display text-xl font-bold">{course}</legend>
                    <p className="mb-3 text-xs text-[var(--muted)]">
                      El cliente elegirá 1 de estas opciones.
                    </p>
                    <div className="grid gap-2">
                      {options.map((option, index) => (
                        <div className="flex gap-2" key={`${course}-${index}`}>
                          <input
                            aria-label={`${course}, opción ${index + 1}`}
                            className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 font-normal"
                            maxLength={80}
                            placeholder={`Opción ${index + 1}`}
                            required
                            value={option}
                            onChange={(event) =>
                              setCourseOption(course, index, event.target.value)
                            }
                          />
                          <button
                            aria-label={`Quitar opción ${index + 1} de ${course}`}
                            className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-35 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                            disabled={options.length <= 1}
                            type="button"
                            onClick={() => removeCourseOption(course, index)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      className="focus-ring mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 dark:bg-white dark:text-neutral-900"
                      disabled={options.length >= 8}
                      type="button"
                      onClick={() => addCourseOption(course)}
                    >
                      <Plus size={16} /> Agregar otra opción
                    </button>
                  </fieldset>
                );
              })}
            </div>

            <fieldset className="mt-6 rounded-2xl border border-[var(--line)] p-4">
              <legend className="px-1 font-display text-xl font-bold">Bebidas</legend>
              <p className="mb-3 text-xs text-[var(--muted)]">
                El cliente elegirá 1 de estas bebidas. Activa o desactiva cada una según disponibilidad.
              </p>
              <div className="grid gap-2">
                {(draft.courses.Bebida as DailyMenuDrink[] || []).map((drink, index) => (
                  <div className="flex items-center gap-2" key={`Bebida-${index}`}>
                    <input
                      aria-label={`Bebida ${index + 1}`}
                      className="h-11 min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 font-normal"
                      maxLength={80}
                      placeholder={`Bebida ${index + 1}`}
                      required
                      value={drink.name}
                      onChange={(event) => setDrinkOption(index, event.target.value)}
                    />
                    <button
                      aria-label={drink.active ? "Desactivar bebida" : "Activar bebida"}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-35 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      type="button"
                      onClick={() => toggleDrink(index)}
                    >
                      {drink.active ? (
                        <ToggleRight size={20} className="text-[var(--green)]" />
                      ) : (
                        <ToggleLeft size={20} className="text-[var(--muted)]" />
                      )}
                    </button>
                    <button
                      aria-label={`Quitar bebida ${index + 1}`}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-35 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      disabled={(draft.courses.Bebida as DailyMenuDrink[] || []).length <= 1}
                      type="button"
                      onClick={() => removeDrink(index)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="focus-ring mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 dark:bg-white dark:text-neutral-900"
                disabled={(draft.courses.Bebida as DailyMenuDrink[] || []).length >= 8}
                type="button"
                onClick={addDrink}
              >
                <Plus size={16} /> Agregar otra bebida
              </button>
            </fieldset>

            <fieldset className="mt-6 rounded-2xl border border-[var(--line)] p-4">
              <legend className="px-1 font-display text-xl font-bold">Extras con costo</legend>
              <p className="mb-3 text-xs text-[var(--muted)]">
                El cliente podrÃ¡ elegir varios extras y su total subirÃ¡ automÃ¡ticamente.
              </p>
              <div className="grid gap-3">
                {(draft.extras || []).map((extra, index) => (
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]" key={`extra-${index}`}>
                    <input
                      aria-label={`Extra ${index + 1}`}
                      className="h-11 min-w-0 rounded-xl border border-[var(--line)] px-3 font-normal"
                      maxLength={80}
                      placeholder={`Extra ${index + 1}`}
                      value={extra.name}
                      onChange={(event) => setExtra(index, "name", event.target.value)}
                    />
                    <input
                      aria-label={`Precio del extra ${index + 1}`}
                      className="h-11 min-w-0 rounded-xl border border-[var(--line)] px-3 font-normal"
                      min="0"
                      step="0.5"
                      type="number"
                      value={extra.price}
                      onChange={(event) => setExtra(index, "price", event.target.value)}
                    />
                    <button
                      aria-label={`Quitar extra ${index + 1}`}
                      className="focus-ring grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-35 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      type="button"
                      onClick={() => removeExtra(index)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="focus-ring mt-3 inline-flex h-10 items-center gap-2 rounded-full bg-neutral-900 px-4 text-xs font-semibold text-white shadow-sm transition-all active:scale-95 dark:bg-white dark:text-neutral-900"
                type="button"
                onClick={addExtra}
              >
                <Plus size={16} /> Agregar extra
              </button>
            </fieldset>

            {notice && (
              <div
                className={`mt-5 rounded-xl p-3 text-sm font-bold ${
                  notice.includes("correctamente") || notice.includes("publicado")
                    ? "bg-[#dce8c8] text-[#274a27]"
                    : "bg-[#f1d0ca] text-[#7a2c22]"
                }`}
              >
                {notice}
              </div>
            )}
            <button
              className="focus-ring mt-5 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)] px-5 font-bold text-white disabled:opacity-60"
              disabled={(() => {
                if (saving) return true;
                const stringCoursesComplete = (["Entrada", "Guarnición", "Plato fuerte"] as const).every(
                  (course) => {
                    const options = draft.courses[course] as string[] || [];
                    return options.length > 0 && options.every((option) => option.trim().length > 0);
                  }
                );
                const drinks = draft.courses.Bebida as DailyMenuDrink[] || [];
                const drinksValid =
                  drinks.length > 0 && drinks.every((drink) => drink.name.trim().length > 0);
                return !stringCoursesComplete || !drinksValid;
              })()}
            >
              <Save size={18} /> {saving ? "Guardando…" : "Guardar y publicar"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function TablesAdmin({ pin }: { pin: string }) {
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<RestaurantTable | null>(null);
  const [deleting, setDeleting] = useState<RestaurantTable | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [qrTable, setQrTable] = useState<RestaurantTable | null>(null);
  const [appUrl] = useState(
    () => (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "")
  );

  const loadTables = useCallback(async () => {
    setLoading(true);
    setNotice("");
    const response = await fetch(`/api/admin/tables?pin=${encodeURIComponent(pin)}`, {
      cache: "no-store"
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error || "No fue posible cargar las mesas");
    } else {
      setTables(Array.isArray(payload) ? payload : []);
    }
    setLoading(false);
  }, [pin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadTables(), 0);
    return () => window.clearTimeout(timer);
  }, [loadTables]);

  const saveTable = async (code: string, name: string, capacity: number, active: boolean): Promise<RestaurantTable | null> => {
    setNotice("");
    const response = await fetch("/api/admin/tables", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pin,
        table: { ...(editing ?? {}), code, name, capacity, active }
      })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error || "No fue posible guardar la mesa");
      return null;
    }
    const updated = payload as RestaurantTable;
    const isNew = !editing?.id;
    setTables(tables.map((t) => (t.id === updated.id ? updated : t)));
    setEditing(null);
    void loadTables();
    if (isNew) setQrTable(updated);
    return updated;
  };

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/tables", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, id: deleting.id })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(payload?.error || "No fue posible eliminar la mesa");
        return;
      }
      setDeleting(null);
      void loadTables();
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-[var(--terracotta)]">Gestión de mesas</p>
          <h1 className="font-display text-4xl font-bold">Mesas</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Configura mesas, activa/desactiva y consulta el estado de pedidos en tiempo real.
          </p>
        </div>
        <button
          className={BTN_PRIMARY}
          onClick={() => setEditing({ id: "", code: "", name: "", capacity: 4, active: true })}
        >
          <Plus size={16} /> Nueva mesa
        </button>
      </div>

      {notice && (
        <p className="mt-3 text-sm font-bold text-[#be011f]">{notice}</p>
      )}

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-800" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => {
            const hasConsumption = (table.orderCount ?? 0) > 0 || (table.tableTotal ?? 0) > 0;
            return (
              <article
                key={table.id}
                className={`paper relative overflow-hidden rounded-3xl border p-5 ${
                  table.active ? "border-[var(--line)]" : "border-red-300 bg-[#fef2f2]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-display text-4xl font-bold text-[var(--brown-dark)]">{table.code}</h2>
                    {table.name && (
                      <p className="mt-1 truncate text-sm text-[var(--muted)]">{table.name}</p>
                    )}
                    {table.capacity > 0 && (
                      <p className="mt-1 text-xs text-[var(--muted)]">Capacidad: {table.capacity} personas</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      className={BTN_ICON}
                      aria-label={`Ver código QR de la mesa ${table.code}`}
                      onClick={() => setQrTable(table)}
                    >
                      <QrCode size={15} />
                    </button>
                    <button
                      className={BTN_ICON}
                      aria-label={`Editar mesa ${table.code}`}
                      onClick={() => setEditing(table)}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className={BTN_ICON_DANGER}
                      aria-label={`Eliminar mesa ${table.code}`}
                      onClick={() => setDeleting(table)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {!table.active ? (
                    <Badge className="h-auto rounded-full border-none bg-red-100 px-3 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
                      Inactiva
                    </Badge>
                  ) : hasConsumption ? (
                    <>
                      <Badge className="h-auto rounded-full border-none bg-orange-50 px-3 py-0.5 text-[11px] font-medium text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                        Ocupada
                      </Badge>
                      <strong className="text-sm text-[var(--ink)]">{money(table.tableTotal ?? 0)}</strong>
                      {(table.orderCount ?? 0) > 0 && (
                        <span className="text-xs text-[var(--muted)]">· {table.orderCount} pedido(s)</span>
                      )}
                    </>
                  ) : (
                    <Badge className="h-auto rounded-full border-none bg-emerald-50 px-3 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                      Libre
                    </Badge>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-2.5">
                  <span className="text-[10px] text-[var(--muted)]">QR → /mesa/{table.code}</span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {table.active ? "Activa" : "Desactivada"}
                  </span>
                </div>
              </article>
            );
          })}
          {tables.length === 0 && !loading && (
            <p className="mt-6 text-sm text-[var(--muted)]">No hay mesas configuradas.</p>
          )}
        </div>
      )}

      {editing && (
        <TableEditor
          table={editing}
          tables={tables}
          onClose={() => setEditing(null)}
          onSave={saveTable}
        />
      )}

      {/* Confirmación de borrado de mesa */}
      <Dialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !deleteBusy) setDeleting(null);
        }}
      >
        <DialogContent className="max-w-sm rounded-3xl p-6 dark:bg-neutral-900 dark:text-neutral-100">
          <DialogTitle className="font-display text-xl font-bold">
            ¿Eliminar la Mesa {deleting?.code}?
          </DialogTitle>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
            Esta acción no se puede deshacer.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-full border border-neutral-200 px-4 py-2.5 text-xs font-semibold transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              onClick={() => setDeleting(null)}
              disabled={deleteBusy}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50"
              onClick={() => void confirmDelete()}
              disabled={deleteBusy}
            >
              {deleteBusy ? "Eliminando…" : "Eliminar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <TableQrModal table={qrTable} appUrl={appUrl} onClose={() => setQrTable(null)} />
    </div>
  );
}

function TableEditor({
  table,
  tables,
  onClose,
  onSave
}: {
  table: RestaurantTable;
  tables: RestaurantTable[];
  onClose: () => void;
  onSave: (code: string, name: string, capacity: number, active: boolean) => Promise<RestaurantTable | null>;
}) {
  const [code, setCode] = useState(table.code);
  const [name, setName] = useState(table.name ?? "");
  const [capacity, setCapacity] = useState((table.capacity ?? 0).toString());
  const [active, setActive] = useState(table.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    const duplicate = tables.some(
      (t) => t.code.trim().toUpperCase() === trimmed && t.id !== table.id
    );
    if (duplicate) {
      setError(`Ya existe una mesa con el código "${trimmed}". Usa otro código.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await onSave(trimmed, name, parseInt(capacity, 10) || 0, active);
      if (saved) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        className="paper w-full max-w-md rounded-3xl p-8 shadow-2xl dark:bg-neutral-900 dark:text-neutral-100"
        onSubmit={handleSubmit}
      >
        <h2 className="font-display text-2xl font-bold">
          {table.id ? "Editar mesa" : "Nueva mesa"}
        </h2>

        {error && (
          <p className="mt-3 rounded-2xl bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-4 space-y-4">
          <label className="block text-sm font-bold">
            Código de mesa
            <input
              className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-lg uppercase outline-none focus:border-[var(--green)] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              pattern="[A-Z][0-9]{0,2}"
              placeholder="Ej: A1"
              required
              disabled={saving}
            />
          </label>
          <label className="block text-sm font-bold">
            Nombre (opcional)
            <input
              className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-lg outline-none focus:border-[var(--green)] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Mesa de la ventana"
              disabled={saving}
            />
          </label>
          <label className="block text-sm font-bold">
            Capacidad
            <input
              type="number"
              className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-4 text-lg outline-none focus:border-[var(--green)] dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              min={0}
              max={50}
              disabled={saving}
            />
          </label>
          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              disabled={saving}
            />
            Activa
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-full border border-neutral-200 px-4 py-3 text-xs font-semibold transition-colors hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            onClick={onClose}
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="focus-ring flex-1 rounded-full bg-neutral-900 px-4 py-3 text-xs font-semibold text-white shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {saving ? "Guardando…" : table.id ? "Actualizar" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}

type CashAdjustment = {
  id: string;
  type: "income" | "expense";
  amount: number;
  concept: string;
  createdAt: string;
};

type SalesPeriod = "day" | "week" | "month";

function salesRange(period: SalesPeriod) {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);
  to.setHours(24, 0, 0, 0);

  if (period === "day") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from.setDate(from.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  }

  return { from: from.toISOString(), to: to.toISOString() };
}

function SalesAdmin({ pin }: { pin: string }) {
  const [period, setPeriod] = useState<SalesPeriod>("day");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [adjustments, setAdjustments] = useState<CashAdjustment[]>([]);
  const [adjustmentTotals, setAdjustmentTotals] = useState({ income: 0, expense: 0 });
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjType, setAdjType] = useState<"income" | "expense">("income");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjConcept, setAdjConcept] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  async function load(nextPeriod = period) {
    setLoading(true);
    setNotice("");
    const range = salesRange(nextPeriod);
    const params = new URLSearchParams({ pin, ...range });
    const response = await fetch(`/api/admin/sales?${params}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error || "No fue posible generar el corte");
      setLoading(false);
      return;
    }
    setReport(payload as SalesReport);
    const adjustmentResponse = await fetch(`/api/admin/cash-adjustments?${params}`, {
      cache: "no-store"
    });
    const adjustmentPayload = await adjustmentResponse.json().catch(() => null);
    if (adjustmentResponse.ok && adjustmentPayload) {
      setAdjustments(adjustmentPayload.items ?? []);
      setAdjustmentTotals(adjustmentPayload.totals ?? { income: 0, expense: 0 });
    }
    setLoading(false);
  }

  async function submitAdjustment() {
    const amount = Number(adjAmount);
    if (!adjAmount || isNaN(amount) || amount <= 0) {
      setNotice("Escribe un monto válido para el ajuste.");
      return;
    }
    if (!adjConcept.trim()) {
      setNotice("Escribe el concepto del ajuste.");
      return;
    }
    setSavingAdjustment(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/cash-adjustments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin, type: adjType, amount, concept: adjConcept.trim() })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        setNotice(payload?.error || "No se pudo registrar el ajuste");
        return;
      }
      setAdjAmount("");
      setAdjConcept("");
      setAdjustmentOpen(false);
      await load();
    } finally {
      setSavingAdjustment(false);
    }
  }

  async function removeAdjustment(id: string) {
    if (!window.confirm("¿Eliminar este movimiento de caja?")) return;
    const response = await fetch("/api/admin/cash-adjustments", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, id })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error || "No se pudo eliminar el ajuste");
      return;
    }
    await load();
  }

  function exportPdf() {
    const range = salesRange(period);
    const params = new URLSearchParams({
      pin,
      from: range.from,
      to: range.to,
      period: period === "day" ? "day" : "week"
    });
    window.open(`/api/admin/sales/pdf?${params.toString()}`, "_blank");
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(period), 0);
    const interval = window.setInterval(() => void load(period), 10000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
    // The PIN is stable for the authenticated admin session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, pin]);

  const maximumDaily = Math.max(...(report?.dailySales.map((day) => day.total) || [1]), 1);
  const maximumProduct = Math.max(
    ...(report?.topProducts.map((product) => product.quantity) || [1]),
    1
  );
  const cashExpected =
    (report?.summary.cashSales ?? 0) + adjustmentTotals.income - adjustmentTotals.expense;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-[var(--terracotta)]">Pedidos realmente entregados</p>
          <h1 className="font-display text-4xl font-bold">Corte de caja</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Este cálculo registra lo pedido en la app. El cobro continúa realizándose directamente
            en el restaurante.
          </p>
        </div>
        <button
          className={BTN_SECONDARY}
          onClick={() => void load()}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={15} /> Actualizar
        </button>
        <button
          className={BTN_PRIMARY}
          onClick={exportPdf}
        >
          <FileDown size={15} /> Exportar PDF
        </button>
      </div>

      <div className="mt-5 inline-flex rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
        {([
          ["day", "Hoy"],
          ["week", "7 días"],
          ["month", "Este mes"]
        ] as const).map(([value, label]) => (
          <button
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              period === value
                ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-900 dark:text-white"
                : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
            }`}
            key={value}
            onClick={() => setPeriod(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="mt-5 rounded-2xl bg-[#f1d0ca] p-4 text-sm font-bold text-[#7a2c22]">
          {notice}
        </div>
      )}

      {loading && !report ? (
        <div className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-800" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-3xl bg-neutral-100 dark:bg-neutral-800" />
        </div>
      ) : report ? (
        <>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: "Consumo registrado",
                value: money(report.summary.grossSales),
                detail:
                  report.summary.unassignedOrders > 0
                    ? `${report.summary.unassignedOrders} pedidos anteriores sin método`
                    : "Solo pedidos entregados",
                icon: CircleDollarSign,
                badge: { text: "Corte", className: "bg-[#efe9df] text-[#6d4530] dark:bg-neutral-800 dark:text-neutral-300" }
              },
              {
                label: "Efectivo",
                value: money(report.summary.cashSales),
                detail: `${report.summary.cashOrders} pedidos`,
                icon: Banknote,
                badge: { text: "Cobrado", className: "bg-[#e4ece6] text-[var(--green)]" }
              },
              {
                label: "Tarjeta",
                value: money(report.summary.cardSales),
                detail: `${report.summary.cardOrders} pedidos`,
                icon: CreditCard,
                badge: { text: "Cobrado", className: "bg-[#e4e9f0] text-[#3a5a8c]" }
              },
              {
                label: "Pedidos entregados",
                value: report.summary.orderCount,
                detail: `${report.summary.itemsSold} productos servidos`,
                icon: PackageCheck,
                badge: { text: "Completado", className: "bg-[#efe9df] text-[#6d4530] dark:bg-neutral-800 dark:text-neutral-300" }
              },
              {
                label: "Ticket promedio",
                value: money(report.summary.averageTicket),
                detail: "Promedio por mesa/pedido",
                icon: TrendingUp,
                badge: { text: "Promedio", className: "bg-[#efe9df] text-[#6d4530] dark:bg-neutral-800 dark:text-neutral-300" }
              },
              {
                label: "Pedidos en proceso",
                value: report.summary.pendingOrders,
                detail: money(report.summary.pendingAmount),
                icon: CalendarDays,
                badge: { text: "En curso", className: "bg-[#f4dfb4] text-[#694500] dark:bg-neutral-800 dark:text-neutral-300" }
              }
            ].map(({ label, value, detail, icon: Icon, badge }) => (
              <Card className="rounded-3xl p-5" key={label}>
                <div className="flex items-center justify-between gap-2">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4ece6] text-[var(--green)]">
                    <Icon size={20} />
                  </div>
                  <Badge className={`h-auto rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge.className}`}>
                    {badge.text}
                  </Badge>
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  {label}
                </p>
                <strong className="mt-1 block font-display text-3xl">{value}</strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span>
              </Card>
            ))}
          </div>

          <section className="paper mt-5 rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow text-[var(--terracotta)]">Caja</p>
                <h2 className="font-display text-2xl font-bold">Ajustes manuales</h2>
              </div>
              <button
                className={BTN_SECONDARY}
                onClick={() => setAdjustmentOpen((value) => !value)}
              >
                <Plus size={15} />
                {adjustmentOpen ? "Cerrar" : "Registrar ajuste"}
              </button>
            </div>

            {adjustmentOpen && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-4 sm:grid-cols-[auto_minmax(0,9rem)_1fr_auto] sm:items-center">
                <div className="inline-flex rounded-xl border border-[var(--line)] bg-white p-1">
                  {(["income", "expense"] as const).map((type) => (
                    <button
                      key={type}
                      className={`focus-ring rounded-lg px-3 py-2 text-xs font-bold transition ${
                        adjType === type
                          ? type === "income"
                            ? "bg-[var(--green)] text-white"
                            : "bg-[#b3261e] text-white"
                          : "text-[var(--muted)]"
                      }`}
                      onClick={() => setAdjType(type)}
                    >
                      {type === "income" ? "Entrada" : "Salida"}
                    </button>
                  ))}
                </div>
                <input
                  className="focus-ring min-w-0 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  placeholder="Monto ($)"
                  value={adjAmount}
                  onChange={(event) => setAdjAmount(event.target.value)}
                />
                <input
                  className="focus-ring min-w-0 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none"
                  type="text"
                  maxLength={200}
                  placeholder="Concepto (ej. compra de hielo)"
                  value={adjConcept}
                  onChange={(event) => setAdjConcept(event.target.value)}
                />
                <button
                  className={BTN_PRIMARY}
                  disabled={savingAdjustment}
                  onClick={() => void submitAdjustment()}
                >
                  <Save size={15} />
                  {savingAdjustment ? "Guardando…" : "Guardar"}
                </button>
              </div>
            )}

            {adjustments.length ? (
              <ul className="mt-4 divide-y divide-[var(--line)]">
                {adjustments.map((adjustment) => (
                  <li className="flex items-center gap-3 py-2.5" key={adjustment.id}>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                        adjustment.type === "income"
                          ? "bg-[#e4ece6] text-[var(--green)]"
                          : "bg-[#f1d0ca] text-[#7a2c22]"
                      }`}
                    >
                      {adjustment.type === "income" ? "Entrada" : "Salida"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {adjustment.concept}
                    </span>
                    <time className="shrink-0 text-xs text-[var(--muted)]">
                      {new Date(adjustment.createdAt).toLocaleString("es-MX", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </time>
                    <strong
                      className={`shrink-0 text-sm ${
                        adjustment.type === "income" ? "text-[var(--green)]" : "text-[#b3261e]"
                      }`}
                    >
                      {adjustment.type === "income" ? "+" : "−"}
                      {money(adjustment.amount)}
                    </strong>
                    <button
                      className={BTN_ICON_DANGER}
                      aria-label="Eliminar ajuste"
                      onClick={() => void removeAdjustment(adjustment.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptySales message="Sin ajustes manuales en este periodo." />
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-[#e4ece6] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  Efectivo esperado en caja
                </p>
                <strong className="mt-1 block font-display text-3xl text-[var(--green)]">
                  {money(cashExpected)}
                </strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Efectivo vendido + entradas − salidas
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Entradas
                  </span>
                  <strong className="mt-1 block text-lg text-[var(--green)]">
                    +{money(adjustmentTotals.income)}
                  </strong>
                </div>
                <div className="rounded-2xl border border-[var(--line)] p-4">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                    Salidas
                  </span>
                  <strong className="mt-1 block text-lg text-[#b3261e]">
                    −{money(adjustmentTotals.expense)}
                  </strong>
                </div>
              </div>
            </div>
          </section>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="paper rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow text-[var(--terracotta)]">Tendencia</p>
                  <h2 className="font-display text-2xl font-bold">Consumo por día</h2>
                </div>
                <BarChart3 className="text-neutral-900 dark:text-neutral-200" />
              </div>
              {report.dailySales.length ? (
                <div className="mt-6 flex min-h-48 items-end gap-3 overflow-x-auto pb-1">
                  {report.dailySales.map((day) => (
                    <div className="flex min-w-16 flex-1 flex-col items-center" key={day.day}>
                      <span className="mb-2 text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {money(day.total)}
                      </span>
                      <div
                        className="w-full min-w-12 rounded-t-2xl bg-neutral-900 transition-opacity hover:opacity-80 dark:bg-neutral-100"
                        style={{
                          height: `${Math.max(18, (day.total / maximumDaily) * 140)}px`
                        }}
                      />
                      <span className="mt-2 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                        {new Date(`${day.day}T12:00:00`).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short"
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptySales message="Sin ventas registradas este periodo." />
              )}
            </section>

            <section className="paper rounded-3xl p-5 sm:p-6">
              <p className="eyebrow text-[var(--terracotta)]">Ranking</p>
              <h2 className="font-display text-2xl font-bold">Lo más vendido</h2>
              {report.topProducts.length ? (
                <div className="mt-5 space-y-3">
                  {report.topProducts.slice(0, 6).map((product, index) => (
                    <Card
                      key={product.name}
                      className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/80"
                    >
                      <div className="flex items-center gap-3 text-sm">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-xs font-bold text-white dark:bg-white dark:text-neutral-900">
                          {index + 1}
                        </span>
                        <strong className="min-w-0 flex-1 truncate">{product.name}</strong>
                        <span className="font-bold">{product.quantity}</span>
                      </div>
                      <div className="ml-9 mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div
                          className="h-full rounded-full bg-neutral-900 transition-all dark:bg-white/90"
                          style={{ width: `${(product.quantity / maximumProduct) * 100}%` }}
                        />
                      </div>
                      <p className="ml-9 mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                        {money(product.revenue)} registrados
                      </p>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptySales message="El ranking aparecerá con el primer pedido entregado." />
              )}
            </section>
          </div>

          <section className="paper mt-5 overflow-hidden rounded-3xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-5">
              <div>
                <p className="eyebrow text-[var(--terracotta)]">Detalle</p>
                <h2 className="font-display text-2xl font-bold">Pedidos del periodo</h2>
              </div>
              <span className="rounded-full bg-[var(--mist)] px-3 py-1.5 text-xs font-bold">
                {report.orders.length}
              </span>
            </div>
            {report.orders.length ? (
              <div className="divide-y divide-[var(--line)]">
                {report.orders.map((order) => (
                  <article className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center" key={order.id}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{order.folio}</strong>
                        <span className="rounded-full bg-[#e4ece6] px-2 py-1 text-[10px] font-bold uppercase">
                          Mesa {order.tableCode}
                        </span>
                        <span className="text-xs text-[var(--muted)]">
                          {order.status === "delivered" ? "Entregado" : "En proceso"}
                        </span>
                        {order.paymentMethod && (
                          <span className="rounded-full bg-neutral-100 px-2 py-1 text-[10px] font-bold uppercase text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                            {order.paymentMethod === "cash" ? "Efectivo" : "Tarjeta"}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-[var(--muted)]">
                        {order.items.map((item) => `${item.quantity}× ${item.name}`).join(" · ")}
                      </p>
                      <time className="mt-1 block text-xs text-[var(--muted)]">
                        {new Date(order.createdAt).toLocaleString("es-MX", {
                          dateStyle: "medium",
                          timeStyle: "short"
                        })}
                      </time>
                    </div>
                    <strong className="font-display text-xl">{money(order.total)}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <EmptySales message="No hay pedidos registrados en este periodo." />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function EmptySales({ message }: { message: string }) {
  return (
    <div className="my-6 rounded-2xl border border-dashed border-neutral-200 px-5 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
      {message}
    </div>
  );
}

// ─── Admin: Extras de Desayunos ───────────────────────────────────────────
type BreakfastExtra = {
  id: string;
  name: string;
  price: number;
  active: boolean;
  sortOrder: number;
};

function BreakfastAdmin({ pin }: { pin: string }) {
  const [extras, setExtras] = useState<BreakfastExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");

  const loadExtras = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch(`/api/admin/breakfast-extras?pin=${encodeURIComponent(pin)}`, { cache: "no-store" });
      const data = await response.json().catch(() => []);
      if (Array.isArray(data)) setExtras(data);
    } catch {
      setNotice("No se pudieron cargar los extras.");
    } finally {
      setLoading(false);
    }
  }, [pin]);

  useEffect(() => { void loadExtras(); }, [loadExtras]);

  async function saveExtra(extra?: BreakfastExtra) {
    const trimmedName = name.trim() || (extra?.name ?? "");
    if (!trimmedName) return;
    const numPrice = Number(price) || (extra?.price ?? 0);
    if (isNaN(numPrice) || numPrice < 0) return;

    setNotice("");
    const response = await fetch("/api/admin/breakfast-extras", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pin,
        id: extra?.id ?? null,
        name: extra ? extra.name : trimmedName,
        price: extra ? extra.price : numPrice,
        active: extra ? !extra.active : true,
        sortOrder: extra?.sortOrder ?? extras.length
      })
    });

    if (!response.ok) {
      setNotice("Error al guardar.");
      return;
    }
    setName("");
    setPrice("");
    void loadExtras();
  }

  async function deleteExtra(id: string) {
    if (!window.confirm("¿Eliminar este extra de desayunos?")) return;
    setNotice("");
    const response = await fetch("/api/admin/breakfast-extras", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, id })
    });
    if (!response.ok) {
      setNotice("Error al eliminar.");
      return;
    }
    void loadExtras();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold">Extras de Desayunos</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Estos extras aparecen en todos los productos de la categoría Desayunos.
          </p>
        </div>
        <button
          className={BTN_SECONDARY}
          onClick={() => void loadExtras()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={15} />
          {loading ? "Cargando" : "Actualizar"}
        </button>
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl bg-[#f8e8e2] p-3 text-sm font-bold text-[#8a3b30]">{notice}</div>
      )}

      {/* Add new */}
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
        <label className="flex-1">
          <span className="text-xs font-bold text-[var(--muted)]">Nombre</span>
          <input
            className="mt-1 block w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brown)]"
            placeholder="Ej: Bistec asado"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="w-28">
          <span className="text-xs font-bold text-[var(--muted)]">Precio ($)</span>
          <input
            className="mt-1 block w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brown)]"
            type="number"
            min="0"
            placeholder="35"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <button
          className={BTN_PRIMARY}
          disabled={!name.trim() || !price}
          onClick={() => void saveExtra()}
        >
          <Plus size={15} /> Agregar
        </button>
      </div>

      {/* List */}
      <div className="mt-5 space-y-2">
        {extras.length === 0 && !loading && (
          <p className="rounded-2xl border border-dashed border-[#bdb4a5] py-10 text-center text-sm text-[var(--muted)]">
            No hay extras configurados. Agrega el primero arriba.
          </p>
        )}
        {extras.map((extra) => (
          <div
            key={extra.id}
            className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
              extra.active ? "border-[var(--line)] bg-white" : "border-transparent bg-[#f5f2ed] opacity-60"
            }`}
          >
            <button
              className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white"
              onClick={() => void saveExtra(extra)}
              title={extra.active ? "Desactivar" : "Activar"}
            >
              {extra.active ? <ToggleRight size={20} className="text-[var(--green)]" /> : <ToggleLeft size={20} className="text-[var(--muted)]" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{extra.name}</p>
              <p className="text-xs text-[var(--muted)]">+${extra.price}</p>
            </div>
            <button
              className={BTN_ICON_DANGER}
              onClick={() => void deleteExtra(extra.id)}
              aria-label={`Eliminar extra ${extra.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
