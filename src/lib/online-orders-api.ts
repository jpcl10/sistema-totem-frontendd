import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type OnlineOrderStatus =
  | "RECEIVED"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export const ONLINE_ORDER_STATUSES: OnlineOrderStatus[] = [
  "RECEIVED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
];

export const STATUS_LABEL: Record<OnlineOrderStatus, string> = {
  RECEIVED: "Recebido",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

export interface OnlineOrderItem {
  id?: string;
  productId?: string;
  name?: string;
  quantity?: number;
  priceInCents?: number;
  [k: string]: unknown;
}

export interface OnlineOrder {
  id: string;
  code?: string;
  number?: string | number;
  status: OnlineOrderStatus | string;
  customerName?: string;
  customerPhone?: string;
  totalInCents?: number;
  items?: OnlineOrderItem[];
  storeId?: string;
  storeSlug?: string;
  createdAt?: string;
  updatedAt?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  address?: string;
  notes?: string;
  [k: string]: unknown;
}

async function handle<T>(res: Response, fallback?: string): Promise<T> {
  if (!res.ok) throw await fromResponse(res, fallback);
  return (await res.json()) as T;
}

function unwrapList(data: unknown): OnlineOrder[] {
  if (Array.isArray(data)) return data as OnlineOrder[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.orders)) return obj.orders as OnlineOrder[];
    if (Array.isArray(obj.onlineOrders)) return obj.onlineOrders as OnlineOrder[];
    if (Array.isArray(obj.data)) return obj.data as OnlineOrder[];
  }
  return [];
}

export async function listOnlineOrders(
  token: string,
  params?: { from?: string; to?: string; storeId?: string; status?: string },
): Promise<OnlineOrder[]> {
  // Preferred: scoped by store when storeId is known.
  if (params?.storeId) {
    const qs = new URLSearchParams();
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const res = await apiFetch(
      `${API_BASE_URL}/online-stores/${encodeURIComponent(params.storeId)}/orders${suffix}`,
      { headers: authHeaders(token) },
    );
    const data = await handle<unknown>(res, "Não foi possível carregar os pedidos online.");
    return unwrapList(data);
  }
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.status) qs.set("status", params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  const res = await apiFetch(`${API_BASE_URL}/online-orders${suffix}`, {
    headers: authHeaders(token),
  });
  const data = await handle<unknown>(res, "Não foi possível carregar os pedidos online.");
  return unwrapList(data);
}


export async function updateOnlineOrderStatus(
  token: string,
  orderId: string,
  status: OnlineOrderStatus,
): Promise<OnlineOrder> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ status }),
    },
  );
  const data = await handle<unknown>(res, "Não foi possível atualizar o status do pedido.");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.order && typeof obj.order === "object") return obj.order as OnlineOrder;
    if (obj.onlineOrder && typeof obj.onlineOrder === "object") return obj.onlineOrder as OnlineOrder;
  }
  return data as OnlineOrder;
}
