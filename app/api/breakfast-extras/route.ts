import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Public: returns active breakfast extras for the menu
export async function GET(_request: NextRequest) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_breakfast_extras");

  if (error) {
    console.error("get_breakfast_extras failed", error.code, error.message);
    return NextResponse.json([], { status: 200 }); // graceful fallback
  }

  return NextResponse.json(data || []);
}
