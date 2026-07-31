import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

const statusSchema = z.enum([
  "accepted",
  "preparing",
  "ready",
  "delivered",
  "cancelled"
]);
const paymentMethodSchema = z.enum(["cash", "card"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = request.nextUrl.searchParams.get("token") || "";
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("get_order_status", {
    p_order_id: id,
    p_access_token: token
  });
  if (error || !data) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = z
    .object({
      status: statusSchema,
      pin: z.string().min(1).max(20),
      paymentMethod: paymentMethodSchema.optional()
    })
    .safeParse(body);
  if (!parsed.success || parsed.data.pin !== process.env.STAFF_DEMO_PIN) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const supabase = createServerClient();
  if (parsed.data.status === "delivered" && !parsed.data.paymentMethod) {
    return NextResponse.json({ error: "Selecciona efectivo o tarjeta" }, { status: 400 });
  }
  const { data, error } =
    parsed.data.status === "delivered"
      ? await supabase.rpc("complete_order", {
          p_order_id: id,
          p_payment_method: parsed.data.paymentMethod,
          p_pin: parsed.data.pin
        })
      : await supabase.rpc("update_order_status", {
          p_order_id: id,
          p_status: parsed.data.status,
          p_pin: parsed.data.pin
        });
  if (error) {
    return NextResponse.json({ error: "No fue posible actualizar" }, { status: 503 });
  }
  return NextResponse.json(data);
}
