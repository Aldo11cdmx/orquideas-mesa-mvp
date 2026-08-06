import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("session_account", {
    p_session_id: id
  });

  if (error) {
    console.error("session_account failed", error);
    return NextResponse.json({ error: "No fue posible consultar la cuenta" }, { status: 503 });
  }
  if (!data) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}
