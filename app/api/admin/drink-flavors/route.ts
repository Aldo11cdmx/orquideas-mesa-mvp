import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

function authorized(pin: string) {
  return Boolean(process.env.STAFF_DEMO_PIN) && pin === process.env.STAFF_DEMO_PIN;
}

const flavorSchema = z.object({
  pin: z.string().min(1).max(20),
  id: z.string().uuid().nullable().optional(),
  drinkType: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(80),
  priceModifier: z.number().int().min(0).max(500).default(0),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).default(0)
});

// GET: list all flavors (admin only)
export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!authorized(pin)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("drink_flavors")
    .select("id, drink_type, name, price_modifier, active, sort_order")
    .order("drink_type", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("drink_flavors select failed", error.code, error.message);
    return NextResponse.json([]);
  }

  const mapped = (data || []).map((row: any) => ({
    id: row.id,
    drinkType: row.drink_type,
    name: row.name,
    priceModifier: row.price_modifier,
    active: row.active,
    sortOrder: row.sort_order
  }));

  return NextResponse.json(mapped);
}

// POST: upsert (create or update)
export async function POST(request: NextRequest) {
  const parsed = flavorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Datos inválidos" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const { id, drinkType, name, priceModifier, active, sortOrder } = parsed.data;
  const supabase = createAdminClient();

  if (id) {
    const { error } = await supabase
      .from("drink_flavors")
      .update({
        drink_type: drinkType,
        name,
        price_modifier: priceModifier,
        active,
        sort_order: sortOrder,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      console.error("drink_flavors update failed", error.code, error.message);
      return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
    }
    return NextResponse.json({ id });
  }

  const { data, error } = await supabase
    .from("drink_flavors")
    .insert({
      drink_type: drinkType,
      name,
      price_modifier: priceModifier,
      active,
      sort_order: sortOrder
    })
    .select("id")
    .single();

  if (error) {
    console.error("drink_flavors insert failed", error.code, error.message);
    return NextResponse.json({ error: "No se pudo crear" }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id });
}

// DELETE
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

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("drink_flavors")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    console.error("drink_flavors delete failed", error.code, error.message);
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
