import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("trial_status");

  if (error || !data) {
    return NextResponse.json({ error: "Periodo de prueba no disponible" }, { status: 503 });
  }

  return NextResponse.json(data, {
    headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600" }
  });
}
