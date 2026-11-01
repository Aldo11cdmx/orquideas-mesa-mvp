import { describe, expect, it } from "vitest";
import {
  EXTRA_RAPIDO_AMOUNTS_MXN,
  isAllowedExtraRapidoAmount,
  toCentavos,
  validateExtraRapidoAmount
} from "@/lib/extra-rapid";

describe("extra rápido amounts", () => {
  it("allows exactly the approved amounts", () => {
    expect(EXTRA_RAPIDO_AMOUNTS_MXN).toEqual([
      10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 90
    ]);
    for (const amount of EXTRA_RAPIDO_AMOUNTS_MXN) {
      expect(isAllowedExtraRapidoAmount(amount)).toBe(true);
    }
  });

  it("rejects unauthorized amounts", () => {
    for (const amount of [0, -10, 80, 85, 89, 100]) {
      expect(isAllowedExtraRapidoAmount(amount)).toBe(false);
    }
  });

  it("validates and converts to centavos", () => {
    expect(validateExtraRapidoAmount(10)).toBe(10);
    expect(toCentavos(90)).toBe(9000);
  });

  it("rejects invalid inputs", () => {
    for (const input of [0, -5, 1.5, NaN, Infinity, "10", null, undefined]) {
      expect(() => validateExtraRapidoAmount(input as number)).toThrow();
    }
  });
});
