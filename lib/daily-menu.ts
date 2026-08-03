import type { DailyMenuConfig, DailyMenuExtra } from "@/lib/types";

export const dailyCourseOrder = ["Entrada", "Guarnición", "Plato fuerte", "Bebida"] as const;

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asExtras(value: unknown): DailyMenuExtra[] {
  if (!Array.isArray(value)) return [];
  const result: DailyMenuExtra[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const extra = item as { name?: unknown; price?: unknown; active?: unknown };
    const name = typeof extra.name === "string" ? extra.name.trim() : "";
    const price = Number(extra.price);
    if (!name || !Number.isFinite(price) || price < 0) continue;
    const active = typeof extra.active === "boolean" ? extra.active : true;
    result.push({ name, price, active });
  }
  return result;
}

export function normalizeDailyMenuConfig(payload: unknown): DailyMenuConfig | null {
  if (!payload || typeof payload !== "object") return null;
  const source = payload as Record<string, unknown>;
  const rawCourses =
    source.courses && typeof source.courses === "object"
      ? (source.courses as Record<string, unknown>)
      : {};

  return {
    active: Boolean(source.active),
    availableToday: Boolean(source.availableToday),
    serviceDate: typeof source.serviceDate === "string" ? source.serviceDate : "",
    availableFrom: typeof source.availableFrom === "string" ? source.availableFrom : "13:00",
    availableUntil: typeof source.availableUntil === "string" ? source.availableUntil : "17:00",
    price: Number(source.price || 0),
    courses: Object.fromEntries(
      dailyCourseOrder.map((course) => [course, asStringArray(rawCourses[course])])
    ),
    extras: asExtras(rawCourses.Extras ?? source.extras),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined
  };
}

export function serializeDailyMenuCourses(menu: DailyMenuConfig) {
  return {
    ...Object.fromEntries(
      dailyCourseOrder.map((course) => [course, menu.courses[course] || []])
    ),
    Extras: (menu.extras || []).map((extra) => ({
      name: extra.name.trim(),
      price: Number(extra.price),
      active: extra.active !== false
    }))
  };
}