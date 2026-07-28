"use client";

import { createClient } from "@/lib/supabase/client";
import type { Order, OrderStatus } from "@/lib/types";

const STORAGE_KEY = "orquideas-demo-orders";
const EVENT = "orders";

export function readDemoOrders(): Order[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Order[];
  } catch {
    return [];
  }
}

export function saveDemoOrder(order: Order) {
  const current = readDemoOrders();
  const next = [order, ...current.filter((item) => item.id !== order.id)].slice(0, 100);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: order }));
}

export function updateDemoOrder(id: string, status: OrderStatus) {
  const order = readDemoOrders().find((item) => item.id === id);
  if (!order) return null;
  const updated = { ...order, status, updatedAt: new Date().toISOString() };
  saveDemoOrder(updated);
  return updated;
}

export function onLocalOrders(callback: (order: Order) => void) {
  const handler = (event: Event) => callback((event as CustomEvent<Order>).detail);
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", () => {
    const first = readDemoOrders()[0];
    if (first) callback(first);
  });
  return () => window.removeEventListener(EVENT, handler);
}

export function connectOrderChannel(
  callback: (payload: { type: string; order: Order }) => void
) {
  const supabase = createClient();
  const channel = supabase
    .channel("orquideas-orders", { config: { broadcast: { self: true } } })
    .on("broadcast", { event: "order" }, ({ payload }) => callback(payload))
    .subscribe();

  return {
    send: (payload: { type: string; order: Order }) =>
      channel.send({ type: "broadcast", event: "order", payload }),
    close: () => {
      void supabase.removeChannel(channel);
    },
    channel
  };
}
