import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

// Búsqueda pública de un pedido por folio (página /seguimiento/[folio]).
// NO requiere PIN de staff: el folio es el identificador que se comparte
// en los links de seguimiento. El acceso se limita a:
//   1. lookup por folio exacto (normalizado) en la tabla orders
//   2. serialización vía order_as_json (security definer, revocado a anon)
// El accessToken del pedido NO se expone en la respuesta.
export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("folio") || "").trim();

  // Normalizar: "1159" → "O-1159" (con relleno a 4 dígitos), minúsculas → mayúsculas
  const folio = /^\d+$/.test(raw) ? `O-${raw.padStart(4, "0")}` : raw.toUpperCase();

  if (!z.string().regex(/^O-\d{3,}$/).safeParse(folio).success) {
    return NextResponse.json({ error: "Folio inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: found, error } = await supabase
    .from("orders")
    .select("id")
    .eq("folio", folio)
    .maybeSingle();

  if (error) {
    console.error("track: lookup failed", error.code, error.message);
    return NextResponse.json(
      { error: "No pudimos consultar tu pedido" },
      { status: 503 }
    );
  }

  if (!found) {
    return NextResponse.json(
      { error: "No encontramos ese pedido. Revisa el número de folio." },
      { status: 404 }
    );
  }

  const { data: order, error: rpcError } = await supabase.rpc("order_as_json", {
    p_order_id: found.id
  });

  if (rpcError || !order) {
    console.error("track: order_as_json failed", rpcError?.code, rpcError?.message);
    return NextResponse.json(
      { error: "No pudimos consultar tu pedido" },
      { status: 503 }
    );
  }

  // No exponer el access token (secreto para la API get_order_status)
  const { accessToken, ...safe } = order as Record<string, unknown>;

  return NextResponse.json(safe, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store"
    }
  });
}
