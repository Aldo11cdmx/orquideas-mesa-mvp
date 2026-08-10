"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

type DrinkFlavor = {
  id: string;
  drinkType: string;
  name: string;
  priceModifier: number;
  active: boolean;
  sortOrder: number;
};

const DRINK_LABELS: Record<string, string> = {
  cafe: "Café",
  malteada: "Malteada",
  licuado: "Licuado",
  "agua-fruta": "Agua de fruta"
};

const DRINK_TYPES = ["cafe", "malteada", "licuado", "agua-fruta"];

export function DrinksAdmin({ pin }: { pin: string }) {
  const [flavors, setFlavors] = useState<DrinkFlavor[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newType, setNewType] = useState("cafe");

  const loadFlavors = useCallback(async () => {
    setLoading(true);
    setNotice("");
    const response = await fetch(
      `/api/admin/drink-flavors?pin=${encodeURIComponent(pin)}`,
      { cache: "no-store" }
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice(payload?.error || "Error al cargar sabores");
    } else {
      setFlavors(Array.isArray(payload) ? payload : []);
    }
    setLoading(false);
  }, [pin]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFlavors(), 0);
    return () => window.clearTimeout(timer);
  }, [loadFlavors]);

  async function saveFlavor(flavor?: DrinkFlavor) {
    setNotice("");
    if (flavor) {
      const response = await fetch("/api/admin/drink-flavors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pin,
          id: flavor.id,
          drinkType: flavor.drinkType,
          name: flavor.name,
          priceModifier: flavor.priceModifier,
          active: !flavor.active,
          sortOrder: flavor.sortOrder
        })
      });
      if (!response.ok) {
        setNotice("Error al actualizar.");
        return;
      }
    } else {
      const name = newName.trim();
      const price = Number(newPrice) || 0;
      if (!name) return;
      const response = await fetch("/api/admin/drink-flavors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pin,
          id: null,
          drinkType: newType,
          name,
          priceModifier: price,
          active: true,
          sortOrder: 0
        })
      });
      if (!response.ok) {
        setNotice("Error al crear sabor.");
        return;
      }
      setNewName("");
      setNewPrice("");
    }
    void loadFlavors();
  }

  async function deleteFlavor(id: string) {
    setNotice("");
    const response = await fetch("/api/admin/drink-flavors", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pin, id })
    });
    if (!response.ok) {
      setNotice("Error al eliminar.");
      return;
    }
    void loadFlavors();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-3xl font-bold">Sabores de Bebidas</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Configura los sabores disponibles de café, malteada, licuado y agua de fruta.
            Desactiva los que no haya hoy.
          </p>
        </div>
        <button
          className="focus-ring flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brown)] px-4 text-sm font-bold text-white"
          onClick={() => void loadFlavors()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} size={16} />
          {loading ? "Cargando" : "Actualizar"}
        </button>
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl bg-[#f8e8e2] p-3 text-sm font-bold text-[#8a3b30]">{notice}</div>
      )}

      {/* Add new */}
      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
        <label className="min-w-32">
          <span className="text-xs font-bold text-[var(--muted)]">Bebida</span>
          <select
            className="mt-1 block w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brown)]"
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
          >
            {DRINK_TYPES.map((t) => (
              <option key={t} value={t}>{DRINK_LABELS[t]}</option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          <span className="text-xs font-bold text-[var(--muted)]">Sabor / Opción</span>
          <input
            className="mt-1 block w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brown)]"
            placeholder="Ej: Fresa, Horchata…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <label className="w-28">
          <span className="text-xs font-bold text-[var(--muted)]">Costo extra ($)</span>
          <input
            className="mt-1 block w-full rounded-xl border border-[var(--line)] px-3 py-2.5 text-sm outline-none focus:border-[var(--brown)]"
            type="number"
            min="0"
            placeholder="0"
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
          />
        </label>
        <button
          className="focus-ring flex min-h-10 items-center gap-2 rounded-xl bg-[var(--green)] px-4 text-sm font-bold text-white disabled:opacity-50"
          disabled={!newName.trim()}
          onClick={() => void saveFlavor()}
        >
          <Plus size={16} /> Agregar
        </button>
      </div>

      {/* List grouped by drink type */}
      <div className="mt-5 space-y-6">
        {DRINK_TYPES.map((drinkType) => {
          const typeFlavors = flavors.filter((f) => f.drinkType === drinkType);
          return (
            <fieldset key={drinkType} className="rounded-2xl border border-[var(--line)] p-4">
              <legend className="px-1 font-display text-xl font-bold">
                {DRINK_LABELS[drinkType]}
              </legend>
              <p className="mb-3 text-xs text-[var(--muted)]">
                {typeFlavors.filter((f) => f.active).length} sabores activos
              </p>
              <div className="space-y-2">
                {typeFlavors.length === 0 && (
                  <p className="rounded-xl border border-dashed border-[#bdb4a5] py-6 text-center text-sm text-[var(--muted)]">
                    Sin sabores. Agrega el primero arriba.
                  </p>
                )}
                {typeFlavors.map((flavor) => (
                  <div
                    key={flavor.id}
                    className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                      flavor.active
                        ? "border-[var(--line)] bg-white"
                        : "border-transparent bg-[#f5f2ed] opacity-60"
                    }`}
                  >
                    <button
                      className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--line)] bg-white"
                      onClick={() => void saveFlavor(flavor)}
                      title={flavor.active ? "Desactivar" : "Activar"}
                    >
                      {flavor.active
                        ? <ToggleRight size={20} className="text-[var(--green)]" />
                        : <ToggleLeft size={20} className="text-[var(--muted)]" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{flavor.name}</p>
                      {flavor.priceModifier > 0 && (
                        <p className="text-xs text-[var(--muted)]">+${flavor.priceModifier}</p>
                      )}
                    </div>
                    <button
                      className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#f8e8e2] text-[#8a3b30]"
                      onClick={() => void deleteFlavor(flavor.id)}
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
    </div>
  );
}
