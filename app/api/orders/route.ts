import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const note = z.string().trim().max(250);
const orderSchema = z.object({
  tableCode: z.string().trim().regex(/^[A-Z]\d{1,2}$/),
  idempotencyKey: z.string().uuid(),
  notes: note.default(""),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(80),
        quantity: z.number().int().min(1).max(10),
        notes: note.default(""),
        option: z.string().trim().max(80).optional()
      })
    )
    .min(1)
    .max(30)
});

export async function POST(request: NextRequest) {
  const parsed = orderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Pedido inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("place_order", {
    p_table_code: parsed.data.tableCode,
    p_items: parsed.data.items,
    p_notes: parsed.data.notes,
    p_idempotency_key: parsed.data.idempotencyKey
  });

  if (error) {
    console.error("place_order failed", error.code);
    return NextResponse.json(
      { error: "La base de datos aún no tiene la migración instalada" },
      { status: 503 }
    );
  }
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (pin !== process.env.STAFF_DEMO_PIN) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("kitchen_orders", { p_pin: pin });
  if (error) {
    return NextResponse.json(
      { error: "La base de datos aún no tiene la migración instalada" },
      { status: 503 }
    );
  }
  return NextResponse.json(data || []);
}
