import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type OrderStatus = "PENDING" | "PREPARING" | "READY" | "DELIVERED" | string;

export interface OrderItem {
  id?: string;
  productId?: string;
  name?: string;
  productName?: string;
  quantity?: number;
  qty?: number;
  priceInCents?: number;
  price?: number;
  [k: string]: unknown;
}

export interface Order {
  id: string;
  number?: number | string;
  orderNumber?: number | string;
  code?: string;
  status: OrderStatus;
  customerName?: string;
  customer?: { name?: string } | string;
  totalInCents?: number;
  total?: number;
  items?: OrderItem[];
  createdAt?: string;
  updatedAt?: string;
  eventId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  amountPaidInCents?: number;
  changeForInCents?: number | null;
  paidAt?: string | null;
  paymentNotes?: string | null;
  [k: string]: unknown;
}

function normalizeOrderItem(raw: unknown): OrderItem {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...obj,
    id: typeof obj.id === "string" ? obj.id : undefined,
    productId:
      typeof obj.productId === "string"
        ? obj.productId
        : typeof obj.product_id === "string"
          ? (obj.product_id as string)
          : undefined,
    name:
      typeof obj.name === "string"
        ? obj.name
        : typeof obj.productName === "string"
          ? (obj.productName as string)
          : typeof obj.product_name === "string"
            ? (obj.product_name as string)
            : undefined,
    productName:
      typeof obj.productName === "string"
        ? obj.productName
        : typeof obj.product_name === "string"
          ? (obj.product_name as string)
          : typeof obj.name === "string"
            ? obj.name
            : undefined,
    quantity:
      typeof obj.quantity === "number"
        ? obj.quantity
        : typeof obj.qty === "number"
          ? (obj.qty as number)
          : undefined,
    qty:
      typeof obj.qty === "number"
        ? obj.qty
        : typeof obj.quantity === "number"
          ? obj.quantity
          : undefined,
    priceInCents:
      typeof obj.priceInCents === "number"
        ? obj.priceInCents
        : typeof obj.unitPriceInCents === "number"
          ? (obj.unitPriceInCents as number)
          : typeof obj.price_in_cents === "number"
            ? (obj.price_in_cents as number)
            : undefined,
    price:
      typeof obj.price === "number"
        ? obj.price
        : typeof obj.unit_price === "number"
          ? (obj.unit_price as number)
          : undefined,
  };
}

export function normalizeOrder(raw: unknown): Order {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...obj,
    id: String(obj.id ?? ""),
    number:
      typeof obj.number === "number" || typeof obj.number === "string"
        ? (obj.number as number | string)
        : typeof obj.orderNumber === "number" || typeof obj.orderNumber === "string"
          ? (obj.orderNumber as number | string)
          : typeof obj.order_number === "number" || typeof obj.order_number === "string"
            ? (obj.order_number as number | string)
            : undefined,
    orderNumber:
      typeof obj.orderNumber === "number" || typeof obj.orderNumber === "string"
        ? (obj.orderNumber as number | string)
        : typeof obj.order_number === "number" || typeof obj.order_number === "string"
          ? (obj.order_number as number | string)
          : typeof obj.number === "number" || typeof obj.number === "string"
            ? (obj.number as number | string)
            : undefined,
    code: typeof obj.code === "string" ? obj.code : undefined,
    status:
      typeof obj.status === "string"
        ? obj.status
        : typeof obj.order_status === "string"
          ? (obj.order_status as string)
          : "PENDING",
    customerName:
      typeof obj.customerName === "string"
        ? obj.customerName
        : typeof obj.customer_name === "string"
          ? (obj.customer_name as string)
          : undefined,
    totalInCents:
      typeof obj.totalInCents === "number"
        ? obj.totalInCents
        : typeof obj.total_in_cents === "number"
          ? (obj.total_in_cents as number)
          : undefined,
    total:
      typeof obj.total === "number"
        ? obj.total
        : typeof obj.total_amount === "number"
          ? (obj.total_amount as number)
          : undefined,
    createdAt:
      typeof obj.createdAt === "string"
        ? obj.createdAt
        : typeof obj.created_at === "string"
          ? (obj.created_at as string)
          : undefined,
    updatedAt:
      typeof obj.updatedAt === "string"
        ? obj.updatedAt
        : typeof obj.updated_at === "string"
          ? (obj.updated_at as string)
          : undefined,
    eventId:
      typeof obj.eventId === "string"
        ? obj.eventId
        : typeof obj.event_id === "string"
          ? (obj.event_id as string)
          : undefined,
    paymentMethod:
      typeof obj.paymentMethod === "string"
        ? obj.paymentMethod
        : typeof obj.payment_method === "string"
          ? (obj.payment_method as string)
          : undefined,
    paymentStatus:
      typeof obj.paymentStatus === "string"
        ? obj.paymentStatus
        : typeof obj.payment_status === "string"
          ? (obj.payment_status as string)
          : undefined,
    items: Array.isArray(obj.items) ? obj.items.map(normalizeOrderItem) : undefined,
  };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

function unwrap<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export async function listOrdersByEvent(token: string, eventId: string): Promise<Order[]> {
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/orders`,
    { headers: authHeaders(token) },
  );
  const data = await handle<unknown>(res);
  return unwrap<unknown>(data, "orders").map(normalizeOrder);
}

export async function updateOrderStatus(
  token: string,
  id: string,
  status: OrderStatus,
  extra?: Record<string, unknown>,
): Promise<Order> {
  const res = await apiFetch(`${API_BASE_URL}/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ status, ...(extra ?? {}) }),
  });
  const data = await handle<Order | { order: Order }>(res);
  return normalizeOrder("order" in (data as object) ? (data as { order: Order }).order : (data as Order));
}

export async function cancelOrder(
  token: string,
  id: string,
  reason: string,
): Promise<Order> {
  return updateOrderStatus(token, id, "CANCELLED", {
    cancellationReason: reason,
    reason,
    restoreStock: true,
  });
}

export async function updateOrderPaymentStatus(
  token: string,
  id: string,
  paymentStatus: string,
): Promise<Order> {
  const url = `${API_BASE_URL}/orders/${encodeURIComponent(id)}/payment-status`;
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ paymentStatus }),
  });
  const data = await handle<Order | { order: Order }>(res);
  return normalizeOrder("order" in (data as object) ? (data as { order: Order }).order : (data as Order));
}

export interface OrderPaymentInput {
  paymentStatus: string;
  paymentMethod: string;
  amountPaidInCents: number;
  changeForInCents: number | null;
  paymentNotes: string | null;
}

export async function submitOrderPayment(
  token: string,
  orderId: string,
  input: OrderPaymentInput,
): Promise<Order> {
  const url = `${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/payment`;
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<Order | { order: Order }>(res);
  return normalizeOrder("order" in (data as object) ? (data as { order: Order }).order : (data as Order));
}

export type ManualSalePaymentMethod =
  | "PIX_MANUAL"
  | "CASH"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "COURTESY"
  | "NFC_BALANCE"
  | "OTHER";

export interface ManualSaleInput {
  customerName?: string;
  paymentMethod: ManualSalePaymentMethod;
  paymentStatus: "PAID" | "PENDING";
  items: { productId: string; quantity: number }[];
}

export async function createManualSale(
  token: string,
  eventId: string,
  input: ManualSaleInput,
): Promise<Order> {
  const url = `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/orders/manual-sale`;
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<Order | { order: Order }>(res);
  return normalizeOrder("order" in (data as object) ? (data as { order: Order }).order : (data as Order));
}

// =====================================================================
// Central Operacional Unificada — GET /orders/unified
// =====================================================================

export type UnifiedOrderSourceType = "EVENT" | "ONLINE" | string;
export type UnifiedOrderOrigin =
  | "DIGITAL_MENU"
  | "TOTEM"
  | "ADMIN"
  | "POS"
  | "WHATSAPP"
  | "API"
  | "EVENT"
  | "ONLINE"
  | string;

export type UnifiedNormalizedStatus =
  | "NEW"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "COMPLETED"
  | "CANCELLED"
  | string;

export interface UnifiedOrderCustomer {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  [k: string]: unknown;
}

export interface UnifiedOrderContext {
  eventId?: string;
  eventName?: string;
  storeId?: string;
  storeSlug?: string;
  storeName?: string;
  [k: string]: unknown;
}

export interface UnifiedOrderItemOption {
  name?: string;
  value?: string;
  priceInCents?: number;
  [k: string]: unknown;
}

export interface UnifiedOrderItem {
  id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  priceInCents?: number;
  totalInCents?: number;
  options?: UnifiedOrderItemOption[];
  notes?: string;
  [k: string]: unknown;
}

export interface UnifiedOrderPayment {
  method?: string;
  status?: string;
  amountPaidInCents?: number;
  changeForInCents?: number | null;
  paidAt?: string | null;
  notes?: string | null;
  [k: string]: unknown;
}

export interface UnifiedOrderFulfillment {
  type?: "DELIVERY" | "PICKUP" | "DINE_IN" | string;
  address?: string | Record<string, unknown>;
  scheduledAt?: string | null;
  [k: string]: unknown;
}

/**
 * Structured fulfillment details attached to a unified order.
 * Contract source: docs/api/settings-phase2-contracts.md (UnifiedOrderDTO).
 */
export interface UnifiedOrderFulfillmentDetailsAddress {
  address: string;
  number: string;
  neighborhood: string;
  complement: string | null;
  reference: string | null;
}

export interface UnifiedOrderFulfillmentDetails {
  type: "DELIVERY" | "PICKUP" | "DINE_IN" | "COUNTER" | string;
  address?: UnifiedOrderFulfillmentDetailsAddress | null;
  deliveryFeeInCents: number | null;
  estimatedMinutes: number | null;
  deliveryRuleId: string | null;
}


export interface UnifiedOrderPrinting {
  status?: string;
  lastPrintedAt?: string | null;
  [k: string]: unknown;
}

export type UnifiedOrderType = "EVENT_ORDER" | "ONLINE_ORDER" | string;

export interface UnifiedOrderActionEndpoints {
  payment?: string | null;
  [k: string]: string | null | undefined;
}

export interface UnifiedOrderDTO {
  id: string;
  /** Native primary key on the underlying table (Order.id or OnlineOrder.id). */
  nativeId?: string;
  /** Domain of the underlying record. Do NOT infer from origin/channel. */
  orderType?: UnifiedOrderType;
  sourceType: UnifiedOrderSourceType;
  origin: UnifiedOrderOrigin;
  status: UnifiedNormalizedStatus;
  rawStatus?: string;
  number?: string | number;
  code?: string;
  customer?: UnifiedOrderCustomer;
  context?: UnifiedOrderContext;
  items?: UnifiedOrderItem[];
  totalInCents?: number;
  payment?: UnifiedOrderPayment;
  fulfillment?: UnifiedOrderFulfillment;
  fulfillmentDetails?: UnifiedOrderFulfillmentDetails;
  printing?: UnifiedOrderPrinting;
  /** Ready-to-use URLs for domain actions. Prefer over building paths client-side. */
  actionEndpoints?: UnifiedOrderActionEndpoints;
  createdAt?: string;
  updatedAt?: string;
  organizationId?: string;
  [k: string]: unknown;
}

export interface UnifiedOrderFilters {
  origin?: UnifiedOrderOrigin | string;
  channel?: string;
  sourceType?: UnifiedOrderSourceType | "EVENT" | "ONLINE" | string;
  status?: UnifiedNormalizedStatus | string;
  eventId?: string;
  storeId?: string;
  customerId?: string;
  search?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  dateField?: "createdAt" | "paidAt";
  paymentMethod?: string;
  paymentStatus?: string;
  source?: string;
  orderType?: "EVENT_ORDER" | "ONLINE_ORDER" | string;
  fulfillmentType?: string;
  sortBy?: "createdAt" | "paidAt" | "totalInCents" | "orderNumber";
  sortOrder?: "asc" | "desc";
}


export interface UnifiedOrdersResponse {
  data: UnifiedOrderDTO[];
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  [k: string]: unknown;
}


function unwrapUnified(data: unknown): UnifiedOrderDTO[] {
  if (Array.isArray(data)) return data as UnifiedOrderDTO[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as UnifiedOrderDTO[];
    if (Array.isArray(obj.orders)) return obj.orders as UnifiedOrderDTO[];
    if (Array.isArray(obj.items)) return obj.items as UnifiedOrderDTO[];
  }
  return [];
}

export async function listUnifiedOrders(
  token: string,
  filters: UnifiedOrderFilters = {},
): Promise<UnifiedOrdersResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const url = `${API_BASE_URL}/orders/unified${qs.toString() ? `?${qs}` : ""}`;
  const res = await apiFetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw await fromResponse(res);
  const raw = (await res.json()) as unknown;
  const list = unwrapUnified(raw);
  const meta =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    data: list,
    page: typeof meta.page === "number" ? (meta.page as number) : undefined,
    limit: typeof meta.limit === "number" ? (meta.limit as number) : undefined,
    total: typeof meta.total === "number" ? (meta.total as number) : undefined,
    totalPages:
      typeof meta.totalPages === "number" ? (meta.totalPages as number) : undefined,
  };
}


// =====================================================================
// Unified payment — PATCH /orders/unified/:orderType/:orderId/payment
// =====================================================================

export interface UnifiedPaymentInput {
  /** Ready-to-use URL from `order.actionEndpoints.payment`. */
  endpoint?: string | null;
  /** Fallback routing when `endpoint` is missing. */
  orderType?: UnifiedOrderType;
  /** Fallback routing — MUST be the native id, not the composite `id`. */
  nativeId?: string;
  paymentStatus: "PAID" | string;
  paymentMethod: string;
  amountReceivedInCents?: number;
  changeInCents?: number | null;
}

function resolvePaymentUrl(input: UnifiedPaymentInput): string {
  if (input.endpoint && input.endpoint.trim()) {
    return input.endpoint.startsWith("http")
      ? input.endpoint
      : `${API_BASE_URL}${input.endpoint.startsWith("/") ? "" : "/"}${input.endpoint}`;
  }
  if (!input.orderType || !input.nativeId) {
    throw new Error(
      "markUnifiedOrderPayment: endpoint ausente e orderType/nativeId inválidos.",
    );
  }
  return `${API_BASE_URL}/orders/unified/${encodeURIComponent(
    input.orderType,
  )}/${encodeURIComponent(input.nativeId)}/payment`;
}

/**
 * PATCH /orders/unified/:orderType/:orderId/payment
 *
 * Prefer `order.actionEndpoints.payment` (backend-provided URL). Only fall
 * back to building the URL from `orderType + nativeId` when the endpoint
 * is missing. NEVER use `order.id` for the URL — for ONLINE_ORDER,
 * `id` may be a composite key different from the native OnlineOrder id.
 */
export async function markUnifiedOrderPayment(
  token: string,
  input: UnifiedPaymentInput,
): Promise<UnifiedOrderDTO> {
  const url = resolvePaymentUrl(input);
  const body: Record<string, unknown> = {
    paymentStatus: input.paymentStatus,
    paymentMethod: input.paymentMethod,
  };
  if (typeof input.amountReceivedInCents === "number") {
    body.amountReceivedInCents = input.amountReceivedInCents;
  }
  if (input.changeInCents !== undefined && input.changeInCents !== null) {
    body.changeInCents = input.changeInCents;
  }
  const res = await apiFetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await fromResponse(res);
  const raw = (await res.json()) as unknown;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (obj.order && typeof obj.order === "object") return obj.order as UnifiedOrderDTO;
    if (obj.data && typeof obj.data === "object") return obj.data as UnifiedOrderDTO;
  }
  return raw as UnifiedOrderDTO;
}
