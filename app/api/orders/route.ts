import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

let orderCache: { data: unknown; expiresAt: number } | null = null;
let pendingOrderQuery: Promise<unknown> | null = null;

const note = z.string().trim().max(250);
const orderSchema = z.object({
  tableCode: z.string().trim().regex(/^[A-Z]\d{1,2}$|^LLEVAR$/),
  idempotencyKey: z.string().uuid(),
  notes: note.default(""),
  sessionId: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().min(1).max(80),
        quantity: z.number().int().min(1).max(10),
        notes: note.default(""),
         option: z.string().trim().max(80).optional(),
         optionPriceModifier: z.number().int().min(0).optional(),
         extras: z
           .array(
             z.object({
               name: z.string().trim().min(1).max(80),
               price: z.number().min(0).optional()
             })
           )
           .max(12)
           .optional()
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
    p_idempotency_key: parsed.data.idempotencyKey,
    p_session_id: parsed.data.sessionId ?? null
  });

  if (error) {
    console.error("place_order failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      tableCode: parsed.data.tableCode
    });
    return NextResponse.json(
      { error: "No fue posible registrar el pedido" },
      { status: 503 }
    );
  }
  // Avoid serving the pre-order snapshot while realtime/polling reconcile the
  // waiter board after a new order is accepted.
  orderCache = null;
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (pin !== process.env.STAFF_DEMO_PIN) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }
  const now = Date.now();
  let data = orderCache?.expiresAt && orderCache.expiresAt > now ? orderCache.data : null;

  if (!data) {
    pendingOrderQuery ||= (async () => {
      const supabase = createServerClient();
      const result = await supabase.rpc("kitchen_orders", { p_pin: pin });
      if (result.error) throw result.error;
      orderCache = { data: result.data || [], expiresAt: Date.now() + 1500 };
      return orderCache.data;
    })().finally(() => {
      pendingOrderQuery = null;
    });

    try {
      data = await pendingOrderQuery;
    } catch (error) {
      const details = error as { code?: string; message?: string };
      console.error("kitchen_orders failed", details.code, details.message);
      return NextResponse.json(
        { error: "No fue posible consultar los pedidos" },
        { status: 503 }
      );
    }
  }
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    }
  });
}