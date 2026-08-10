import type { OrderStatus } from "@/lib/types";

const labels: Record<OrderStatus, string> = {
  sent: "Revisión del mesero",
  accepted: "Confirmado",
  preparing: "Preparando",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado"
};

const activeStatuses: OrderStatus[] = ["accepted", "preparing", "sent"];

export function StatusPill({ status }: { status: OrderStatus }) {
  const isActive = activeStatuses.includes(status);
  return (
    <span
      className={`status-${status} inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide`}
    >
      {isActive && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full bg-current pulse-dot"
          aria-hidden="true"
        />
      )}
      {labels[status]}
    </span>
  );
}
