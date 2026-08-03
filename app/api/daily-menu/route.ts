import { NextResponse } from "next/server";
import { normalizeDailyMenuConfig } from "@/lib/daily-menu";
import { createServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_daily_menu");

  if (error) {
    console.error("get_daily_menu failed", error.code, error.message);
    return NextResponse.json(
      { error: "La comida corrida todavía no está configurada" },
      { status: 503 }
    );
  }

  return NextResponse.json(normalizeDailyMenuConfig(data));
}
