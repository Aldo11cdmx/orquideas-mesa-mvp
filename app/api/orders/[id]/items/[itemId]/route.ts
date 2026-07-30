import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string; itemId: string }>;
  }
) {
  const { id, itemId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = z.object({ pin: z.string().min(1).max(20) }).safeParse(body);

  if (
    !z.string().uuid().safeParse(id).success ||
    !z.string().uuid().safeParse(itemId).success ||
    !parsed.success ||
    parsed.data.pin !== process.env.STAFF_DEMO_PIN
  ) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("remove_order_item", {
    p_order_id: id,
    p_order_item_id: itemId,
    p_pin: parsed.data.pin
  });

  if (error) {
    const message =
      error.message.includes("cannot_remove_last_item")
        ? "No puedes eliminar el último producto; cancela el pedido completo."
        : error.message.includes("order_already_confirmed")
          ? "El pedido ya fue confirmado y no se puede editar."
          : "No fue posible eliminar el producto.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json(data);
}
