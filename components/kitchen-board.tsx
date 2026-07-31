"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  ChefHat,
  HandPlatter,
  Clock3,
  RefreshCw,
  Search,
  Trash2,
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
import type { Order, OrderStatus, PaymentMethod } from "@/lib/types";

const kitchenColumns: Array<{
  id: string;
  title: string;
  statuses: OrderStatus[];
  icon: typeof Bell;
}> = [
  { id: "new", title: "Por preparar", statuses: ["accepted"], icon: BellRing },
  { id: "preparing", title: "Preparando", statuses: ["preparing"], icon: ChefHat },
  { id: "ready", title: "Listos", statuses: ["ready"], icon: CheckCircle2 }
];

const waiterColumns: typeof kitchenColumns = [
  { id: "review", title: "Por revisar", statuses: ["sent"], icon: BellRing },
  { id: "kitchen", title: "En cocina", statuses: ["accepted", "preparing"], icon: ChefHat },
  { id: "ready", title: "Para entregar", statuses: ["ready"], icon: HandPlatter }
];

type StaffRole = "kitchen" | "waiter";

export function KitchenBoard() {
  return <StaffBoard role="kitchen" />;
}

export function WaiterBoard() {
  return <StaffBoard role="waiter" />;
}

function StaffBoard({ role }: { role: StaffRole }) {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [tableFilter, setTableFilter] = useState("");
  const [sound, setSound] = useState(false);
  const [readyNotice, setReadyNotice] = useState<Order | null>(null);
  const [online, setOnline] = useState(true);
  const [backend, setBackend] = useState<"supabase" | "demo">("supabase");
  const [now, setNow] = useState(0);
  const channelRef = useRef<ReturnType<typeof connectOrderChannel> | null>(null);
  const soundRef = useRef(false);
  const notifiedReadyRef = useRef(new Set<string>());
  const boardColumns = role === "kitchen" ? kitchenColumns : waiterColumns;

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

  const notifyWaiterReady = useCallback(
    (order: Order) => {
      if (
        role !== "waiter" ||
        order.status !== "ready" ||
        notifiedReadyRef.current.has(order.id)
      ) {
        return;
      }

      notifiedReadyRef.current.add(order.id);
      setReadyNotice(order);
      beep();

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Pedido listo · Mesa ${order.tableCode}`, {
          body: `${order.folio} está listo para entregar.`,
          tag: `orquideas-ready-${order.id}`
        });
      }
    },
    [beep, role]
  );

  useEffect(() => {
    if (!unlocked) return;
    channelRef.current = connectOrderChannel(({ type, order }) => {
      if (!order) return;
      upsert(order);
      notifyWaiterReady(order);
      if (
        (role === "waiter" && type === "new") ||
        (role === "kitchen" && order.status === "accepted")
      ) {
        beep();
      }
    });
    return () => channelRef.current?.close();
  }, [beep, notifyWaiterReady, role, unlocked, upsert]);

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
        rows.forEach(notifyWaiterReady);
      } else if (response.status === 503) {
        const demoOrders = readDemoOrders();
        setOrders(demoOrders);
        setBackend("demo");
        demoOrders.forEach(notifyWaiterReady);
      } else {
        throw new Error("PIN incorrecto");
      }
    },
    [notifyWaiterReady]
  );

  async function toggleAlerts() {
    if (sound) {
      setSound(false);
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    setSound(true);
  }

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

  useEffect(() => {
    if (!unlocked || !pin) return;
    const timer = window.setInterval(() => {
      void loadOrders(pin);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [loadOrders, pin, unlocked]);

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const active = !["delivered", "cancelled"].includes(order.status);
        const visibleForRole = role === "waiter" || order.status !== "sent";
        return (
          visibleForRole &&
          (statusFilter === "all" || (statusFilter === "active" ? active : order.status === statusFilter)) &&
          (!tableFilter || order.tableCode.toLowerCase().includes(tableFilter.toLowerCase()))
        );
      }),
    [orders, role, statusFilter, tableFilter]
  );

  async function changeStatus(
    order: Order,
    status: OrderStatus,
    paymentMethod?: PaymentMethod
  ) {
    if (
      status === "accepted" &&
      !window.confirm(`¿Confirmas que el pedido ${order.folio} está correcto y puede pasar a cocina?`)
    ) {
      return;
    }
    if (status === "cancelled" && !window.confirm(`¿Cancelar el pedido ${order.folio}?`)) return;
    let updated: Order | null = null;
    if (backend === "supabase") {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, pin, paymentMethod })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        window.alert(payload?.error || "No fue posible actualizar el pedido.");
        return;
      }
      updated = payload as Order;
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

  async function removeItem(order: Order, itemId: string) {
    if (
      !window.confirm(
        `¿Eliminar este producto del pedido ${order.folio}? El total se recalculará automáticamente.`
      )
    ) {
      return;
    }

    if (backend !== "supabase") {
      window.alert("La edición de productos requiere conexión con Supabase.");
      return;
    }

    const response = await fetch(`/api/orders/${order.id}/items/${itemId}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      window.alert(payload?.error || "No fue posible eliminar el producto.");
      return;
    }

    const updated = payload as Order;
    upsert(updated);
    await channelRef.current?.send({ type: "edited", order: updated });
  }

  if (!unlocked) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <form className="paper w-full max-w-sm rounded-[2rem] p-8 shadow-2xl" onSubmit={unlock}>
          <Brand />
          <div className="mt-8 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--charcoal)] text-[var(--gold)] shadow-lg">
            {role === "kitchen" ? <ChefHat size={28} /> : <HandPlatter size={28} />}
          </div>
          <h1 className="mt-5 font-display text-3xl font-bold">
            Acceso para {role === "kitchen" ? "cocina" : "meseros"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Ingresa el PIN del personal para ver los pedidos de todas las mesas.
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
          <button className="focus-ring mt-4 h-14 w-full rounded-2xl bg-[var(--brown)] font-bold text-white shadow-lg hover:bg-[var(--brown-dark)]">
            Abrir tablero
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/92 px-5 py-4 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-5">
            <Brand compact />
            <span className="hidden h-8 w-px bg-[var(--line)] sm:block" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
                Operación
              </p>
              <h1 className="font-display text-2xl font-bold">
                {role === "kitchen" ? "Tablero de cocina" : "Tablero de meseros"}
              </h1>
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
              onClick={() => void toggleAlerts()}
            >
              {sound ? <BellRing size={16} /> : <Bell size={16} />}
              {sound ? "Alertas activas" : "Activar alertas"}
            </button>
          </div>
        </div>
      </header>

      {role === "waiter" && readyNotice && (
        <div
          aria-live="assertive"
          className="fixed inset-x-4 top-24 z-50 mx-auto max-w-md animate-pop rounded-3xl border-2 border-[#d9c17f] bg-[var(--charcoal)] p-4 text-white shadow-2xl"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--gold)] text-[var(--charcoal)]">
              <BellRing size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-[#d9c17f]">
                Cocina terminó
              </p>
              <strong className="font-display text-2xl">Mesa {readyNotice.tableCode}</strong>
              <p className="mt-1 text-sm text-white/80">
                El pedido {readyNotice.folio} está listo para entregar.
              </p>
            </div>
            <button
              aria-label="Cerrar alerta"
              className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10"
              onClick={() => setReadyNotice(null)}
            >
              <XCircle size={20} />
            </button>
          </div>
          <button
            className="focus-ring mt-4 min-h-11 w-full rounded-xl bg-[var(--gold)] font-bold text-[var(--charcoal)]"
            onClick={() => {
              setTableFilter(readyNotice.tableCode);
              setStatusFilter("ready");
              setReadyNotice(null);
            }}
          >
            Ver pedido listo
          </button>
        </div>
      )}

      <div className="mx-auto max-w-[1500px] p-4 lg:p-5">
        {backend === "demo" && (
          <div className="mb-4 rounded-2xl bg-[#f4dfb4] px-4 py-3 text-sm text-[#694500]">
            Conexión temporal activa: revisa la configuración de Supabase para recuperar pedidos
            después de recargar.
          </div>
        )}
        <div className="mb-4 rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm">
          {role === "waiter" ? (
            <>
              <strong>Revisa antes de enviar:</strong> puedes quitar productos o cancelar el pedido
              mientras esté en revisión. Al confirmar, aparecerá en cocina.
            </>
          ) : (
            <>
              <strong>Pedidos confirmados:</strong> aquí solo aparecen después de que un mesero
              revisó y aprobó el pedido.
            </>
          )}
        </div>
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
            {role === "waiter" && <option value="sent">Por revisar</option>}
            <option value="accepted">Confirmados</option>
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
          {boardColumns.map((column) => {
            const ColumnIcon = column.icon;
            const columnOrders = filtered.filter((order) => column.statuses.includes(order.status));
            return (
              <section key={column.id} className="staff-column min-w-0 rounded-[1.75rem] p-3">
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
                      role={role}
                      onStatus={changeStatus}
                      onRemoveItem={removeItem}
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
  role,
  onStatus,
  onRemoveItem
}: {
  order: Order;
  now: number;
  role: StaffRole;
  onStatus: (order: Order, status: OrderStatus, paymentMethod?: PaymentMethod) => void;
  onRemoveItem: (order: Order, itemId: string) => void;
}) {
  const minutes = Math.max(0, Math.floor((now - +new Date(order.createdAt)) / 60000));
  const next: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> =
    role === "kitchen"
      ? {
          accepted: { label: "Comenzar preparación", status: "preparing" },
          preparing: { label: "Marcar listo", status: "ready" }
        }
      : {
          sent: { label: "Confirmar y enviar a cocina", status: "accepted" },
          ready: { label: "Registrar entrega", status: "delivered" }
        };
  const action = next[order.status];
  return (
    <article
      className={`paper order-card animate-pop overflow-hidden rounded-2xl ${
        order.status === "sent" ? "ring-2 ring-[var(--gold)]" : ""
      }`}
    >
      <div className="premium-header flex items-start justify-between p-4 text-white">
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
            <li
              className="border-b border-[var(--line)] pb-3 last:border-0"
              key={item.itemId || `${item.productId}-${index}`}
            >
              <div className="flex items-start gap-2 font-bold">
                <span className="text-[var(--terracotta)]">{item.quantity}×</span>
                <span className="min-w-0 flex-1">{item.name}</span>
                {role === "waiter" && order.status === "sent" && item.itemId && (
                  <button
                    className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#f8e8e2] text-[#8a3b30]"
                    aria-label={`Eliminar ${item.name}`}
                    title="Eliminar producto"
                    onClick={() => onRemoveItem(order, item.itemId!)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {item.option && (
                <p className="ml-6 mt-1 rounded-lg bg-[#edf3ec] px-2 py-1.5 text-xs font-bold text-[var(--green)]">
                  Elecciones: {item.option}
                </p>
              )}
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
        {role === "waiter" && order.status === "ready" ? (
          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--cream)] p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
              Pregunta al cliente cómo pagará
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="focus-ring min-h-12 rounded-xl bg-[var(--green)] px-3 font-bold text-white"
                onClick={() => onStatus(order, "delivered", "cash")}
              >
                Efectivo
              </button>
              <button
                className="focus-ring min-h-12 rounded-xl bg-[var(--brown)] px-3 font-bold text-white"
                onClick={() => onStatus(order, "delivered", "card")}
              >
                Tarjeta
              </button>
            </div>
          </div>
        ) : action ? (
          <button
            className="focus-ring mt-4 min-h-12 w-full rounded-xl bg-[var(--brown)] px-4 font-bold text-white shadow-md hover:bg-[var(--brown-dark)]"
            onClick={() => onStatus(order, action.status)}
          >
            {action.label}
          </button>
        ) : null}
        {role === "waiter" && ["sent", "accepted"].includes(order.status) && (
          <button
            className="focus-ring mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-[#8a3b30]"
            onClick={() => onStatus(order, "cancelled")}
          >
            <XCircle size={15} /> Cancelar pedido completo
          </button>
        )}
      </div>
    </article>
  );
}
