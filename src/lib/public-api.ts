import { API_BASE_URL, API_HEADERS } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export interface PublicProduct {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price?: number;
  priceInCents?: number;
  categoryId: string;
  status?: string;
  active?: boolean;
  soldOut?: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  [k: string]: unknown;
}

export interface PublicCategory {
  id: string;
  name: string;
  description?: string;
  order?: number;
  products?: PublicProduct[];
  [k: string]: unknown;
}

export interface PublicEvent {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  totemWelcomeMessage?: string;
  totemBackgroundColor?: string;
  totemTextColor?: string;
  totemShowLogo?: boolean;
  pixEnabled?: boolean;
  pixKey?: string;
  pixReceiverName?: string;
  pixQrCode?: string;
  pixInstructions?: string;
  [k: string]: unknown;
}

export interface PublicMenu {
  event: PublicEvent;
  categories: PublicCategory[];
  products?: PublicProduct[];
  code?: string;
  message?: string;
  canonicalUrl?: string | null;
  canonicalPath?: string | null;
  organizationSlug?: string;
}

export interface LegacyPublicEventResolution {
  code?: string;
  message?: string;
  canonicalUrl?: string | null;
  canonicalPath?: string | null;
  organizationSlug?: string;
  eventSlug?: string;
}

export interface CheckoutPaymentSettings {
  context?: "TOTEM" | "PUBLIC_CHECKOUT";
  mercadoPago: {
    pixAutomaticAvailable: boolean;
    cardEnabled?: boolean;
    terminalEnabled?: boolean;
  };
  manualPix: {
    enabled: boolean;
    pixKey?: string;
    pixReceiverName?: string;
    pixQrCode?: string;
    pixInstructions?: string;
  };
  totem?: {
    allowedPaymentMethods: ("PIX" | "CARD")[];
    pixAvailable: boolean;
    cardAvailable: boolean;
    unavailablePixReason?: string | null;
  };
}

export interface PaymentProviderSetting {
  id: string;
  provider: "MERCADO_PAGO";
  enabled: boolean;
  pixEnabled: boolean;
  cardEnabled: boolean;
  terminalEnabled: boolean;
  publicKeyConfigured: boolean;
  accessTokenConfigured: boolean;
  [k: string]: unknown;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  provider: string;
  method: string;
  amountInCents: number;
  status: "PENDING" | "WAITING_PAYMENT" | "PAID" | "CANCELLED" | "ERROR";
  pixCopyPaste?: string;
  qrCode?: string;
  qrCodeBase64?: string;
  gatewayStatus?: string;
  expiresAt?: string;
  [k: string]: unknown;
}

export interface CheckoutPaymentResponse {
  paymentStep: "pix_automatic" | "pix_manual" | "pix_unavailable" | "operator" | "paid";
  order: PublicOrderResponse;
  manualPix?: {
    enabled: boolean;
    pixKey?: string;
    receiverName?: string;
    city?: string;
    instructions?: string;
  };
  paymentTransaction?: PaymentTransaction;
  message?: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

function encodeEventPath({
  organizationSlug,
  eventSlug,
}: {
  organizationSlug: string;
  eventSlug: string;
}) {
  return `/public/organizations/${encodeURIComponent(organizationSlug)}/events/${encodeURIComponent(eventSlug)}`;
}

function normalizePublicEvent(raw: unknown): PublicEvent {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    ...obj,
    id: String(obj.id ?? ""),
    name: String(obj.name ?? ""),
    slug: String(obj.slug ?? ""),
    logoUrl:
      typeof obj.logoUrl === "string"
        ? obj.logoUrl
        : typeof obj.logo_url === "string"
          ? (obj.logo_url as string)
          : undefined,
    bannerUrl:
      typeof obj.bannerUrl === "string"
        ? obj.bannerUrl
        : typeof obj.banner_url === "string"
          ? (obj.banner_url as string)
          : undefined,
    primaryColor:
      typeof obj.primaryColor === "string"
        ? obj.primaryColor
        : typeof obj.primary_color === "string"
          ? (obj.primary_color as string)
          : undefined,
    secondaryColor:
      typeof obj.secondaryColor === "string"
        ? obj.secondaryColor
        : typeof obj.secondary_color === "string"
          ? (obj.secondary_color as string)
          : undefined,
    totemWelcomeMessage:
      typeof obj.totemWelcomeMessage === "string"
        ? obj.totemWelcomeMessage
        : typeof obj.totem_welcome_message === "string"
          ? (obj.totem_welcome_message as string)
          : undefined,
    totemBackgroundColor:
      typeof obj.totemBackgroundColor === "string"
        ? obj.totemBackgroundColor
        : typeof obj.totem_background_color === "string"
          ? (obj.totem_background_color as string)
          : undefined,
    totemTextColor:
      typeof obj.totemTextColor === "string"
        ? obj.totemTextColor
        : typeof obj.totem_text_color === "string"
          ? (obj.totem_text_color as string)
          : undefined,
    totemShowLogo:
      typeof obj.totemShowLogo === "boolean"
        ? obj.totemShowLogo
        : typeof obj.totem_show_logo === "boolean"
          ? (obj.totem_show_logo as boolean)
          : undefined,
    pixEnabled:
      typeof obj.pixEnabled === "boolean"
        ? obj.pixEnabled
        : typeof obj.pix_enabled === "boolean"
          ? (obj.pix_enabled as boolean)
          : undefined,
    pixKey:
      typeof obj.pixKey === "string"
        ? obj.pixKey
        : typeof obj.pix_key === "string"
          ? (obj.pix_key as string)
          : undefined,
    pixReceiverName:
      typeof obj.pixReceiverName === "string"
        ? obj.pixReceiverName
        : typeof obj.pix_receiver_name === "string"
          ? (obj.pix_receiver_name as string)
          : undefined,
    pixQrCode:
      typeof obj.pixQrCode === "string"
        ? obj.pixQrCode
        : typeof obj.pix_qr_code === "string"
          ? (obj.pix_qr_code as string)
          : typeof obj.pixQr === "string"
            ? (obj.pixQr as string)
            : undefined,
    pixInstructions:
      typeof obj.pixInstructions === "string"
        ? obj.pixInstructions
        : typeof obj.pix_instructions === "string"
          ? (obj.pix_instructions as string)
          : undefined,
  };
}

function normalizePublicOrder(raw: unknown): PublicOrderResponse {
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
          : undefined,
    code: typeof obj.code === "string" ? obj.code : undefined,
    paymentStatus:
      typeof obj.paymentStatus === "string"
        ? obj.paymentStatus
        : typeof obj.payment_status === "string"
          ? (obj.payment_status as string)
          : undefined,
    paymentMethod:
      typeof obj.paymentMethod === "string"
        ? obj.paymentMethod
        : typeof obj.payment_method === "string"
          ? (obj.payment_method as string)
          : undefined,
    totalInCents:
      typeof obj.totalInCents === "number"
        ? obj.totalInCents
        : typeof obj.total_in_cents === "number"
          ? (obj.total_in_cents as number)
          : undefined,
  };
}

export async function getPublicMenu(slug: string): Promise<PublicMenu> {
  const res = await apiFetch(
    `${API_BASE_URL}/public/events/${encodeURIComponent(slug)}/catalog-menu`,
    { headers: { ...API_HEADERS } },
  );
  const data = await handle<unknown>(res);
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const event = normalizePublicEvent(obj.event ?? obj);
  const eventObj = event as unknown as Record<string, unknown>;
  let categories =
    ((eventObj?.categories as PublicCategory[] | undefined)
      ?? (obj.categories as PublicCategory[] | undefined)
      ?? []);
  const topProducts = (obj.products as PublicProduct[] | undefined) ?? [];
  categories = categories.map((c) => ({
    ...c,
    products: c.products ?? topProducts.filter((p) => p.categoryId === c.id),
  }));
  return { event, categories, products: topProducts };
}

export async function resolveLegacyPublicEvent(slug: string): Promise<LegacyPublicEventResolution> {
  const res = await apiFetch(
    `${API_BASE_URL}/public/events/${encodeURIComponent(slug)}/catalog-menu`,
    { headers: { ...API_HEADERS } },
  );
  return handle<LegacyPublicEventResolution>(res);
}

export async function getCanonicalPublicMenu({
  organizationSlug,
  eventSlug,
}: {
  organizationSlug: string;
  eventSlug: string;
}): Promise<PublicMenu> {
  const res = await apiFetch(
    `${API_BASE_URL}${encodeEventPath({ organizationSlug, eventSlug })}/catalog-menu`,
    { headers: { ...API_HEADERS } },
  );
  const data = await handle<unknown>(res);
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const event = normalizePublicEvent(obj.event ?? obj);
  const eventObj = event as unknown as Record<string, unknown>;
  const categories =
    ((eventObj?.categories as PublicCategory[] | undefined)
      ?? (obj.categories as PublicCategory[] | undefined)
      ?? []);
  const topProducts = (obj.products as PublicProduct[] | undefined) ?? [];
  return {
    event: {
      ...event,
      canonicalUrl: typeof obj.canonicalUrl === "string" ? obj.canonicalUrl : undefined,
      canonicalPath: typeof obj.canonicalPath === "string" ? obj.canonicalPath : undefined,
      organizationSlug: typeof obj.organizationSlug === "string" ? obj.organizationSlug : undefined,
      code: typeof obj.code === "string" ? obj.code : undefined,
      message: typeof obj.message === "string" ? obj.message : undefined,
    },
    categories: categories.map((c) => ({
      ...c,
      products: c.products ?? topProducts.filter((p) => p.categoryId === c.id),
    })),
    products: topProducts,
  };
}

export interface NfcIdentifiedCustomer {
  cardId: string;
  uid: string;
  code: string;
  name: string;
  type: string;
  status?: string;
  balanceInCents?: number;
}

export interface NfcIdentifyResponse {
  found: boolean;
  blocked?: boolean;
  customer?: NfcIdentifiedCustomer;
}

function pickBalance(obj: Record<string, unknown> | undefined | null): number | undefined {
  if (!obj) return undefined;
  const keys = ["balanceInCents", "balance_in_cents", "balanceCents", "balance_cents"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  const b = obj.balance;
  if (typeof b === "number" && Number.isFinite(b)) return Math.round(b * 100);
  return undefined;
}

export async function identifyNfc(slug: string, uid: string): Promise<NfcIdentifyResponse> {
  const normalized = uid.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  const res = await apiFetch(
    `${API_BASE_URL}/public/events/${encodeURIComponent(slug)}/nfc/identify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      body: JSON.stringify({ uid: normalized }),
    },
  );
  const data = await handle<NfcIdentifyResponse & { card?: Record<string, unknown> }>(res);
  const customer = data.customer;
  const blocked = data.blocked === true || (customer?.status && String(customer.status).toUpperCase() === "BLOCKED");
  let normalizedCustomer = customer;
  if (customer) {
    const balance =
      pickBalance(customer as unknown as Record<string, unknown>) ??
      pickBalance((data as unknown as Record<string, unknown>).card as Record<string, unknown> | undefined) ??
      pickBalance(data as unknown as Record<string, unknown>);
    normalizedCustomer = { ...customer, balanceInCents: balance };
  }
  return { found: !!data.found, blocked: !!blocked, customer: normalizedCustomer };
}

export async function identifyNfcCanonical(
  organizationSlug: string,
  eventSlug: string,
  uid: string,
): Promise<NfcIdentifyResponse> {
  const normalized = uid.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  const res = await apiFetch(
    `${API_BASE_URL}${encodeEventPath({ organizationSlug, eventSlug })}/nfc/identify`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      body: JSON.stringify({ uid: normalized }),
    },
  );
  const data = await handle<NfcIdentifyResponse & { card?: Record<string, unknown> }>(res);
  const customer = data.customer;
  const blocked = data.blocked === true || (customer?.status && String(customer.status).toUpperCase() === "BLOCKED");
  let normalizedCustomer = customer;
  if (customer) {
    const balance =
      pickBalance(customer as unknown as Record<string, unknown>) ??
      pickBalance((data as unknown as Record<string, unknown>).card as Record<string, unknown> | undefined) ??
      pickBalance(data as unknown as Record<string, unknown>);
    normalizedCustomer = { ...customer, balanceInCents: balance };
  }
  return { found: !!data.found, blocked: !!blocked, customer: normalizedCustomer };
}

export interface NfcPaymentResult {
  success: boolean;
  order?: PublicOrderResponse;
  card?: { balanceInCents?: number; uid?: string; [k: string]: unknown };
  newBalanceInCents?: number;
  message?: string;
  [k: string]: unknown;
}

export async function payWithNfcBalance(
  slug: string,
  orderId: string,
  uid: string,
): Promise<NfcPaymentResult> {
  const normalized = uid.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  const res = await apiFetch(
    `${API_BASE_URL}/public/events/${encodeURIComponent(slug)}/orders/${encodeURIComponent(orderId)}/pay-with-nfc-balance`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      body: JSON.stringify({ uid: normalized }),
    },
  );
  const data = await handle<NfcPaymentResult>(res);
  const newBalance =
    pickBalance(data as unknown as Record<string, unknown>) ??
    pickBalance(data.card as Record<string, unknown> | undefined);
  return { ...data, success: true, newBalanceInCents: newBalance };
}

export async function payWithNfcBalanceCanonical(
  organizationSlug: string,
  eventSlug: string,
  orderId: string,
  uid: string,
): Promise<NfcPaymentResult> {
  const normalized = uid.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
  const res = await apiFetch(
    `${API_BASE_URL}${encodeEventPath({ organizationSlug, eventSlug })}/orders/${encodeURIComponent(orderId)}/pay-with-nfc-balance`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      body: JSON.stringify({ uid: normalized }),
    },
  );
  const data = await handle<NfcPaymentResult>(res);
  const newBalance =
    pickBalance(data as unknown as Record<string, unknown>) ??
    pickBalance(data.card as Record<string, unknown> | undefined);
  return { ...data, success: true, newBalanceInCents: newBalance };
}

export interface CreatePublicOrderInput {
  customerName: string;
  items: { productId: string; quantity: number }[];
  checkoutContext?: "TOTEM" | "PUBLIC_EVENT";
  paymentMethod?: "PIX" | "CARD" | "PIX_AUTOMATIC" | "CREDIT_CARD" | "DEBIT_CARD" | string;
  paymentStatus?: "PENDING" | "PAID" | string;
  status?: "PENDING" | "CONFIRMED" | string;
}

export interface PublicOrderResponse {
  id: string;
  number?: number | string;
  orderNumber?: number | string;
  code?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  totalInCents?: number;
  [k: string]: unknown;
}

export async function createPublicOrder(
  slug: string,
  input: CreatePublicOrderInput,
): Promise<PublicOrderResponse> {
  const res = await apiFetch(
    `${API_BASE_URL}/public/events/${encodeURIComponent(slug)}/orders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<PublicOrderResponse | { order: PublicOrderResponse }>(res);
  return normalizePublicOrder(
    "order" in (data as object)
      ? (data as { order: PublicOrderResponse }).order
      : (data as PublicOrderResponse),
  );
}

export async function createPublicOrderCanonical(
  organizationSlug: string,
  eventSlug: string,
  input: CreatePublicOrderInput,
): Promise<PublicOrderResponse> {
  const res = await apiFetch(
    `${API_BASE_URL}${encodeEventPath({ organizationSlug, eventSlug })}/orders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<PublicOrderResponse | { order: PublicOrderResponse }>(res);
  return normalizePublicOrder(
    "order" in (data as object)
      ? (data as { order: PublicOrderResponse }).order
      : (data as PublicOrderResponse),
  );
}

export async function getCheckoutPaymentSettings(
  eventId: string,
  context: "TOTEM" | "PUBLIC_CHECKOUT" = "PUBLIC_CHECKOUT",
): Promise<CheckoutPaymentSettings> {
  const res = await apiFetch(`${API_BASE_URL}/public/events/${encodeURIComponent(eventId)}/checkout-payment-settings?context=${encodeURIComponent(context)}`, {
    headers: { ...API_HEADERS },
  });
  const data = await handle<CheckoutPaymentSettings | { checkoutPaymentSettings: CheckoutPaymentSettings }>(res);
  return "checkoutPaymentSettings" in (data as object)
    ? (data as { checkoutPaymentSettings: CheckoutPaymentSettings }).checkoutPaymentSettings
    : (data as CheckoutPaymentSettings);
}

export async function createPixAutomaticPayment(orderId: string): Promise<PaymentTransaction> {
  const res = await apiFetch(`${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/pix-automatic-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...API_HEADERS },
    body: JSON.stringify({}),
  });
  return handle<PaymentTransaction>(res);
}

export async function checkoutPayment(
  orderId: string,
  input: { context?: "TOTEM" | "PUBLIC_CHECKOUT"; paymentMethod?: "PIX" | "CARD" } = {},
): Promise<CheckoutPaymentResponse> {
  const url = `${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/checkout-payment`;
  // [redacted log]
  const res = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      ...API_HEADERS
    },
    body: JSON.stringify(input),
  });
  
  // [redacted log]
  const data = await res.json();
  // [redacted log]
  if (!res.ok) {
    throw new Error(data?.message || "Erro ao preparar pagamento");
  }

  return data as CheckoutPaymentResponse;
}

/** Fallback status check while waiting for socket. Returns null if endpoint unavailable. */
export async function getPublicOrderStatus(
  orderId: string,
): Promise<{ paymentStatus?: string } | null> {
  const id = encodeURIComponent(orderId);
  const candidates = [
    `${API_BASE_URL}/public/orders/${id}`,
    `${API_BASE_URL}/public/orders/${id}/status`,
    `${API_BASE_URL}/orders/${id}`,
  ];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { ...API_HEADERS } });
      if (!res.ok) continue;
      const data = await res.json();
      const root = data ?? {};
      const order = (root.order ?? root) as { paymentStatus?: string };
      if (order?.paymentStatus) {
        return { paymentStatus: order.paymentStatus };
      }
    } catch {
      // try next
    }
  }
  return null;
}

export async function getPaymentProviderSettings(): Promise<PaymentProviderSetting[]> {
  const res = await apiFetch(`${API_BASE_URL}/payment-provider-settings`, {
    headers: { ...API_HEADERS },
  });
  const data = await handle<PaymentProviderSetting[] | { settings: PaymentProviderSetting[] }>(res);
  return Array.isArray(data) ? data : data.settings;
}

export async function createPaymentTransaction(
  orderId: string,
  input: {
    provider: string;
    method: string;
    amountInCents: number;
    metadata?: Record<string, unknown>;
  }
): Promise<PaymentTransaction> {
  const res = await apiFetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}/payment-transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...API_HEADERS },
    body: JSON.stringify(input),
  });
  return handle<PaymentTransaction>(res);
}

export interface CallScreenData {
  event: PublicEvent;
  orders: PublicOrderResponse[];
}

export async function getCallScreenOrders(slug: string): Promise<CallScreenData> {
  const res = await apiFetch(`${API_BASE_URL}/public/events/${encodeURIComponent(slug)}/call-screen-orders`, {
    headers: { ...API_HEADERS },
  });
  return handle<CallScreenData>(res);
}

export async function getCallScreenOrdersCanonical(
  organizationSlug: string,
  eventSlug: string,
): Promise<CallScreenData> {
  const res = await apiFetch(
    `${API_BASE_URL}${encodeEventPath({ organizationSlug, eventSlug })}/call-screen-orders`,
    {
      headers: { ...API_HEADERS },
    },
  );
  return handle<CallScreenData>(res);
}

/* ---------------- Public Online Store (Guello's Pizza etc.) ---------------- */

export interface PublicStoreOperation {
  onlineOrderingEnabled?: boolean;
  digitalMenuEnabled?: boolean;
  autoAcceptOrders?: boolean;
  openNow: boolean;
  acceptingOrders?: boolean;
  statusMessage?: string | null;
  unavailableReason?: string | null;
  availabilityReason?: string | null;
  timezone?: string | null;
  nextOpeningAt?: string | null;
  nextClosingAt?: string | null;
  closedMessage: string | null;
  checkoutNotice: string | null;
  orderConfirmationMessage: string | null;
}

export interface PublicStoreFulfillmentOptions {
  delivery: boolean;
  pickup: boolean;
  counter: boolean;
  dineIn: boolean;
  estimatedPreparationMinutes: number;
  estimatedDeliveryMinutes: number;
  defaultDeliveryFeeInCents: number;
  freeDeliveryAboveInCents: number | null;
}

export interface PublicStoreOrderRules {
  minimumOrderInCents: number;
  requireCustomerName: boolean;
  requireCustomerPhone: boolean;
  requireDeliveryAddress: boolean;
  allowCustomerNotes: boolean;
}

export interface PublicStore {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  city?: string;
  state?: string;
  whatsapp?: string;
  phone?: string;
  isOpen?: boolean;
  acceptingOrders?: boolean;
  availabilityReason?: string | null;
  nextOpeningAt?: string | null;
  nextClosingAt?: string | null;
  open?: boolean;
  active?: boolean;
  status?: string;
  organizationId?: string;
  // Branding fields (populated by the backend from GET /settings + /settings/effective).
  // Any missing field falls back to the previous behavior.
  lightLogoUrl?: string | null;
  darkLogoUrl?: string | null;
  bannerDesktopUrl?: string | null;
  bannerMobileUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  theme?: "LIGHT" | "DARK" | "SYSTEM" | string | null;
  defaultProductImageUrl?: string | null;
  socialImageUrl?: string | null;
  // From /settings/effective
  openNow?: boolean;
  openStatusMessage?: string | null;
  // Fase 2A — Loja Online / Delivery (contract in docs/api/settings-phase2-contracts.md).
  // Any of these may be absent when the backend has not been upgraded yet.
  operation?: PublicStoreOperation;
  fulfillment?: PublicStoreFulfillmentOptions;
  orderRules?: PublicStoreOrderRules;
  [k: string]: unknown;
}


export interface PublicProductOptionLinkedProduct {
  id: string;
  name: string;
  imageUrl: string | null;
}

export interface PublicProductOption {
  id: string;
  key?: string;
  name: string;
  priceDeltaInCents: number;
  sortOrder: number;
  linkedProductId: string | null;
  linkedProduct: PublicProductOptionLinkedProduct | null;
}

export interface PublicProductOptionGroup {
  id: string;
  key?: string;
  name: string;
  description?: string | null;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: PublicProductOption[];
}

export interface PublicStoreCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  order?: number;
  sortOrder?: number;
  products?: PublicStoreProduct[];
  [k: string]: unknown;
}

export interface PublicStoreProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string | null;
  priceInCents: number;
  pricingRule?: "STANDARD" | "MAX_SELECTED_FLAVOR" | string;
  acceptsHalfAndHalf?: boolean;
  supportsHalfAndHalf?: boolean;
  halfAndHalfFlavors?: PublicStoreProduct[];
  halfAndHalfFlavorProducts?: PublicStoreProduct[];
  sortOrder?: number;
  categoryId?: string;
  active?: boolean;
  soldOut?: boolean;
  optionGroups?: PublicProductOptionGroup[];
  [k: string]: unknown;
}

export interface PublicStoreDetail {
  store: PublicStore;
  categories: PublicStoreCategory[];
  products: PublicStoreProduct[];
}

function toList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const k of keys) if (Array.isArray(obj[k])) return obj[k] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

export async function getPublicStore(slug: string): Promise<PublicStoreDetail> {
  const res = await apiFetch(
    `${API_BASE_URL}/public/stores/${encodeURIComponent(slug)}`,
    { headers: { ...API_HEADERS } },
  );
  const data = await handle<unknown>(res);
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const store =
    (obj.store as PublicStore) ??
    (obj.onlineStore as PublicStore) ??
    (obj.data as PublicStore) ??
    (data as PublicStore);

  const nested = (root: unknown, key: string): unknown => {
    if (!root || typeof root !== "object") return undefined;
    const v = (root as Record<string, unknown>)[key];
    return Array.isArray(v) ? v : undefined;
  };
  const storeObj = obj.store as Record<string, unknown> | undefined;
  const onlineStoreObj = obj.onlineStore as Record<string, unknown> | undefined;
  const dataObj = obj.data as Record<string, unknown> | undefined;

  // Source of truth: response.categories. Only fall back to legacy shapes when empty.
  const primary = toList<PublicStoreCategory>(obj.categories, "categories");
  const categories: PublicStoreCategory[] =
    primary.length > 0
      ? primary
      : toList<PublicStoreCategory>(
          obj.catalogCategories ??
            obj.onlineCategories ??
            nested(storeObj, "categories") ??
            nested(storeObj, "catalogCategories") ??
            nested(onlineStoreObj, "categories") ??
            nested(onlineStoreObj, "catalogCategories") ??
            nested(dataObj, "categories") ??
            [],
          "categories",
        );

  // Flatten products from nested categories[].products (current contract).
  // Fall back to legacy top-level products only when nested is empty.
  const nestedProducts: PublicStoreProduct[] = [];
  for (const c of categories) {
    const list = Array.isArray(c.products) ? c.products : [];
    for (const p of list) nestedProducts.push({ ...p, categoryId: p.categoryId ?? c.id });
  }
  const products: PublicStoreProduct[] =
    nestedProducts.length > 0
      ? nestedProducts
      : toList<PublicStoreProduct>(
          obj.products ??
            obj.catalogProducts ??
            obj.onlineProducts ??
            nested(storeObj, "products") ??
            nested(storeObj, "catalogProducts") ??
            nested(onlineStoreObj, "products") ??
            nested(onlineStoreObj, "catalogProducts") ??
            nested(dataObj, "products") ??
            [],
          "products",
        );

  if (import.meta.env.DEV) {
    /* eslint-disable no-console */
    console.groupCollapsed(`[getPublicStore] /public/stores/${slug}`);
    console.groupEnd();
    /* eslint-enable no-console */
  }

  return { store, categories, products };
}


/* ---------------- Public Store Customer (identify by WhatsApp) ---------------- */

export interface PublicCustomerAddress {
  id: string;
  label?: string;
  address: string;
  number?: string;
  neighborhood?: string;
  complement?: string;
  reference?: string;
  [k: string]: unknown;
}

export interface PublicCustomer {
  id: string;
  name: string;
  phone: string;
  addresses: PublicCustomerAddress[];
  [k: string]: unknown;
}

function onlyDigits(s: string): string {
  return s.replace(/\D+/g, "");
}

function normalizeCustomerAddress(raw: unknown): PublicCustomerAddress | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const str = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return undefined;
  };
  const address = str("address", "street", "deliveryAddress", "logradouro");
  if (!address) return null;
  return {
    ...o,
    id: String(o.id ?? o.addressId ?? `${address}-${o.number ?? ""}`),
    label: str("label", "name", "title", "nickname"),
    address,
    number: str("number", "deliveryNumber", "numero"),
    neighborhood: str("neighborhood", "deliveryNeighborhood", "bairro"),
    complement: str("complement", "deliveryComplement", "complemento"),
    reference: str("reference", "deliveryReference", "referencia", "landmark"),
  };
}

export async function getPublicStoreCustomerByPhone(
  slug: string,
  phone: string,
): Promise<PublicCustomer | null> {
  const normalized = onlyDigits(phone);
  if (normalized.length < 10) return null;
  const url = `${API_BASE_URL}/public/stores/${encodeURIComponent(slug)}/customers/by-phone?phone=${encodeURIComponent(normalized)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { ...API_HEADERS } });
  } catch {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) return null;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const c =
    (obj.customer as Record<string, unknown> | undefined) ??
    (obj.data as Record<string, unknown> | undefined) ??
    obj;
  if (!c || typeof c !== "object") return null;
  const id = c.id;
  const name = c.name ?? c.customerName;
  if (!id || !name) return null;
  const addrRaw =
    (c.addresses as unknown[] | undefined) ??
    (c.customerAddresses as unknown[] | undefined) ??
    (obj.addresses as unknown[] | undefined) ??
    [];
  const addresses = Array.isArray(addrRaw)
    ? (addrRaw.map(normalizeCustomerAddress).filter(Boolean) as PublicCustomerAddress[])
    : [];
  return {
    ...c,
    id: String(id),
    name: String(name),
    phone: String(c.phone ?? c.customerPhone ?? normalized),
    addresses,
  };
}


export type PublicPaymentMethod = "PIX" | "CARD_ON_DELIVERY" | "CASH";

export interface CreatePublicOrderItemSelectedOption {

  optionGroupId: string;
  optionIds: string[];
}

export interface CreatePublicOrderItem {
  productId: string;
  quantity: number;
  notes?: string;
  selectedOptions?: CreatePublicOrderItemSelectedOption[];
  selectedFlavorProductIds?: string[];
}


export interface CreatePublicStoreOrderInput {
  customerName: string;
  customerPhone: string;
  /** Optional: link to an existing Customer discovered via by-phone lookup. */
  customerId?: string;
  /**
   * Optional: link to an existing CustomerAddress. When present, the backend
   * reuses that address and delivery* fields are informational only. Never
   * send this together with a "novo endereço" the user just typed.
   */
  customerAddressId?: string;
  /**
   * Explicit fulfillment channel. Must match the store's PublicStoreFulfillmentOptions
   * (delivery / pickup). When PICKUP, the delivery* fields are omitted.
   */
  fulfillment?: "DELIVERY" | "PICKUP";
  deliveryAddress?: string;
  deliveryNumber?: string;
  deliveryNeighborhood?: string;
  deliveryComplement?: string;
  deliveryReference?: string;
  paymentMethod: PublicPaymentMethod;
  changeForInCents?: number;
  notes?: string;
  items: CreatePublicOrderItem[];
}


export interface PublicOrderCreatedItemOption {
  groupName?: string;
  optionName?: string;
  priceDeltaInCents?: number;
}

export interface PublicOrderCreatedItem {
  id?: string;
  productId?: string;
  productName?: string;
  name?: string;
  quantity?: number;
  unitPriceInCents?: number;
  totalInCents?: number;
  notes?: string;
  options?: PublicOrderCreatedItemOption[];
}

export interface PublicOrderCreated {
  id: string;
  orderNumber?: number | string;
  code?: string;
  subtotalInCents?: number;
  deliveryFeeInCents?: number;
  totalInCents?: number;
  paymentMethod?: string;
  status?: string;
  items?: PublicOrderCreatedItem[];
  [k: string]: unknown;
}

export async function createPublicStoreOrder(
  slug: string,
  input: CreatePublicStoreOrderInput,
): Promise<PublicOrderCreated> {

  const res = await apiFetch(
    `${API_BASE_URL}/public/stores/${encodeURIComponent(slug)}/orders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...API_HEADERS },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<unknown>(res);
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  return (
    (obj.order as PublicOrderCreated) ??
    (obj.data as PublicOrderCreated) ??
    (data as PublicOrderCreated)
  );
}
