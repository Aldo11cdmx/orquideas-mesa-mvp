import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

const RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";

function pinValid(pin: string) {
  return Boolean(process.env.STAFF_DEMO_PIN) && pin === process.env.STAFF_DEMO_PIN;
}

const promotionSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(120),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.number().positive(),
  targetProductId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().default(true)
});

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!pinValid(pin)) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("promotions")
    .select("id, title, discount_type, discount_value, target_product_id, is_active, created_at, products(slug, name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("promotions list failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible consultar las promociones" },
      { status: 503 }
    );
  }
  const rows = (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    productId: row.target_product_id,
    productSlug: (row.products as { slug?: string } | null)?.slug ?? null,
    productName: (row.products as { name?: string } | null)?.name ?? null,
    isActive: row.is_active,
    createdAt: row.created_at
  }));
  return NextResponse.json(rows);
}

export async function POST(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!pinValid(pin)) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = promotionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const supabase = createAdminClient();
  const payload = {
    title: parsed.data.title,
    discount_type: parsed.data.discountType,
    discount_value: parsed.data.discountValue,
    target_product_id: parsed.data.targetProductId ?? null,
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString()
  };

  if (parsed.data.id) {
    const { data, error } = await supabase
      .from("promotions")
      .update(payload)
      .eq("id", parsed.data.id)
      .select("id")
      .single();
    if (error) {
      console.error("promotion update failed", error.code, error.message);
      return NextResponse.json(
        { error: "No fue posible guardar la promoción" },
        { status: 503 }
      );
    }
    return NextResponse.json({ id: data.id });
  }

  const { data, error } = await supabase
    .from("promotions")
    .insert({ ...payload, restaurant_id: RESTAURANT_ID })
    .select("id")
    .single();
  if (error) {
    console.error("promotion insert failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible crear la promoción" },
      { status: 503 }
    );
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!pinValid(pin)) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const parsed = z.object({ id: z.string().uuid() }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from("promotions").delete().eq("id", parsed.data.id);
  if (error) {
    console.error("promotion delete failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible eliminar la promoción" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}
