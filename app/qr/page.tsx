import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { activeTables } from "@/lib/menu";
import { PrintButton } from "@/components/print-button";
import { QRGrid } from "@/components/qr-grid";

export default function QRPage() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
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
        <QRGrid appUrl={appUrl} tables={activeTables} />
        <p className="no-print mt-6 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
          <Printer size={16} /> Imprime en tamaño carta al 100%.
        </p>
      </div>
    </main>
  );
}
