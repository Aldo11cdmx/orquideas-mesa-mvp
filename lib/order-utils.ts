import type { Product } from "@/lib/types";

export function calculateTrustedTotal(
  items: Array<{ productId: string; quantity: number }>,
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
    return total + product.price * item.quantity;
  }, 0);
}
