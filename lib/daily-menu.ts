import type {
  DailyMenuConfig,
  DailyMenuDrink,
  DailyMenuExtra,
  ProductOptionGroup
} from "@/lib/types";

export const dailyCourseOrder = ["Entrada", "Guarnición", "Plato fuerte", "Bebida"] as const;

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function asDrinks(value: unknown): DailyMenuDrink[] {
  if (!Array.isArray(value)) return [];
  const result: DailyMenuDrink[] = [];
  for (const item of value) {
    if (typeof item === "string") {
      const name = item.trim();
      if (name.length > 0) result.push({ name, active: true });
    } else if (item && typeof item === "object") {
      const drink = item as { name?: unknown; active?: unknown };
      const name = typeof drink.name === "string" ? drink.name.trim() : "";
      if (!name) continue;
      result.push({ name, active: drink.active !== false });
    }
  }
  return result;
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
      Object.entries(rawCourses)
        .filter(([, options]) => Array.isArray(options))
        .map(([course, options]) => {
          if (course === "Bebida") return [course, asDrinks(options)];
          return [course, asStringArray(options)];
        })
    ),
    extras: asExtras(rawCourses.Extras ?? source.extras),
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : undefined
  };
}

export function serializeDailyMenuCourses(menu: DailyMenuConfig) {
  return {
    ...Object.fromEntries(
      Object.entries(menu.courses)
        .filter(([, options]) => Array.isArray(options))
        .map(([course, options]) => {
          if (course === "Bebida") {
            return [
              course,
              (options as DailyMenuDrink[])
                .filter((drink) => drink.name.trim())
                .map((drink) => ({ name: drink.name.trim(), active: drink.active !== false }))
            ];
          }
          return [
            course,
            (options as string[]).filter((option) => option.trim()).map((option) => option.trim())
          ];
        })
    ),
    Extras: (menu.extras || []).map((extra) => ({
      name: extra.name.trim(),
      price: Number(extra.price),
      active: extra.active !== false
    }))
  };
}

export function getCourseOptions(
  course: string,
  options: string[] | DailyMenuDrink[] | undefined
): string[] {
  if (!options) return [];
  if (course === "Bebida") {
    return (options as DailyMenuDrink[]).filter((drink) => drink.active !== false).map((drink) => drink.name);
  }
  return options as string[];
}

const groupCourseMap: Record<string, string> = {
  "primer-tiempo": "Entrada",
  "acompanamiento": "Guarnición",
  "agua": "Bebida"
};

export function resolveDailyCourseGroups(
  baseGroups: ProductOptionGroup[],
  dailyCourses: DailyMenuConfig["courses"] | undefined
): ProductOptionGroup[] {
  if (!dailyCourses) return baseGroups;
  return baseGroups.map((group) => {
    const courseKey = groupCourseMap[group.id];
    if (!courseKey) return group;
    const courseData = dailyCourses[courseKey];
    if (!courseData) return group;
    const activeOptions = getCourseOptions(courseKey, courseData);
    return { ...group, choices: activeOptions };
  });
}