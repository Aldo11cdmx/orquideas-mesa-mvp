import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

function authorized(pin: string) {
  return Boolean(process.env.STAFF_DEMO_PIN) && pin === process.env.STAFF_DEMO_PIN;
}

const listSchema = z.object({
  pin: z.string().min(1).max(20),
  from: z.string().datetime(),
  to: z.string().datetime()
});

const createSchema = z.object({
  pin: z.string().min(1).max(20),
  type: z.enum(["income", "expense"]),
  amount: z.number().positive().max(999999.99),
  concept: z.string().trim().min(1).max(200),
  createdBy: z.string().trim().max(80).optional()
});

const deleteSchema = z.object({
  pin: z.string().min(1).max(20),
  id: z.string().uuid()
});

const maximumRange = 370 * 24 * 60 * 60 * 1000;

function validRange(from: Date, to: Date) {
  return (
    !Number.isNaN(from.valueOf()) &&
    !Number.isNaN(to.valueOf()) &&
    to > from &&
    to.valueOf() - from.valueOf() <= maximumRange
  );
}

// GET: lista ajustes del periodo (admin only)
export async function GET(request: NextRequest) {
  const parsed = listSchema.safeParse({
    pin: request.nextUrl.searchParams.get("pin"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to")
  });

  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (!validRange(from, to)) {
    return NextResponse.json({ error: "Periodo inválido" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("admin_cash_adjustments", {
    p_pin: parsed.data.pin,
    p_from: from.toISOString(),
    p_to: to.toISOString()
  });

  if (error) {
    console.error("admin_cash_adjustments failed", error.code, error.message);
    return NextResponse.json({ error: "No fue posible cargar los ajustes" }, { status: 503 });
  }

  return NextResponse.json(data);
}

// POST: registra una entrada o salida de efectivo (admin only)
export async function POST(request: NextRequest) {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Datos inválidos" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const { type, amount, concept, createdBy } = parsed.data;
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("save_cash_adjustment", {
    p_pin: parsed.data.pin,
    p_type: type,
    p_amount: amount,
    p_concept: concept,
    p_created_by: createdBy ?? null
  });

  if (error) {
    console.error("save_cash_adjustment failed", error.code, error.message);
    return NextResponse.json({ error: "No se pudo registrar el ajuste" }, { status: 503 });
  }

  return NextResponse.json(data);
}

// DELETE: elimina un ajuste (admin only)
export async function DELETE(request: NextRequest) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "ID inválido" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("delete_cash_adjustment", {
    p_pin: parsed.data.pin,
    p_id: parsed.data.id
  });

  if (error) {
    console.error("delete_cash_adjustment failed", error.code, error.message);
    return NextResponse.json({ error: "No se pudo eliminar el ajuste" }, { status: 503 });
  }

  return NextResponse.json(data);
}
