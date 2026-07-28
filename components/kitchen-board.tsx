"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  ChefHat,
  Clock3,
  RefreshCw,
  Search,
  Utensils,
  Wifi,
  WifiOff,
  XCircle
} from "lucide-react";
import { Brand } from "@/components/brand";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/menu";
import {
  connectOrderChannel,
  readDemoOrders,
  saveDemoOrder,
  updateDemoOrder
} from "@/lib/order-store";
import type { Order, OrderStatus } from "@/lib/types";

const columns: Array<{
  id: string;
  title: string;
  statuses: OrderStatus[];
  icon: typeof Bell;
}> = [
  { id: "new", title: "Nuevos", statuses: ["sent", "accepted"], icon: BellRing },
  { id: "preparing", title: "Preparando", statuses: ["preparing"], icon: ChefHat },
  { id: "ready", title: "Listos", statuses: ["ready"], icon: CheckCircle2 }
];

export function KitchenBoard() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [tableFilter, setTableFilter] = useState("");
  const [sound, setSound] = useState(false);
  const [online, setOnline] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "demo">("supabase");
  const [now, setNow] = useState(0);
  const channelRef = useRef<ReturnType<typeof connectOrderChannel> | null>(null);
  const soundRef = useRef(false);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const upsert = useCallback((incoming: Order) => {
    setOrders((current) => {
      const existing = current.find((order) => order.id === incoming.id);
      const selected =
        existing && +new Date(existing.updatedAt) > +new Date(incoming.updatedAt)
          ? existing
          : incoming;
      return [selected, ...current.filter((order) => order.id !== incoming.id)].sort(
        (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
      );
    });
  }, []);

  const beep = useCallback(() => {
    if (!soundRef.current) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.06, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.35);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  }, []);

  useEffect(() => {
    if (!unlocked) return;
    channelRef.current = connectOrderChannel(({ type, order }) => {
      upsert(order);
      if (type === "new") beep();
    });
    return () => channelRef.current?.close();
  }, [beep, unlocked, upsert]);

  useEffect(() => {
    const firstTick = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    const setConnection = () => setOnline(navigator.onLine);
    setConnection();
    window.addEventListener("online", setConnection);
    window.addEventListener("offline", setConnection);
    return () => {
      clearInterval(timer);
      clearTimeout(firstTick);
      window.removeEventListener("online", setConnection);
      window.removeEventListener("offline", setConnection);
    };
  }, []);

  const loadOrders = useCallback(
    async (enteredPin: string) => {
      const response = await fetch(`/api/orders?pin=${encodeURIComponent(enteredPin)}`);
      if (response.ok) {
        const rows = (await response.json()) as Order[];
        setOrders(rows);
        setBackend("supabase");
      } else if (response.status === 503) {
        setOrders(readDemoOrders());
        setBackend("demo");
      } else {
        throw new Error("PIN incorrecto");
      }
    },
    []
  );

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    try {
      await loadOrders(pin);
      setUnlocked(true);
      sessionStorage.setItem("orquideas-staff-pin", pin);
    } catch {
      window.alert("PIN incorrecto");
    }
  }

  useEffect(() => {
    const saved = sessionStorage.getItem("orquideas-staff-pin");
    if (!saved) return;
    // Restores an explicitly persisted staff session after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders(saved)
      .then(() => {
        setPin(saved);
        setUnlocked(true);
      })
      .catch(() => sessionStorage.removeItem("orquideas-staff-pin"));
  }, [loadOrders]);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const active = !["delivered", "cancelled"].includes(order.status);
        return (
          (statusFilter === "all" || (statusFilter === "active" ? active : order.status === statusFilter)) &&
          (!tableFilter || order.tableCode.toLowerCase().includes(tableFilter.toLowerCase()))
        );
      }),
    [orders, statusFilter, tableFilter]
  );

  async function changeStatus(order: Order, status: OrderStatus) {
    if (status === "cancelled" && !window.confirm(`¿Cancelar el pedido ${order.folio}?`)) return;
    let updated: Order | null = null;
    if (backend === "supabase") {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, pin })
      });
      if (response.ok) updated = await response.json();
    }
    if (!updated) {
      updated = updateDemoOrder(order.id, status) || {
        ...order,
        status,
        updatedAt: new Date().toISOString(),
        source: "demo"
      };
      saveDemoOrder(updated);
    }
    upsert(updated);
    await channelRef.current?.send({ type: "status", order: updated });
  }

  if (!unlocked) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <form className="paper w-full max-w-sm rounded-[2rem] p-7" onSubmit={unlock}>
          <Brand />
          <div className="mt-8 grid h-14 w-14 place-items-center rounded-full bg-[#e4ece6]">
            <ChefHat size={28} />
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold">Acceso a cocina</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Ingresa el PIN de demostración para ver y atender pedidos.
          </p>
          <label className="mt-6 block text-sm font-bold">
            PIN
            <input
              autoFocus
              inputMode="numeric"
              type="password"
              className="mt-2 h-14 w-full rounded-2xl border border-[var(--line)] bg-white px-4 text-xl tracking-[0.3em] outline-none focus:border-[var(--green)]"
              maxLength={20}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>
          <button className="focus-ring mt-4 h-14 w-full rounded-2xl bg-[var(--green)] font-bold text-white">
            Abrir tablero
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#e9e5dc]">
      <header className="border-b border-[var(--line)] bg-[var(--paper)] px-5 py-4">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <Brand compact />
            <span className="hidden h-8 w-px bg-[var(--line)] sm:block" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
                Operación
              </p>
              <h1 className="font-display text-2xl font-bold">Tablero de cocina</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold ${
                online ? "bg-[#dce8c8] text-[#274a27]" : "bg-[#f1d0ca] text-[#7a2c22]"
              }`}
            >
              {online ? <Wifi size={16} /> : <WifiOff size={16} />}
              {online ? "En línea" : "Sin conexión"}
            </span>
            <button
              className={`focus-ring flex min-h-10 items-center gap-2 rounded-full px-3 text-xs font-bold ${
                sound ? "bg-[var(--green)] text-white" : "border border-[var(--line)] bg-white"
              }`}
              onClick={() => setSound((value) => !value)}
            >
              {sound ? <BellRing size={16} /> : <Bell size={16} />}
              {sound ? "Alertas activas" : "Activar alertas"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] p-4 lg:p-5">
        {backend === "demo" && (
          <div className="mb-4 rounded-2xl bg-[#f4dfb4] px-4 py-3 text-sm text-[#694500]">
            Modo demo activo: ejecuta la migración de Supabase para recuperar pedidos después de
            recargar.
          </div>
        )}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <label className="flex min-h-11 items-center gap-2 rounded-xl bg-white px-3">
            <Search size={17} />
            <span className="sr-only">Filtrar por mesa</span>
            <input
              className="w-32 outline-none"
              placeholder="Mesa A1"
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por estado"
            className="min-h-11 rounded-xl border-0 bg-white px-3 font-bold outline-none"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="active">Pedidos activos</option>
            <option value="all">Todos</option>
            <option value="sent">Enviados</option>
            <option value="preparing">Preparando</option>
            <option value="ready">Listos</option>
          </select>
          <button
            className="focus-ring flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-bold"
            onClick={() => loadOrders(pin)}
          >
            <RefreshCw size={17} /> Actualizar
          </button>
          <span className="ml-auto text-sm text-[var(--muted)]">
            {filtered.length} pedidos visibles
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {columns.map((column) => {
            const ColumnIcon = column.icon;
            const columnOrders = filtered.filter((order) => column.statuses.includes(order.status));
            return (
              <section key={column.id} className="min-w-0 rounded-3xl bg-[#dcd7cd] p-3">
                <div className="flex items-center justify-between px-2 py-2">
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                    <ColumnIcon size={20} /> {column.title}
                  </h2>
                  <span className="grid h-7 min-w-7 place-items-center rounded-full bg-white px-2 text-sm font-bold">
                    {columnOrders.length}
                  </span>
                </div>
                <div className="mt-2 space-y-3">
                  {columnOrders.map((order) => (
                    <KitchenCard
                      key={order.id}
                      order={order}
                      now={now}
                      onStatus={changeStatus}
                    />
                  ))}
                  {columnOrders.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#b9b2a5] py-12 text-center text-sm text-[var(--muted)]">
                      <Utensils className="mx-auto mb-3 opacity-50" size={26} />
                      Nada por aquí
                    </div>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function KitchenCard({
  order,
  now,
  onStatus
}: {
  order: Order;
  now: number;
  onStatus: (order: Order, status: OrderStatus) => void;
}) {
  const minutes = Math.max(0, Math.floor((now - +new Date(order.createdAt)) / 60000));
  const next: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> = {
    sent: { label: "Aceptar pedido", status: "accepted" },
    accepted: { label: "Comenzar preparación", status: "preparing" },
    preparing: { label: "Marcar listo", status: "ready" },
    ready: { label: "Entregar", status: "delivered" }
  };
  const action = next[order.status];
  return (
    <article
      className={`paper animate-pop overflow-hidden rounded-2xl ${
        order.status === "sent" ? "ring-2 ring-[var(--gold)]" : ""
      }`}
    >
      <div className="flex items-start justify-between bg-[var(--green)] p-4 text-white">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#d9c17f]">Mesa</p>
          <strong className="font-display text-4xl">{order.tableCode}</strong>
        </div>
        <div className="text-right">
          <StatusPill status={order.status} />
          <p className="mt-2 text-xs">{order.folio}</p>
        </div>
      </div>
      <div className="p-4">
        <div
          className={`mb-3 flex items-center gap-2 text-sm font-bold ${
            minutes >= 15 ? "text-[var(--terracotta)]" : "text-[var(--muted)]"
          }`}
        >
          <Clock3 size={16} /> Hace {minutes} min
        </div>
        <ul className="space-y-3">
          {order.items.map((item, index) => (
            <li className="border-b border-[var(--line)] pb-3 last:border-0" key={index}>
              <div className="flex gap-2 font-bold">
                <span className="text-[var(--terracotta)]">{item.quantity}×</span>
                <span>{item.name}</span>
              </div>
              {item.option && <p className="ml-6 mt-1 text-xs">Salsa: {item.option}</p>}
              {item.notes && (
                <p className="ml-6 mt-1 rounded-lg bg-[#f4dfb4] p-2 text-xs font-bold text-[#694500]">
                  {item.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
        {order.notes && (
          <div className="mt-3 rounded-xl border-2 border-[var(--terracotta)]/30 bg-[#f8e8e2] p-3 text-sm">
            <strong>Observación general:</strong> {order.notes}
          </div>
        )}
        <div className="mt-4 flex justify-between border-t border-[var(--line)] pt-3">
          <span>Total</span>
          <strong>{money(order.total)}</strong>
        </div>
        {action && (
          <button
            className="focus-ring mt-4 min-h-12 w-full rounded-xl bg-[var(--terracotta)] px-4 font-bold text-white"
            onClick={() => onStatus(order, action.status)}
          >
            {action.label}
          </button>
        )}
        <button
          className="focus-ring mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-[#8a3b30]"
          onClick={() => onStatus(order, "cancelled")}
        >
          <XCircle size={15} /> Cancelar
        </button>
      </div>
    </article>
  );
}
