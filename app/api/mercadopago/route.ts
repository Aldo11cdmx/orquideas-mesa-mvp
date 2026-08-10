import { NextRequest, NextResponse } from "next/server";

/**
 * Mercado Pago Checkout API
 *
 * Crea una preferencia de pago y devuelve la URL del checkout.
 * Requiere MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno.
 *
 * Para obtener el token:
 * 1. Crear cuenta en https://www.mercadopago.com.mx
 * 2. Ir a Configuración → Credenciales → Access Token (producción o prueba)
 * 3. Agregar MERCADO_PAGO_ACCESS_TOKEN en .env.local
 *
 * Modo prueba: usa credenciales de test, no cobra realmente.
 * Modo producción: usa credenciales de producción.
 */

export async function POST(request: NextRequest) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado", url: null },
      { status: 200 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || !body.amount) {
    return NextResponse.json({ error: "Monto requerido" }, { status: 400 });
  }

  const { amount, description, customerName, customerPhone } = body as {
    amount: number;
    description: string;
    customerName: string;
    customerPhone: string;
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  try {
    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        items: [
          {
            title: description || "Pedido para llevar · Imperio",
            quantity: 1,
            currency_id: "MXN",
            unit_price: amount
          }
        ],
        payer: {
          name: customerName || "Cliente",
          phone: customerPhone
            ? { number: customerPhone.replace(/\D/g, "") }
            : undefined
        },
        back_urls: {
          success: `${appUrl}/llevar`,
          failure: `${appUrl}/llevar`,
          pending: `${appUrl}/llevar`
        },
        auto_return: "approved",
        external_reference: `imperio-${Date.now()}`
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      console.error("Mercado Pago error:", error);
      return NextResponse.json(
        { error: "No se pudo crear el pago", url: null },
        { status: 200 }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      url: data.init_point || data.sandbox_init_point || null,
      preferenceId: data.id
    });
  } catch (err) {
    console.error("Mercado Pago request failed:", err);
    return NextResponse.json(
      { error: "Servicio de pago no disponible", url: null },
      { status: 200 }
    );
  }
}
