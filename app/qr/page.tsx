import Link from "next/link";
import { ArrowLeft, Printer, ShoppingBag } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";
import { QRGrid } from "@/components/qr-grid";
import { LlevarQR } from "./llevar-qr";

export const dynamic = "force-dynamic";

type DbTable = {
  code: string;
  name: string;
  active: boolean;
};

export default async function QRPage() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("admin_tables", {
    p_pin: process.env.STAFF_DEMO_PIN || "2026"
  });

  if (error) {
    console.error("admin_tables failed", error.code, error.message);
  }

  const tables = ((data ?? []) as DbTable[]).filter((t) => t.active !== false);

  return (
    <main className="min-h-screen pb-12">
      <div className="premium-header no-print text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-end justify-between gap-5 px-5 py-10 sm:px-8 sm:py-14">
          <div>
            <Link className="flex items-center gap-2 text-sm font-bold text-white/70" href="/">
              <ArrowLeft size={17} /> Volver
            </Link>
            <p className="eyebrow mt-6 text-[var(--gold)]">Material para impresión</p>
            <h1 className="mt-2 font-display text-5xl font-bold">Códigos QR de mesas</h1>
          </div>
          <PrintButton />
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <QRGrid
          appUrl={appUrl}
          tables={tables.map((t) => ({
            code: t.code,
            name: t.name
          }))}
        />
        <div className="mt-12">
          <p className="eyebrow mb-5 text-center text-[var(--brown)]">QR para llevar</p>
          <div className="glass-card mx-auto max-w-xs rounded-[2rem] p-6 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <ShoppingBag size={18} className="text-[var(--brown)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--brown)]">Para llevar</span>
            </div>
            <LlevarQR url={`${appUrl}/llevar`} />
            <p className="mt-3 text-xs text-[var(--muted)]">
              Escanea para ordenar y recoger
            </p>
          </div>
        </div>
        <p className="no-print mt-6 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <Printer size={16} /> Imprime en tamaño carta al 100%.
        </p>
      </div>
    </main>
  );
}
