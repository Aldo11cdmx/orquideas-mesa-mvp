import { describe, expect, it } from "vitest";
import { getCourseOptions, normalizeDailyMenuConfig, resolveDailyCourseGroups, serializeDailyMenuCourses } from "@/lib/daily-menu";
import type { DailyMenuConfig, ProductOptionGroup } from "@/lib/types";

const seedGroups: ProductOptionGroup[] = [
  { id: "primer-tiempo", label: "Primer tiempo", choices: ["Consomé", "Sopa"], required: true },
  { id: "acompanamiento", label: "Acompañamiento", choices: ["Arroz", "Pasta"], required: true },
  { id: "agua", label: "Agua", choices: ["Agua de fruta", "Agua simple"], required: true }
];

const adminDailyMenu: DailyMenuConfig = {
  active: true,
  availableToday: true,
  serviceDate: "2026-08-04",
  availableFrom: "13:00",
  availableUntil: "17:00",
  price: 125,
  courses: {
    Entrada: ["Consomé", "Crema de zanahoria"],
    Guarnición: ["Arroz primavera", "Pasta roja"],
    "Plato fuerte": ["Milanesa", "Enchiladas"],
    Bebida: [{ name: "Agua de limón con chía", active: true }]
  },
  extras: [{ name: "Huevo", price: 10, active: true }]
};

describe("normalizeDailyMenuConfig", () => {
  it("preserva las opciones configuradas por el admin tras serializar y normalizar", () => {
    const normalized = normalizeDailyMenuConfig({
      ...adminDailyMenu,
      courses: serializeDailyMenuCourses(adminDailyMenu)
    });

    expect(normalized?.courses.Entrada).toEqual(["Consomé", "Crema de zanahoria"]);
    expect(normalized?.courses.Guarnición).toEqual(["Arroz primavera", "Pasta roja"]);
    expect(normalized?.courses["Plato fuerte"]).toEqual(["Milanesa", "Enchiladas"]);
    expect(normalized?.courses.Bebida).toEqual([{ name: "Agua de limón con chía", active: true }]);
    expect(normalized?.extras).toEqual([{ name: "Huevo", price: 10, active: true }]);
  });
});

describe("getCourseOptions", () => {
  it("devuelve los nombres de las bebidas activas", () => {
    expect(
      getCourseOptions("Bebida", [
        { name: "Agua de fruta", active: true },
        { name: "Agua simple", active: false }
      ])
    ).toEqual(["Agua de fruta"]);
  });

  it("devuelve las opciones tal cual para tiempos que no son bebida", () => {
    expect(getCourseOptions("Entrada", ["Consomé", "Crema de zanahoria"])).toEqual(["Consomé", "Crema de zanahoria"]);
  });

  it("devuelve [] cuando no hay datos", () => {
    expect(getCourseOptions("Entrada", undefined)).toEqual([]);
  });
});

describe("resolveDailyCourseGroups", () => {
  it("usa las opciones reales del admin en lugar de filtrar las genéricas (causa raíz)", () => {
    const resolved = resolveDailyCourseGroups(seedGroups, adminDailyMenu.courses);

    expect(resolved[0]).toEqual({
      id: "primer-tiempo",
      label: "Primer tiempo",
      choices: ["Consomé", "Crema de zanahoria"],
      required: true
    });
    expect(resolved[1]).toEqual({
      id: "acompanamiento",
      label: "Acompañamiento",
      choices: ["Arroz primavera", "Pasta roja"],
      required: true
    });
    expect(resolved[2]).toEqual({
      id: "agua",
      label: "Agua",
      choices: ["Agua de limón con chía"],
      required: true
    });
  });

  it("mantiene los labels originales de option_groups", () => {
    const resolved = resolveDailyCourseGroups(seedGroups, adminDailyMenu.courses);
    expect(resolved.map((g) => g.label)).toEqual(["Primer tiempo", "Acompañamiento", "Agua"]);
  });

  it("no deja caer a coincidencias exactas (antes mostraba solo 'Consomé')", () => {
    const resolved = resolveDailyCourseGroups(seedGroups, adminDailyMenu.courses);
    expect(resolved[0].choices).toHaveLength(2);
    expect(resolved[1].choices).toHaveLength(2);
    expect(resolved[2].choices).toHaveLength(1);
  });

  it("es compatible con datos antiguos: sin daily menu, conserva choices originales", () => {
    const resolved = resolveDailyCourseGroups(seedGroups, undefined);
    expect(resolved).toEqual(seedGroups);
  });

  it("deja sin cambios los grupos que no mapean a un curso del daily menu", () => {
    const extraGroups: ProductOptionGroup[] = [
      ...seedGroups,
      { id: "salsa", label: "Elige tu salsa", choices: ["Salsa verde", "Salsa roja"], required: true }
    ];
    const resolved = resolveDailyCourseGroups(extraGroups, adminDailyMenu.courses);
    expect(resolved[3]).toEqual({
      id: "salsa",
      label: "Elige tu salsa",
      choices: ["Salsa verde", "Salsa roja"],
      required: true
    });
  });

  it("respeta bebidas desactivadas en el daily menu", () => {
    const courses = {
      Bebida: [{ name: "Agua de fruta", active: true }, { name: "Agua simple", active: false }]
    };
    const resolved = resolveDailyCourseGroups(seedGroups, courses);
    expect(resolved[2].choices).toEqual(["Agua de fruta"]);
  });

  it("respeta bebidas como string[] en el daily menu (compatibilidad hacia atrás)", () => {
    const courses = { Entrada: ["Consomé"] };
    const resolved = resolveDailyCourseGroups([seedGroups[0]], courses);
    expect(resolved[0].choices).toEqual(["Consomé"]);
  });

  it("muestra TODAS las opciones del admin aunque ninguna coincida con las choices genéricas del producto", () => {
    const resolved = resolveDailyCourseGroups(seedGroups, adminDailyMenu.courses);
    expect(resolved[0].choices).toEqual(["Consomé", "Crema de zanahoria"]);
    expect(resolved[1].choices).toEqual(["Arroz primavera", "Pasta roja"]);
  });

  it("deja el grupo vacío solo cuando el curso del daily menu existe pero tiene cero opciones activas", () => {
    const courses = {
      Entrada: ["Consomé"],
      Guarnición: ["Arroz primavera"],
      Bebida: [{ name: "Agua de limón con chía", active: false }]
    };
    const resolved = resolveDailyCourseGroups(seedGroups, courses);
    expect(resolved[2].choices).toEqual([]);
  });
});
