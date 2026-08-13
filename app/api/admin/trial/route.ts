import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";

function authorized(pin: string) {
  return Boolean(process.env.STAFF_DEMO_PIN) && pin === process.env.STAFF_DEMO_PIN;
}

const extendSchema = z.object({
  pin: z.string().min(1).max(20),
  restaurantId: z.string().uuid().optional(),
  hours: z.number().int().min(1).max(8760).default(24)
});

const DEFAULT_RESTAURANT_ID = "00000000-0000-0000-0000-000000000001";

// POST: extiende el periodo de prueba vía el RPC extend_trial (service_role).
// El RPC está restringido a service_role en la base; esta ruta agrega el gate
// de PIN del panel admin (STAFF_DEMO_PIN).
export async function POST(request: NextRequest) {
  const parsed = extendSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Datos inválidos" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const { restaurantId, hours } = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("extend_trial", {
    p_restaurant_id: restaurantId ?? DEFAULT_RESTAURANT_ID,
    p_hours: hours
  });

  if (error) {
    console.error("extend_trial rpc failed", error.code, error.message, error.hint);
    return NextResponse.json({ error: "No se pudo extender la prueba" }, { status: 503 });
  }

  return NextResponse.json(data);
}
