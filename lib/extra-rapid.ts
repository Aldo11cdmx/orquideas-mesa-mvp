import { createServerClient } from "@/lib/supabase/server";

export const EXTRA_RAPIDO_AMOUNTS_MXN = [
  10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 90
] as const;

export const EXTRA_RAPIDO_AMOUNTS_CENTAVOS = EXTRA_RAPIDO_AMOUNTS_MXN.map(
  (amount) => Math.round(amount * 100)
);

export function isAllowedExtraRapidoAmount(amountMxn: number): boolean {
  return EXTRA_RAPIDO_AMOUNTS_MXN.includes(amountMxn as (typeof EXTRA_RAPIDO_AMOUNTS_MXN)[number]);
}

export function validateExtraRapidoAmount(input: unknown): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new Error("invalid_amount");
  }
  if (!Number.isInteger(input) || input <= 0) {
    throw new Error("invalid_amount");
  }
  if (!isAllowedExtraRapidoAmount(input)) {
    throw new Error("amount_not_allowed");
  }
  return input;
}

export function toCentavos(amountMxn: number): number {
  const validated = validateExtraRapidoAmount(amountMxn);
  return validated * 100;
}

export async function addExtraRapidoToOrder(orderId: string, amountMxn: number) {
  const validatedMxn = validateExtraRapidoAmount(amountMxn);
  const cents = toCentavos(validatedMxn);

  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("order_extra_charges")
    .insert({
      order_id: orderId,
      amount_mxn: validatedMxn,
      amount_cents: cents
    })
    .select()
    .single();

  if (error) {
    throw new Error("db_error: " + error.message);
  }

  return data;
}
