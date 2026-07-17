import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export interface OnlineStore {
  id: string;
  name: string;
  slug: string;
  active?: boolean;
  status?: string;
  logoUrl?: string;
  description?: string;
  [k: string]: unknown;
}

export interface OnlineCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  order?: number;
  active?: boolean;
  storeId?: string;
  [k: string]: unknown;
}

export interface OnlineProduct {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  priceInCents: number;
  active?: boolean;
  categoryId?: string;
  category?: OnlineCategory;
  storeId?: string;
  [k: string]: unknown;
}

export interface OnlineStoreDetail {
  store: OnlineStore;
  categories: OnlineCategory[];
  products: OnlineProduct[];
}

async function handle<T>(res: Response, fallback?: string): Promise<T> {
  if (!res.ok) throw await fromResponse(res, fallback);
  return (await res.json()) as T;
}

function unwrapList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const k of keys) if (Array.isArray(obj[k])) return obj[k] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function unwrapOne<T>(data: unknown, ...keys: string[]): T {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const k of keys) {
      if (obj[k] && typeof obj[k] === "object") return obj[k] as T;
    }
    if (obj.data && typeof obj.data === "object") return obj.data as T;
  }
  return data as T;
}

/* ------------------- Stores ------------------- */

export async function listOnlineStores(token: string): Promise<OnlineStore[]> {
  const res = await apiFetch(`${API_BASE_URL}/online-stores`, { headers: authHeaders(token) });
  const data = await handle<unknown>(res, "Não foi possível carregar as lojas.");
  return unwrapList<OnlineStore>(data, "stores", "onlineStores");
}

export async function getOnlineStoreDetail(
  token: string,
  storeId: string,
): Promise<OnlineStoreDetail> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}`,
    { headers: authHeaders(token) },
  );
  const data = await handle<unknown>(res, "Não foi possível carregar a loja.");
  const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
  const store =
    (obj.store as OnlineStore) ??
    (obj.onlineStore as OnlineStore) ??
    (obj.data as OnlineStore) ??
    (data as OnlineStore);
  const storeRec = (store && typeof store === "object" ? store : {}) as Record<string, unknown>;

  // Categories may live at root, under `store`, or wrapped in `data`.
  const categories = unwrapList<OnlineCategory>(
    obj.categories ?? obj.onlineCategories ?? storeRec.categories ?? storeRec.onlineCategories ?? data,
    "categories",
    "onlineCategories",
  );

  // Products may live at root, under `store`, or aggregated inside each category.
  let products = unwrapList<OnlineProduct>(
    obj.products ?? obj.onlineProducts ?? storeRec.products ?? storeRec.onlineProducts ?? data,
    "products",
    "onlineProducts",
  );
  if (products.length === 0 && categories.length > 0) {
    const collected: OnlineProduct[] = [];
    for (const c of categories) {
      const rec = c as unknown as { products?: OnlineProduct[]; onlineProducts?: OnlineProduct[] };
      const list = rec.products ?? rec.onlineProducts ?? [];
      for (const p of list) collected.push({ ...p, categoryId: p.categoryId ?? c.id });
    }
    products = collected;
  }

  if (import.meta.env.DEV) {
    console.log("[online-store] detail", { storeId, categories: categories.length, products: products.length, raw: data });
  }

  return { store, categories, products };
}


/* ------------------- Categories ------------------- */

export async function createOnlineCategory(
  token: string,
  storeId: string,
  input: { name: string; description?: string; order?: number; active?: boolean },
): Promise<OnlineCategory> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}/categories`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<unknown>(res, "Não foi possível criar a categoria.");
  return unwrapOne<OnlineCategory>(data, "category", "onlineCategory");
}

export async function updateOnlineCategory(
  token: string,
  storeId: string,
  categoryId: string,
  patch: Partial<{ name: string; description: string; order: number; active: boolean }>,
): Promise<OnlineCategory> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}/categories/${encodeURIComponent(categoryId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(patch),
    },
  );
  const data = await handle<unknown>(res, "Não foi possível atualizar a categoria.");
  return unwrapOne<OnlineCategory>(data, "category", "onlineCategory");
}

export async function deleteOnlineCategory(
  token: string,
  storeId: string,
  categoryId: string,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}/categories/${encodeURIComponent(categoryId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (!res.ok) throw await fromResponse(res, "Não foi possível excluir a categoria.");
}

/* ------------------- Products ------------------- */

export async function createOnlineProduct(
  token: string,
  storeId: string,
  input: {
    name: string;
    description?: string;
    imageUrl?: string;
    priceInCents: number;
    categoryId: string;
    active?: boolean;
  },
): Promise<OnlineProduct> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}/products`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<unknown>(res, "Não foi possível criar o produto.");
  return unwrapOne<OnlineProduct>(data, "product", "onlineProduct");
}

export async function updateOnlineProduct(
  token: string,
  storeId: string,
  productId: string,
  patch: Partial<{
    name: string;
    description: string;
    imageUrl: string;
    priceInCents: number;
    categoryId: string;
    active: boolean;
  }>,
): Promise<OnlineProduct> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(patch),
    },
  );
  const data = await handle<unknown>(res, "Não foi possível atualizar o produto.");
  return unwrapOne<OnlineProduct>(data, "product", "onlineProduct");
}

export async function deleteOnlineProduct(
  token: string,
  storeId: string,
  productId: string,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}/products/${encodeURIComponent(productId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (!res.ok) throw await fromResponse(res, "Não foi possível excluir o produto.");
}

/* ------------------- Manual sale (store) ------------------- */

export type StorePaymentMethod = "PIX" | "CARD_ON_DELIVERY" | "CASH";
export type StoreFulfillment = "PICKUP" | "DELIVERY";

export interface StoreManualSaleItem {
  productId?: string;
  catalogProductId?: string;
  quantity: number;
  notes?: string | null;
  selectedOptions?: Array<{ optionGroupId: string; optionIds: string[] }>;
}

export interface StoreManualSaleInput {
  items: StoreManualSaleItem[];
  customerId?: string | null;
  /**
   * Optional: link to an existing CustomerAddress. When present the backend
   * reuses that address and the `delivery` block is informational only.
   * Never send both a fresh delivery block AND customerAddressId for a
   * different address in the same request.
   */
  customerAddressId?: string | null;
  customer?: { name?: string | null; phone?: string | null };
  fulfillment?: StoreFulfillment;
  delivery?: {
    address: string;
    number: string;
    neighborhood: string;
    complement?: string | null;
    reference?: string | null;
  };
  paymentMethod: StorePaymentMethod;
  amountReceivedInCents?: number | null;
  notes?: string | null;
}


function emptyToNull(v: string | null | undefined): string | null | undefined {
  if (v == null) return v;
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * POST /online-stores/:storeId/orders/manual-sale
 * Backend is source of truth for prices/totals. NEVER send prices.
 */
export async function createStoreManualSale(
  token: string,
  storeId: string,
  input: StoreManualSaleInput,
): Promise<{ id: string; [k: string]: unknown }> {
  const fulfillment: StoreFulfillment = input.fulfillment ?? "PICKUP";
  const body: Record<string, unknown> = {
    fulfillment,
    paymentMethod: input.paymentMethod,
    items: input.items.map((it) => {
      const item: Record<string, unknown> = { quantity: it.quantity };
      if (it.catalogProductId) item.catalogProductId = it.catalogProductId;
      else if (it.productId) item.productId = it.productId;
      const notes = emptyToNull(it.notes ?? undefined);
      if (notes !== undefined) item.notes = notes;
      if (it.selectedOptions && it.selectedOptions.length > 0) {
        item.selectedOptions = it.selectedOptions.map((o) => ({
          optionGroupId: o.optionGroupId,
          optionIds: o.optionIds,
        }));
      }
      return item;
    }),
  };

  if (input.customerId) body.customerId = input.customerId;
  if (input.customerAddressId) body.customerAddressId = input.customerAddressId;
  if (input.customer) {
    const name = emptyToNull(input.customer.name ?? undefined);
    const phone = emptyToNull(input.customer.phone ?? undefined);
    if (name !== undefined || phone !== undefined) {
      body.customer = { name: name ?? null, phone: phone ?? null };
    }

  }
  // "Nunca enviar ambos": prefer customerAddressId (backend reuses saved
  // CustomerAddress). Only emit the fresh delivery block when no saved
  // address is being reused.
  if (fulfillment === "DELIVERY" && !input.customerAddressId && input.delivery) {
    body.delivery = {
      address: input.delivery.address,
      number: input.delivery.number,
      neighborhood: input.delivery.neighborhood,
      complement: emptyToNull(input.delivery.complement ?? undefined) ?? null,
      reference: emptyToNull(input.delivery.reference ?? undefined) ?? null,
    };
  }

  if (input.paymentMethod === "CASH" && typeof input.amountReceivedInCents === "number") {
    body.amountReceivedInCents = input.amountReceivedInCents;
  }
  const notes = emptyToNull(input.notes ?? undefined);
  if (notes !== undefined) body.notes = notes;

  if (import.meta.env.DEV) {
    console.log("[store-manual-sale] payload", { storeId, body });
  }

  const res = await apiFetch(
    `${API_BASE_URL}/online-stores/${encodeURIComponent(storeId)}/orders/manual-sale`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(body),
    },
  );
  const data = await handle<unknown>(res, "Não foi possível criar o pedido.");
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.order && typeof obj.order === "object") return obj.order as { id: string };
    if (obj.onlineOrder && typeof obj.onlineOrder === "object")
      return obj.onlineOrder as { id: string };
    return obj as { id: string };
  }
  return { id: "" };
}
