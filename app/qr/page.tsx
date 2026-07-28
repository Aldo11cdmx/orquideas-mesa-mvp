import QRCode from "qrcode";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Brand } from "@/components/brand";
import { activeTables } from "@/lib/menu";
import { PrintButton } from "@/components/print-button";

export default async function QRPage() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const codes = await Promise.all(
    activeTables.map(async (table) => ({
      table,
      url: `${appUrl}/mesa/${table}`,
      image: await QRCode.toDataURL(`${appUrl}/mesa/${table}`, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 720,
        color: { dark: "#111111", light: "#FFFFFF" }
      })
    }))
  );
  return (
    <main className="mx-auto max-w-5xl p-5 sm:p-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link className="flex items-center gap-2 text-sm font-bold" href="/demo">
            <ArrowLeft size={17} /> Volver
          </Link>
          <h1 className="mt-3 font-display text-4xl font-bold">Códigos QR de mesas</h1>
        </div>
        <PrintButton />
      </div>
      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {codes.map(({ table, url, image }) => (
          <article
            className="qr-card paper overflow-hidden rounded-3xl border-2 border-[var(--green)] p-6 text-center"
            key={table}
          >
            <div className="flex justify-center">
              <Brand compact />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="mx-auto mt-5 aspect-square w-full max-w-72"
              src={image}
              alt={`QR de la mesa ${table}`}
            />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--terracotta)]">
              Mesa
            </p>
            <h2 className="font-display text-6xl font-bold">{table}</h2>
            <p className="mt-2 font-bold">Escanea para ver el menú y ordenar</p>
            <p className="mt-2 break-all text-[9px] text-[var(--muted)]">{url}</p>
          </article>
        ))}
      </div>
      <p className="no-print mt-6 flex items-center justify-center gap-2 text-sm text-[var(--muted)]">
        <Printer size={16} /> Imprime en tamaño carta al 100%.
      </p>
    </main>
  );
}
