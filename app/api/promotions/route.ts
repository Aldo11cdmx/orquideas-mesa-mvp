import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("public_promotions");

  if (error) {
    console.error("public_promotions failed", error.code, error.message);
    return NextResponse.json(
      { error: "No fue posible cargar las promociones" },
      { status: 503 }
    );
  }

  return NextResponse.json(data || [], {
    headers: { "Cache-Control": "no-store" }
  });
}
