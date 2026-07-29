"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Brand } from "@/components/brand";

type Code = { table: string; url: string; image: string };

export function QRGrid({ appUrl, tables }: { appUrl: string; tables: string[] }) {
  const [codes, setCodes] = useState<Code[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all(
      tables.map(async (table) => {
        const url = `${appUrl}/mesa/${table}`;
        return {
          table,
          url,
          image: await QRCode.toDataURL(url, {
            errorCorrectionLevel: "H",
            margin: 1,
            width: 720,
            color: { dark: "#111111", light: "#FFFFFF" }
          })
        };
      })
    ).then((items) => {
      if (active) setCodes(items);
    });
    return () => {
      active = false;
    };
  }, [appUrl, tables]);

  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
      {codes.length === 0 &&
        tables.map((table) => (
          <div className="qr-card paper min-h-[500px] animate-pulse rounded-3xl" key={table} />
        ))}
      {codes.map(({ table, url, image }) => (
        <article
          className="qr-card paper menu-card relative overflow-hidden rounded-[2rem] border border-[var(--line)] p-7 text-center"
          key={table}
        >
          <div className="flex justify-center">
            <Brand compact />
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="mx-auto mt-6 aspect-square w-full max-w-72 rounded-2xl border border-[var(--line)] bg-white p-3 shadow-inner"
            src={image}
            alt={`QR de la mesa ${table}`}
          />
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-[var(--terracotta)]">
            Mesa
          </p>
          <h2 className="font-display text-7xl font-bold text-[var(--brown-dark)]">{table}</h2>
          <p className="mt-2 font-bold">Escanea para ver el menú y ordenar</p>
          <p className="mt-2 break-all text-[9px] text-[var(--muted)]">{url}</p>
        </article>
      ))}
    </div>
  );
}
