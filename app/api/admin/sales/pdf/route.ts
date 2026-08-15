import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
// pdfmake se resuelve en runtime Node (ver serverExternalPackages en next.config.ts)
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import type { SalesReport } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;

const querySchema = z.object({
  pin: z.string().min(1).max(20),
  from: z.string().datetime(),
  to: z.string().datetime(),
  period: z.enum(["day", "week"]).default("day")
});

const maximumRange = 370 * 24 * 60 * 60 * 1000;

const money = (value: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(value);

type AdjustmentsPayload = {
  items: Array<{
    id: string;
    type: "income" | "expense";
    amount: number;
    concept: string;
    createdAt: string;
  }>;
  totals: { income: number; expense: number };
};

function summaryTable(report: SalesReport) {
  const rows: Array<Array<string | number>> = [
    ["Concepto", "Monto", "Detalle"],
    ["Consumo registrado (entregados)", money(report.summary.grossSales), `${report.summary.orderCount} pedidos`],
    ["Efectivo", money(report.summary.cashSales), `${report.summary.cashOrders} pedidos`],
    ["Tarjeta", money(report.summary.cardSales), `${report.summary.cardOrders} pedidos`],
    ["Sin método", money(report.summary.unassignedSales), `${report.summary.unassignedOrders} pedidos`],
    ["Ticket promedio", money(report.summary.averageTicket), ""],
    ["En proceso", money(report.summary.pendingAmount), `${report.summary.pendingOrders} pedidos`]
  ];
  return {
    layout: "lightHorizontalLines" as const,
    table: { headerRows: 1, widths: ["*", "auto", "auto"], body: rows }
  };
}

function adjustmentsTable(adjustments: AdjustmentsPayload) {
  const body: Array<Array<string | number>> = [["Fecha", "Tipo", "Concepto", "Monto"]];
  for (const item of adjustments.items) {
    body.push([
      new Date(item.createdAt).toLocaleString("es-MX", {
        timeZone: "America/Mexico_City",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      }),
      item.type === "income" ? "Entrada" : "Salida",
      item.concept,
      item.type === "income" ? `+${money(item.amount)}` : `-${money(item.amount)}`
    ]);
  }
  body.push(["", "Totales", `Entradas +${money(adjustments.totals.income)} · Salidas -${money(adjustments.totals.expense)}`, ""]);
  return {
    layout: "lightHorizontalLines" as const,
    table: { headerRows: 1, widths: ["auto", "auto", "*", "auto"], body }
  };
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse({
    pin: request.nextUrl.searchParams.get("pin"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
    period: request.nextUrl.searchParams.get("period") || "day"
  });

  if (!parsed.success || parsed.data.pin !== process.env.STAFF_DEMO_PIN) {
    return NextResponse.json({ error: "Acceso no autorizado" }, { status: 401 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);
  if (
    Number.isNaN(from.valueOf()) ||
    Number.isNaN(to.valueOf()) ||
    to <= from ||
    to.valueOf() - from.valueOf() > maximumRange
  ) {
    return NextResponse.json({ error: "Periodo inválido" }, { status: 400 });
  }

  const supabase = createServerClient();
  const [reportResult, adjustmentsResult] = await Promise.all([
    supabase.rpc("admin_sales_report", {
      p_pin: parsed.data.pin,
      p_from: from.toISOString(),
      p_to: to.toISOString()
    }),
    supabase.rpc("admin_cash_adjustments", {
      p_pin: parsed.data.pin,
      p_from: from.toISOString(),
      p_to: to.toISOString()
    })
  ]);

  if (reportResult.error || adjustmentsResult.error) {
    console.error(
      "sales pdf rpc failed",
      reportResult.error?.code,
      reportResult.error?.message,
      adjustmentsResult.error?.code,
      adjustmentsResult.error?.message
    );
    return NextResponse.json({ error: "No fue posible generar el reporte" }, { status: 503 });
  }

  const report = reportResult.data as unknown as SalesReport;
  const adjustments = (adjustmentsResult.data ?? {
    items: [],
    totals: { income: 0, expense: 0 }
  }) as AdjustmentsPayload;

  const cashExpected = report.summary.cashSales + adjustments.totals.income - adjustments.totals.expense;

  const periodLabel =
    parsed.data.period === "day"
      ? `Corte Diario · ${from.toLocaleDateString("es-MX", {
          timeZone: "America/Mexico_City",
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric"
        })}`
      : `Corte Semanal · ${from.toLocaleDateString("es-MX", {
          timeZone: "America/Mexico_City",
          day: "2-digit",
          month: "short"
        })} a ${to.toLocaleDateString("es-MX", {
          timeZone: "America/Mexico_City",
          day: "2-digit",
          month: "short",
          year: "numeric"
        })}`;

  const docDefinition = {
    content: [
      { text: "Imperio", style: "brand" },
      { text: "Corte de caja", style: "title" },
      { text: periodLabel, style: "meta" },
      {
        text: `Emitido: ${new Date().toLocaleString("es-MX", {
          timeZone: "America/Mexico_City",
          dateStyle: "medium",
          timeStyle: "short"
        })}`,
        style: "meta"
      },
      { text: "Resumen de ventas", style: "section" },
      summaryTable(report),
      { text: "Ajustes manuales", style: "section" },
      adjustmentsTable(adjustments),
      { text: "Balance final", style: "section" },
      {
        layout: "noBorders",
        table: {
          widths: ["*", "auto"],
          body: [
            ["Efectivo vendido", money(report.summary.cashSales)],
            ["+ Entradas", `+${money(adjustments.totals.income)}`],
            ["- Salidas", `-${money(adjustments.totals.expense)}`],
            [
              { text: "Efectivo esperado en caja", bold: true },
              { text: money(cashExpected), bold: true, fontSize: 14 }
            ]
          ]
        }
      },
      {
        text: "Documento generado por el sistema de pedidos Orquídeas Mesa.",
        style: "footer"
      }
    ],
    styles: {
      brand: { fontSize: 18, bold: true, color: "#5c3d2e" },
      title: { fontSize: 24, bold: true, margin: [0, 4, 0, 2] },
      meta: { fontSize: 9, color: "#6b7280", margin: [0, 1, 0, 2] },
      section: { fontSize: 13, bold: true, color: "#5c3d2e", margin: [0, 14, 0, 6] },
      footer: { fontSize: 8, color: "#9ca3af", margin: [0, 18, 0, 0] }
    },
    defaultStyle: { fontSize: 10, lineHeight: 1.35 }
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    pdfDoc.getBuffer((result: Uint8Array) => resolve(Buffer.from(result)));
    // getBuffer no reporta errores; timeout defensivo por si algo se cuelga
    setTimeout(() => reject(new Error("pdf timeout")), 20000);
  });

  const filename = `corte-${parsed.data.period}-${new Date().toISOString().slice(0, 10)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}
