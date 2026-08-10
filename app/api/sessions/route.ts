import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const sessionSchema = z.object({
  tableCode: z.string().trim().regex(/^[A-Z]\d{1,2}$|^LLEVAR$/)
});

export async function GET(request: NextRequest) {
  const tableCode = request.nextUrl.searchParams.get("tableCode");
  const listActive = request.nextUrl.searchParams.get("list");
  const supabase = createServerClient();

  if (listActive === "active") {
    const pin = request.nextUrl.searchParams.get("pin") || "";
    if (pin !== process.env.STAFF_DEMO_PIN) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
    }
    const { data, error } = await supabase.rpc("get_active_sessions");
    if (error) {
      console.error("get_active_sessions failed", error);
      return NextResponse.json(
        { error: "No fue posible consultar las sesiones" },
        { status: 503 }
      );
    }
    return NextResponse.json(data || []);
  }

  if (!tableCode) {
    return NextResponse.json(
      { error: "tableCode o list=active es requerido" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("get_table_session", {
    p_table_code: tableCode.toUpperCase()
  });
  if (error) {
    console.error("get_table_session failed", error);
    return NextResponse.json(
      { error: "No fue posible consultar la sesión" },
      { status: 503 }
    );
  }
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const parsed = sessionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_or_create_table_session", {
    p_table_code: parsed.data.tableCode.toUpperCase()
  });

  if (error) {
    console.error("get_or_create_table_session failed", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    });
    return NextResponse.json(
      { error: "No fue posible crear la sesión" },
      { status: 500 }
    );
  }
  return NextResponse.json(data, { status: 201 });
}
