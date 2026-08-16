"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CheckCircle2,
  ChefHat,
  Hand,
  HandPlatter,
  Clock3,
  Flame,
  Minus,
  Plus,
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
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { money } from "@/lib/menu";
import {
  connectOrderChannel,
  readDemoOrders,
  saveDemoOrder,
  updateDemoOrder
} from "@/lib/order-store";
import type { Order, OrderStatus, PaymentMethod } from "@/lib/types";
import type { WaiterCall } from "@/lib/order-store";
import {
  mergeOrders,
  orderAgeMinutes,
  urgencyLevel
} from "@/lib/staff-board-utils";

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
  { id: "kitchen", title: "En cocina", statuses: ["sent", "accepted", "preparing"], icon: ChefHat },
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
  const [sessionView, setSessionView] = useState<{ sessionId: string; tableCode: string } | null>(null);
  const [closingSession, setClosingSession] = useState(false);
  const [online, setOnline] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState("CONNECTING");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const [backend, setBackend] = useState<"supabase" | "demo">("supabase");
  const [waiterCalls, setWaiterCalls] = useState<WaiterCall[]>([]);
  const [groupByTable, setGroupByTable] = useState(false);
  const [now, setNow] = useState(0);
  const channelRef = useRef<ReturnType<typeof connectOrderChannel> | null>(null);
  const soundRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const alertedRef = useRef(new Set<string>());
  const ordersRef = useRef<Order[]>([]);
  const hasLoadedRef = useRef(false);
  const requestRef = useRef<Promise<void> | null>(null);
  const cancelledIdsRef = useRef<Set<string>>(
    new Set(
      typeof window !== "undefined"
        ? JSON.parse(sessionStorage.getItem("orquideas-cancelled") || "[]")
        : []
    )
  );
  const boardColumns = role === "kitchen" ? kitchenColumns : waiterColumns;

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const upsert = useCallback((incoming: Order) => {
    setOrders((current) => {
      const next = mergeOrders(current, [incoming]);
      ordersRef.current = next;
      return next;
    });
  }, []);

  const beep = useCallback(() => {
    if (!soundRef.current) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextClass) return;
    const context = audioContextRef.current || new AudioContextClass();
    audioContextRef.current = context;
    void context.resume();
    const start = context.currentTime + 0.02;
    [0, 1].forEach((round) => {
      [740, 980, 740, 1180].forEach((frequency, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const toneStart = start + round * 1.25 + index * 0.24;
        oscillator.type = "square";
        oscillator.frequency.setValueAtTime(frequency, toneStart);
        gain.gain.setValueAtTime(0.3, toneStart);
        gain.gain.exponentialRampToValueAtTime(0.001, toneStart + 0.18);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(toneStart);
        oscillator.stop(toneStart + 0.2);
      });
    });
  }, []);

  const notifyStaff = useCallback(
    (order: Order) => {
      let kind = "";
      let title = "";
      let body = "";

      if (role === "waiter" && order.status === "ready") {
        kind = "ready";
        title = `Pedido listo · Mesa ${order.tableCode}`;
        body = `${order.folio} está listo para entregar.`;
      } else if (role === "kitchen" && order.status === "accepted") {
        kind = "accepted";
        title = `Nuevo para cocina · Mesa ${order.tableCode}`;
        body = `${order.folio} acaba de ser confirmado por el cliente.`;
      } else {
        return;
      }

      const alertKey = `${role}:${kind}:${order.id}`;
      if (alertedRef.current.has(alertKey)) return;
      alertedRef.current.add(alertKey);
      if (kind === "ready") setReadyNotice(order);
      beep();
      navigator.vibrate?.([300, 120, 300, 120, 450]);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
          body,
          tag: `orquideas-${kind}-${order.id}`
        });
      }
    },
    [beep, role]
  );

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
      if (requestRef.current) return requestRef.current;
      const request = (async () => {
        setSyncing(true);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 9000);
        try {
          const response = await fetch(`/api/orders?pin=${encodeURIComponent(enteredPin)}`, {
            cache: "no-store",
            signal: controller.signal
          });
          if (response.ok) {
            const rows = (await response.json()) as Order[];
            if (hasLoadedRef.current) {
              const previous = new Map(
                ordersRef.current.map((order) => [order.id, `${order.status}:${order.updatedAt}`])
              );
              rows.forEach((order) => {
                if (previous.get(order.id) !== `${order.status}:${order.updatedAt}`) {
                  notifyStaff(order);
                }
              });
            }
            const returnedIds = new Set(rows.map((order) => order.id));
            const next = mergeOrders(ordersRef.current, rows).filter((order) => {
              if (cancelledIdsRef.current.has(order.id)) return false;
              const stillReturned = returnedIds.has(order.id);
              const terminal = ["delivered", "cancelled"].includes(order.status);
              return stillReturned || !terminal;
            });
            ordersRef.current = next;
            setOrders(next);
            setBackend("supabase");
            setLastSync(Date.now());
            hasLoadedRef.current = true;
          } else if (response.status === 503) {
            const demoOrders = readDemoOrders();
            ordersRef.current = demoOrders;
            setOrders(demoOrders);
            setBackend("demo");
          } else {
            throw new Error("PIN incorrecto");
          }
        } finally {
          window.clearTimeout(timeout);
          setSyncing(false);
        }
      })();
      requestRef.current = request;
      try {
        await request;
      } finally {
        requestRef.current = null;
      }
    },
    [notifyStaff]
  );

  useEffect(() => {
    if (!unlocked) return;
    channelRef.current = connectOrderChannel(
      ({ order, type, waiterCall }) => {
        if (order) {
          upsert(order);
          notifyStaff(order);
        } else if (type === "database_change") {
          void loadOrders(pin);
        } else if (type === "waiter-call" && waiterCall && role === "waiter") {
          setWaiterCalls((current) => {
            const exists = current.some((c) => c.id === waiterCall.id);
            if (exists) return current;
            beep();
            navigator.vibrate?.([600, 200, 600]);
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification(`Mesa ${waiterCall.tableCode} solicita atención`, {
                body: "El cliente está llamando al mesero.",
                tag: `orquideas-call-${waiterCall.tableCode}`
              });
            }
            return [...current.slice(-9), waiterCall];
          });
        }
      },
      setRealtimeStatus
    );
    return () => channelRef.current?.close();
  }, [loadOrders, notifyStaff, pin, unlocked, upsert, role, beep]);

  async function toggleAlerts() {
    if (sound) {
      soundRef.current = false;
      setSound(false);
      return;
    }

    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }
    soundRef.current = true;
    alertedRef.current.clear();
    setSound(true);
    beep();
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
    loadOrders(saved)
      .then(() => {
        setPin(saved);
        setUnlocked(true);
      })
      .catch(() => sessionStorage.removeItem("orquideas-staff-pin"));
  }, [loadOrders]);

  useEffect(() => {
    if (!unlocked || !pin) return;
    let timer = 0;
    let stopped = false;
    const schedule = () => {
      const connected = realtimeStatus === "SUBSCRIBED";
      // Broadcast/Postgres Changes deliver instantly. This short automatic
      // reconciliation guarantees that staff still receive orders if a mobile
      // network silently drops a realtime packet; no manual refresh is needed.
      const delay = connected ? (role === "waiter" ? 4000 : 7000) : 3000;
      timer = window.setTimeout(async () => {
        if (!stopped && document.visibilityState === "visible") {
          await loadOrders(pin).catch(() => undefined);
        }
        if (!stopped) schedule();
      }, delay + Math.floor(Math.random() * 1500));
    };
    const refresh = () => {
      if (document.visibilityState === "visible") void loadOrders(pin).catch(() => undefined);
    };
    schedule();
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadOrders, pin, realtimeStatus, role, unlocked]);

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
      }).sort((a, b) => {
        // Sort by urgency then by time
        const urgencyOrder: Record<string, number> = { critical: 0, warning: 1, normal: 2 };
        const ua = urgencyLevel(a, now);
        const ub = urgencyLevel(b, now);
        if (ua !== ub) return (urgencyOrder[ua] ?? 2) - (urgencyOrder[ub] ?? 2);
        return +new Date(a.createdAt) - +new Date(b.createdAt);
      }),
    [orders, role, statusFilter, tableFilter, now]
  );
  const activeCount = orders.filter(
    (order) => !["delivered", "cancelled"].includes(order.status)
  ).length;
  const urgentCount = filtered.filter(
    (order) => urgencyLevel(order, now) !== "normal"
  ).length;
  const readyCount = orders.filter((order) => order.status === "ready").length;
  const peakMode = activeCount >= 12;

  useEffect(() => {
    if (!unlocked) return;
    const attention = role === "waiter"
      ? orders.filter((order) => order.status === "ready").length
      : orders.filter((order) => order.status === "accepted").length;
    document.title = attention
      ? `(${attention}) ${role === "kitchen" ? "Cocina" : "Meseros"} · Orquídeas`
      : `${role === "kitchen" ? "Cocina" : "Meseros"} · Orquídeas`;
    return () => {
      document.title = "Orquídeas";
    };
  }, [orders, role, unlocked]);

  async function changeStatus(
    order: Order,
    status: OrderStatus,
    paymentMethod?: PaymentMethod
  ) {
    if (status === "cancelled" && !window.confirm(`¿Cancelar el pedido ${order.folio}?`)) return;
    let updated: Order | null = null;
    let apiError = "";
    if (backend === "supabase") {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status, pin, paymentMethod })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        apiError = payload?.error || "No fue posible actualizar el pedido.";
        // Si es cancelación, forzar localmente aunque falle el backend
        if (status !== "cancelled") {
          window.alert(apiError);
          return;
        }
      } else {
        updated = payload as Order;
      }
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
    if (status === "cancelled") {
      cancelledIdsRef.current.add(order.id);
      try { sessionStorage.setItem("orquideas-cancelled", JSON.stringify([...cancelledIdsRef.current])); } catch { /* ok */ }
      // También remover de demo si existe
      const key = `orquideas-demo-order-${order.id}`;
      try { localStorage.removeItem(key); } catch { /* ok */ }
    }
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

    if (backend === "supabase") {
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
      return;
    }

    // Modo demo: eliminar localmente
    const itemIndex = order.items.findIndex(
      (i) => (i.itemId || i.productId) === itemId
    );
    if (itemIndex === -1) {
      // Try by productId as last resort
      const byProduct = order.items.findIndex((i) => i.productId === itemId);
      if (byProduct === -1) return;
      const updatedItems = [...order.items];
      updatedItems.splice(byProduct, 1);
      if (updatedItems.length === 0) {
        window.alert("No puedes eliminar el último producto; cancela el pedido completo.");
        return;
      }
      const newTotal = updatedItems.reduce(
        (s, i) => s + i.unitPrice * i.quantity + (i.priceModifier || 0),
        0
      );
      const updated = { ...order, items: updatedItems, total: newTotal, updatedAt: new Date().toISOString() };
      updateDemoOrder(updated.id, order.status);
      saveDemoOrder(updated);
      upsert(updated);
      return;
    }
    const updatedItems = [...order.items];
    updatedItems.splice(itemIndex, 1);
    if (updatedItems.length === 0) {
      window.alert("No puedes eliminar el último producto; cancela el pedido completo.");
      return;
    }
    const newTotal = updatedItems.reduce(
      (s, i) => s + i.unitPrice * i.quantity + (i.priceModifier || 0),
      0
    );
    const updated = { ...order, items: updatedItems, total: newTotal, updatedAt: new Date().toISOString() };
    updateDemoOrder(updated.id, order.status);
    saveDemoOrder(updated);
    upsert(updated);
  }

  async function closeSession(sessionId: string) {
    setClosingSession(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        window.alert(payload?.error || "No fue posible cerrar la sesión.");
        return;
      }
      void loadOrders(pin);
      setSessionView(null);
    } catch {
      window.alert("No fue posible cerrar la sesión.");
    } finally {
      setClosingSession(false);
    }
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
          <button className="focus-ring mt-4 h-14 w-full rounded-full bg-neutral-900 text-sm font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.98] dark:bg-white dark:text-neutral-900">
            Abrir tablero
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen dark:bg-neutral-950">
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/92 px-5 py-4 shadow-sm backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/80">
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
                online && realtimeStatus === "SUBSCRIBED"
                  ? "bg-[#dce8c8] text-[#274a27]"
                  : online && realtimeStatus === "CONNECTING"
                    ? "bg-[#f4dfb4] text-[#694500]"
                    : online
                      ? "bg-[#f4dfb4] text-[#694500]"
                      : "bg-[#f1d0ca] text-[#7a2c22]"
              }`}
            >
              {!online
                ? <><WifiOff size={16} /> Sin conexión</>
                : realtimeStatus === "SUBSCRIBED"
                  ? <><Wifi size={16} /> En vivo</>
                  : <><RefreshCw size={14} className="animate-spin" /> Reconectando</>
              }
            </span>
            {(!online || realtimeStatus !== "SUBSCRIBED") && (
              <button
                className="focus-ring inline-flex min-h-9 items-center gap-1 rounded-full border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                onClick={() => void loadOrders(pin)}
              >
                <RefreshCw size={14} /> Actualizar
              </button>
            )}
            <button
              className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                sound
                  ? "bg-[var(--green)] text-white"
                  : "border border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
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
            className="focus-ring mt-4 min-h-14 w-full rounded-xl bg-[var(--gold)] text-base font-bold text-[var(--charcoal)]"
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

      {role === "waiter" && waiterCalls.length > 0 && (
        <div className="fixed inset-x-4 top-4 z-[55] mx-auto max-w-lg space-y-2">
          {waiterCalls.map((call) => (
            <div
              key={call.id}
              aria-live="polite"
              className="animate-pop flex items-center gap-3 rounded-2xl border-2 border-[var(--terracotta)] bg-[#f8e8e2] p-4 shadow-2xl"
              role="alert"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--terracotta)] text-white">
                <Hand size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
                  Cliente solicita atención
                </p>
                <strong className="font-display text-xl">Mesa {call.tableCode}</strong>
                <p className="text-xs text-[var(--terracotta)]/70">
                  {new Date(call.timestamp).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </p>
              </div>
              <button
                aria-label={`Atender mesa ${call.tableCode}`}
                className="focus-ring shrink-0 rounded-xl bg-[var(--terracotta)] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
                onClick={() => {
                  setTableFilter(call.tableCode);
                  setStatusFilter("all");
                  setWaiterCalls((current) => current.filter((c) => c.id !== call.id));
                }}
              >
                Ver mesa
              </button>
              <button
                aria-label="Descartar llamado"
                className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/60"
                onClick={() =>
                  setWaiterCalls((current) => current.filter((c) => c.id !== call.id))
                }
              >
                <XCircle size={18} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mx-auto max-w-[1500px] p-4 lg:p-5">
        {backend === "demo" && (
          <div className="mb-4 rounded-2xl bg-[#f4dfb4] px-4 py-3 text-sm text-[#694500]">
            Conexión temporal activa: revisa la configuración de Supabase para recuperar pedidos
            después de recargar.
          </div>
        )}
        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen operativo">
          <button
            className="rounded-2xl border border-neutral-200/80 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/90"
            onClick={() => setStatusFilter("active")}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Pendientes</p>
            <strong className="mt-1 block font-display text-3xl font-extrabold text-neutral-900 dark:text-white">{activeCount}</strong>
          </button>
          <button
            className={`rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${
              urgentCount
                ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30"
                : "border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-900/90"
            }`}
            onClick={() => setStatusFilter("active")}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Con demora</p>
            <strong className="mt-1 flex items-center gap-2 font-display text-3xl font-extrabold text-neutral-900 dark:text-white">
              {urgentCount > 0 && <Flame size={24} className="text-amber-600 dark:text-amber-400" />} {urgentCount}
            </strong>
          </button>
          <button
            className="rounded-2xl border border-neutral-200/80 bg-white p-4 text-left shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900/90"
            onClick={() => setStatusFilter("ready")}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Listos</p>
            <strong className="mt-1 block font-display text-3xl font-extrabold text-neutral-900 dark:text-white">{readyCount}</strong>
          </button>
          <div className="rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/90">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Operación</p>
            <strong className="mt-1 block text-lg font-extrabold text-neutral-900 dark:text-white">
              {peakMode ? "Hora pico 🔥" : "Flujo normal"}
            </strong>
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
              {syncing ? "Sincronizando…" : lastSync ? `Actualizado ${new Date(lastSync).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Cargando"}
            </span>
          </div>
        </section>
        <div className="mb-4 rounded-2xl border border-neutral-200/80 bg-white px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900/60">
          <strong className="text-neutral-900 dark:text-white">Pedidos confirmados:</strong>
          <span className="text-neutral-600 dark:text-neutral-400"> los pedidos llegan directamente desde la confirmación del cliente.</span>
        </div>
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Table filter chips */}
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {(() => {
              const tables = [...new Set(orders.filter(o => !["delivered", "cancelled"].includes(o.status)).map(o => o.tableCode))].sort();
              if (tables.length === 0) return null;
              return (
                <>
                  <button
                    className={`focus-ring rounded-full px-4 py-2 text-xs transition-all duration-200 active:scale-95 ${
                      !tableFilter
                        ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                        : "border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                    }`}
                    onClick={() => setTableFilter("")}
                  >
                    Todas
                  </button>
                  {tables.map((t) => (
                    <button
                      key={t}
                      className={`focus-ring rounded-full px-4 py-2 text-xs transition-all duration-200 active:scale-95 ${
                        tableFilter === t
                          ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                          : "border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
                      }`}
                      onClick={() => setTableFilter(tableFilter === t ? "" : t)}
                    >
                      {t === "LLEVAR" ? "🥡 Llevar" : t}
                    </button>
                  ))}
                </>
              );
            })()}
            {!tableFilter && orders.filter(o => !["delivered", "cancelled"].includes(o.status)).length === 0 && (
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">Las mesas activas aparecerán aquí</span>
            )}
          </div>
          <select
            aria-label="Filtrar por estado"
            className="min-h-10 rounded-full border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-800 shadow-sm outline-none dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="active">Pedidos activos</option>
            <option value="all">Todos</option>
            <option value="accepted">Confirmados</option>
            <option value="preparing">Preparando</option>
            <option value="ready">Listos</option>
          </select>
          <button
            className="focus-ring inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-xs font-semibold text-neutral-800 shadow-sm transition-all active:scale-95 disabled:opacity-60 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
            disabled={syncing}
            onClick={() => void loadOrders(pin)}
          >
            <RefreshCw className={syncing ? "animate-spin" : ""} size={15} />
            {syncing ? "Sincronizando" : "Actualizar"}
          </button>
          {role === "waiter" && (
            <button
              className={`focus-ring inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                groupByTable
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "border border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200"
              }`}
              onClick={() => setGroupByTable((v) => !v)}
            >
              {groupByTable ? "Por estado" : "Por mesa"}
            </button>
          )}
          <span className="ml-auto text-xs font-semibold text-neutral-600 dark:text-neutral-400">
            {filtered.length} pedidos visibles
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {filtered.length === 0 && !syncing ? (
            <div className="md:col-span-3 animate-fade-in rounded-[1.75rem] border border-dashed border-neutral-200 py-16 text-center dark:border-neutral-700">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                {role === "kitchen" ? <ChefHat size={34} className="text-neutral-700 dark:text-neutral-300" /> : <HandPlatter size={34} className="text-neutral-700 dark:text-neutral-300" />}
              </div>
              <p className="font-display text-lg font-bold text-neutral-900 dark:text-white">
                {role === "kitchen" ? "Cocina despejada ✨" : "Todo en orden ✨"}
              </p>
              <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                {role === "kitchen"
                  ? "No hay pedidos pendientes. Cuando llegue uno, aparecerá aquí al instante."
                  : "No hay pedidos por entregar. Recibirás alertas cuando cocina termine algo."}
              </p>
            </div>
          ) : (
            boardColumns.map((column) => {
            const ColumnIcon = column.icon;
            const columnOrders = filtered.filter((order) => column.statuses.includes(order.status));
            return (
              <section key={column.id} className="staff-column min-w-0 rounded-[1.75rem] p-3">
                <div className="flex items-center justify-between px-2 py-2">
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold">
                    <ColumnIcon size={20} /> {column.title}
                  </h2>
                  <span className="grid h-7 min-w-7 place-items-center rounded-full bg-neutral-100 px-2 text-sm font-bold text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
                    {columnOrders.length}
                  </span>
                </div>
                {role === "kitchen" && column.id === "new" && columnOrders.length > 0 && (
                  <button
                    className="focus-ring mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-3 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-neutral-800 active:scale-95 dark:bg-white dark:text-neutral-900"
                    onClick={async () => {
                      if (!window.confirm(`¿Iniciar preparación de los ${columnOrders.length} pedidos nuevos?`)) return;
                      for (const o of columnOrders) {
                        await changeStatus(o, "preparing");
                      }
                    }}
                  >
                    <ChefHat size={14} /> Preparar todos
                  </button>
                )}
                {role === "kitchen" && column.id === "ready" && columnOrders.length > 0 && (
                  <button
                    className="focus-ring mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--green)] px-3 text-xs font-bold text-white transition hover:opacity-90"
                    onClick={async () => {
                      if (!window.confirm(`¿Marcar los ${columnOrders.length} pedidos listos como entregados?`)) return;
                      for (const o of columnOrders) {
                        await changeStatus(o, "delivered");
                      }
                    }}
                  >
                    <CheckCircle2 size={14} /> Marcar todos entregados
                  </button>
                )}
                <div className="mt-2 space-y-3">
                   {columnOrders.map((order) => (
                     <KitchenCard
                       key={order.id}
                       order={order}
                       now={now}
                       role={role}
                       onStatus={changeStatus}
                       onRemoveItem={removeItem}
                       onViewSession={() => {
                         if (order.sessionId) setSessionView({ sessionId: order.sessionId, tableCode: order.tableCode });
                       }}
                     />
                   ))}
                  {columnOrders.length === 0 && (
                    <div className="animate-fade-in rounded-2xl border border-dashed border-neutral-200 py-12 text-center dark:border-neutral-700">
                      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 dark:bg-neutral-800">
                        <Utensils size={26} className="text-neutral-700 dark:text-neutral-300" />
                      </div>
                      <p className="font-bold text-neutral-900 dark:text-white">Sin pedidos</p>
                      <p className="mt-1 text-xs font-medium text-neutral-600 dark:text-neutral-400">
                        {column.id === "new"
                          ? "Aún no han llegado pedidos nuevos"
                          : column.id === "ready"
                            ? role === "waiter"
                              ? "No hay pedidos para entregar"
                              : "Cocina no ha marcado nada como listo"
                            : column.id === "kitchen"
                              ? "No hay pedidos en cocina"
                              : "Nada en preparación"}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            );
          }))}
        </div>

        {role === "waiter" && groupByTable && (
          <TableGroupedView
            orders={filtered}
            now={now}
            onStatus={changeStatus}
            onRemoveItem={removeItem}
            onViewSession={(sessionId, tableCode) => setSessionView({ sessionId, tableCode })}
          />
        )}
      </div>

      {sessionView && (
        <SessionAccountModal
          sessionId={sessionView.sessionId}
          tableCode={sessionView.tableCode}
          orders={orders.filter(
            (o) =>
              o.sessionId === sessionView.sessionId &&
              !["delivered", "cancelled"].includes(o.status)
          )}
          allOrders={orders.filter((o) => o.sessionId === sessionView.sessionId)}
          onClose={() => setSessionView(null)}
          onCloseSession={() => closeSession(sessionView.sessionId)}
          closing={closingSession}
          pin={pin}
        />
      )}
    </main>
  );
}

function KitchenCard({
  order,
  now,
  role,
  onStatus,
  onRemoveItem,
  onViewSession
}: {
  order: Order;
  now: number;
  role: StaffRole;
  onStatus: (order: Order, status: OrderStatus, paymentMethod?: PaymentMethod) => void;
  onRemoveItem: (order: Order, itemId: string) => void;
  onViewSession: () => void;
}) {
  const minutes = orderAgeMinutes(order, now);
  const urgency = urgencyLevel(order, now);
  const next: Partial<Record<OrderStatus, { label: string; status: OrderStatus }>> =
    role === "kitchen"
      ? {
          accepted: { label: "Comenzar preparación", status: "preparing" },
          preparing: { label: "Marcar listo", status: "ready" }
        }
      : {
          ready: { label: "Registrar entrega", status: "delivered" }
        };
  const action = next[order.status];
  return (
    <Card
      className={`order-card card-enter card-hover animate-pop overflow-hidden rounded-3xl border dark:border-neutral-800 ${
        order.status === "sent" ? "ring-2 ring-[var(--gold)]" : ""
      } ${urgency === "critical" ? "order-card-critical" : urgency === "warning" ? "order-card-warning" : ""}`}
    >
      <div className="premium-header flex items-start justify-between p-4 text-white">
        <div>
          {order.tableCode === "LLEVAR" ? (
            <>
              <Badge className="h-auto border-none bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-[#7c2d00] shadow-[0_0_18px_rgba(245,158,11,0.55)]">
                🥡 Para llevar
              </Badge>
              {order.customerName && (
                <p className="mt-2 font-display text-lg font-bold leading-none text-[#ffd166]">
                  👤 {order.customerName}
                </p>
              )}
            </>
          ) : (
            <p className="text-xs uppercase tracking-wider text-[#d9c17f]">Mesa {order.tableCode}</p>
          )}
          <strong className="mt-1 block font-display text-4xl">{order.folio}</strong>
        </div>
        <div className="text-right">
          <StatusPill status={order.status} />
          <p className="mt-2 text-xs">{order.folio}</p>
          {order.sessionId && (
            <p className="mt-1 text-[10px] text-[#d9c17f]">Sesión #{order.sessionId.slice(0, 8)}</p>
          )}
        </div>
      </div>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span
            className={`flex items-center gap-2 font-bold ${
              urgency === "critical"
                ? "text-lg text-red-700 dark:text-red-400"
                : urgency === "warning"
                  ? "text-base text-[#c2410c] dark:text-orange-400"
                  : "text-sm text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Clock3 size={urgency === "critical" ? 22 : urgency === "warning" ? 20 : 16} />
            {minutes < 1 ? "ahora" : `${minutes} min`}
          </span>
          {urgency !== "normal" && (
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider ${urgency === "critical" ? "bg-red-700 text-white animate-pulse" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300"}`}>
              {urgency === "critical" ? "⚠️ Urgente" : "Revisar"}
            </span>
          )}
          {urgency === "normal" && minutes >= 25 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
              ⏳ {minutes} min
            </span>
          )}
          <span className="ml-auto text-xs font-bold text-neutral-700 dark:text-neutral-300">
            {order.items.reduce((s, i) => s + i.quantity, 0)} items
          </span>
        </div>
        <ul className="space-y-3">
          {order.items.map((item, index) => (
            <li
              className="border-b border-[var(--line)] pb-3 last:border-0"
              key={item.itemId || `${item.productId}-${index}`}
            >
              <div className="flex items-start gap-2 font-bold">
                <span className="text-[#c2410c] dark:text-orange-400">{item.quantity}×</span>
                <span className="min-w-0 flex-1 text-neutral-900 dark:text-neutral-100">{item.name}</span>
                {role === "waiter" && ["sent", "accepted"].includes(order.status) && (
                  <button
                    className="focus-ring grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={`Eliminar ${item.name}`}
                    title="Eliminar producto"
                    onClick={() => onRemoveItem(order, item.itemId || item.productId)}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {item.option && (
                <p className="ml-6 mt-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                  Elecciones: {item.option}
                </p>
              )}
              {item.extras && item.extras.length > 0 && (
                <div className="ml-6 mt-1 space-y-0.5">
                  {item.extras.map((extra, extraIndex) => (
                    <p key={extraIndex} className="text-xs font-medium text-[#c2410c] dark:text-orange-400">
                      + {extra.name} {extra.price !== undefined ? money(extra.price) : ""}
                    </p>
                  ))}
                </div>
              )}
              {item.notes && (
                <p className="ml-6 mt-1 rounded-lg bg-amber-100 p-2 text-xs font-bold text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                  {item.notes}
                </p>
              )}
            </li>
          ))}
        </ul>
        {order.notes && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-neutral-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-neutral-100">
            <strong>Observación general:</strong> {order.notes}
          </div>
        )}
        <div className="mt-4 flex justify-between border-t border-[var(--line)] pt-3 dark:border-neutral-800">
          <span className="text-neutral-700 dark:text-neutral-300">Total</span>
          <strong className="text-neutral-900 dark:text-white">{money(order.total)}</strong>
        </div>
        {role === "waiter" && order.status === "ready" ? (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/60">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
              Pregunta al cliente cómo pagará
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="focus-ring min-h-14 rounded-2xl bg-[var(--green)] px-3 text-base font-bold text-white transition active:scale-95"
                onClick={() => onStatus(order, "delivered", "cash")}
              >
                Efectivo
              </button>
              <button
                className="focus-ring min-h-14 rounded-2xl bg-neutral-900 px-3 text-base font-bold text-white transition active:scale-95 dark:bg-white dark:text-neutral-900"
                onClick={() => onStatus(order, "delivered", "card")}
              >
                Tarjeta
              </button>
            </div>
          </div>
        ) : action ? (
          <button
            className="focus-ring mt-4 min-h-14 w-full rounded-2xl bg-neutral-900 px-4 text-base font-bold text-white shadow-md transition hover:bg-neutral-800 active:scale-95 dark:bg-white dark:text-neutral-900"
            onClick={() => onStatus(order, action.status)}
          >
            {action.label}
          </button>
        ) : null}
        {role === "waiter" && ["sent", "accepted", "preparing", "ready"].includes(order.status) && (
          <button
            className="focus-ring mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-bold text-red-700 transition active:scale-95 dark:text-red-400"
            onClick={() => onStatus(order, "cancelled")}
          >
            <XCircle size={15} /> Cancelar pedido completo
          </button>
        )}
        {role === "waiter" && order.sessionId && (
          <button
            className="focus-ring mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-neutral-100 px-4 text-xs font-bold text-neutral-800 transition hover:bg-neutral-200 active:scale-95 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
            onClick={onViewSession}
          >
            <Search size={15} /> Ver cuenta de mesa
          </button>
        )}
      </div>
    </Card>
  );
}

function SessionAccountModal({
  sessionId,
  tableCode,
  orders,
  allOrders,
  onClose,
  onCloseSession,
  closing,
  pin
}: {
  sessionId: string;
  tableCode: string;
  orders: Order[];
  allOrders: Order[];
  onClose: () => void;
  onCloseSession: () => void;
  closing: boolean;
  pin: string;
}) {
  const allTotal = allOrders.reduce((sum, order) => sum + order.total, 0);
  const pendingOrdersCount = orders.length;
  const canClose = pendingOrdersCount === 0;
  const [splitCount, setSplitCount] = useState(2);
  const splitAmount = splitCount > 0 ? allTotal / splitCount : allTotal;

  return (
    <div className="animate-fade-in fixed inset-0 z-[60] flex items-end overflow-hidden bg-[#171411]/70 backdrop-blur-[3px] lg:items-center lg:justify-center lg:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-title"
        className="animate-scale-in w-full max-w-2xl rounded-t-[2rem] bg-[var(--paper)] shadow-2xl lg:rounded-[2rem]"
      >
        <div className="border-b border-[var(--line)] p-5 sm:p-7">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">
                Mesa {tableCode}
              </p>
              <h2 id="session-title" className="mt-1 font-display text-2xl font-bold">
                Cuenta de sesión
              </h2>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Sesión #{sessionId.slice(0, 8)} · {allOrders.length} pedidos
              </p>
            </div>
            <button
              className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-[#eee8dc]"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>

        <div className="max-h-[60dvh] overflow-y-auto p-5 sm:p-7">
          {allOrders.length === 0 ? (
            <p className="text-center text-sm text-[var(--muted)]">
              Esta sesión aún no tiene pedidos.
            </p>
          ) : (
            <div className="space-y-4">
              {allOrders.map((order) => (
                <article key={order.id} className="paper rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong className="font-display">{order.folio}</strong>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {new Date(order.createdAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <strong className="text-lg">{money(order.total)}</strong>
                      <StatusPill status={order.status} />
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {order.items.map((item, index) => (
                      <li key={item.itemId || `${item.productId}-${index}`} className="flex justify-between">
                        <span>
                          {item.quantity}× {item.name}
                          {item.option && <span className="text-[var(--muted)]"> · {item.option}</span>}
                          {item.extras && item.extras.length > 0 && (
                            <span className="block text-xs text-[var(--terracotta)]">
                              Extras: {item.extras.map((e) => e.name).join(", ")}
                            </span>
                          )}
                        </span>
                        <span className="text-[var(--muted)]">{money(item.unitPrice * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                  {order.notes && (
                    <p className="mt-2 text-xs text-[var(--muted)]">Nota: {order.notes}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-[var(--line)] bg-[#faf7f3] p-5 sm:p-7">
          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Pedidos pendientes</span>
              <strong>{pendingOrdersCount}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Total acumulado</span>
              <strong className="text-xl text-[var(--brown)]">{money(allTotal)}</strong>
            </div>

            {/* ── Dividir cuenta ── */}
            <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Dividir cuenta</p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white font-bold"
                  aria-label="Menos personas"
                  onClick={() => setSplitCount((v) => Math.max(1, v - 1))}
                >
                  <Minus size={16} />
                </button>
                <strong className="w-8 text-center text-lg">{splitCount}</strong>
                <button
                  className="focus-ring grid h-9 w-9 place-items-center rounded-xl border border-[var(--line)] bg-white font-bold"
                  aria-label="Más personas"
                  onClick={() => setSplitCount((v) => Math.min(20, v + 1))}
                >
                  <Plus size={16} />
                </button>
                <span className="text-sm text-[var(--muted)]">personas</span>
                <span className="ml-auto font-display text-xl font-bold text-[var(--brown)]">
                  {money(splitAmount)} c/u
                </span>
              </div>
            </div>
          </div>

          {canClose ? (
            <button
              className="focus-ring flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--gold)] px-5 font-bold text-[var(--charcoal)] shadow-lg transition hover:opacity-90"
              disabled={closing}
              onClick={() => {
                if (
                  window.confirm(
                    `¿Cerrar la sesión de la mesa ${tableCode}? Se marcarán todos los pedidos como cerrados.\n\nPIN: ${pin}`
                  )
                ) {
                  onCloseSession();
                }
              }}
            >
              {closing ? "Cerrando…" : "Cerrar sesión"}
            </button>
          ) : (
            <div className="rounded-2xl bg-[#f4dfb4]/60 p-4 text-sm">
              <p className="font-bold text-[#694500]">
                Quedan {pendingOrdersCount} pedido(s) pendientes.
              </p>
              <p className="mt-1 text-xs text-[#694500]/80">
                Marca todos los pedidos como entregados para poder cerrar la cuenta.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function TableGroupedView({
  orders,
  now,
  onStatus,
  onRemoveItem,
  onViewSession
}: {
  orders: Order[];
  now: number;
  onStatus: (order: Order, status: OrderStatus, paymentMethod?: PaymentMethod) => void;
  onRemoveItem: (order: Order, itemId: string) => void;
  onViewSession: (sessionId: string, tableCode: string) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const order of orders) {
      const key = order.tableCode;
      const existing = map.get(key) || [];
      existing.push(order);
      map.set(key, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [orders]);

  if (grouped.length === 0) {
    return (
      <div className="animate-fade-in rounded-2xl border border-dashed border-neutral-200 py-12 text-center dark:border-neutral-700">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 dark:bg-neutral-800"><HandPlatter size={26} className="text-neutral-700 dark:text-neutral-300" /></div>
        <p className="font-bold text-neutral-900 dark:text-white">Sin pedidos activos</p>
      </div>
    );
  }

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {grouped.map(([tableCode, tableOrders]) => {
        const total = tableOrders.reduce((s, o) => s + o.total, 0);
        const readyCount = tableOrders.filter((o) => o.status === "ready").length;
        return (
          <article key={tableCode} className="glass-card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between bg-[var(--charcoal)] px-4 py-3 text-white">
              <div>
                <p className="text-xs text-[#d9c17f]">
                  {tableCode === "LLEVAR" ? "Llevar 🥡" : "Mesa"}
                </p>
                <strong className="font-display text-2xl">{tableCode === "LLEVAR" ? "🥡" : tableCode}</strong>
              </div>
              <div className="text-right">
                <strong className="text-lg">{money(total)}</strong>
                <p className="text-xs font-medium text-white/80">{tableOrders.length} pedidos · {readyCount} listos</p>
              </div>
            </div>
            <div className="divide-y divide-[var(--line)]/40 p-3">
              {tableOrders.map((order) => {
                const minutes = orderAgeMinutes(order, now);
                const urgency = urgencyLevel(order, now);
                return (
                  <div key={order.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{order.folio}</span>
                        <StatusPill status={order.status} />
                      </div>
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ").slice(0, 80)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="text-sm">{money(order.total)}</strong>
                      <p className={`text-xs font-bold ${urgency !== "normal" ? "text-[#c2410c] dark:text-orange-400" : "text-neutral-600 dark:text-neutral-400"}`}>
                        {minutes} min
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            {tableOrders.some((o) => o.sessionId) && (
              <button
                className="focus-ring flex min-h-10 w-full items-center justify-center gap-1 rounded-b-2xl bg-neutral-100 text-xs font-bold text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                onClick={() => {
                  const sessionOrder = tableOrders.find((o) => o.sessionId);
                  if (sessionOrder?.sessionId) onViewSession(sessionOrder.sessionId, tableCode);
                }}
              >
                Ver cuenta completa
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
}
