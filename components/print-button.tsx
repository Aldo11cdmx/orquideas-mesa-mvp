"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      className="focus-ring flex min-h-12 items-center gap-2 rounded-xl bg-[var(--green)] px-5 font-bold text-white"
      onClick={() => window.print()}
    >
      <Printer size={18} /> Imprimir
    </button>
  );
}
