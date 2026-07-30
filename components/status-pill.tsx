import type { OrderStatus } from "@/lib/types";

const labels: Record<OrderStatus, string> = {
  sent: "Revisión del mesero",
  accepted: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

export function StatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`status-${status} inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide`}
    >
      {labels[status]}
    </span>
  );
}
