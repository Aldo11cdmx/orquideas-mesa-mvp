"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      className="focus-ring flex min-h-12 items-center gap-2 rounded-2xl bg-[var(--gold)] px-5 font-bold text-[var(--charcoal)] shadow-xl"
      onClick={() => window.print()}
    >
      <Printer size={18} /> Imprimir
    </button>
  );
}
