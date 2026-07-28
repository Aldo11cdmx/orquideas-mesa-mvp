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
import type { Product } from "@/lib/types";

const ADMIN_PRODUCTS = "orquideas-admin-products";

export function AdminPanel() {
  const [pin, setPin] = useState("");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("menu");
  const [products, setProducts] = useState<Product[]>(seedProducts);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(ADMIN_PRODUCTS);
    queueMicrotask(() => {
      if (saved) setProducts(JSON.parse(saved));
      if (sessionStorage.getItem("orquideas-admin-pin")) setReady(true);
    });
  }, []);

  function login(event: React.FormEvent) {
    event.preventDefault();
    if (pin !== "2026") return window.alert("PIN incorrecto");
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
          {tab === "daily" && <DailyAdmin />}
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

function DailyAdmin() {
  return (
    <div>
      <h1 className="font-display text-4xl font-bold">Comida corrida</h1>
      <div className="paper mt-5 max-w-2xl rounded-3xl p-6">
        <span className="rounded-full bg-[#f4dfb4] px-3 py-1 text-xs font-bold">
          Datos de demostración
        </span>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {["Fecha", "Horario", "Precio", "Entrada o sopa", "Plato fuerte", "Bebida"].map(
            (label) => (
              <label className="text-sm font-bold" key={label}>
                {label}
                <input
                  className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] px-3 font-normal"
                  defaultValue={
                    label === "Horario" ? "13:00–17:00" : label === "Precio" ? "125" : ""
                  }
                />
              </label>
            )
          )}
        </div>
        <button className="focus-ring mt-5 flex h-12 items-center gap-2 rounded-xl bg-[var(--green)] px-5 font-bold text-white">
          <Save size={17} /> Guardar configuración
        </button>
      </div>
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
