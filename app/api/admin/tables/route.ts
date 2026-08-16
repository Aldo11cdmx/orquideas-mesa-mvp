import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient, createAdminClient } from "@/lib/supabase/server";

const tableSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("").transform(() => undefined)),
  code: z.string().trim().min(1).max(10),
  name: z.string().trim().max(80).optional(),
  capacity: z.number().int().min(0).max(50).optional(),
  active: z.boolean().optional()
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
  const { data, error } = await supabase.rpc("admin_tables", { p_pin: pin });

  if (error) {
    console.error("admin_tables failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible consultar las mesas" },
      { status: 503 }
    );
  }
  return NextResponse.json(data || []);
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z
    .object({ pin: z.string().min(1).max(20), id: z.string().uuid() })
    .safeParse(body);

  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Solicitud inválida" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("tables").delete().eq("id", parsed.data.id);

  if (error) {
    console.error("delete table failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible eliminar la mesa" },
      { status: 503 }
    );
  }
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = z
    .object({ pin: z.string().min(1).max(20), table: tableSchema })
    .safeParse(body);

  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Datos de mesa inválidos" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("save_admin_table", {
    p_pin: parsed.data.pin,
    p_table: parsed.data.table
  });

  if (error) {
    console.error("save_admin_table failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible guardar la mesa" },
      { status: 503 }
    );
  }
  return NextResponse.json(data, { status: 201 });
}
