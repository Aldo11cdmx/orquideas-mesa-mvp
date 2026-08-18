"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function LlevarQR({ url }: { url: string }) {
  const [image, setImage] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 400,
      color: { dark: "#302c29", light: "#FFFFFF" }
    }).then((data) => {
      if (active) setImage(data);
    });
    return () => { active = false; };
  }, [url]);

  if (!image) {
    return <div className="mx-auto aspect-square w-full max-w-48 animate-pulse rounded-2xl bg-[var(--mist)]" />;
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="mx-auto aspect-square w-full max-w-48 rounded-2xl border border-[var(--line)] bg-white p-2"
        src={image}
        alt="QR para pedidos para llevar"
      />
      <p className="mt-2 break-all text-[9px] text-[var(--muted-foreground)]">{url}</p>
    </>
  );
}
