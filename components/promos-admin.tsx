"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgePercent, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Product, Promotion } from "@/lib/types";

function money(value: number) {
  return `$${value.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

function promoPrice(product: { price: number }, promotion: Promotion) {
  if (promotion.discountType === "percent") {
    return Math.max(0, Math.round(product.price * (1 - promotion.discountValue / 100)));
  }
  return Math.max(0, product.price - promotion.discountValue);
}

export function PromosAdmin({ pin }: { pin: string }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    title: "",
    discountType: "fixed" as "percent" | "fixed",
    discountValue: "20",
    targetProductId: "",
    isActive: true
  });

  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/promotions?pin=${encodeURIComponent(pin)}`, {
      cache: "no-store"
    });
    if (!response.ok) return;
    const rows = (await response.json()) as Promotion[];
    setPromotions(rows);
    setLoading(false);
  }, [pin]);

  useEffect(() => {
    void load();
    void fetch(`/api/admin/products?pin=${encodeURIComponent(pin)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (Array.isArray(rows) && rows.length) setProducts(rows);
      })
      .catch(() => {});
  }, [load, pin]);

  async function toggle(promotion: Promotion) {
    const next = !promotion.isActive;
    setPromotions((current) =>
      current.map((item) => (item.id === promotion.id ? { ...item, isActive: next } : item))
    );
    const response = await fetch(
      `/api/admin/promotions?pin=${encodeURIComponent(pin)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: promotion.id,
          title: promotion.title,
          discountType: promotion.discountType,
          discountValue: promotion.discountValue,
          targetProductId: promotion.productId,
          isActive: next
        })
      }
    );
    if (!response.ok) {
      setPromotions((current) =>
        current.map((item) => (item.id === promotion.id ? { ...item, isActive: !next } : item))
      );
      setError("No fue posible actualizar la promoción");
    }
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return;
    const value = Number(form.discountValue);
    if (!Number.isFinite(value) || value <= 0) return;
    setSaving(true);
    setError("");
    const response = await fetch(
      `/api/admin/promotions?pin=${encodeURIComponent(pin)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          discountType: form.discountType,
          discountValue: value,
          targetProductId: form.targetProductId || null,
          isActive: form.isActive
        })
      }
    );
    setSaving(false);
    if (!response.ok) {
      setError("No fue posible crear la promoción");
      return;
    }
    setForm({ title: "", discountType: "fixed", discountValue: "20", targetProductId: "", isActive: true });
    void load();
  }

  async function remove(promotion: Promotion) {
    if (!window.confirm(`¿Eliminar la promoción "${promotion.title}"?`)) return;
    const response = await fetch(
      `/api/admin/promotions?pin=${encodeURIComponent(pin)}`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: promotion.id })
      }
    );
    if (!response.ok) {
      setError("No fue posible eliminar la promoción");
      return;
    }
    setPromotions((current) => current.filter((item) => item.id !== promotion.id));
  }

  const productMap = new Map(products.map((product) => [product.id, product]));

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">Promociones</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            Enciende o apaga ofertas en un toque. Se reflejan al instante en el menú público.
          </p>
        </div>
        <button
          className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
          aria-label="Actualizar promociones"
          onClick={() => void load()}
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[#f1d0ca] px-4 py-3 text-sm font-bold text-[#7a2c22]">
          {error}
        </div>
      )}

      <section className="paper rounded-[1.75rem] p-5">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold">
          <BadgePercent size={20} className="text-[var(--terracotta)]" /> Nueva promoción
        </h3>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={create}>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-[var(--muted-foreground)]">Título</span>
            <input
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--brown)]"
              placeholder="Ej. Jueves de Tacos Dorados"
              value={form.title}
              maxLength={120}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[var(--muted-foreground)]">Tipo de descuento</span>
            <select
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-bold outline-none"
              value={form.discountType}
              onChange={(event) =>
                setForm({ ...form, discountType: event.target.value as "percent" | "fixed" })
              }
            >
              <option value="fixed">Precio fijo (ej. $15 menos)</option>
              <option value="percent">Porcentaje (ej. 20%)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-[var(--muted-foreground)]">
              {form.discountType === "percent" ? "Porcentaje" : "Descuento ($)"}
            </span>
            <input
              type="number"
              min={1}
              step={form.discountType === "percent" ? 1 : 1}
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 outline-none focus:border-[var(--brown)]"
              value={form.discountValue}
              onChange={(event) => setForm({ ...form, discountValue: event.target.value })}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-[var(--muted-foreground)]">Producto</span>
            <select
              className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 font-bold outline-none"
              value={form.targetProductId}
              onChange={(event) => setForm({ ...form, targetProductId: event.target.value })}
            >
              <option value="">— Todos los productos (banner general) —</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} · {money(product.price)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-bold sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--green)]"
              checked={form.isActive}
              onChange={(event) => setForm({ ...form, isActive: event.target.checked })}
            />
            Activa desde que se crea
          </label>
          <button
            className="focus-ring mt-1 inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full bg-neutral-900 px-5 text-xs font-semibold text-white shadow-sm transition-all duration-200 hover:bg-neutral-800 active:scale-95 disabled:opacity-40 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200 sm:col-span-2"
            disabled={saving || !form.title.trim() || !(Number(form.discountValue) > 0)}
          >
            <Plus size={15} />
            {saving ? "Guardando…" : "Crear promoción"}
          </button>
        </form>
      </section>

      <section className="paper rounded-[1.75rem] p-5">
        <h3 className="mb-4 font-display text-lg font-bold">Promociones existentes</h3>
        {loading ? (
          <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Cargando promociones…</p>
        ) : promotions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#b9b2a5] py-10 text-center">
            <p className="font-display text-xl font-bold">Aún no hay promociones</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Crea la primera arriba y aparecerá en el menú público con su badge de ¡PROMO!.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {promotions.map((promotion) => {
              const product = promotion.productSlug
                ? productMap.get(promotion.productSlug)
                : undefined;
              const base = product?.price ?? 0;
              const finalPrice = product ? promoPrice(product, promotion) : null;
              return (
                <li
                  key={promotion.id}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 transition ${
                    promotion.isActive
                      ? "border-[var(--green)]/40 bg-[#f2f7f0]"
                      : "border-[var(--line)] bg-white opacity-75"
                  }`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] text-lg">
                    🏷️
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-bold leading-tight">
                      {promotion.title}
                    </p>
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {promotion.productSlug
                        ? product
                          ? `${product.name} · ${money(base)} → ${money(finalPrice ?? base)}`
                          : promotion.productSlug
                        : "Todos los productos"}
                      {promotion.discountType === "percent"
                        ? ` · −${promotion.discountValue}%`
                        : ` · −${money(promotion.discountValue)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={promotion.isActive}
                      onCheckedChange={() => void toggle(promotion)}
                      aria-label={`Activar ${promotion.title}`}
                    />
                    <button
                      className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      aria-label={`Eliminar ${promotion.title}`}
                      onClick={() => void remove(promotion)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
