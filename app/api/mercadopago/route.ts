import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Mercado Pago Checkout API
 *
 * Crea una preferencia de pago y devuelve la URL del checkout.
 * Requiere MERCADO_PAGO_ACCESS_TOKEN en las variables de entorno.
 */

// Validación del cuerpo de la solicitud
const paymentSchema = z.object({
  amount: z.number().min(1).max(50000),
  description: z.string().trim().min(1).max(200),
  customerName: z.string().trim().max(100).optional(),
  customerPhone: z.string().trim().max(20).optional()
});

// Rate limiting simple en memoria (por IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto
const RATE_LIMIT_MAX = 5; // 5 requests por minuto por IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;

  if (!accessToken) {
    return NextResponse.json(
      { error: "Mercado Pago no está configurado", url: null },
      { status: 200 }
    );
  }

  // Rate limiting
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(clientIp)) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta en un momento.", url: null },
      { status: 429 }
    );
  }

  // Validar cuerpo
  const parsed = paymentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de pago inválidos", url: null },
      { status: 400 }
    );
  }

  const { amount, description, customerName, customerPhone } = parsed.data;

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
            title: description,
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
      console.error("Mercado Pago API error", response.status);
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
    console.error("Mercado Pago request failed");
    return NextResponse.json(
      { error: "Servicio de pago no disponible", url: null },
      { status: 200 }
    );
  }
}
