import { Leaf, UtensilsCrossed } from "lucide-react";
import { restaurant } from "@/lib/menu";

export function Brand({
  compact = false,
  inverse = false
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`relative grid shrink-0 place-items-center rounded-2xl bg-[var(--green)] text-[var(--gold)] shadow-lg ring-1 ring-white/20 ${
          compact ? "h-10 w-10" : "h-12 w-12"
        }`}
        aria-hidden="true"
      >
        <span className="absolute inset-1 rounded-xl border border-[var(--gold)]/25" />
        <div className="relative">
          <UtensilsCrossed size={compact ? 19 : 22} strokeWidth={1.8} />
          <Leaf className="absolute -right-2 -top-2" size={12} fill="currentColor" />
        </div>
      </div>
      <div>
        <p
          className={`${compact ? "text-xl" : "text-2xl"} font-display font-bold leading-none tracking-[-0.03em] ${
            inverse ? "text-white" : ""
          }`}
        >
          {restaurant.name}
        </p>
        <p
          className={`mt-1 text-[10px] font-bold uppercase tracking-[0.22em] ${
            inverse ? "text-[var(--gold)]" : "text-[var(--terracotta)]"
          }`}
        >
          {restaurant.descriptor}
        </p>
      </div>
    </div>
  );
}
