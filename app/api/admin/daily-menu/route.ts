import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDailyMenuConfig, serializeDailyMenuCourses } from "@/lib/daily-menu";
import { createServerClient } from "@/lib/supabase/server";

const time = z.string().regex(/^\d{2}:\d{2}$/);
const dailyMenuExtra = z.object({
  name: z.string().trim().min(1).max(80),
  price: z.number().min(0).max(10000),
  active: z.boolean().optional()
});
const dailyMenuDrink = z.object({
  name: z.string().trim().min(1).max(80),
  active: z.boolean().optional()
});

const dailyMenuSchema = z.object({
  pin: z.string().min(1).max(20),
  active: z.boolean(),
  serviceDate: z.string().date(),
  availableFrom: time,
  availableUntil: time,
  price: z.number().min(1).max(10000),
  courses: z.object({
    Entrada: z.array(z.string().trim().min(1).max(80)).min(1).max(8),
    "Guarnición": z.array(z.string().trim().min(1).max(80)).min(1).max(8),
    "Plato fuerte": z.array(z.string().trim().min(1).max(80)).min(1).max(8),
    Bebida: z.array(dailyMenuDrink).min(1).max(8)
  }),
  extras: z.array(dailyMenuExtra).max(12).optional().default([])
});

function authorized(pin: string) {
  return Boolean(process.env.STAFF_DEMO_PIN) && pin === process.env.STAFF_DEMO_PIN;
}

export async function GET(request: NextRequest) {
  const pin = request.nextUrl.searchParams.get("pin") || "";
  if (!authorized(pin)) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("admin_daily_menu", { p_pin: pin });
  if (error) {
    console.error("admin_daily_menu failed", error.code, error.message);
    return NextResponse.json(
      { error: "Falta instalar la actualización de comida corrida" },
      { status: 503 }
    );
  }

  return NextResponse.json(normalizeDailyMenuConfig(data));
}

export async function PUT(request: NextRequest) {
  const parsed = dailyMenuSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !authorized(parsed.data.pin)) {
    return NextResponse.json(
      { error: parsed.success ? "PIN incorrecto" : "Revisa los datos del menú" },
      { status: parsed.success ? 401 : 400 }
    );
  }

  const { pin, active, serviceDate, availableFrom, availableUntil, price, courses, extras } =
    parsed.data;
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("save_daily_menu", {
    p_pin: pin,
    p_active: active,
    p_service_date: serviceDate,
    p_available_from: availableFrom,
    p_available_until: availableUntil,
    p_price: price,
    p_courses: serializeDailyMenuCourses({
      active,
      availableToday: active,
      serviceDate,
      availableFrom,
      availableUntil,
      price,
      courses,
      extras
    })
  });

  if (error) {
    console.error("save_daily_menu failed", error.code, error.message);
    return NextResponse.json({ error: "No fue posible guardar el menú" }, { status: 503 });
  }

  return NextResponse.json(normalizeDailyMenuConfig(data));
}
