import type { Product, ProductExtra, CartItem } from "@/lib/types";

export function calculateTrustedTotal(
  items: Array<{
    productId: string;
    quantity: number;
    extras?: Array<{ name: string; price?: number }>;
    priceModifier?: number;
  }>,
  catalog: Product[]
) {
  if (items.length < 1 || items.length > 30) throw new Error("invalid_items");
  return items.reduce((total, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10) {
      throw new Error("invalid_quantity");
    }
    const product = catalog.find(
      (candidate) =>
        candidate.id === item.productId && !candidate.soldOut
    );
    if (!product) throw new Error("invalid_product");

    let unitPrice = product.price;

    if (item.extras && item.extras.length > 0) {
      const configExtras: ProductExtra[] = product.extrasConfig ?? [];
      const extraPriceMap = new Map(
        configExtras
          .filter((e) => e.active !== false)
          .map((e) => [e.name, e.price])
      );

      for (const extra of item.extras) {
        const verifiedPrice = extraPriceMap.get(extra.name);
        if (verifiedPrice === undefined) {
          throw new Error(`invalid_extra:${extra.name}`);
        }
        unitPrice += verifiedPrice;
      }
    }

    if (item.priceModifier !== undefined) {
      const group = product.optionGroups?.find((g) => g.choicePrices);
      if (group && group.choicePrices) {
        if (!group.choicePrices.includes(item.priceModifier)) {
          throw new Error(`invalid_price_modifier:${item.priceModifier}`);
        }
        unitPrice += item.priceModifier;
      } else if (item.priceModifier !== 0) {
        throw new Error("invalid_price_modifier_no_config");
      }
    }

    return total + unitPrice * item.quantity;
  }, 0);
}

export function cartItemTotal(item: CartItem): number {
  const extrasTotal = (item.extras || []).reduce((sum, extra) => sum + extra.price, 0);
  return (item.unitPrice + extrasTotal) * item.quantity;
}

export function calculateCartTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + cartItemTotal(item), 0);
}
