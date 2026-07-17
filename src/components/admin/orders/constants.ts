import {
  CheckCircle2,
  ChefHat,
  Clock,
  Inbox,
  PackageCheck,
  Truck,
} from "lucide-react";
import type { OrderStatus } from "@/lib/orders-api";

/**
 * Kanban columns keyed by the normalized status returned by
 * `GET /orders/unified`: NEW | CONFIRMED | PREPARING | READY |
 * OUT_FOR_DELIVERY | COMPLETED. `rawStatus` (e.g. DELIVERED) is NOT
 * used to route columns.
 */
export const COLUMNS: {
  key: OrderStatus;
  label: string;
  accent: string;
  icon: React.ElementType;
}[] = [
  {
    key: "NEW",
    label: "Recebidos",
    accent: "from-violet-500/20 to-violet-500/5",
    icon: Inbox,
  },
  {
    key: "CONFIRMED",
    label: "Confirmados",
    accent: "from-amber-500/20 to-amber-500/5",
    icon: Clock,
  },
  {
    key: "PREPARING",
    label: "Preparando",
    accent: "from-sky-500/20 to-sky-500/5",
    icon: ChefHat,
  },
  {
    key: "READY",
    label: "Prontos",
    accent: "from-emerald-500/20 to-emerald-500/5",
    icon: CheckCircle2,
  },
  {
    key: "OUT_FOR_DELIVERY",
    label: "Saiu para entrega",
    accent: "from-blue-500/20 to-blue-500/5",
    icon: Truck,
  },
  {
    key: "COMPLETED",
    label: "Entregues",
    accent: "from-zinc-500/20 to-zinc-500/5",
    icon: PackageCheck,
  },
];

/**
 * Default next-status transitions. `READY` defaults to `COMPLETED`
 * (pickup / dine-in / event). For online delivery, `nextStatusFor`
 * in `helpers.ts` promotes it to `OUT_FOR_DELIVERY`.
 */
export const NEXT_STATUS: Partial<
  Record<OrderStatus, { status: OrderStatus; label: string }>
> = {
  NEW: { status: "CONFIRMED", label: "Confirmar" },
  CONFIRMED: { status: "PREPARING", label: "Iniciar preparo" },
  PREPARING: { status: "READY", label: "Marcar pronto" },
  READY: { status: "COMPLETED", label: "Marcar entregue" },
  OUT_FOR_DELIVERY: { status: "COMPLETED", label: "Marcar entregue" },
};

/** Column routing table: unknown values fall back in the consumer. */
export const STATUS_TO_COLUMN: Record<string, OrderStatus> = {
  NEW: "NEW",
  RECEIVED: "NEW",
  PENDING: "CONFIRMED",
  CONFIRMED: "CONFIRMED",
  PREPARING: "PREPARING",
  IN_PROGRESS: "PREPARING",
  READY: "READY",
  DONE: "READY",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  COMPLETED: "COMPLETED",
  DELIVERED: "COMPLETED",
  CANCELLED: "CANCELLED",
};
