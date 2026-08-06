import { describe, expect, it } from "vitest";
import { products } from "@/lib/menu";
import { calculateTrustedTotal, calculateCartTotal, cartItemTotal } from "@/lib/order-utils";
import type { CartItem } from "@/lib/types";

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
    ).toBe(165);
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

  describe("extras pricing", () => {
    const cartaProduct = products.find((p) => p.slug === "taco-bistec-longaniza")!;
    const extrasConfig = cartaProduct.extrasConfig!;

    it("adds validated extras from extrasConfig", () => {
      const total = calculateTrustedTotal(
        [
          {
            productId: "taco-bistec-longaniza",
            quantity: 1,
            extras: [{ name: "Café", price: 999 }, { name: "Fruta extra", price: 999 }]
          }
        ],
        products
      );

      // Base $26 + Café $15 + Fruta extra $10 = $51
      // Client's price of 999 is ignored; server config wins.
      expect(total).toBe(51);
    });

    it("ignores client-provided price and uses config price", () => {
      const total = calculateTrustedTotal(
        [
          {
            productId: "club-sandwich",
            quantity: 2,
            extras: [{ name: "Café", price: 0 }]
          }
        ],
        products
      );

      // Base $65 * 2 + Café $15 * 2 = $160
      expect(total).toBe(160);
    });

    it("rejects extras not in the product config", () => {
      expect(() =>
        calculateTrustedTotal(
          [
            {
              productId: "papas-francesa",
              quantity: 1,
              extras: [{ name: "Extra inventado", price: 50 }]
            }
          ],
          products
        )
      ).toThrow("invalid_extra:Extra inventado");
    });

    it("handles products without extrasConfig", () => {
      const total = calculateTrustedTotal(
        [{ productId: "chilaquiles-sencillos", quantity: 1 }],
        products
      );
      expect(total).toBe(50);
    });

    it("calculates total with multiple items and extras", () => {
      const total = calculateTrustedTotal(
        [
          {
            productId: "taco-bistec-longaniza",
            quantity: 2,
            extras: [{ name: "Café", price: 999 }]
          },
          {
            productId: "cafe",
            quantity: 1
          }
        ],
        products
      );

      // Base $26 * 2 + Café extra $15 * 2 + Café normal $15 * 1 = $97
      expect(total).toBe(97);
    });

    it("uses café at $15 as base product", () => {
      const total = calculateTrustedTotal(
        [{ productId: "cafe", quantity: 3 }],
        products
      );
      expect(total).toBe(45);
    });

    it("café con leche evaporada is an option, not a separate product", () => {
      // El producto "Café" tiene optionGroups con choicePrices
      const cafe = products.find((p) => p.slug === "cafe")!;
      expect(cafe.price).toBe(15);
      expect(cafe.optionGroups).toBeDefined();
      expect(cafe.optionGroups![0].choices).toEqual(["Café normal", "Café con leche evaporada"]);
      expect(cafe.optionGroups![0].choicePrices).toEqual([0, 15]);
      // No existe cafe-leche como producto separado
      expect(products.find((p) => p.slug === "cafe-leche")).toBeUndefined();
    });

    it("validates priceModifier against option_groups.choicePrices", () => {
      const total = calculateTrustedTotal(
        [{ productId: "cafe", quantity: 1, priceModifier: 15 }],
        products
      );
      // Base $15 + modifier $15 = $30
      expect(total).toBe(30);
    });

    it("rejects priceModifier not in choicePrices", () => {
      expect(() =>
        calculateTrustedTotal(
          [{ productId: "cafe", quantity: 1, priceModifier: 999 }],
          products
        )
      ).toThrow("invalid_price_modifier:999");
    });

    it("uses té at $15 as base product", () => {
      const total = calculateTrustedTotal(
        [{ productId: "te", quantity: 2 }],
        products
      );
      expect(total).toBe(30);
    });

    it("validates extrasConfig structure from seed", () => {
      expect(extrasConfig).toHaveLength(2);
      expect(extrasConfig[0]).toEqual({ name: "Café", price: 15, active: true });
      expect(extrasConfig[1]).toEqual({ name: "Fruta extra", price: 10, active: true });
    });

    it("rejects inactive extras even if present in catalog", () => {
      // Simular un extra inactivo en el catálogo
      const customCatalog = products.map((p) =>
        p.slug === "taco-bistec-longaniza"
          ? {
              ...p,
              extrasConfig: [{ name: "Café", price: 15, active: false }]
            }
          : p
      );

      expect(() =>
        calculateTrustedTotal(
          [
            {
              productId: "taco-bistec-longaniza",
              quantity: 1,
              extras: [{ name: "Café", price: 0 }]
            }
          ],
          customCatalog
        )
      ).toThrow("invalid_extra:Café");
    });
  });

  describe("comida-corrida extras (from daily menu)", () => {
    it("rejects comida-corrida not in seed catalog", () => {
      expect(() =>
        calculateTrustedTotal([{ productId: "comida-corrida", quantity: 1 }], products)
      ).toThrow("invalid_product");
    });
  });
});

describe("calculateCartTotal / cartItemTotal", () => {
  it("cartItemTotal includes extras in the line total", () => {
    const item: CartItem = {
      productId: "taco-bistec-longaniza",
      name: "Taco de bistec o longaniza",
      unitPrice: 26,
      quantity: 2,
      notes: "",
      extras: [
        { name: "Café", price: 15 },
        { name: "Fruta extra", price: 10 }
      ],
      image: ""
    };
    // (26 + 15 + 10) * 2 = 102
    expect(cartItemTotal(item)).toBe(102);
  });

  it("cartItemTotal works without extras", () => {
    const item: CartItem = {
      productId: "cafe",
      name: "Café normal",
      unitPrice: 15,
      quantity: 3,
      notes: "",
      image: ""
    };
    expect(cartItemTotal(item)).toBe(45);
  });

  it("cartItemTotal works with quantity 1 and no extras", () => {
    const item: CartItem = {
      productId: "cafe",
      name: "Café con leche evaporada",
      unitPrice: 30,
      quantity: 1,
      notes: "",
      priceModifier: 15,
      image: ""
    };
    expect(cartItemTotal(item)).toBe(30);
  });

  it("calculateCartTotal sums all items including extras", () => {
    const cart: CartItem[] = [
      {
        productId: "taco-bistec-longaniza",
        name: "Taco",
        unitPrice: 26,
        quantity: 2,
        notes: "",
        extras: [{ name: "Café", price: 15 }],
        image: ""
      },
      {
        productId: "cafe",
        name: "Café",
        unitPrice: 15,
        quantity: 1,
        notes: "",
        priceModifier: 0,
        image: ""
      }
    ];
    // Taco: (26 + 15) * 2 = 82; Café: 15 * 1 = 15; Total = 97
    expect(calculateCartTotal(cart)).toBe(97);
  });

  it("calculateCartTotal returns 0 for empty cart", () => {
    expect(calculateCartTotal([])).toBe(0);
  });

  it("matches calculateTrustedTotal for the same inputs", () => {
    const cart: CartItem[] = [
      {
        productId: "taco-bistec-longaniza",
        name: "Taco",
        unitPrice: 26,
        quantity: 1,
        notes: "",
        extras: [{ name: "Café", price: 15 }],
        image: ""
      },
      {
        productId: "cafe",
        name: "Café",
        unitPrice: 15,
        quantity: 1,
        notes: "",
        image: ""
      }
    ];

    const trustedTotal = calculateTrustedTotal(
      [
        { productId: "taco-bistec-longaniza", quantity: 1, extras: [{ name: "Café", price: 999 }] },
        { productId: "cafe", quantity: 1 }
      ],
      products
    );
    // (26 + 15) + 15 = 56
    expect(calculateCartTotal(cart)).toBe(trustedTotal);
    expect(trustedTotal).toBe(56);
  });

  it("cartItemTotal includes priceModifier for option variants", () => {
    const item: CartItem = {
      productId: "cafe",
      name: "Café",
      unitPrice: 30,
      quantity: 2,
      notes: "Tipo: Café con leche evaporada",
      priceModifier: 15,
      image: ""
    };
    // unitPrice=30 (15 base + 15 modifier), no extras
    expect(cartItemTotal(item)).toBe(60);
  });
});
