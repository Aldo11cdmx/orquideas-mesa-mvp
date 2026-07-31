import { describe, expect, it } from "vitest";
import { mergeOrders, orderAgeMinutes, urgencyLevel } from "@/lib/staff-board-utils";
import type { Order } from "@/lib/types";

function order(id: string, createdAt: string, updatedAt = createdAt): Order {
  return {
    id,
    folio: id,
    tableCode: "A1",
    status: "sent",
    items: [],
    notes: "",
    subtotal: 0,
    total: 0,
    createdAt,
    updatedAt
  };
}

describe("staff board utilities", () => {
  it("conserva la versión más reciente y ordena del pedido más antiguo al nuevo", () => {
    const old = order("1", "2026-07-31T10:00:00Z", "2026-07-31T10:01:00Z");
    const stale = { ...old, status: "accepted" as const, updatedAt: "2026-07-31T10:00:30Z" };
    const newer = order("2", "2026-07-31T10:05:00Z");

    expect(mergeOrders([old], [newer, stale])).toEqual([old, newer]);
  });

  it("clasifica pedidos demorados", () => {
    const sample = order("1", "2026-07-31T10:00:00Z");
    const now = +new Date("2026-07-31T10:26:00Z");
    expect(orderAgeMinutes(sample, now)).toBe(26);
    expect(urgencyLevel(sample, now)).toBe("critical");
  });
});
