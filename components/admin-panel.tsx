"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  History,
  LayoutGrid,
  Pencil,
  Plus,
  Save,
  Settings2,
  Store,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductImage } from "@/components/product-image";
import { categories, money, products as seedProducts } from "@/lib/menu";
import { readDemoOrders } from "@/lib/order-store";
import type { DailyMenuConfig, Product } from "@/lib/types";

const ADMIN_PRODUCTS = "orquideas-admin-products";

export function AdminPanel() {
  const [pin, setPin] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("menu");
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_PRODUCTS);
    const savedPin = sessionStorage.getItem("orquideas-admin-pin");
    queueMicrotask(() => {
      if (saved) setProducts(JSON.parse(saved));
      if (savedPin) {
        setPin(savedPin);
        setReady(true);
      }
    });
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch(`/api/admin/daily-menu?pin=${encodeURIComponent(pin)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      return window.alert(payload?.error || "PIN incorrecto");
    }
    sessionStorage.setItem("orquideas-admin-pin", pin);
    setReady(true);
  }

  function persist(next: Product[]) {
    setProducts(next);
    localStorage.setItem(ADMIN_PRODUCTS, JSON.stringify(next));
  }

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <form className="paper w-full max-w-sm rounded-[2rem] p-7" onSubmit={login}>
          <Brand />
          <Settings2 className="mt-8 text-[var(--terracotta)]" size={40} />
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
          <button className="focus-ring mt-4 h-14 w-full rounded-2xl bg-[var(--green)] font-bold text-white">
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
    ["history", "Historial", History],
    ["summary", "Resumen", BarChart3]
  ] as const;

  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <Brand compact />
          <span className="rounded-full bg-[#e4ece6] px-4 py-2 text-xs font-bold">
            Panel administrativo
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-5 p-4 md:grid-cols-[210px_1fr] md:p-6">
        <nav className="paper flex gap-2 overflow-x-auto rounded-2xl p-2 md:block md:h-fit">
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
          {tab === "menu" && (
            <MenuAdmin
              products={products}
              onEdit={setEditing}
              onChange={persist}
              onCreate={() =>
                setEditing({
                  id: `new-${Date.now()}`,
                  name: "",
                  description: "",
                  price: 0,
                  category: "Mega hamburguesas",
                  image: "/menu/texas.png"
                })
              }
            />
          )}
          {tab === "daily" && <DailyAdmin pin={pin} />}
          {tab === "tables" && <TablesAdmin />}
          {tab === "history" && <HistoryAdmin />}
          {tab === "summary" && <SummaryAdmin />}
        </section>
      </div>
      {editing && (
        <EditProduct
          product={editing}
          onClose={() => setEditing(null)}
          onSave={(product) => {
            persist([product, ...products.filter((item) => item.id !== product.id)]);
            setEditing(null);
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
  onCreate
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onChange: (products: Product[]) => void;
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
            Los cambios de este panel demo se guardan en este navegador.
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
          <article className="paper flex gap-3 rounded-2xl p-3" key={product.id}>
            <ProductImage
              src={product.image}
              alt=""
              className="h-24 w-24 shrink-0 rounded-xl"
            />
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-bold">{product.name || "Producto nuevo"}</h2>
              <p className="mt-1 text-sm">{money(product.price)}</p>
              <p className="mt-1 truncate text-xs text-[var(--muted)]">{product.category}</p>
              <div className="mt-3 flex items-center justify-between">
                <button
                  className="focus-ring flex items-center gap-1 text-xs font-bold"
                  onClick={() => onEdit(product)}
                >
                  <Pencil size={14} /> Editar
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
        className="paper max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-[2rem] p-6"
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
  price: 125,
  courses: {
    Entrada: ["Sopa de tortilla", "Consomé del día"],
    "Plato fuerte": ["Milanesa con papas", "Enchiladas verdes"],
    Bebida: ["Agua de jamaica", "Agua de horchata"]
  }
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
    const response = await fetch("/api/admin/daily-menu", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, ...draft })
    });
    const payload = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setNotice(payload?.error || "No fue posible guardar");
      return;
    }
    setDraft(payload as DailyMenuConfig);
    setNotice("Menú guardado y publicado correctamente.");
  }

  function setCourse(course: string, text: string) {
    const options = text
      .split("\n")
      .map((option) => option.trim())
      .filter(Boolean);
    setDraft((current) => ({
      ...current,
      courses: { ...current.courses, [course]: options }
    }));
  }

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
        Configuración del día
      </p>
      <h1 className="font-display text-4xl font-bold">Comida corrida</h1>
      <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
        Solo cambia las opciones del día y presiona “Guardar y publicar”. Escribe una opción por
        renglón.
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
              {(["Entrada", "Plato fuerte", "Bebida"] as const).map((course) => (
                <label className="text-sm font-bold" key={course}>
                  {course}
                  <span className="ml-2 font-normal text-[var(--muted)]">
                    una opción por renglón
                  </span>
                  <textarea
                    className="mt-2 min-h-28 w-full resize-y rounded-xl border border-[var(--line)] p-3 font-normal"
                    required
                    value={(draft.courses[course] || []).join("\n")}
                    onChange={(event) => setCourse(course, event.target.value)}
                  />
                </label>
              ))}
            </div>

            {notice && (
              <div
                className={`mt-5 rounded-xl p-3 text-sm font-bold ${
                  notice.includes("correctamente")
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
                Object.values(draft.courses).some((options) => options.length === 0)
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

function HistoryAdmin() {
  const orders = readDemoOrders();
  return (
    <div>
      <h1 className="font-display text-4xl font-bold">Historial</h1>
      <div className="paper mt-5 overflow-hidden rounded-2xl">
        {orders.length === 0 ? (
          <p className="p-10 text-center text-[var(--muted)]">Aún no hay pedidos registrados.</p>
        ) : (
          orders.map((order) => (
            <div
              className="flex items-center justify-between border-b border-[var(--line)] p-4 last:border-0"
              key={order.id}
            >
              <div>
                <strong>{order.folio}</strong>
                <p className="text-xs text-[var(--muted)]">
                  Mesa {order.tableCode} · {order.status}
                </p>
              </div>
              <strong>{money(order.total)}</strong>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SummaryAdmin() {
  const orders = readDemoOrders();
  const ranking = useMemo(() => {
    const counts = new Map<string, number>();
    orders.flatMap((order) => order.items).forEach((item) => {
      counts.set(item.name, (counts.get(item.name) || 0) + item.quantity);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [orders]);
  return (
    <div>
      <h1 className="font-display text-4xl font-bold">Resumen</h1>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          ["Pedidos", orders.length],
          ["Ventas estimadas", money(orders.reduce((sum, order) => sum + order.total, 0))],
          ["Mesas activas", 6]
        ].map(([label, value]) => (
          <div className="paper rounded-2xl p-5" key={label}>
            <p className="text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
            <strong className="mt-2 block font-display text-3xl">{value}</strong>
          </div>
        ))}
      </div>
      <div className="paper mt-5 rounded-2xl p-5">
        <h2 className="font-display text-2xl font-bold">Más solicitados</h2>
        {ranking.length ? (
          ranking.map(([name, count], index) => (
            <div className="mt-4 flex items-center gap-3" key={name}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e4ece6] font-bold">
                {index + 1}
              </span>
              <span className="flex-1 font-bold">{name}</span>
              <span>{count}</span>
            </div>
          ))
        ) : (
          <p className="mt-4 text-sm text-[var(--muted)]">
            El ranking aparecerá después del primer pedido.
          </p>
        )}
      </div>
    </div>
  );
}
