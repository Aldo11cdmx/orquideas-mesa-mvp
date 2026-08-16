"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Toggle de tema claro/oscuro estilo Apple.
 * Mecanismo: clase `dark` en <html> + localStorage("theme").
 * El estado inicial lo aplica un script inline en app/layout.tsx
 * antes de la hidratación (sin FOUC); aquí solo se alterna la clase.
 * Los íconos se muestran por CSS (dark:) → cero riesgo de hydration mismatch.
 */
export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.classList.contains("dark") ? "light" : "dark";
    root.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* almacenamiento no disponible: el cambio aplica solo a la sesión */
    }
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Cambiar tema claro u oscuro"
      title="Cambiar tema"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-black/10 bg-neutral-100 text-neutral-700 transition-colors duration-300 hover:bg-neutral-200 active:scale-90 dark:border-white/15 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden="true" />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden="true" />
    </button>
  );
}
