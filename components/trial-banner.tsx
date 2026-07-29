"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";
import type { TrialStatus } from "@/lib/types";

export function TrialBanner({ compact = false }: { compact?: boolean }) {
  const [trial, setTrial] = useState<TrialStatus | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    void fetch("/api/trial")
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as TrialStatus;
      })
      .then((payload) => {
        if (active && payload) setTrial(payload);
      });
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
      </span>
      {!remaining.active && !compact && (
        <span className="rounded-full bg-white/70 px-3 py-1 text-xs">El sistema sigue activo</span>
      )}
    </div>
  );
}
