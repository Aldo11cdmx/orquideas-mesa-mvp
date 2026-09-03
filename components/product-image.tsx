"use client";

import { useState } from "react";

const categoryIcons: Record<string, { emoji: string; bg: string }> = {
  Desayunos: { emoji: "🍳", bg: "#f4dfb4" },
  "A la carta": { emoji: "🌮", bg: "#dce8c8" },
  "Panes y más": { emoji: "🥐", bg: "#e4ece6" },
  Bebidas: { emoji: "🥤", bg: "#d9ebe1" },
  "Comidas a la carta": { emoji: "🍖", bg: "#f4dfb4" },
  Extras: { emoji: "➕", bg: "#e8e4db" },
  "Comida corrida": { emoji: "🍲", bg: "#eee2d8" }
};

export function ProductImage({
  src,
  alt,
  category,
  className = ""
}: {
  src: string;
  alt: string;
  category?: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (error || !src || src.trim() === "") {
    const icon = category ? categoryIcons[category] : null;
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 ${className}`}
        style={{ backgroundColor: icon?.bg || "#f4f1ea" }}
        role="img"
        aria-label={alt}
      >
        <span className="text-4xl sm:text-5xl" aria-hidden="true">
          {icon?.emoji || "🍽️"}
        </span>
        <span className="px-3 text-center text-xs font-bold text-[#5c5348] line-clamp-2">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div className={`menu-photo ${className}`}>
      {/* Restaurant-owned menu photographs supplied through screenshots. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setError(true)}
      />
    </div>
  );
}
