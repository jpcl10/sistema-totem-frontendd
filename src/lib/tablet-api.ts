import { API_BASE_URL, API_HEADERS, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";
import type {
  TotemV2Category,
  TotemV2Order,
  TotemV2PaymentPreparation,
} from "./totem-v2-api";

export type TabletContextType = "EVENT";

export interface TabletContext {
  deviceId: string;
  organizationId: string;
  organizationSlug: string;
  contextType: TabletContextType;
  eventId: string;
  eventSlug: string;
  storeId: null;
  storeSlug: null;
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
    kitchenPrinterDeviceId?: string | null;
    barPrinterDeviceId?: string | null;
    paperSize: string;
  };
  tablet: {
    autoResetSeconds: number;
    requireWelcome: boolean;
    cardExternalEnabled: boolean;
  };
  catalog: {
    categories: TotemV2Category[];
  };
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

export async function resolveTabletContext(token: string): Promise<TabletContext> {
  const res = await apiFetch(`${API_BASE_URL}/devices/me/tablet-context`, {
    headers: authHeaders(token),
  });
  const data = await handle<{ context: TabletContext } | TabletContext>(res);
  return "context" in (data as object) ? (data as { context: TabletContext }).context : data as TabletContext;
}

export async function createTabletEventOrder({
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
        checkoutContext: "TABLET",
        paymentMethod,
        items,
      }),
    },
  );
  const data = await handle<{ order: TotemV2Order } | TotemV2Order>(res);
  return "order" in (data as object) ? (data as { order: TotemV2Order }).order : data as TotemV2Order;
}

export async function prepareTabletPixPayment(orderId: string): Promise<TotemV2PaymentPreparation> {
  const res = await apiFetch(`${API_BASE_URL}/public/orders/${encodeURIComponent(orderId)}/checkout-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...API_HEADERS,
    },
    body: JSON.stringify({
      context: "TABLET",
      paymentMethod: "PIX",
    }),
  });
  return handle<TotemV2PaymentPreparation>(res);
}

export async function getTabletOrderStatus(orderId: string): Promise<{
  paymentStatus?: string;
  orderNumber?: number | string;
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
  const data = (await res.json()) as { order?: { paymentStatus?: string; orderNumber?: number | string; printJobs?: [] } };
  const order = data.order ?? data;
  return order;
}

export async function retryTabletPrintJob(token: string, orderId: string, printJobId: string) {
  const res = await apiFetch(
    `${API_BASE_URL}/public/tablet/orders/${encodeURIComponent(orderId)}/print-jobs/${encodeURIComponent(printJobId)}/retry`,
    {
      method: "PATCH",
      headers: authHeaders(token),
    },
  );
  return handle(res);
}
