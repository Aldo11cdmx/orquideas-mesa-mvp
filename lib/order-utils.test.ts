import { describe, expect, it } from "vitest";
import { products } from "@/lib/menu";
import { calculateTrustedTotal } from "@/lib/order-utils";

describe("calculateTrustedTotal", () => {
  it("uses catalog prices rather than any client-provided price", () => {
    expect(
      calculateTrustedTotal(
        [
          { productId: "chilaquiles-sencillos", quantity: 2 },
          { productId: "club-sandwich", quantity: 1 }
        ],
        products
      )
    ).toBe(185);
  });

  it("rejects excessive quantities", () => {
    expect(() =>
      calculateTrustedTotal([{ productId: "chilaquiles-sencillos", quantity: 11 }], products)
    ).toThrow("invalid_quantity");
  });

  it("rejects missing products", () => {
    expect(() =>
      calculateTrustedTotal([{ productId: "fake", quantity: 1 }], products)
    ).toThrow("invalid_product");
  });
});
