import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { activeTables } from "@/lib/menu";
import { PrintButton } from "@/components/print-button";
import { QRGrid } from "@/components/qr-grid";

export default function QRPage() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return (
    <main className="mx-auto max-w-5xl p-5 sm:p-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link className="flex items-center gap-2 text-sm font-bold" href="/">
            <ArrowLeft size={17} /> Volver
          </Link>
          <h1 className="mt-3 font-display text-4xl font-bold">Códigos QR de mesas</h1>
        </div>
        <PrintButton />
      </div>
      <QRGrid appUrl={appUrl} tables={activeTables} />
      <p className="no-print mt-6 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
        <Printer size={16} /> Imprime en tamaño carta al 100%.
      </p>
    </main>
  );
}
