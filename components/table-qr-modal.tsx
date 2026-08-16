"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type TableEntry = { code: string; name?: string };

/**
 * Modal estilo Apple para mostrar/imprimir/descargar el QR de una mesa.
 * La URL apunta a /mesa/[codigo]; maneja estados de carga y error.
 */
export function TableQrModal({
  table,
  appUrl,
  onClose
}: {
  table: TableEntry | null;
  appUrl: string;
  onClose: () => void;
}) {
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const url = table ? `${appUrl}/mesa/${encodeURIComponent(table.code)}` : "";

  useEffect(() => {
    if (!table) return;
    let active = true;
    setImage(null);
    setFailed(false);
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 720,
      color: { dark: "#111111", light: "#FFFFFF" }
    })
      .then((dataUrl) => {
        if (active) setImage(dataUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [table, url]);

  function download() {
    if (!image || !table) return;
    const link = document.createElement("a");
    link.href = image;
    link.download = `mesa-${table.code}.png`;
    link.click();
  }

  function print() {
    if (!image || !table) return;
    const win = window.open("", "_blank", "width=420,height=620");
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>QR Mesa ${table.code}</title>` +
        `<style>body{font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:32px}` +
        `img{width:320px;height:320px;border-radius:16px;border:1px solid #e5e5e5;padding:8px}` +
        `strong{font-size:64px;display:block;margin-top:8px}h2{font-size:20px;margin:0;color:#444}` +
        `p{color:#777;font-size:12px;word-break:break-all;max-width:320px;margin:8px auto}` +
        `@media print{body{padding:0}}</style></head>` +
        `<body><img src="${image}" alt="QR mesa ${table.code}"/><strong>${table.code}</strong>` +
        `<h2>${table.name ?? ""}</h2><p>${url}</p>` +
        `<script>window.onload=function(){window.print()}<\\/script></body></html>`
    );
    win.document.close();
  }

  return (
    <Dialog
      open={Boolean(table)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-sm rounded-3xl p-6 text-center dark:bg-neutral-900 dark:text-neutral-100">
        <DialogTitle className="font-display text-xl font-bold">
          QR de la mesa {table?.code}
        </DialogTitle>

        {failed ? (
          <p className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:bg-red-950/40 dark:text-red-400">
            No se pudo generar el código QR. Intenta de nuevo.
          </p>
        ) : image ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt={`Código QR de la mesa ${table?.code}`}
              className="mx-auto mt-4 aspect-square w-64 rounded-2xl border border-neutral-200 bg-white p-2 dark:border-neutral-700"
            />
            <p className="mt-3 text-sm font-bold">
              {table?.code}
              {table?.name ? ` · ${table.name}` : ""}
            </p>
            <p className="mt-1 break-all text-[10px] text-neutral-500 dark:text-neutral-400">
              {url}
            </p>
          </>
        ) : (
          <div className="mx-auto mt-6 aspect-square w-64 animate-pulse rounded-2xl bg-neutral-200 dark:bg-neutral-800" />
        )}

        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={download}
            disabled={!image}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-xs font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            <Download size={15} /> Descargar QR
          </button>
          <button
            type="button"
            onClick={print}
            disabled={!image}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-6 py-3 text-xs font-semibold text-white shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            <Printer size={15} /> Imprimir
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
