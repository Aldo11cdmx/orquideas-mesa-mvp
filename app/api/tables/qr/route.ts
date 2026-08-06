import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const qrSchema = z.object({
  table: z.string().uuid()
});

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("table");
  const parsed = qrSchema.safeParse({ table: token });
  if (!parsed.success) {
    return NextResponse.json({ error: "Token de mesa inválido" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_table_by_qr", {
    p_qr_token: parsed.data.table
  });

  if (error) {
    console.error("get_table_by_qr failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible consultar la mesa" },
      { status: 503 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: "Mesa no encontrada" }, { status: 404 });
  }
  return NextResponse.json(data);
}
