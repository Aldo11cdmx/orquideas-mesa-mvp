import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  ExternalLink,
  QrCode,
  ShieldCheck,
  Smartphone,
  Tablet
} from "lucide-react";
import { Brand } from "@/components/brand";

const steps = [
  ["Tablet", "Abre Cocina e ingresa el PIN 2026.", Tablet],
  ["Alertas", "Toca “Activar alertas” en el tablero.", ChefHat],
  ["Celular", "Abre la mesa A1 o escanea su QR.", Smartphone],
  ["Pedido", "Agrega productos y envíalos a cocina.", CheckCircle2],
  ["Tiempo real", "Cambia a preparando y listo; observa el celular.", ArrowRight]
] as const;

export default function DemoPage() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Brand compact />
          <span className="rounded-full bg-[#f4dfb4] px-3 py-2 text-xs font-bold text-[#694500]">
            MVP de demostración
          </span>
        </div>
      </header>
      <section className="relative overflow-hidden bg-[var(--green)] text-white">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[70px] border-white/5" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e5cd90]">
            Del QR a la cocina
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-bold leading-[0.98] sm:text-7xl">
            Un pedido completo, en menos de un minuto.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-7 text-[#d7e2dd]">
            Prueba la experiencia desde una mesa, recibe el pedido en la tablet y actualiza su
            estado sin recargar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="focus-ring flex items-center gap-2 rounded-full bg-[var(--gold)] px-6 py-4 font-bold text-[var(--green)]"
              href="/mesa/A1"
            >
              Probar mesa A1 <ExternalLink size={17} />
            </Link>
            <Link
              className="focus-ring flex items-center gap-2 rounded-full border border-white/25 px-6 py-4 font-bold"
              href="/cocina"
            >
              Abrir cocina <ChefHat size={18} />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-12">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--terracotta)]">
              Guion rápido
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold">Demostración de 1 minuto</h2>
            <ol className="mt-7 space-y-3">
              {steps.map(([title, body, Icon], index) => (
                <li className="paper flex gap-4 rounded-2xl p-4" key={title}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#e4ece6] font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <h3 className="flex items-center gap-2 font-bold">
                      <Icon size={17} /> {title}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <aside>
            <div className="paper rounded-[2rem] p-6">
              <QrCode className="text-[var(--terracotta)]" size={38} />
              <h2 className="mt-4 font-display text-3xl font-bold">Códigos de mesa</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                La hoja imprimible incluye A1, A2, A3, B1, B2 y B3.
              </p>
              <Link
                className="focus-ring mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--green)] font-bold text-white"
                href="/qr"
              >
                Ver e imprimir QR
              </Link>
            </div>
            <div className="mt-4 rounded-[2rem] bg-[#f4dfb4] p-6 text-[#694500]">
              <ShieldCheck size={32} />
              <h3 className="mt-3 font-display text-2xl font-bold">Acceso demo</h3>
              <p className="mt-2 text-sm">
                Cocina y administración usan el PIN <strong>2026</strong>. No corresponde a una
                contraseña real.
              </p>
            </div>
            <Link
              className="focus-ring mt-4 flex min-h-14 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 font-bold"
              href="/admin"
            >
              Abrir administración <ArrowRight size={18} />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
