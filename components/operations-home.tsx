import Link from "next/link";
import {
  ArrowRight,
  ChefHat,
  ExternalLink,
  HandPlatter,
  QrCode,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
} from "lucide-react";
import { Brand } from "@/components/brand";

export function OperationsHome() {
  return (
    <main className="min-h-screen">
      {/* ── Header bar ── */}
      <header className="border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Brand compact />
          <span className="rounded-full bg-[var(--mist)] px-3 py-1.5 text-xs font-semibold text-[var(--brown)]">
            En operación
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="premium-header text-white">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">
            Cocina de barrio
          </p>
          <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold leading-[1.05] sm:text-6xl">
            Pide desde la mesa.<br />Sigue tu pedido en tiempo real.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/60">
            Escanea el QR de tu mesa, elige tus platillos y recíbelos sin esperar al mesero.
            Cocina y meseros ven todo al mismo tiempo.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="focus-ring flex items-center gap-2 rounded-xl bg-[var(--gold)] px-5 py-3 font-semibold text-[var(--green)] transition hover:brightness-95"
              href="/mesa/A1"
            >
              Ver mesa demo <ExternalLink size={16} />
            </Link>
            <Link
              className="focus-ring flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-white/90 transition hover:bg-white/5"
              href="/cocina"
            >
              <ChefHat size={18} /> Cocina
            </Link>
            <Link
              className="focus-ring flex items-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-white/90 transition hover:bg-white/5"
              href="/meseros"
            >
              <HandPlatter size={18} /> Meseros
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trial + quick actions ── */}
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickCard
            href="/mesa/A1"
            icon={Smartphone}
            title="Mesa A1"
            subtitle="Pedido demo"
          />
          <QuickCard
            href="/cocina"
            icon={ChefHat}
            title="Cocina"
            subtitle="Tablero en vivo"
          />
          <QuickCard
            href="/meseros"
            icon={HandPlatter}
            title="Meseros"
            subtitle="Gestión de pedidos"
          />
          <QuickCard
            href="/llevar"
            icon={ShoppingBag}
            title="Para llevar"
            subtitle="Pedidos externos"
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Link
            className="focus-ring flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4 transition hover:border-[var(--terracotta)]/30"
            href="/qr"
          >
            <span className="flex items-center gap-3">
              <QrCode size={20} className="text-[var(--terracotta)]" />
              <span>
                <span className="block font-semibold">Códigos QR de mesa</span>
                <span className="text-sm text-[var(--muted)]">Imprimir hoja A1–B3</span>
              </span>
            </span>
            <ArrowRight size={18} className="text-[var(--muted)]" />
          </Link>

          <Link
            className="focus-ring flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4 transition hover:border-[var(--terracotta)]/30"
            href="/admin"
          >
            <span className="flex items-center gap-3">
              <ShieldCheck size={20} className="text-[var(--terracotta)]" />
              <span>
                <span className="block font-semibold">Administración</span>
                <span className="text-sm text-[var(--muted)]">Productos, extras y reportes</span>
              </span>
            </span>
            <ArrowRight size={18} className="text-[var(--muted)]" />
          </Link>
        </div>
      </div>
    </main>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  subtitle,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      className="focus-ring group flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--paper)] px-5 py-4 transition hover:border-[var(--terracotta)]/30 hover:shadow-sm"
      href={href}
    >
      <Icon size={22} className="text-[var(--terracotta)]" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
    </Link>
  );
}
