import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

function authorized(pin: string) {
  return Boolean(process.env.STAFF_DEMO_PIN) && pin === process.env.STAFF_DEMO_PIN;
}

const extraSchema = z.object({
  pin: z.string().min(1).max(20),
  id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  price: z.number().int().min(0).max(10000),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).default(0)
});

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!authorized(pin)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("admin_breakfast_extras", { p_pin: pin });

  if (error) {
    // Table might not exist yet — return empty
    console.error("admin_breakfast_extras failed", error.code, error.message);
    return NextResponse.json([]);
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const parsed = extraSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Datos inválidos" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const { pin, id, name, price, active, sortOrder } = parsed.data;
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("upsert_breakfast_extra", {
    p_pin: pin,
    p_id: id || null,
    p_name: name,
    p_price: price,
    p_active: active,
    p_sort_order: sortOrder
  });

  if (error) {
    console.error("upsert_breakfast_extra failed", error.code, error.message);
    return NextResponse.json({ error: "No se pudo guardar" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({
    pin: z.string().min(1).max(20),
    id: z.string().uuid()
  }).safeParse(body);

  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "ID inválido" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const { pin, id } = parsed.data;
  const supabase = createServerClient();
  const { error } = await supabase.rpc("delete_breakfast_extra", {
    p_pin: pin,
    p_id: id
  });

  if (error) {
    console.error("delete_breakfast_extra failed", error.code, error.message);
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
