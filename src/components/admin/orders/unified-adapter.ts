/**
 * Adapter: UnifiedOrderDTO -> Kanban Order model.
 *
 * The Central Operacional consumes `GET /orders/unified` (read-only).
 * Mutations are NOT unified — this module keeps dispatch by
 * `sourceType`:
 * - EVENT  -> updateOrderStatus / cancelOrder (orders-api)
 * - ONLINE -> updateOnlineOrderStatus (online-orders-api)
 *
 * Field mapping follows the real DTO shape:
 *   dto.totals.totalInCents / subtotalInCents / deliveryFeeInCents
 *   dto.storeName / dto.eventName (top-level, NOT dto.context)
 *   dto.customer.{ name, phone, email }
 *   dto.channel  (DIGITAL_MENU, TOTEM, POS, WHATSAPP, API, ADMIN)
 *   dto.origin   (EVENT | ONLINE) — kept as sourceType marker
 *   dto.status   (NEW | CONFIRMED | PREPARING | READY |
 *                 OUT_FOR_DELIVERY | COMPLETED | CANCELLED)
 */
import type { Order, OrderStatus } from "@/lib/orders-api";
import {
  updateOrderStatus,
  cancelOrder as cancelEventOrder,
} from "@/lib/orders-api";
import {
  updateOnlineOrderStatus,
  type OnlineOrderStatus,
} from "@/lib/online-orders-api";
import type {
  UnifiedOrderDTO,
  UnifiedOrderFulfillmentDetails,
  UnifiedOrderType,
  UnifiedOrderActionEndpoints,
} from "@/lib/orders-api";

export interface UnifiedContext {
  eventId?: string;
  eventName?: string;
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
}

/** Marker fields kept on the adapted Order so handlers can route mutations. */
export interface AdaptedOrderMeta {
  __unifiedSourceType?: "EVENT" | "ONLINE" | string;
  __unifiedOrigin?: string;
  __unifiedContext?: UnifiedContext;
  __unifiedFulfillmentType?: string;
  __unifiedFulfillmentDetails?: UnifiedOrderFulfillmentDetails | null;
  /** Native id on the underlying table — required for unified payment routing. */
  __unifiedNativeId?: string;
  /** Domain of the underlying record. Never inferred from origin/channel. */
  __unifiedOrderType?: UnifiedOrderType;
  /** Backend-provided action URLs. Prefer over building paths client-side. */
  __unifiedActionEndpoints?: UnifiedOrderActionEndpoints;
}

export type AdaptedOrder = Order & AdaptedOrderMeta;


function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function pickString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

function pickNumber(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return undefined;
}

/**
 * Resolve total in cents from the DTO with a robust fallback chain.
 * Priority: totals.totalInCents > totals.subtotal + deliveryFee >
 *           totalInCents at root > sum of items.
 */
function resolveTotalCents(dto: UnifiedOrderDTO): number | undefined {
  const rec = asRecord(dto);
  const totals = asRecord(rec.totals);
  const total = pickNumber(
    totals.totalInCents,
    totals.total_in_cents,
    totals.total,
    rec.totalInCents,
    rec.total_in_cents,
  );
  if (typeof total === "number") return total;
  const subtotal = pickNumber(totals.subtotalInCents, totals.subtotal_in_cents);
  const delivery = pickNumber(
    totals.deliveryFeeInCents,
    totals.delivery_fee_in_cents,
  );
  if (typeof subtotal === "number") return subtotal + (delivery ?? 0);
  const items = Array.isArray(rec.items) ? (rec.items as unknown[]) : [];
  if (items.length) {
    let sum = 0;
    for (const raw of items) {
      const it = asRecord(raw);
      const qty = pickNumber(it.quantity, it.qty) ?? 1;
      const line = pickNumber(it.totalInCents, it.total_in_cents);
      if (typeof line === "number") {
        sum += line;
        continue;
      }
      const unit = pickNumber(
        it.priceInCents,
        it.price_in_cents,
        it.unitPriceInCents,
      );
      if (typeof unit === "number") sum += unit * qty;
    }
    if (sum > 0) return sum;
  }
  return undefined;
}

function resolveContext(dto: UnifiedOrderDTO): UnifiedContext {
  const rec = asRecord(dto);
  const nested = asRecord(rec.context);
  return {
    eventId: pickString(rec.eventId, nested.eventId),
    eventName: pickString(rec.eventName, nested.eventName),
    storeId: pickString(rec.storeId, nested.storeId),
    storeSlug: pickString(rec.storeSlug, nested.storeSlug),
    storeName: pickString(rec.storeName, nested.storeName),
  };
}

/** Convert a UnifiedOrderDTO into the Kanban's Order shape. */
export function unifiedToKanbanOrder(dto: UnifiedOrderDTO): AdaptedOrder {
  const rec = asRecord(dto);
  const customerRec = asRecord(rec.customer);
  const customerName = pickString(customerRec.name, rec.customerName);
  const customerPhone = pickString(customerRec.phone, rec.customerPhone);
  const customerEmail = pickString(customerRec.email, rec.customerEmail);

  const items = Array.isArray(rec.items)
    ? (rec.items as unknown[]).map((raw) => {
        const it = asRecord(raw);
        const name = pickString(it.name, it.productName, it.product_name);
        return {
          ...it,
          id: typeof it.id === "string" ? it.id : undefined,
          productId: pickString(it.productId, it.product_id),
          name,
          productName: name,
          quantity: pickNumber(it.quantity, it.qty) ?? 1,
          qty: pickNumber(it.qty, it.quantity) ?? 1,
          priceInCents: pickNumber(
            it.priceInCents,
            it.price_in_cents,
            it.unitPriceInCents,
          ),
          totalInCents: pickNumber(it.totalInCents, it.total_in_cents),
        };
      })
    : undefined;

  const context = resolveContext(dto);
  const totalCents = resolveTotalCents(dto);
  const payment = asRecord(rec.payment);
  const fulfillment = asRecord(rec.fulfillment);

  // Prefer the structured contract from `fulfillmentDetails` (Fase 2A).
  // Fall back to the legacy `fulfillment` shape only when the newer object is absent.
  const rawDetails = rec.fulfillmentDetails as
    | UnifiedOrderFulfillmentDetails
    | null
    | undefined;
  let fulfillmentDetails: UnifiedOrderFulfillmentDetails | null = null;
  if (rawDetails && typeof rawDetails === "object") {
    fulfillmentDetails = rawDetails;
  } else if (fulfillment && (fulfillment.type || fulfillment.address)) {
    const legacyAddr = fulfillment.address;
    const addr =
      legacyAddr && typeof legacyAddr === "object"
        ? (legacyAddr as Record<string, unknown>)
        : null;
    fulfillmentDetails = {
      type: pickString(fulfillment.type) ?? "",
      address: addr
        ? {
            address:
              pickString(addr.address, addr.street) ?? "",
            number: pickString(addr.number) ?? "",
            neighborhood: pickString(addr.neighborhood) ?? "",
            complement:
              typeof addr.complement === "string" ? (addr.complement as string) : null,
            reference:
              typeof addr.reference === "string" ? (addr.reference as string) : null,
          }
        : null,
      deliveryFeeInCents:
        pickNumber(fulfillment.deliveryFeeInCents) ?? null,
      estimatedMinutes:
        pickNumber(fulfillment.estimatedMinutes) ?? null,
      deliveryRuleId:
        typeof fulfillment.deliveryRuleId === "string"
          ? (fulfillment.deliveryRuleId as string)
          : null,
    };
  }
  const fulfillmentType = fulfillmentDetails?.type
    ? String(fulfillmentDetails.type)
    : pickString(fulfillment.type);

  const status = String(rec.status ?? "").toUpperCase();
  const paymentStatus =
    pickString(payment.status) ??
    (typeof payment.paidAt === "string" && payment.paidAt ? "PAID" : undefined);

  // Origin marker: prefer `channel` (DIGITAL_MENU, TOTEM, POS, ...).
  // Fall back to `origin` when channel is absent so we still render a badge.
  const origin =
    pickString(rec.channel) ??
    pickString(rec.origin) ??
    (rec.storeId ? "DIGITAL_MENU" : "");
  const sourceType = pickString(rec.sourceType, rec.origin) ?? "EVENT";

  const adapted: AdaptedOrder = {
    // Raw fields first so mapped fields below always win.
    ...(rec as Record<string, unknown>),
    id: String(rec.id ?? ""),
    number: (rec.number as string | number | undefined) ?? undefined,
    orderNumber: (rec.number as string | number | undefined) ?? undefined,
    code: pickString(rec.code),
    status: status as OrderStatus,
    customerName,
    customer: customerName
      ? ({
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
        } as unknown as Order["customer"])
      : undefined,
    customerPhone,
    customerEmail,
    totalInCents: totalCents,
    items: items as Order["items"],
    createdAt: pickString(rec.createdAt),
    updatedAt: pickString(rec.updatedAt),
    eventId: context.eventId,
    storeId: context.storeId,
    storeName: context.storeName,
    eventName: context.eventName,
    paymentMethod: pickString(payment.method),
    paymentStatus,
    amountPaidInCents: pickNumber(payment.amountPaidInCents),
    changeForInCents:
      typeof payment.changeForInCents === "number"
        ? (payment.changeForInCents as number)
        : null,
    paidAt:
      typeof payment.paidAt === "string" ? (payment.paidAt as string) : null,
    paymentNotes:
      typeof payment.notes === "string" ? (payment.notes as string) : null,
    __unifiedSourceType: sourceType,
    __unifiedOrigin: origin,
    __unifiedContext: context,
    __unifiedFulfillmentType: fulfillmentType,
    __unifiedFulfillmentDetails: fulfillmentDetails,
    __unifiedNativeId:
      pickString(rec.nativeId, (rec as Record<string, unknown>).native_id) ??
      undefined,
    __unifiedOrderType:
      pickString(rec.orderType, (rec as Record<string, unknown>).order_type) ??
      undefined,
    __unifiedActionEndpoints:
      rec.actionEndpoints && typeof rec.actionEndpoints === "object"
        ? (rec.actionEndpoints as UnifiedOrderActionEndpoints)
        : undefined,
  };


  return adapted;
}

/** Map Kanban's target status to the OnlineOrder vocabulary. */
function kanbanToOnlineStatus(s: OrderStatus): OnlineOrderStatus {
  const up = String(s).toUpperCase();
  switch (up) {
    case "CONFIRMED":
      return "CONFIRMED";
    case "PREPARING":
      return "PREPARING";
    case "OUT_FOR_DELIVERY":
      return "OUT_FOR_DELIVERY";
    // Unified vocabulary uses COMPLETED; OnlineOrder uses DELIVERED.
    case "COMPLETED":
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
      return "CANCELLED";
    case "READY":
      return "READY";
    default:
      return "CONFIRMED";
  }
}

function mergeOnlineMutationResult(
  updated: unknown,
  order: AdaptedOrder,
  status: OrderStatus,
): UnifiedOrderDTO {
  const updatedRec = asRecord(updated);
  const previousRec = order as unknown as Record<string, unknown>;
  const updatedContext =
    updatedRec.context && typeof updatedRec.context === "object"
      ? (updatedRec.context as UnifiedOrderDTO["context"])
      : undefined;
  const updatedDetails =
    updatedRec.fulfillmentDetails &&
    typeof updatedRec.fulfillmentDetails === "object"
      ? (updatedRec.fulfillmentDetails as UnifiedOrderFulfillmentDetails)
      : undefined;
  const previousDetails =
    previousRec.fulfillmentDetails &&
    typeof previousRec.fulfillmentDetails === "object"
      ? (previousRec.fulfillmentDetails as UnifiedOrderFulfillmentDetails)
      : undefined;
  const updatedFulfillment =
    updatedRec.fulfillment && typeof updatedRec.fulfillment === "object"
      ? (updatedRec.fulfillment as UnifiedOrderDTO["fulfillment"])
      : undefined;
  const previousFulfillment =
    previousRec.fulfillment && typeof previousRec.fulfillment === "object"
      ? (previousRec.fulfillment as UnifiedOrderDTO["fulfillment"])
      : undefined;
  const updatedActionEndpoints =
    updatedRec.actionEndpoints && typeof updatedRec.actionEndpoints === "object"
      ? (updatedRec.actionEndpoints as UnifiedOrderActionEndpoints)
      : undefined;

  return {
    ...(previousRec as unknown as UnifiedOrderDTO),
    ...(updatedRec as unknown as UnifiedOrderDTO),
    id: order.id,
    sourceType: "ONLINE",
    origin: order.__unifiedOrigin ?? "ONLINE",
    status,
    context:
      updatedContext ??
      (order.__unifiedContext as UnifiedOrderDTO["context"] | undefined),
    fulfillmentDetails:
      updatedDetails ?? order.__unifiedFulfillmentDetails ?? previousDetails,
    fulfillment:
      updatedFulfillment ??
      previousFulfillment ??
      (order.__unifiedFulfillmentType
        ? { type: order.__unifiedFulfillmentType }
        : undefined),
    nativeId:
      typeof updatedRec.nativeId === "string"
        ? updatedRec.nativeId
        : order.__unifiedNativeId,
    orderType:
      typeof updatedRec.orderType === "string"
        ? updatedRec.orderType
        : order.__unifiedOrderType,
    actionEndpoints: updatedActionEndpoints ?? order.__unifiedActionEndpoints,
  };
}

/** Advance status via the endpoint that owns the source order. */
export async function advanceUnifiedOrder(
  token: string,
  order: AdaptedOrder,
  nextStatus: OrderStatus,
): Promise<Order> {
  if (order.__unifiedSourceType === "ONLINE") {
    const updated = await updateOnlineOrderStatus(
      token,
      order.id,
      kanbanToOnlineStatus(nextStatus),
    );
    return unifiedToKanbanOrder(
      mergeOnlineMutationResult(updated, order, nextStatus),
    );
  }
  return updateOrderStatus(token, order.id, nextStatus);
}

/**
 * Cancel via the endpoint that owns the source order. The online
 * status endpoint does not accept a reason field — we still keep it
 * on the local toast/UI, but only the CANCELLED status is sent.
 */
export async function cancelUnifiedOrder(
  token: string,
  order: AdaptedOrder,
  reason: string,
): Promise<Order> {
  if (order.__unifiedSourceType === "ONLINE") {
    const updated = await updateOnlineOrderStatus(token, order.id, "CANCELLED");
    return unifiedToKanbanOrder(
      mergeOnlineMutationResult(updated, order, "CANCELLED"),
    );
  }
  return cancelEventOrder(token, order.id, reason);
}
