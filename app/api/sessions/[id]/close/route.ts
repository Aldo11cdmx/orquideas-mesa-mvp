import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pin = ((await request.json().catch(() => null)) as { pin?: string })?.pin || "";
  if (pin !== process.env.STAFF_DEMO_PIN) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("close_table_session", {
    p_session_id: id,
    p_pin: pin
  });

  if (error) {
    console.error("close_table_session failed", error);
    return NextResponse.json({ error: "No fue posible cerrar la sesión" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  return NextResponse.json(data);
}
