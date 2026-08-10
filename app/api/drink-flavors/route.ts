import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

// Public: returns active drink flavors
export async function GET(_request: NextRequest) {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_drink_flavors");

  if (error) {
    console.error("get_drink_flavors failed", error.code, error.message);
    return NextResponse.json([], { status: 200 });
  }

  return NextResponse.json(data || []);
}
