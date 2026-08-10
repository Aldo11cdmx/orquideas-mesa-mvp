import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

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

// GET: list all extras (admin only, uses service_role)
export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!authorized(pin)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("breakfast_extras")
    .select("id, name, price, active, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("breakfast_extras select failed", error.code, error.message);
    return NextResponse.json([]);
  }

  // Map sort_order → sortOrder for frontend
  const mapped = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    active: row.active,
    sortOrder: row.sort_order
  }));

  return NextResponse.json(mapped);
}

// POST: upsert (create or toggle active)
export async function POST(request: NextRequest) {
  const parsed = extraSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Datos inválidos" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const { id, name, price, active, sortOrder } = parsed.data;
  const supabase = createAdminClient();

  if (id) {
    // Update existing (toggle active or edit)
    const { error } = await supabase
      .from("breakfast_extras")
      .update({ name, price, active, sort_order: sortOrder, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error("breakfast_extras update failed", error.code, error.message);
      return NextResponse.json({ error: "No se pudo actualizar" }, { status: 500 });
    }
    return NextResponse.json({ id });
  }

  // Insert new
  const { data, error } = await supabase
    .from("breakfast_extras")
    .insert({ name, price, active, sort_order: sortOrder })
    .select("id")
    .single();

  if (error) {
    console.error("breakfast_extras insert failed", error.code, error.message);
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
    .from("breakfast_extras")
    .delete()
    .eq("id", parsed.data.id);

  if (error) {
    console.error("breakfast_extras delete failed", error.code, error.message);
    return NextResponse.json({ error: "No se pudo eliminar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
