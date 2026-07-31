import type { Order } from "@/lib/types";

export function mergeOrders(current: Order[], incoming: Order[]) {
  const byId = new Map(current.map((order) => [order.id, order]));

  for (const order of incoming) {
    const previous = byId.get(order.id);
    if (!previous || +new Date(order.updatedAt) >= +new Date(previous.updatedAt)) {
      byId.set(order.id, order);
    }
  }

  return [...byId.values()].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
  );
}

export function orderAgeMinutes(order: Order, now: number) {
  return Math.max(0, Math.floor((now - +new Date(order.createdAt)) / 60000));
}

export function urgencyLevel(order: Order, now: number) {
  const minutes = orderAgeMinutes(order, now);
  if (minutes >= 25) return "critical" as const;
  if (minutes >= 15) return "warning" as const;
  return "normal" as const;
}
