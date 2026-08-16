"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Brand } from "@/components/brand";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/menu";
import { connectOrderChannel } from "@/lib/order-store";
import type { Order } from "@/lib/types";
import { Check, ChevronRight, Clock3, Share2 } from "lucide-react";

export default function TrackingPage() {
  const params = useParams<{ folio: string }>();
  const folio = params?.folio || "";
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const channelRef = useRef<ReturnType<typeof connectOrderChannel> | null>(null);

  useEffect(() => {
    if (!folio) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/orders/track?folio=${encodeURIComponent(folio)}`);
        const payload = (await res.json().catch(() => null)) as
          | { error?: string }
          | Order
          | Order[]
          | null;
        if (!res.ok) {
          const message =
            payload && typeof payload === "object" && "error" in payload && payload.error
              ? payload.error
              : "No pudimos consultar tu pedido. Intenta de nuevo.";
          setError(message);
          return;
        }
        const found = Array.isArray(payload) ? payload[0] : payload;
        if (found && typeof found === "object" && "id" in found) {
          setOrder(found as Order);
        } else {
          setError("No encontramos ese pedido. Revisa el número de folio.");
        }
      } catch {
        setError("No pudimos consultar tu pedido. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    };
    load();

    // Poll every 8 seconds
    const timer = setInterval(load, 8000);
    return () => clearInterval(timer);
  }, [folio]);

  useEffect(() => {
    if (!order) return;
    channelRef.current = connectOrderChannel(({ order: incoming }) => {
      if (incoming && incoming.id === order.id) {
        setOrder(incoming);
      }
    });
    return () => channelRef.current?.close();
  }, [order?.id]);

  const steps = ["accepted", "preparing", "ready", "delivered"] as const;
  const current = order
    ? steps.indexOf(
        order.status === "cancelled" || order.status === "sent"
          ? "accepted"
          : order.status
      )
    : 0;

  const shareLink = typeof window !== "undefined" ? `${window.location.origin}/seguimiento/${folio}` : "";
  const shareText = `🍽️ Mi pedido en Imperio · ${order?.folio || folio}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareLink}`)}`;

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="text-center">
          <div className="skeleton mx-auto h-12 w-48 rounded-xl" />
          <div className="skeleton mx-auto mt-4 h-6 w-64 rounded-lg" />
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="glass-card w-full max-w-sm rounded-[2rem] p-8 text-center">
          <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-[#f1d0ca] text-2xl">😕</span>
          <h1 className="mt-4 font-display text-2xl font-bold">Ups</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">{error || "Pedido no encontrado"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-6">
      <Brand />
      <section className="glass-card mt-8 overflow-hidden rounded-[2rem]">
        <div className="bg-[var(--green)] px-6 py-8 text-white">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold)] text-[var(--green)]">
            <Check size={30} strokeWidth={3} />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#e5cd90]">
            {order.status === "ready" ? "¡Ya está listo!" : "Pedido en proceso"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold">
            {order.status === "ready"
              ? "Pasa a recoger tu pedido 🎉"
              : order.status === "delivered"
              ? "Pedido entregado"
              : order.status === "cancelled"
              ? "Pedido cancelado"
              : "Estamos preparando tu pedido"}
          </h1>
          <div className="mt-4 flex items-center gap-4">
            <StatusPill status={order.status} />
            <span className="text-sm">Folio {order.folio}</span>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between rounded-2xl bg-[#eee8dc] p-4">
            <span><span className="block text-xs uppercase text-[var(--muted)]">Total</span><strong className="text-xl">{money(order.total)}</strong></span>
            <span className="text-right"><span className="block text-xs uppercase text-[var(--muted)]">Items</span><strong>{order.items.length}</strong></span>
          </div>

          {order.status === "cancelled" ? (
            <div className="mt-5 rounded-2xl bg-[#f1d0ca] p-4 text-[#7a2c22] font-bold text-sm">Este pedido fue cancelado.</div>
          ) : (
            <ol className="mt-6 space-y-0">
              {steps.map((step, index) => (
                <li className={`flex gap-4 ${index === current ? "step-active" : ""}`} key={step}>
                  <div className="flex flex-col items-center">
                    <span className={`step-circle grid h-8 w-8 place-items-center rounded-full ${index <= current ? "bg-[var(--green)] text-white" : "border-2 border-[var(--line)] bg-white"}`}>
                      {index < current ? <Check size={16} /> : index + 1}
                    </span>
                    {index < steps.length - 1 && <span className={`h-9 w-0.5 ${index < current ? "bg-[var(--green)]" : "bg-[var(--line)]"}`} />}
                  </div>
                  <div className="pt-1">
                    <strong className="capitalize">{{ accepted: "Confirmado", preparing: "Preparando", ready: "Listo para recoger", delivered: "Entregado" }[step]}</strong>
                    {index === current && <p className="text-xs text-[var(--muted)]">Estado actual</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {order.status === "ready" && (
            <div className="mt-5 animate-bounce-in rounded-2xl bg-[#dce8c8] p-4 text-center">
              <p className="font-display text-xl font-bold text-[#274a27]">¡Tu pedido está listo!</p>
              <p className="mt-1 text-sm text-[#274a27]/80">Pasa a recogerlo al restaurante. Av. Orquídeas, Hacienda Coacalco.</p>
            </div>
          )}

          <div className="mt-5 space-y-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 font-bold text-white shadow-md hover:opacity-90"
            >
              <Share2 size={18} /> Compartir por WhatsApp
            </a>
            <p className="text-center text-xs text-[var(--muted)]">
              Guarda esta página o compártela para seguir tu pedido.<br />
              Se actualiza solo.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
