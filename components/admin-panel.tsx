"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  LayoutGrid,
  PackageCheck,
  Pencil,
  Plus,
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
import { connectOrderChannel } from "@/lib/order-store";
import { categories, money, products as seedProducts } from "@/lib/menu";
import type { DailyMenuConfig, Product, SalesReport } from "@/lib/types";

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
      <main className="grid min-h-screen place-items-center px-5">
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
          <button className="focus-ring mt-4 h-14 w-full rounded-2xl bg-[var(--brown)] font-bold text-white shadow-lg hover:bg-[var(--brown-dark)]">
            Entrar
          </button>
        </form>
      </main>
    );
  }

  const nav = [
    ["menu", "Menú", LayoutGrid],
    ["daily", "Comida corrida", Store],
    ["tables", "Mesas", Settings2],
    ["sales", "Corte de caja", BarChart3]
  ] as const;

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/92 px-5 py-4 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Brand compact />
          <span className="rounded-full bg-[#e4ece6] px-4 py-2 text-xs font-bold">
            Panel administrativo
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 p-4 md:grid-cols-[210px_1fr] md:p-6">
        <nav className="paper flex gap-2 overflow-x-auto rounded-3xl p-2 md:sticky md:top-24 md:block md:h-fit">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`focus-ring flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold md:mb-1 md:w-full ${
                tab === id ? "bg-[var(--green)] text-white" : ""
              }`}
              onClick={() => setTab(id)}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <section>
          <TrialBanner compact />
          <div className="mt-5">
          {tab === "menu" && (
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
          )}
          {tab === "daily" && <DailyAdmin pin={pin} />}
          {tab === "tables" && <TablesAdmin />}
            {tab === "sales" && <SalesAdmin pin={pin} />}
          </div>
        </section>
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
          className="focus-ring flex min-h-11 items-center gap-2 rounded-xl bg-[var(--terracotta)] px-4 font-bold text-white"
          onClick={onCreate}
        >
          <Plus size={18} /> Nuevo producto
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
                  className="focus-ring flex items-center gap-1 text-xs font-bold"
                  onClick={() => onEdit(product)}
                >
                  <Pencil size={14} /> Editar
                </button>
                <button
                  className="focus-ring flex items-center gap-1 text-xs font-bold text-[#8a3b30]"
                  aria-label={`Borrar ${product.name}`}
                  onClick={() => onDelete(product)}
                >
                  <Trash2 size={14} /> Borrar
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
    Entrada: ["Consomé del día", "Sopa del día", "Crema del día"],
    Guarnición: ["Arroz", "Pasta"],
    "Plato fuerte": ["Pechuga empanizada", "Enchiladas verdes"],
    Bebida: ["Agua de fruta del día"]
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
        Object.entries(draft.courses).map(([course, options]) => [
          course,
          options.map((option) => option.trim()).filter(Boolean)
        ])
      ),
      extras: (draft.extras || [])
        .map((extra) => ({ name: extra.name.trim(), price: Number(extra.price) }))
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
        [course]: (current.courses[course] || []).map((option, optionIndex) =>
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
        [course]: [...(current.courses[course] || []), ""]
      }
    }));
  }

  function removeCourseOption(course: string, index: number) {
    setDraft((current) => ({
      ...current,
      courses: {
        ...current.courses,
        [course]: (current.courses[course] || []).filter(
          (_, optionIndex) => optionIndex !== index
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
                    className="rounded-xl bg-[#eee8dc] px-3 text-xs font-bold"
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
              {(["Entrada", "Guarnición", "Plato fuerte", "Bebida"] as const).map((course) => (
                <fieldset className="rounded-2xl border border-[var(--line)] p-4" key={course}>
                  <legend className="px-1 font-display text-xl font-bold">{course}</legend>
                  <p className="mb-3 text-xs text-[var(--muted)]">
                    El cliente elegirá 1 de estas opciones.
                  </p>
                  <div className="grid gap-2">
                    {(draft.courses[course] || []).map((option, index) => (
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
                          className="focus-ring grid h-11 w-11 place-items-center rounded-xl border border-[#d8b5ad] text-[#9a392e] disabled:opacity-35"
                          disabled={(draft.courses[course] || []).length <= 1}
                          type="button"
                          onClick={() => removeCourseOption(course, index)}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="focus-ring mt-3 flex h-10 items-center gap-2 rounded-xl bg-[#eee8dc] px-4 text-sm font-bold"
                    disabled={(draft.courses[course] || []).length >= 8}
                    type="button"
                    onClick={() => addCourseOption(course)}
                  >
                    <Plus size={16} /> Agregar otra opción
                  </button>
                </fieldset>
              ))}
            </div>

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
                      className="focus-ring grid h-11 w-11 place-items-center rounded-xl border border-[#d8b5ad] text-[#9a392e]"
                      type="button"
                      onClick={() => removeExtra(index)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="focus-ring mt-3 flex h-10 items-center gap-2 rounded-xl bg-[#eee8dc] px-4 text-sm font-bold"
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
              disabled={
                saving ||
                Object.values(draft.courses).some(
                  (options) =>
                    options.length === 0 || options.some((option) => !option.trim())
                )
              }
            >
              <Save size={18} /> {saving ? "Guardando…" : "Guardar y publicar"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}

function TablesAdmin() {
  const [tables, setTables] = useState(["A1", "A2", "A3", "B1", "B2", "B3"]);
  return (
    <div>
      <h1 className="font-display text-4xl font-bold">Mesas</h1>
      <div className="mt-5 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3">
        {tables.map((table) => (
          <div className="paper flex items-center justify-between rounded-2xl p-5" key={table}>
            <strong className="font-display text-3xl">{table}</strong>
            <ToggleRight className="text-[#377359]" />
          </div>
        ))}
        <button
          className="focus-ring flex min-h-24 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#bdb4a5] font-bold"
          onClick={() => setTables([...tables, `C${tables.length - 5}`])}
        >
          <Plus /> Agregar
        </button>
      </div>
    </div>
  );
}

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
    setLoading(false);
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
          className="focus-ring flex min-h-11 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-4 font-bold"
          onClick={() => void load()}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={17} /> Actualizar
        </button>
      </div>

      <div className="paper mt-5 inline-flex rounded-2xl p-1.5">
        {([
          ["day", "Hoy"],
          ["week", "7 días"],
          ["month", "Este mes"]
        ] as const).map(([value, label]) => (
          <button
            className={`focus-ring rounded-xl px-4 py-2.5 text-sm font-bold ${
              period === value ? "bg-[var(--brown)] text-white shadow" : "text-[var(--muted)]"
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
        <div className="paper mt-5 grid min-h-64 place-items-center rounded-3xl">
          <div className="text-center">
            <RefreshCw className="mx-auto animate-spin text-[var(--brown)]" />
            <p className="mt-3 text-sm text-[var(--muted)]">Calculando el corte…</p>
          </div>
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
                icon: CircleDollarSign
              },
              {
                label: "Efectivo",
                value: money(report.summary.cashSales),
                detail: `${report.summary.cashOrders} pedidos`,
                icon: Banknote
              },
              {
                label: "Tarjeta",
                value: money(report.summary.cardSales),
                detail: `${report.summary.cardOrders} pedidos`,
                icon: CreditCard
              },
              {
                label: "Pedidos entregados",
                value: report.summary.orderCount,
                detail: `${report.summary.itemsSold} productos servidos`,
                icon: PackageCheck
              },
              {
                label: "Ticket promedio",
                value: money(report.summary.averageTicket),
                detail: "Promedio por mesa/pedido",
                icon: TrendingUp
              },
              {
                label: "Pedidos en proceso",
                value: report.summary.pendingOrders,
                detail: money(report.summary.pendingAmount),
                icon: CalendarDays
              }
            ].map(({ label, value, detail, icon: Icon }) => (
              <article className="paper rounded-3xl p-5" key={label}>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e4ece6] text-[var(--green)]">
                  <Icon size={20} />
                </div>
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
                  {label}
                </p>
                <strong className="mt-1 block font-display text-3xl">{value}</strong>
                <span className="mt-1 block text-xs text-[var(--muted)]">{detail}</span>
              </article>
            ))}
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="paper rounded-3xl p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="eyebrow text-[var(--terracotta)]">Tendencia</p>
                  <h2 className="font-display text-2xl font-bold">Consumo por día</h2>
                </div>
                <BarChart3 className="text-[var(--brown)]" />
              </div>
              {report.dailySales.length ? (
                <div className="mt-6 flex min-h-48 items-end gap-3 overflow-x-auto">
                  {report.dailySales.map((day) => (
                    <div className="flex min-w-16 flex-1 flex-col items-center" key={day.day}>
                      <span className="mb-2 text-xs font-bold">{money(day.total)}</span>
                      <div
                        className="w-full min-w-12 rounded-t-xl bg-gradient-to-t from-[var(--brown-dark)] to-[var(--terracotta)]"
                        style={{
                          height: `${Math.max(18, (day.total / maximumDaily) * 140)}px`
                        }}
                      />
                      <span className="mt-2 text-[11px] text-[var(--muted)]">
                        {new Date(`${day.day}T12:00:00`).toLocaleDateString("es-MX", {
                          day: "2-digit",
                          month: "short"
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptySales message="Aún no hay pedidos entregados en este periodo." />
              )}
            </section>

            <section className="paper rounded-3xl p-5 sm:p-6">
              <p className="eyebrow text-[var(--terracotta)]">Ranking</p>
              <h2 className="font-display text-2xl font-bold">Lo más vendido</h2>
              {report.topProducts.length ? (
                <div className="mt-5 space-y-4">
                  {report.topProducts.slice(0, 6).map((product, index) => (
                    <div key={product.name}>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--charcoal)] text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <strong className="min-w-0 flex-1 truncate">{product.name}</strong>
                        <span className="font-bold">{product.quantity}</span>
                      </div>
                      <div className="ml-10 mt-2 h-2 overflow-hidden rounded-full bg-[var(--mist)]">
                        <div
                          className="h-full rounded-full bg-[var(--green)]"
                          style={{ width: `${(product.quantity / maximumProduct) * 100}%` }}
                        />
                      </div>
                      <p className="ml-10 mt-1 text-[11px] text-[var(--muted)]">
                        {money(product.revenue)} registrados
                      </p>
                    </div>
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
                          <span className="rounded-full bg-[#eee8dc] px-2 py-1 text-[10px] font-bold uppercase text-[var(--brown)]">
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
    <div className="my-6 rounded-2xl border border-dashed border-[#bdb4a5] px-5 py-10 text-center text-sm text-[var(--muted)]">
      {message}
    </div>
  );
}
