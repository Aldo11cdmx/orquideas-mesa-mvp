import { Leaf, UtensilsCrossed } from "lucide-react";
import { restaurant } from "@/lib/menu";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`grid shrink-0 place-items-center rounded-full bg-[var(--green)] text-[var(--gold)] ${
          compact ? "h-10 w-10" : "h-12 w-12"
        }`}
        aria-hidden="true"
      >
        <div className="relative">
          <UtensilsCrossed size={compact ? 19 : 22} strokeWidth={1.8} />
          <Leaf className="absolute -right-2 -top-2" size={12} fill="currentColor" />
        </div>
      </div>
      <div>
        <p className={`${compact ? "text-xl" : "text-2xl"} font-display font-bold leading-none`}>
          {restaurant.name}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--terracotta)]">
          {restaurant.descriptor}
        </p>
      </div>
    </div>
  );
}
