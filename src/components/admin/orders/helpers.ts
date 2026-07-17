import type { Order } from "@/lib/orders-api";

export type SectorFilter = "ALL" | "BAR" | "KITCHEN";
export type ViewFilter = "ACTIVE" | "DELIVERED" | "ALL";

export type OperationsConfig = {
  averagePreparationTimeInMinutes: number;
  lateOrderAlertMinutes: number;
  notificationSound: "default" | "soft" | "alert" | "silent";
  autoHideDeliveredOrders: boolean;
  autoHideDeliveredAfterMinutes: number;
};

export const DEFAULT_OPS: OperationsConfig = {
  averagePreparationTimeInMinutes: 15,
  lateOrderAlertMinutes: 25,
  notificationSound: "default",
  autoHideDeliveredOrders: false,
  autoHideDeliveredAfterMinutes: 10,
};

export function loadOperationsConfig(eventId: string): OperationsConfig {
  if (!eventId || typeof window === "undefined") return DEFAULT_OPS;
  try {
    const raw = window.localStorage.getItem(
      `admin.settings.operations.event.${eventId}`,
    );
    if (!raw) return DEFAULT_OPS;
    return { ...DEFAULT_OPS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_OPS;
  }
}

export function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

export function totalCents(o: Order): number {
  // Prefer normalized field set by the unified adapter.
  if (typeof o.totalInCents === "number" && o.totalInCents > 0)
    return o.totalInCents;
  // Read the raw `totals` block from the unified DTO if the adapter
  // hasn't yet stamped a top-level `totalInCents` (e.g. socket upserts).
  const rec = o as unknown as Record<string, unknown>;
  const totals =
    rec.totals && typeof rec.totals === "object"
      ? (rec.totals as Record<string, unknown>)
      : null;
  if (totals) {
    const t = totals.totalInCents ?? totals.total_in_cents ?? totals.total;
    if (typeof t === "number" && t > 0) return t;
    const sub = totals.subtotalInCents ?? totals.subtotal_in_cents;
    const del = totals.deliveryFeeInCents ?? totals.delivery_fee_in_cents;
    if (typeof sub === "number") return sub + (typeof del === "number" ? del : 0);
  }
  if (typeof o.total === "number")
    return o.total > 1000 ? o.total : Math.round(o.total * 100);
  // Last resort: sum items.
  if (Array.isArray(o.items)) {
    let sum = 0;
    for (const it of o.items) {
      const r = it as Record<string, unknown>;
      const qty = (r.quantity as number) ?? (r.qty as number) ?? 1;
      const line = r.totalInCents as number | undefined;
      if (typeof line === "number") {
        sum += line;
        continue;
      }
      const unit = (r.priceInCents as number | undefined) ?? undefined;
      if (typeof unit === "number") sum += unit * qty;
    }
    if (sum > 0) return sum;
  }
  return 0;
}

/**
 * Resolve the human label of the order context (store or event) based
 * on the marker set by the unified adapter. Falls back to slug/id.
 */
export function contextLabel(
  o: Order,
): { kind: "Loja" | "Evento"; label: string | null } {
  const rec = o as unknown as {
    __unifiedSourceType?: string;
    __unifiedContext?: {
      storeName?: string;
      storeSlug?: string;
      storeId?: string;
      eventName?: string;
      eventId?: string;
    };
    storeName?: string;
    eventName?: string;
  };
  const isOnline = rec.__unifiedSourceType === "ONLINE";
  const ctx = rec.__unifiedContext ?? {};
  if (isOnline) {
    const label =
      ctx.storeName ??
      rec.storeName ??
      ctx.storeSlug ??
      ctx.storeId ??
      null;
    return { kind: "Loja", label };
  }
  const label = ctx.eventName ?? rec.eventName ?? ctx.eventId ?? null;
  return { kind: "Evento", label };
}

/**
 * Resolve the next status transition for the "advance" button.
 * READY branches on fulfillment type: online delivery goes through
 * OUT_FOR_DELIVERY, everything else (pickup, dine-in, event) jumps
 * straight to COMPLETED.
 */
export function nextStatusFor(
  o: Order,
): { status: string; label: string } | undefined {
  const status = (o.status ?? "").toUpperCase();
  const rec = o as unknown as {
    __unifiedSourceType?: string;
    __unifiedFulfillmentType?: string;
    __unifiedFulfillmentDetails?: { type?: string | null } | null;
    fulfillmentDetails?: { type?: string | null } | null;
    fulfillment?: string | { type?: string | null } | null;
  };
  const isOnline = rec.__unifiedSourceType === "ONLINE";
  const fulfillmentType =
    rec.__unifiedFulfillmentType ??
    rec.__unifiedFulfillmentDetails?.type ??
    rec.fulfillmentDetails?.type ??
    (typeof rec.fulfillment === "string"
      ? rec.fulfillment
      : rec.fulfillment?.type) ??
    "";
  const isDelivery = fulfillmentType.toUpperCase() === "DELIVERY";
  switch (status) {
    case "NEW":
    case "RECEIVED":
      return { status: "CONFIRMED", label: "Confirmar" };
    case "CONFIRMED":
    case "PENDING":
      return { status: "PREPARING", label: "Iniciar preparo" };
    case "PREPARING":
    case "IN_PROGRESS":
      return { status: "READY", label: "Marcar pronto" };
    case "READY":
    case "DONE":
      if (isOnline && isDelivery)
        return { status: "OUT_FOR_DELIVERY", label: "Saiu para entrega" };
      return { status: "COMPLETED", label: "Marcar entregue" };
    case "OUT_FOR_DELIVERY":
      return { status: "COMPLETED", label: "Marcar entregue" };
    default:
      return undefined;
  }
}

export function orderTime(o: Order): string {
  const iso = o.createdAt ?? o.updatedAt;
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function elapsedMinutes(o: Order): number {
  const iso = o.createdAt;
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / 60000);
}

export function elapsed(o: Order): string {
  const mins = elapsedMinutes(o);
  if (!o.createdAt) return "";
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

export function isOrderLate(o: Order, lateMinutes: number): boolean {
  const status = (o.status ?? "").toUpperCase();
  if (status === "DELIVERED" || status === "CANCELLED" || status === "COMPLETED")
    return false;
  return elapsedMinutes(o) > lateMinutes;
}

export function elapsedTone(
  mins: number,
  lateMinutes: number,
): "ok" | "warn" | "danger" {
  if (mins > lateMinutes) return "danger";
  if (mins >= Math.max(1, lateMinutes - 5)) return "warn";
  return "ok";
}

export function deliveredAgeMinutes(o: Order): number {
  const iso = o.updatedAt ?? o.createdAt;
  if (!iso) return 0;
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.floor(diff / 60000);
}

export function isDeliveredHidden(o: Order, ops: OperationsConfig): boolean {
  if (!ops.autoHideDeliveredOrders) return false;
  const status = (o.status ?? "").toUpperCase();
  if (status !== "DELIVERED") return false;
  return deliveredAgeMinutes(o) > ops.autoHideDeliveredAfterMinutes;
}

export function itemSectors(o: Order): Set<string> {
  const set = new Set<string>();
  for (const it of o.items ?? []) {
    const rec = it as Record<string, unknown>;
    const candidates: unknown[] = [
      rec.sector,
      (rec.category as Record<string, unknown> | undefined)?.sector,
      (rec.catalogCategory as Record<string, unknown> | undefined)?.sector,
      (
        (rec.catalogProduct as Record<string, unknown> | undefined)
          ?.catalogCategory as Record<string, unknown> | undefined
      )?.sector,
      (
        (rec.catalogProduct as Record<string, unknown> | undefined)
          ?.category as Record<string, unknown> | undefined
      )?.sector,
      (
        (rec.product as Record<string, unknown> | undefined)
          ?.catalogCategory as Record<string, unknown> | undefined
      )?.sector,
      (
        (rec.product as Record<string, unknown> | undefined)?.category as
          | Record<string, unknown>
          | undefined
      )?.sector,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c) {
        const normalized = c.toUpperCase();
        if (normalized.includes("BAR")) set.add("BAR");
        else if (normalized.includes("COZINHA") || normalized.includes("KITCHEN"))
          set.add("KITCHEN");
        else set.add(normalized);
      }
    }
  }
  return set;
}

export function matchesSector(o: Order, filter: SectorFilter): boolean {
  if (filter === "ALL") return true;
  const sectors = itemSectors(o);
  return sectors.has(filter);
}

export function customerOf(o: Order): string {
  if (typeof o.customer === "string") return o.customer;
  if (o.customer && typeof o.customer === "object" && o.customer.name)
    return o.customer.name;
  return o.customerName ?? "Cliente";
}

export function orderLabel(o: Order): string {
  const extra = o as unknown as Record<string, unknown>;
  const n =
    o.number ??
    o.orderNumber ??
    o.code ??
    (extra.publicCode as string | number | undefined) ??
    (extra.public_code as string | number | undefined) ??
    (extra.displayNumber as string | number | undefined) ??
    (extra.display_number as string | number | undefined) ??
    (extra.shortId as string | undefined) ??
    (extra.short_id as string | undefined);
  if (n !== undefined && n !== null && n !== "") return `#${n}`;
  return `#${o.id.slice(-6).toUpperCase()}`;
}

export function orderShortId(o: Order): string {
  return o.id ? o.id.slice(0, 8).toUpperCase() : "—";
}
