import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("public_menu_products");

  if (error) {
    console.error("public_menu_products failed", error.code, error.message);
    return NextResponse.json({ error: "No fue posible cargar el menú" }, { status: 503 });
  }

  return NextResponse.json(data || [], {
    headers: { "Cache-Control": "no-store" }
  });
}
