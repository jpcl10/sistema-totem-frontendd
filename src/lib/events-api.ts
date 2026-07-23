import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export interface EventItem {
  id: string;
  name: string;
  slug: string;
  status?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  bannerUrl?: string;
  startsAt?: string;
  endsAt?: string;
  totemWelcomeMessage?: string;
  totemBackgroundColor?: string;
  totemTextColor?: string;
  totemShowPrices?: boolean;
  totemShowLowStock?: boolean;
  totemRequireCustomerName?: boolean;
  totemAutoResetSeconds?: number;
  totemShowLogo?: boolean;
  totemFullscreenRecommended?: boolean;
  pixPaymentExpirationMinutes?: number;
  pixEnabled?: boolean;
  pixKey?: string;
  pixReceiverName?: string;
  pixInstructions?: string;
  [k: string]: unknown;
}

export interface CreateEventInput {
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor: string;
  startsAt: string;
  endsAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  eventId: string;
  description?: string;
  order?: number;
  [k: string]: unknown;
}

export interface ProductItem {
  id: string;
  name: string;
  slug?: string;
  price?: number;
  priceInCents?: number;
  imageUrl?: string;
  description?: string;
  status?: string;
  categoryId: string;
  eventId?: string;
  stock?: number;
  [k: string]: unknown;
}

export interface TotemReadiness {
  ready: boolean;
  checks: Record<string, boolean>;
  blockers: { code: string; message: string }[];
  warnings: { code: string; message: string }[];
  mercadoPago?: {
    configured: boolean;
    pixEnabled: boolean;
    environment: string;
    accountReference: string | null;
    updatedAt: string | null;
    webhookReady: boolean;
    credentialReadable: boolean;
  };
  printing?: {
    printMode: string;
    paperSize: string;
    defaultPrinterDeviceId: string | null;
    kitchenPrinterDeviceId: string | null;
    barPrinterDeviceId: string | null;
    sources?: Record<string, unknown>;
    sectors?: Record<string, unknown>;
  };
  devices?: Array<{
    id: string;
    name: string;
    codePreview: string;
    type: string;
    status: string;
    authStatus: string;
    online: boolean;
    lastHeartbeatAt: string | null;
  }>;
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

export async function listEvents(token: string): Promise<EventItem[]> {
  const res = await apiFetch(`${API_BASE_URL}/events`, { headers: authHeaders(token) });
  const data = await handle<unknown>(res);
  return unwrap<EventItem>(data, "events");
}

export async function getTotemReadiness(token: string, eventId: string): Promise<TotemReadiness> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/totem-readiness`, {
    headers: authHeaders(token),
  });
  return handle<TotemReadiness>(res);
}

export async function getEvent(token: string, id: string): Promise<EventItem> {
  const res = await apiFetch(`${API_BASE_URL}/events/${id}`, { headers: authHeaders(token) });
  const data = await handle<EventItem | { event: EventItem }>(res);
  return "event" in (data as object) ? (data as { event: EventItem }).event : (data as EventItem);
}

export async function updateEvent(
  token: string,
  id: string,
  patch: Partial<EventItem>,
): Promise<EventItem> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(patch),
  });
  const data = await handle<EventItem | { event: EventItem }>(res);
  return "event" in (data as object) ? (data as { event: EventItem }).event : (data as EventItem);
}

export async function createEvent(token: string, input: CreateEventInput): Promise<EventItem> {
  const res = await apiFetch(`${API_BASE_URL}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<EventItem | { event: EventItem }>(res);
  return "event" in (data as object) ? (data as { event: EventItem }).event : (data as EventItem);
}

export async function listCategories(token: string, eventId: string): Promise<CategoryItem[]> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/categories`, {
    headers: authHeaders(token),
  });
  const data = await handle<unknown>(res);
  return unwrap<CategoryItem>(data, "categories");
}

export async function createCategory(
  token: string,
  input: { name: string; eventId: string; slug: string; description?: string },
): Promise<CategoryItem> {
  const { eventId, name, slug, description } = input;
  const body: Record<string, unknown> = { name, slug };
  if (description) body.description = description;
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  const data = await handle<CategoryItem | { category: CategoryItem }>(res);
  return "category" in (data as object)
    ? (data as { category: CategoryItem }).category
    : (data as CategoryItem);
}

export async function listProducts(token: string, eventId: string): Promise<ProductItem[]> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/products`, {
    headers: authHeaders(token),
  });
  const data = await handle<unknown>(res);
  return unwrap<ProductItem>(data, "products");
}

export async function createProduct(
  token: string,
  input: {
    eventId: string;
    name: string;
    slug: string;
    priceInCents: number;
    categoryId: string;
    description?: string;
  },
): Promise<ProductItem> {
  const { eventId, ...payload } = input;
  const url = `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/products`;
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(payload),
  });
  const data = await handle<ProductItem | { product: ProductItem }>(res);
  return "product" in (data as object)
    ? (data as { product: ProductItem }).product
    : (data as ProductItem);
}

export interface UploadImageResponse {
  imageUrl: string;
  key?: string;
}

/**
 * Centralized image upload to Cloudflare R2 via POST /uploads/images.
 * Returns the public URL to use as logoUrl / bannerUrl / imageUrl.
 */
export async function uploadImage(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  // Do NOT set Content-Type manually — the browser will add the multipart boundary.
  const res = await apiFetch(`${API_BASE_URL}/uploads/images`, {
    method: "POST",
    headers: authHeaders(token),
    body: fd,
  });
  const data = await handle<UploadImageResponse>(res);
  if (!data?.imageUrl) {
    throw new Error("Resposta de upload inválida: imageUrl ausente");
  }
  return data.imageUrl;
}


export interface FinancialSummaryPeriod {
  type?: string;
  timezone?: string;
  startDate?: string;
  endDate?: string;
  revenueDateField?: string;
  operationalDateField?: string;
}

export type FinancialTimeseriesGranularity = "HOUR" | "DAY" | "MONTH";

export interface FinancialTimeseriesPoint {
  periodStart: string;
  label?: string;
  grossRevenueInCents: number;
  paidOrdersCount: number;
  averageTicketInCents: number;
}

export interface FinancialTimeseries {
  granularity: FinancialTimeseriesGranularity;
  timezone: string;
  dateField: "paidAt" | string;
  points: FinancialTimeseriesPoint[];
}

export interface FinancialSummary {
  summary: {
    period?: FinancialSummaryPeriod;
    event?: { id: string; name: string; slug: string } | null;
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    notRequiredOrders: number;
    failedOrders: number;
    cancelledOrders: number;
    refundedOrders: number;
    grossTotalInCents: number;
    netTotalInCents?: number;
    /** New official aliases from backend V2. Prefer these when present. */
    grossRevenueInCents?: number;
    netRevenueInCents?: number;
    deliveryFeesInCents?: number;
    discountsInCents?: number;
    refundsInCents?: number;
    paidOrdersCount?: number;
    pendingOrdersCount?: number;
    canceledOrdersCount?: number;
    refundedOrdersCount?: number;
    byFulfillmentType?: Record<string, number>;
    limitations?: string[] | Record<string, unknown>;
    paidTotalInCents: number;
    pendingTotalInCents: number;
    notRequiredTotalInCents: number;
    cancelledTotalInCents: number;
    averageTicketInCents: number;

    byPaymentMethod: Record<string, number> & {
      PIX_MANUAL?: number;
      PIX_AUTOMATIC?: number;
      NFC_BALANCE?: number;
      CASH?: number;
      CREDIT_CARD?: number;
      DEBIT_CARD?: number;
      COURTESY?: number;
      OTHER?: number;
    };
    ordersCountByPaymentMethod?: Record<string, number>;
    bySource?: Record<string, number>;
    byOrderType?: Record<string, number>;
    ordersCountBySource?: Record<string, number>;
    ordersCountByOrderType?: Record<string, number>;
    timeseries?: FinancialTimeseries;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export async function getFinancialSummary(token: string, eventId: string, params?: Record<string, string>): Promise<FinancialSummary> {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/financial-summary${query}`,
    { headers: authHeaders(token) },
  );
  return handle<FinancialSummary>(res);
}

/**
 * Global financial aggregation — GET /financial-summary
 * Official aggregation from backend. Accepts filters: period, startDate,
 * endDate, storeId, eventId, source, orderType, paymentMethod,
 * paymentStatus, fulfillmentType. Do NOT compute revenue client-side.
 */
export async function getGlobalFinancialSummary(
  token: string,
  params?: Record<string, string | undefined>,
): Promise<FinancialSummary> {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === "") continue;
      qs.set(k, String(v));
    }
  }
  const url = `${API_BASE_URL}/financial-summary${qs.toString() ? `?${qs}` : ""}`;
  const res = await apiFetch(url, { headers: authHeaders(token) });
  return handle<FinancialSummary>(res);
}

export interface EventMetrics {
  totalOrders?: number;
  ordersCount?: number;
  totalRevenueInCents?: number;
  totalRevenue?: number;
  averageTicketInCents?: number;
  averageTicket?: number;
  ordersByStatus?: Record<string, number>;
  statusCounts?: Record<string, number>;
  salesBySector?: { BAR?: number; KITCHEN?: number; bar?: number; kitchen?: number };
  sectorSales?: { BAR?: number; KITCHEN?: number; bar?: number; kitchen?: number };
  topProducts?: Array<{
    productId?: string;
    name?: string;
    productName?: string;
    quantity?: number;
    qty?: number;
    totalInCents?: number;
    total?: number;
  }>;
  [k: string]: unknown;
}

export async function getEventMetrics(token: string, eventId: string, params?: Record<string, string>): Promise<EventMetrics> {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/metrics${query}`,
    { headers: authHeaders(token) },
  );
  const data = await handle<EventMetrics | { metrics: EventMetrics }>(res);
  return "metrics" in (data as object)
    ? (data as { metrics: EventMetrics }).metrics
    : (data as EventMetrics);
}

export interface ClosingPreview {
  event: {
    id: string;
    name: string;
    closed: boolean;
    closedAt?: string;
  };
  summary: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    paidTotalInCents: number;
    pendingTotalInCents: number;
    cancelledTotalInCents: number;
    averageTicketInCents: number;
  };
  byPaymentMethod: Record<string, number>;
  printSummary: {
    PENDING: number;
    PRINTED: number;
    ERROR: number;
    CANCELLED: number;
  };
  warnings: Array<{
    type: "PENDING_ORDERS" | "PRINT_ERRORS" | string;
    message: string;
  }>;
}

export async function getClosingPreview(token: string, eventId: string): Promise<ClosingPreview> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/closing-preview`, {
    headers: authHeaders(token),
  });
  return handle<ClosingPreview>(res);
}

export interface ClosingData {
  event: {
    id: string;
    name: string;
    closed: boolean;
    closedAt?: string;
  };
  closing?: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    cancelledOrders: number;
    receivedInCents: number;
    pendingInCents: number;
    cancelledInCents: number;
    averageTicketInCents: number;
    pixManualInCents: number;
    pixAutomaticInCents: number;
    cashInCents: number;
    creditCardInCents: number;
    debitCardInCents: number;
    courtesyInCents: number;
    otherInCents: number;
    printPendingCount: number;
    printPrintedCount: number;
    printErrorCount: number;
    printCancelledCount: number;
  };
  closedBy?: {
    name: string;
    email: string;
    role: string;
  };
  notes?: string;
}

export async function getClosingData(token: string, eventId: string): Promise<ClosingData> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/closing`, {
    headers: authHeaders(token),
  });
  return handle<ClosingData>(res);
}

export async function closeEvent(
  token: string,
  eventId: string,
  data: { notes?: string | null; allowPendingOrders: boolean; allowPrintErrors: boolean }
): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(data),
  });
  return handle<any>(res);
}

export async function reopenEvent(token: string, eventId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/reopen`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({}),
  });
  return handle<any>(res);
}

export async function archiveEvent(token: string, eventId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/archive`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({}),
  });
  return handle<any>(res);
}

export async function restoreEvent(token: string, eventId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/restore`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({}),
  });
  return handle<any>(res);
}

export async function deleteEvent(token: string, eventId: string): Promise<any> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handle<any>(res);
}
