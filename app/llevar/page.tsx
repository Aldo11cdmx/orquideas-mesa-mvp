"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Clock3, Minus, Phone, Plus, Search, ShoppingBag, User, X } from "lucide-react";
import { Brand } from "@/components/brand";
import { ProductImage } from "@/components/product-image";
import { StatusPill } from "@/components/status-pill";
import {
  categories,
  isProductAvailable,
  mexicoCityMinutes,
  money,
  products as seedProducts
} from "@/lib/menu";
import { calculateCartTotal, cartItemTotal } from "@/lib/order-utils";
import type { CartItem, Product } from "@/lib/types";

function normalizeProduct(raw: Record<string, unknown>): Product {
  const product = raw as unknown as Product;
  return {
    ...product,
    slug: (raw.slug as string) || (raw.id as string) || product.slug || product.id,
    image: (raw.image as string) || product.image || "/menu/imperio/chilaquiles-sencillos.jpg"
  };
}

export default function LlevarPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Favoritos");
  const [selected, setSelected] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [generalNotes, setGeneralNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [catalog, setCatalog] = useState<Product[]>(seedProducts);
  const [serviceMinutes, setServiceMinutes] = useState<number | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [orderSent, setOrderSent] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    const updateClock = () => setServiceMinutes(mexicoCityMinutes());
    updateClock();
    const timer = window.setInterval(updateClock, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const loadCatalog = useCallback(async () => {
    const response = await fetch("/api/products", { cache: "no-store" });
    if (!response.ok) return;
    const raw = (await response.json()) as Array<Record<string, unknown>>;
    if (!raw.length) return;
    const next = raw.map(normalizeProduct);
    if (next.length) setCatalog(next);
  }, []);

  useEffect(() => {
    void loadCatalog();
    const timer = window.setInterval(() => void loadCatalog(), 15000);
    return () => window.clearInterval(timer);
  }, [loadCatalog]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return catalog.filter((product) => {
      const matchesQuery =
        !normalized ||
        `${product.name} ${product.description}`.toLocaleLowerCase("es").includes(normalized);
      const matchesCategory =
        normalized || (category === "Favoritos" ? product.popular : product.category === category);
      return matchesQuery && matchesCategory;
    });
  }, [catalog, category, query]);

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = calculateCartTotal(cart);

  function addItem(product: Product, quantity: number, notes: string) {
    setCart((current) => [
      ...current,
      {
        productId: product.slug || product.id,
        name: product.name,
        unitPrice: product.price,
        quantity,
        notes,
        image: product.image
      }
    ]);
    setSelected(null);
    setJustAdded(true);
    window.setTimeout(() => setJustAdded(false), 1800);
  }

  async function submitOrder() {
    if (sending || cart.length === 0) return;
    if (!customerName.trim()) {
      window.alert("Por favor ingresa tu nombre para el pedido.");
      return;
    }
    if (!window.confirm(`¿Confirmar pedido para llevar de ${money(subtotal)}?`)) return;
    setSending(true);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tableCode: "LLEVAR",
          items: cart.map(({ productId, quantity, notes }) => ({ productId, quantity, notes })),
          notes: `Para llevar · ${customerName.trim()} · ${customerPhone.trim() || "Sin teléfono"} · ${generalNotes}`,
          idempotencyKey: crypto.randomUUID()
        })
      });
      if (!response.ok) throw new Error("Error al registrar pedido");
      setOrderSent(true);
      setCartOpen(false);

      // Try Mercado Pago
      try {
        const mpRes = await fetch("/api/mercadopago", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amount: subtotal,
            description: `Pedido para llevar · ${customerName.trim()}`,
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim()
          })
        });
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          if (mpData.url) setPaymentUrl(mpData.url);
        }
      } catch {
        // Mercado Pago not configured, skip
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "No fue posible enviar el pedido");
    } finally {
      setSending(false);
    }
  }

  if (orderSent) {
    return (
      <main className="mx-auto min-h-screen max-w-xl px-5 py-6">
        <Brand />
        <section className="glass-card mt-8 overflow-hidden rounded-[2rem]">
          <div className="bg-[var(--green)] px-6 py-8 text-white">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--gold)] text-[var(--green)]">
              <Check size={30} strokeWidth={3} />
            </div>
            <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-[#e5cd90]">Pedido registrado</p>
            <h1 className="mt-1 font-display text-4xl font-bold">¡Gracias, {customerName}!</h1>
            <p className="mt-2 text-white/70">Tu pedido para llevar está en proceso. Te avisaremos cuando esté listo.</p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between rounded-2xl bg-[#eee8dc] p-4">
              <span>
                <span className="block text-xs uppercase text-[var(--muted)]">Total</span>
                <strong className="text-xl">{money(subtotal)}</strong>
              </span>
              <span className="text-right">
                <span className="block text-xs uppercase text-[var(--muted)]">Productos</span>
                <strong>{itemCount}</strong>
              </span>
            </div>
            {paymentUrl ? (
              <a
                href={paymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#00a650] px-5 font-bold text-white shadow-lg hover:opacity-90"
              >
                <ShoppingBag size={20} />
                Pagar con Mercado Pago
              </a>
            ) : (
              <div className="mt-4 rounded-2xl bg-[#f4dfb4]/60 p-4 text-sm">
                <p className="font-bold text-[#694500]">Pago en el local</p>
                <p className="mt-1 text-xs text-[#694500]/80">
                  Puedes pagar en efectivo o tarjeta al recoger tu pedido.
                </p>
              </div>
            )}
            <button
              className="focus-ring mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--terracotta)] px-5 font-bold text-white"
              onClick={() => {
                setOrderSent(false);
                setCart([]);
                setPaymentUrl(null);
              }}
            >
              Hacer otro pedido
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-28">
      <header className="premium-header relative overflow-hidden text-white">
        <div className="absolute -right-20 -top-36 h-80 w-80 rounded-full border-[64px] border-white/[0.035]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-5 sm:px-6 sm:pb-8">
          <div className="flex items-center justify-between">
            <Brand compact inverse />
            <div className="chip-glass rounded-full px-3 py-2 text-xs font-bold text-white">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#9acb8a] shadow-[0_0_0_4px_rgba(154,203,138,0.12)]" />
              Pedido para llevar
            </div>
          </div>
          <div className="mt-8">
            <p className="eyebrow text-[var(--gold)]">Recoge en el local</p>
            <h1 className="mt-2 max-w-2xl font-display text-4xl font-bold leading-[0.98] sm:text-5xl">
              Ordena y pasa a recoger
            </h1>
            <p className="mt-3 text-sm text-white/65">
              Arma tu pedido y te avisamos cuando esté listo.
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="glass-card -mt-4 relative z-10 mb-4 rounded-2xl p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] mb-1.5">
                <User size={14} /> Tu nombre
              </span>
              <input
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brown)]"
                placeholder="Ej. Juan Pérez"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)] mb-1.5">
                <Phone size={14} /> Teléfono (opcional)
              </span>
              <input
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brown)]"
                placeholder="55 1234 5678"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </label>
          </div>
        </section>

        <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--line)]/50 bg-[var(--cream)]/90 px-4 pb-4 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <label className="paper search-glow flex items-center gap-3 rounded-2xl px-4 py-3 transition-shadow">
            <Search size={19} aria-hidden="true" />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8b938f]"
              placeholder="Busca chilaquiles, molletes, café…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="Limpiar búsqueda" onClick={() => setQuery("")}>
                <X size={18} />
              </button>
            )}
          </label>
          <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
            {categories.filter(c => c !== "Comidas a la carta").map((item) => (
              <button
                key={item}
                className={`focus-ring shrink-0 rounded-full px-4 py-2 text-sm font-bold category-pill ${
                  category === item ? "bg-[var(--brown)] text-white shadow-sm" : "border border-[var(--line)] bg-[var(--paper)]"
                }`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 mt-3 flex items-end justify-between">
          <div>
            <p className="eyebrow text-[var(--brown)]">Hecho al momento</p>
            <h2 className="font-display text-3xl font-bold">{category}</h2>
          </div>
          <span className="text-sm text-[var(--muted)]">{visible.length} opciones</span>
        </div>

        {visible.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} currentMinutes={serviceMinutes} onOpen={setSelected} />
            ))}
          </div>
        ) : (
          <div className="paper rounded-3xl px-6 py-14 text-center">
            <Search className="mx-auto text-[var(--brown)]" size={34} />
            <h3 className="mt-4 font-display text-2xl font-bold">No encontramos ese platillo</h3>
            <p className="mt-2 text-sm text-[var(--muted)]">Intenta con otro nombre o cambia de categoría.</p>
          </div>
        )}
      </div>

      {justAdded && (
        <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div className="toast-enter flex items-center gap-2.5 rounded-full bg-[var(--charcoal)] px-5 py-3.5 text-sm font-bold text-white shadow-2xl ring-1 ring-white/10">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--gold)]">
              <Check size={14} strokeWidth={3} className="text-[var(--charcoal)]" />
            </span>
            Agregado al pedido
          </div>
        </div>
      )}

      {itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 p-3 sm:p-5">
          <button
            className="focus-ring btn-press mx-auto flex w-full max-w-xl items-center justify-between rounded-2xl bg-[var(--brown)] px-5 py-4 font-bold text-white shadow-2xl transition hover:bg-[var(--brown-dark)]"
            onClick={() => setCartOpen(true)}
          >
            <span className="flex items-center gap-3">
              <span className={`grid h-8 w-8 place-items-center rounded-full bg-white/20 ${justAdded ? "animate-bounce-in" : ""}`}>
                {itemCount}
              </span>
              Ver mi pedido
            </span>
            <span>{money(subtotal)}</span>
          </button>
        </div>
      )}

      {selected && (
        <ProductDialog product={selected} onClose={() => setSelected(null)} onAdd={addItem} />
      )}
      {cartOpen && (
        <div className="animate-fade-in fixed inset-0 z-50 flex justify-end bg-[#171411]/70 backdrop-blur-[3px]">
          <CartDrawer
            cart={cart}
            notes={generalNotes}
            sending={sending}
            onNotes={setGeneralNotes}
            onClose={() => setCartOpen(false)}
            onChange={setCart}
            onSubmit={submitOrder}
          />
        </div>
      )}
    </main>
  );
}

function ProductCard({ product, currentMinutes, onOpen }: { product: Product; currentMinutes: number | null; onOpen: (p: Product) => void }) {
  const available = isProductAvailable(product, currentMinutes);
  return (
    <article className="paper menu-card card-hover group relative overflow-hidden rounded-[1.75rem]">
      <button className="focus-ring block w-full text-left disabled:opacity-65" onClick={() => onOpen(product)} disabled={product.soldOut || !available}>
        <div className="relative">
          <ProductImage src={product.image} alt={product.name} category={product.category} className="aspect-[4/3] w-full" />
          <span className="absolute left-3 top-3 chip-glass rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-white">
            {product.category}
          </span>
        </div>
        <div className="p-5">
          <h3 className="font-display text-[1.35rem] font-bold leading-[1.05]">{product.name}</h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--muted)]">{product.description}</p>
          <div className="mt-5 flex items-center justify-between border-t border-[var(--line)]/65 pt-4">
            <p className="text-lg font-extrabold text-[var(--brown-dark)]">{money(product.price)}</p>
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--brown)] text-white shadow-lg transition group-hover:scale-105">
              <Plus size={20} />
            </span>
          </div>
        </div>
      </button>
    </article>
  );
}

function ProductDialog({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (p: Product, q: number, n: string) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-end overflow-hidden bg-[#171411]/70 backdrop-blur-[3px] lg:items-center lg:justify-center lg:p-5">
      <section role="dialog" aria-modal="true" className="animate-scale-in max-h-[94dvh] w-full overflow-auto rounded-t-[2rem] bg-[var(--paper)] shadow-2xl lg:max-w-5xl lg:rounded-[2rem]">
        <div className="relative grid min-w-0 lg:grid-cols-[0.9fr_1.1fr]">
          <button className="focus-ring absolute left-4 top-4 z-10 grid h-11 w-11 place-items-center rounded-2xl bg-white/90 shadow-lg backdrop-blur" aria-label="Cerrar" onClick={onClose}><X /></button>
          <ProductImage src={product.image} alt={product.name} category={product.category} className="h-56 w-full sm:h-72 lg:h-full lg:min-h-[34rem]" />
          <div className="min-w-0 p-5 sm:p-7 lg:p-10">
            <p className="eyebrow mb-3 text-[var(--brown)]">{product.category}</p>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">{product.name}</h2>
            <p className="mt-3 leading-6 text-[var(--muted)]">{product.description}</p>
            <label className="mt-5 block text-sm font-bold">
              Observaciones
              <textarea className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[var(--line)] bg-white p-3 font-normal outline-none focus:border-[var(--green)]" maxLength={180} placeholder="Sin cebolla, salsa aparte…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]">
              <div className="flex items-center justify-center rounded-xl border border-[var(--line)]">
                <button className="focus-ring grid h-12 w-11 place-items-center" aria-label="Restar" onClick={() => setQuantity((v) => Math.max(1, v - 1))}><Minus size={18} /></button>
                <strong className="w-8 text-center">{quantity}</strong>
                <button className="focus-ring grid h-12 w-11 place-items-center text-[var(--terracotta)]" aria-label="Sumar" onClick={() => setQuantity((v) => Math.min(10, v + 1))}><Plus size={18} /></button>
              </div>
              <button className="focus-ring flex flex-1 items-center justify-between rounded-xl bg-[var(--brown)] px-5 font-bold text-white shadow-lg hover:bg-[var(--brown-dark)]" onClick={() => onAdd(product, quantity, notes.trim())}>
                <span>Agregar</span><span>{money(product.price * quantity)}</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function CartDrawer({ cart, notes, sending, onNotes, onClose, onChange, onSubmit }: { cart: CartItem[]; notes: string; sending: boolean; onNotes: (n: string) => void; onClose: () => void; onChange: (i: CartItem[]) => void; onSubmit: () => void }) {
  const subtotal = calculateCartTotal(cart);
  return (
    <section role="dialog" aria-modal="true" className="animate-slide-in-right flex h-full w-full max-w-lg flex-col bg-[var(--paper)] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-4">
        <button className="focus-ring grid h-10 w-10 place-items-center rounded-full bg-[#eee8dc]" aria-label="Cerrar" onClick={onClose}><ArrowLeft /></button>
        <div><p className="text-xs font-bold uppercase tracking-wider text-[var(--terracotta)]">Para llevar</p><h2 className="font-display text-2xl font-bold">Mi pedido</h2></div>
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-3">
          {cart.map((item, index) => (
            <article key={`${item.productId}-${index}`} className="glass-card rounded-2xl p-4">
              <div className="flex gap-3">
                <ProductImage src={item.image} alt={item.name} className="h-20 w-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-3"><h3 className="font-bold">{item.name}</h3><strong>{money(cartItemTotal(item))}</strong></div>
                  {item.notes && <p className="mt-1 text-xs text-[var(--muted)]">{item.notes}</p>}
                  <div className="mt-3 flex items-center gap-3">
                    <button className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-white" aria-label={`Restar ${item.name}`} onClick={() => { const next = [...cart]; if (item.quantity === 1) next.splice(index, 1); else next[index] = { ...item, quantity: item.quantity - 1 }; onChange(next); }}><Minus size={15} /></button>
                    <strong>{item.quantity}</strong>
                    <button className="focus-ring grid h-8 w-8 place-items-center rounded-full bg-white" aria-label={`Sumar ${item.name}`} onClick={() => { const next = [...cart]; next[index] = { ...item, quantity: Math.min(10, item.quantity + 1) }; onChange(next); }}><Plus size={15} /></button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
        <label className="mt-5 block text-sm font-bold">
          Observaciones generales
          <textarea className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-[var(--line)] bg-white p-3 font-normal outline-none focus:border-[var(--green)]" maxLength={250} placeholder="Algo que debamos saber…" value={notes} onChange={(e) => onNotes(e.target.value)} />
        </label>
      </div>
      <div className="border-t border-[var(--line)] bg-[var(--paper)] p-5 shadow-[0_-16px_36px_rgba(48,44,41,0.08)]">
        <div className="mb-4 flex items-center justify-between text-lg"><span>Total estimado</span><strong className="text-xl">{money(subtotal)}</strong></div>
        <button className="focus-ring flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--green)] px-5 font-bold text-white transition hover:opacity-90 disabled:opacity-60" disabled={sending || cart.length === 0} onClick={onSubmit}>
          {sending ? "Enviando…" : <><ShoppingBag size={20} />Confirmar pedido</>}
        </button>
      </div>
    </section>
  );
}
