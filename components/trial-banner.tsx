"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Plus } from "lucide-react";
import type { TrialStatus } from "@/lib/types";

export function TrialBanner({ compact = false, pin }: { compact?: boolean; pin?: string }) {
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [extending, setExtending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refresh = useMemo(
    () => () => {
      void fetch(`/api/trial?ts=${Date.now()}`, { cache: "no-store" })
        .then(async (response) => (response.ok ? ((await response.json()) as TrialStatus) : null))
        .then((payload) => {
          if (payload) setTrial(payload);
        });
    },
    []
  );

  useEffect(() => {
    refresh();
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refresh]);

  async function extendTrial() {
    if (extending) return;
    setExtending(true);
    setFeedback(null);
    try {
      const adminPin = pin ?? sessionStorage.getItem("orquideas-admin-pin") ?? "";
      const response = await fetch("/api/admin/trial", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: adminPin, hours: 24 })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo extender la prueba");
      }
      const endsAt = payload?.trialEndsAt;
      const formatted = endsAt
        ? new Date(endsAt as string).toLocaleString("es-MX", {
            timeZone: "America/Mexico_City",
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
          })
        : null;
      setFeedback(formatted ? `✓ Prueba extendida hasta el ${formatted}` : "✓ Prueba extendida");
      refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "No se pudo extender la prueba");
    } finally {
      setExtending(false);
    }
  }

  const remaining = useMemo(() => {
    if (!trial?.endsAt) return null;
    const milliseconds = Math.max(0, new Date(trial.endsAt).valueOf() - now);
    return {
      active: milliseconds > 0,
      days: Math.ceil(milliseconds / 86400000),
      hours: Math.ceil(milliseconds / 3600000)
    };
  }, [now, trial]);

  if (!remaining) return null;

  const label = remaining.active
    ? remaining.days > 1
      ? `${remaining.days} días de prueba restantes`
      : `${remaining.hours} horas de prueba restantes`
    : "El periodo de prueba terminó";

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border font-bold ${
        remaining.active
          ? "border-[#ddc786] bg-[#fff4ce] text-[#684c05]"
          : "border-[#d9aaa2] bg-[#f8dfda] text-[#7a2c22]"
      } ${compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"}`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/70">
        <Clock3 size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] uppercase tracking-wider opacity-70">
          Prueba de 14 días
        </span>
        {label}
        {feedback && (
          <span
            className={`mt-0.5 block text-[11px] font-semibold ${
              feedback.startsWith("✓") ? "text-[#2e7d32]" : "text-[#b3261e]"
            }`}
          >
            {feedback}
          </span>
        )}
      </span>
      <button
        type="button"
        className="focus-ring flex shrink-0 items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-xs font-bold shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => void extendTrial()}
        disabled={extending}
      >
        <Plus size={14} />
        {extending ? "Extendiendo…" : "24 hrs"}
      </button>
      {!remaining.active && !compact && (
        <span className="hidden rounded-full bg-white/70 px-3 py-1 text-xs sm:inline">
          El sistema sigue activo
        </span>
      )}
    </div>
  );
}
