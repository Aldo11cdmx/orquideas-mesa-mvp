import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const optionGroup = z.object({
  id: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(80),
  choices: z.array(z.string().trim().min(1).max(80)).max(20),
  required: z.boolean().optional()
});

const productSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500),
  price: z.number().min(0).max(10000),
  compareAt: z.number().min(0).max(10000).optional(),
  category: z.string().trim().min(1).max(80),
  image: z.string().trim().min(1).max(500),
  popular: z.boolean().optional(),
  isNew: z.boolean().optional(),
  soldOut: z.boolean().optional(),
  active: z.boolean().optional(),
  options: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  optionGroups: z.array(optionGroup).max(8).optional(),
  packageIncludes: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  availableFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  availableUntil: z.string().regex(/^\d{2}:\d{2}$/).optional()
});

function authorized(pin: string) {
  return Boolean(process.env.STAFF_DEMO_PIN) && pin === process.env.STAFF_DEMO_PIN;
}

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!authorized(pin)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("admin_menu_products", { p_pin: pin });
  if (error) {
    console.error("admin_menu_products failed", error.code, error.message);
    return NextResponse.json(
      { error: "Falta instalar la actualización del menú" },
      { status: 503 }
    );
  }

  return NextResponse.json(data || [], {
    headers: { "Cache-Control": "no-store" }
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z.object({ pin: z.string().min(1).max(20), product: productSchema }).safeParse(body);

  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Revisa los datos del producto" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("save_admin_product", {
    p_pin: parsed.data.pin,
    p_product: parsed.data.product
  });

  if (error) {
    console.error("save_admin_product failed", error.code, error.message);
    return NextResponse.json({ error: "No fue posible guardar el producto" }, { status: 503 });
  }

  return NextResponse.json(data);
}
