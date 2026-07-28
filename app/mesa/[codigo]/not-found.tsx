import Link from "next/link";
import { CircleX } from "lucide-react";
import { Brand } from "@/components/brand";

export default function TableNotFound() {
  return (
    <main className="mx-auto grid min-h-screen max-w-lg place-items-center px-6 text-center">
      <div>
        <Brand />
        <CircleX className="mx-auto mt-12 text-[var(--terracotta)]" size={52} />
        <h1 className="mt-5 font-display text-4xl font-bold">Esta mesa no existe</h1>
        <p className="mt-3 text-[var(--muted)]">
          Escanea nuevamente el código colocado en tu mesa o solicita ayuda al personal.
        </p>
        <Link
          className="focus-ring mt-8 inline-flex rounded-full bg-[var(--green)] px-6 py-3 font-bold text-white"
          href="/demo"
        >
          Ir a la demostración
        </Link>
      </div>
    </main>
  );
}
