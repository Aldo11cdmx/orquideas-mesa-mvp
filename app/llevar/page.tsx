"use client";

import { useState } from "react";
import { Phone, User } from "lucide-react";
import { MenuClient } from "@/components/menu-client";

export default function LlevarPage() {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [started, setStarted] = useState(false);

  if (!started) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <div className="glass-card w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
          <div className="text-center">
            <span className="inline-grid h-14 w-14 place-items-center rounded-2xl bg-[var(--green)] text-[var(--gold)] text-2xl shadow-lg">🥡</span>
            <h1 className="mt-5 font-display text-3xl font-bold">Pedido para llevar</h1>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Arma tu pedido y pasa a recoger. Tienes el mismo menú completo del restaurante.
            </p>
          </div>

          <div className="mt-7 space-y-4">
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted-foreground)] mb-1.5">
                <User size={14} /> Tu nombre
              </span>
              <input
                autoFocus
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none focus:border-[var(--brown)] search-glow"
                placeholder="Ej. Juan Pérez"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted-foreground)] mb-1.5">
                <Phone size={14} /> Teléfono (opcional, para avisarte)
              </span>
              <input
                className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-base outline-none focus:border-[var(--brown)] search-glow"
                placeholder="55 1234 5678"
                inputMode="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </label>
          </div>

          <button
            className="focus-ring btn-press mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brown)] px-5 text-base font-bold text-white shadow-lg transition hover:bg-[var(--brown-dark)] disabled:opacity-40"
            disabled={!customerName.trim()}
            onClick={() => setStarted(true)}
          >
            Ver menú completo
          </button>
        </div>
      </main>
    );
  }

  return <MenuClient tableCode="LLEVAR" customerName={customerName.trim()} customerPhone={customerPhone.trim()} />;
}
