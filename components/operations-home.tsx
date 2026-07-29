import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChefHat,
  ExternalLink,
  HandPlatter,
  QrCode,
  ShieldCheck,
  Smartphone,
  Tablet
} from "lucide-react";
import { Brand } from "@/components/brand";

const steps = [
  ["Cocina", "Abre el tablero en la tablet e ingresa el PIN del personal.", Tablet],
  ["Alertas", "Activa las alertas de pedidos nuevos.", ChefHat],
  ["Mesa", "El cliente escanea el QR colocado en su mesa.", Smartphone],
  ["Pedido", "Elige sus platillos y los envía al instante.", CheckCircle2],
  ["Aviso", "El pedido aparece al mismo tiempo en cocina y meseros.", HandPlatter],
  ["Seguimiento", "El cliente sigue el estado hasta que se entrega.", ArrowRight]
] as const;

export function OperationsHome() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Brand compact />
          <span className="rounded-full bg-[var(--mist)] px-3 py-2 text-xs font-bold text-[var(--brown)]">
            Sistema en operación
          </span>
        </div>
      </header>
      <section className="premium-header relative overflow-hidden text-white">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[70px] border-white/5" />
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-[var(--gold)]/5 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-28">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e5cd90]">
            Del QR a la cocina
          </p>
          <h1 className="mt-4 max-w-4xl font-display text-5xl font-bold leading-[0.95] sm:text-7xl">
            Una experiencia más clara, rápida y deliciosa.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-7 text-[#d7e2dd]">
            Cada mesa tiene su propio QR. El pedido llega a cocina y meseros mientras el cliente
            sigue su estado.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              className="focus-ring flex items-center gap-2 rounded-2xl bg-[var(--gold)] px-6 py-4 font-bold text-[var(--green)] shadow-xl"
              href="/mesa/A1"
            >
              Abrir mesa A1 <ExternalLink size={17} />
            </Link>
            <Link
              className="focus-ring flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-bold backdrop-blur"
              href="/cocina"
            >
              Abrir cocina <ChefHat size={18} />
            </Link>
            <Link
              className="focus-ring flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-4 font-bold backdrop-blur"
              href="/meseros"
            >
              Abrir meseros <HandPlatter size={18} />
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <section>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--terracotta)]">
              Flujo de servicio
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold">Operación en seis pasos</h2>
            <ol className="mt-7 grid gap-3 sm:grid-cols-2">
              {steps.map(([title, body, Icon], index) => (
                <li className="paper flex min-h-36 flex-col justify-between rounded-3xl p-5" key={title}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--charcoal)] font-bold text-[var(--gold)] shadow-md">
                    {index + 1}
                  </span>
                  <div className="mt-5 flex-1">
                    <h3 className="flex items-center gap-2 font-display text-xl font-bold">
                      <Icon size={17} /> {title}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <aside>
            <div className="paper rounded-[2rem] p-7">
              <QrCode className="text-[var(--terracotta)]" size={38} />
              <h2 className="mt-4 font-display text-3xl font-bold">Códigos de mesa</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                La hoja imprimible incluye A1, A2, A3, B1, B2 y B3.
              </p>
              <Link
                className="focus-ring mt-5 flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[var(--green)] font-bold text-white shadow-lg"
                href="/qr"
              >
                Ver e imprimir QR
              </Link>
            </div>
            <div className="mt-4 rounded-[2rem] border border-[#d6b66f]/45 bg-[#f4dfb4] p-6 text-[#694500] shadow-lg">
              <ShieldCheck size={32} />
              <h3 className="mt-3 font-display text-2xl font-bold">Acceso del personal</h3>
              <p className="mt-2 text-sm">
                Cocina y administración requieren el PIN configurado para el personal autorizado.
              </p>
            </div>
            <Link
              className="focus-ring mt-4 flex min-h-14 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 font-bold"
              href="/admin"
            >
              Abrir administración <ArrowRight size={18} />
            </Link>
            <Link
              className="focus-ring mt-3 flex min-h-14 items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--paper)] px-5 font-bold"
              href="/meseros"
            >
              Abrir tablero de meseros <HandPlatter size={18} />
            </Link>
          </aside>
        </div>
      </div>
    </main>
  );
}
