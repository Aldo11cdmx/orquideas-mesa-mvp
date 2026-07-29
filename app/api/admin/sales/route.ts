import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  pin: z.string().min(1).max(20),
  from: z.string().datetime(),
  to: z.string().datetime()
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    pin: request.nextUrl.searchParams.get("pin"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to")
  });

  if (!parsed.success || parsed.data.pin !== process.env.STAFF_DEMO_PIN) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  const maximumRange = 370 * 24 * 60 * 60 * 1000;
  if (
    Number.isNaN(from.valueOf()) ||
    Number.isNaN(to.valueOf()) ||
    to <= from ||
    to.valueOf() - from.valueOf() > maximumRange
  ) {
    return NextResponse.json({ error: "Periodo inválido" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("admin_sales_report", {
    p_pin: parsed.data.pin,
    p_from: from.toISOString(),
    p_to: to.toISOString()
  });

  if (error) {
    console.error("admin_sales_report failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible generar el corte de caja" },
      { status: 503 }
    );
  }

  return NextResponse.json(data);
}
