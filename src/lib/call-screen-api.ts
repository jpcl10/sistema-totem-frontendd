import { API_BASE_URL, API_HEADERS } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type CallScreenContextType = "STORE" | "EVENT";

export interface CallScreenContext {
  type: CallScreenContextType;
  id: string;
  slug: string;
  name: string;
}

export interface CallScreenBranding {
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  backgroundColor: string | null;
  textColor: string | null;
}

export interface CallScreenConfiguration {
  showPreparing: boolean;
  showReady: boolean;
  soundEnabled: boolean;
  maxItemsPerColumn: number;
  nameMasking: string;
  readyRetentionMinutes: number | null;
}

export interface CallScreenOrder {
  id: string;
  publicCode: string;
  orderNumber: number | null;
  status: "PREPARING" | "READY";
  statusLabel: string;
  fulfillmentType: "PICKUP" | "COUNTER" | "ON_SITE" | "EVENT";
  displayName: string | null;
  updatedAt: string;
  readyAt: string | null;
}

export interface CallScreenOrdersPayload {
  context: CallScreenContext;
  orders: {
    preparing: CallScreenOrder[];
    ready: CallScreenOrder[];
  };
  serverTime: string;
}

export interface CallScreenBootstrapPayload extends CallScreenOrdersPayload {
  branding: CallScreenBranding;
  configuration: CallScreenConfiguration;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

function endpoint(type: CallScreenContextType, slug: string, suffix = ""): string {
  const base =
    type === "STORE"
      ? `/public/call-screens/store/${encodeURIComponent(slug)}`
      : `/public/call-screens/event/${encodeURIComponent(slug)}`;
  return `${API_BASE_URL}${base}${suffix}`;
}

export async function getCallScreenBootstrap(
  type: CallScreenContextType,
  slug: string,
): Promise<CallScreenBootstrapPayload> {
  const res = await apiFetch(endpoint(type, slug), {
    headers: { ...API_HEADERS },
  });
  return handle<CallScreenBootstrapPayload>(res);
}

export async function getCallScreenOrders(
  type: CallScreenContextType,
  slug: string,
): Promise<CallScreenOrdersPayload> {
  const res = await apiFetch(endpoint(type, slug, "/orders"), {
    headers: { ...API_HEADERS },
  });
  return handle<CallScreenOrdersPayload>(res);
}

