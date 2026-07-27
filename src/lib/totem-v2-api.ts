import { API_BASE_URL, API_HEADERS, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";
import type { PaymentTransaction } from "./public-api";

export type TotemV2ContextType = "EVENT" | "ONLINE_STORE";

export interface TotemV2Option {
  id: string;
  name: string;
  priceDeltaInCents: number;
  sortOrder?: number;
}

export interface TotemV2OptionGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: TotemV2Option[];
}

export interface TotemV2Product {
  id: string;
  catalogProductId?: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  priceInCents: number;
  optionGroups?: TotemV2OptionGroup[];
}

export interface TotemV2Category {
  id: string;
  name: string;
  slug?: string;
  sortOrder?: number;
  products: TotemV2Product[];
}

export interface TotemV2Context {
  deviceId: string;
  organizationId: string;
  organizationSlug: string;
  contextType: TotemV2ContextType;
  eventId: string | null;
  eventSlug: string | null;
  storeId: string | null;
  storeSlug: string | null;
  displayName: string;
  bannerUrl: string | null;
  logoUrl: string | null;
  paymentMethods: {
    pix: boolean;
    card: boolean;
  };
  printing: {
    enabled: boolean;
    autoPrintEnabled: boolean;
    defaultPrinterDeviceId: string | null;
    paperSize: string;
  };
  catalog: {
    categories: TotemV2Category[];
  };
}

export interface TotemV2Order {
  id: string;
  orderNumber?: number | string;
  totalInCents?: number;
  paymentStatus?: string;
}

export interface TotemV2PaymentPreparation {
  paymentStep: string;
  isPaymentConfirmed?: boolean;
  transactionId?: string | null;
  qrCode?: string;
  qrCodeBase64?: string;
  expiresAt?: string;
  paymentTransaction?: PaymentTransaction | null;
  message?: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

export async function resolveTotemV2Context(token: string): Promise<TotemV2Context> {
  const res = await apiFetch(`${API_BASE_URL}/devices/me/totem-v2-context`, {
    headers: authHeaders(token),
  });
  const data = await handle<{ context: TotemV2Context } | TotemV2Context>(res);
  return "context" in (data as object) ? (data as { context: TotemV2Context }).context : data as TotemV2Context;
}

export async function createTotemV2EventOrder({
  token,
  organizationSlug,
  eventSlug,
  paymentMethod,
  items,
}: {
  token: string;
  organizationSlug: string;
  eventSlug: string;
  paymentMethod: "PIX" | "CARD";
  items: Array<{
    productId: string;
    quantity: number;
    selectedOptions?: Array<{
      optionGroupId: string;
      optionIds: string[];
    }>;
  }>;
}): Promise<TotemV2Order> {
  const res = await apiFetch(
    `${API_BASE_URL}/public/organizations/${encodeURIComponent(organizationSlug)}/events/${encodeURIComponent(eventSlug)}/orders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...API_HEADERS,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        checkoutContext: "TOTEM",
        paymentMethod,
        items,
      }),
    },
  );
  const data = await handle<{ order: TotemV2Order } | TotemV2Order>(res);
  return "order" in (data as object) ? (data as { order: TotemV2Order }).order : data as TotemV2Order;
}

export async function prepareTotemV2Payment(
  orderId: string,
  paymentMethod: "PIX" | "CARD",
): Promise<TotemV2PaymentPreparation> {
  const res = await apiFetch(`${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/checkout-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...API_HEADERS,
    },
    body: JSON.stringify({
      context: "TOTEM",
      paymentMethod,
    }),
  });
  return handle<TotemV2PaymentPreparation>(res);
}

export async function getTotemV2OrderStatus(orderId: string): Promise<{
  paymentStatus?: string;
  printJobs?: Array<{
    id: string;
    status: string;
    deviceId?: string | null;
    printedAt?: string | null;
    attempts?: number;
    errorMessage?: string | null;
  }>;
} | null> {
  const res = await fetch(`${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}`, {
    headers: { ...API_HEADERS },
  });
  if (!res.ok) return null;
  const data = await res.json() as { order?: { paymentStatus?: string } } & { paymentStatus?: string };
  const order = data.order ?? data;
  return {
    paymentStatus: order.paymentStatus,
    printJobs: order.printJobs ?? [],
  };
}
