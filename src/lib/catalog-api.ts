import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type CategorySector = "BAR" | "KITCHEN";

export interface CatalogCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  active?: boolean;
  sector?: CategorySector;
  [k: string]: unknown;
}

export type CatalogProductPricingRule = "STANDARD" | "MAX_SELECTED_FLAVOR";
export interface CatalogProduct {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  catalogCategoryId?: string;
  categoryId?: string;
  category?: CatalogCategory;
  catalogCategory?: CatalogCategory;
  /** Preço-base do catálogo em centavos. */
  pricingRule?: CatalogProductPricingRule;
  supportsHalfAndHalf?: boolean;
  canBeUsedAsFlavor?: boolean;
  halfAndHalfFlavorCategoryId?: string | null;
  priceInCents?: number;
  sortOrder?: number;
  active?: boolean;
  [k: string]: unknown;
}

export type PriceSource = "CATALOG" | "EVENT";

export interface CatalogOption {
  id: string;
  name: string;
  priceInCents?: number;
  active?: boolean;
  sortOrder?: number;
}

export interface CatalogOptionGroup {
  id: string;
  name: string;
  required?: boolean;
  minSelections?: number;
  maxSelections?: number;
  sortOrder?: number;
  options?: CatalogOption[];
}

export interface EventCatalogProduct {
  id: string; // EventProduct id (used as order item id)
  eventId: string;
  catalogProductId?: string;
  /** Preço efetivo (priceInCents), decidido pelo backend. */
  priceInCents: number;
  /** Preço-base do catálogo em centavos (informativo). */
  catalogPriceInCents?: number;
  /** Preço específico do evento em centavos; null quando herda o catálogo. */
  eventPriceInCents?: number | null;
  /** Origem do preço efetivo. */
  priceSource?: PriceSource;
  active?: boolean;
  status?: string;
  product?: CatalogProduct;
  catalogProduct?: CatalogProduct;
  category?: CatalogCategory;
  name?: string;
  imageUrl?: string;
  description?: string;
  trackStock?: boolean;
  stockQuantity?: number;
  soldOut?: boolean;
  sortOrder?: number;
  /** Grupos de opções herdados do CatalogProduct. */
  optionGroups?: CatalogOptionGroup[];
  [k: string]: unknown;
}

/** Produto do catálogo com marcação de vínculo já existente ao evento. */
export interface AvailableCatalogProduct extends CatalogProduct {
  alreadyLinked?: boolean;
  optionGroups?: CatalogOptionGroup[];
  category?: CatalogCategory;
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

function unwrapOne<T>(data: unknown, ...keys: string[]): T {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const k of keys) {
      if (k in obj && obj[k] && typeof obj[k] === "object") return obj[k] as T;
    }
    if ("data" in obj && obj.data && typeof obj.data === "object") return obj.data as T;
  }
  return data as T;
}

function catalogHeaders(token: string, organizationId?: string | null) {
  const headers: Record<string, string> = authHeaders(token);
  if (organizationId) headers["x-organization-id"] = organizationId;
  return headers;
}

/* ---------------- Global catalog ---------------- */

export async function listCatalogCategories(token: string, organizationId?: string | null): Promise<CatalogCategory[]> {
  const res = await apiFetch(`${API_BASE_URL}/catalog/categories`, { headers: catalogHeaders(token, organizationId) });
  const data = await handle<unknown>(res);
  return unwrap<CatalogCategory>(data, "categories");
}

export async function createCatalogCategory(
  token: string,
  input: { name: string; slug: string; description?: string; sector?: CategorySector },
  organizationId?: string | null,
): Promise<CatalogCategory> {
  const res = await apiFetch(`${API_BASE_URL}/catalog/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
    body: JSON.stringify(input),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogCategory>(data, "category", "catalogCategory");
}

export async function listCatalogProducts(token: string, organizationId?: string | null): Promise<CatalogProduct[]> {
  const res = await apiFetch(`${API_BASE_URL}/catalog/products`, { headers: catalogHeaders(token, organizationId) });
  const data = await handle<unknown>(res);
  return unwrap<CatalogProduct>(data, "products");
}

export async function createCatalogProduct(
  token: string,
  input: {
    name: string;
    slug: string;
    catalogCategoryId: string;
    description?: string;
    imageUrl?: string;
    priceInCents?: number;
    pricingRule?: CatalogProductPricingRule;
    supportsHalfAndHalf?: boolean;
    canBeUsedAsFlavor?: boolean;
    halfAndHalfFlavorCategoryId?: string | null;
    sortOrder?: number;
    active?: boolean;
  },
  organizationId?: string | null,
): Promise<CatalogProduct> {
  // Backend V2 expects `categoryId` (not `catalogCategoryId`).
  const body: Record<string, unknown> = {
    categoryId: input.catalogCategoryId,
    name: input.name,
    slug: input.slug,
  };
  if (input.description) body.description = input.description;
  if (input.imageUrl) body.imageUrl = input.imageUrl;
  if (typeof input.priceInCents === "number") body.priceInCents = input.priceInCents;
  if (typeof input.pricingRule === "string") body.pricingRule = input.pricingRule;
  if (typeof input.supportsHalfAndHalf === "boolean") {
    body.supportsHalfAndHalf = input.supportsHalfAndHalf;
  }
  if (typeof input.canBeUsedAsFlavor === "boolean") {
    body.canBeUsedAsFlavor = input.canBeUsedAsFlavor;
  }
  if (input.halfAndHalfFlavorCategoryId !== undefined) {
    body.halfAndHalfFlavorCategoryId = input.halfAndHalfFlavorCategoryId;
  }
  if (typeof input.sortOrder === "number") body.sortOrder = input.sortOrder;
  if (typeof input.active === "boolean") body.active = input.active;
  const res = await apiFetch(`${API_BASE_URL}/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
    body: JSON.stringify(body),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProduct>(data, "product", "catalogProduct");
}

/* ---------------- Event catalog products ---------------- */

export async function listEventCatalogProducts(
  token: string,
  eventId: string,
): Promise<EventCatalogProduct[]> {
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/catalog-products`,
    { headers: authHeaders(token) },
  );
  const data = await handle<unknown>(res);
  // Backend V2 returns { eventProducts: [...] }
  const list = unwrap<EventCatalogProduct>(data, "eventProducts");
  if (list.length > 0) return list;
  return unwrap<EventCatalogProduct>(data, "products");
}

export interface ListAvailableParams {
  search?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export async function listAvailableCatalogProducts(
  token: string,
  eventId: string,
  params: ListAvailableParams = {},
): Promise<AvailableCatalogProduct[]> {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", params.search);
  if (params.categoryId && params.categoryId !== "ALL") qs.set("categoryId", params.categoryId);
  if (typeof params.page === "number") qs.set("page", String(params.page));
  if (typeof params.limit === "number") qs.set("limit", String(params.limit));
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/catalog-products/available${query}`,
    { headers: authHeaders(token) },
  );
  const data = await handle<unknown>(res);
  const list = unwrap<AvailableCatalogProduct>(data, "products");
  if (list.length > 0) return list;
  return unwrap<AvailableCatalogProduct>(data, "catalogProducts");
}

export interface BulkLinkInput {
  catalogProductId: string;
  priceInCents: number | null;
  active?: boolean;
  trackStock?: boolean;
  stockQuantity?: number | null;
}

export interface BulkLinkResult {
  created: EventCatalogProduct[];
  createdCount: number;
  skippedCount: number;
  skipped?: Array<{ catalogProductId: string; reason?: string }>;
}

export async function bulkLinkEventCatalogProducts(
  token: string,
  eventId: string,
  products: BulkLinkInput[],
): Promise<BulkLinkResult> {
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/catalog-products/bulk`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({ products }),
    },
  );
  const data = await handle<unknown>(res);
  const obj = (data ?? {}) as Record<string, unknown>;
  const created =
    (Array.isArray(obj.created) && (obj.created as EventCatalogProduct[])) ||
    (Array.isArray(obj.eventProducts) && (obj.eventProducts as EventCatalogProduct[])) ||
    [];
  const skipped = Array.isArray(obj.skipped)
    ? (obj.skipped as Array<{ catalogProductId: string; reason?: string }>)
    : [];
  return {
    created,
    createdCount: typeof obj.createdCount === "number" ? obj.createdCount : created.length,
    skippedCount: typeof obj.skippedCount === "number" ? obj.skippedCount : skipped.length,
    skipped,
  };
}

export async function addEventCatalogProduct(
  token: string,
  eventId: string,
  input: {
    catalogProductId: string;
    /** null = usar preço do catálogo; número em centavos = preço específico do evento */
    priceInCents: number | null;
    active?: boolean;
    trackStock?: boolean;
    stockQuantity?: number;
  },
): Promise<EventCatalogProduct> {
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/catalog-products`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<EventCatalogProduct>(data, "eventProduct", "product");
}

export async function updateEventCatalogProduct(
  token: string,
  eventId: string,
  eventProductId: string,
  patch: Partial<{
    /** null = usar preço do catálogo; número em centavos = preço específico do evento */
    priceInCents: number | null;
    active: boolean;
    trackStock: boolean;
    stockQuantity: number;
    soldOut: boolean;
  }>,
): Promise<EventCatalogProduct> {
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/catalog-products/${encodeURIComponent(eventProductId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(patch),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<EventCatalogProduct>(data, "eventProduct", "product");
}

export async function deleteEventCatalogProduct(
  token: string,
  eventId: string,
  eventProductId: string,
): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/catalog-products/${encodeURIComponent(eventProductId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (!res.ok) throw await fromResponse(res);
}

/* ---------------- Global catalog mutations ---------------- */

export async function updateCatalogCategory(
  token: string,
  id: string,
  patch: Partial<{ name: string; slug: string; description: string; active: boolean; sector: CategorySector }>,
  organizationId?: string | null,
): Promise<CatalogCategory> {
  const res = await apiFetch(`${API_BASE_URL}/catalog/categories/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
    body: JSON.stringify(patch),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogCategory>(data, "category", "catalogCategory");
}

export async function deleteCatalogCategory(token: string, id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/catalog/categories/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
}

export async function updateCatalogProduct(
  token: string,
  id: string,
  patch: Partial<{
    name: string;
    slug: string;
    description: string;
    imageUrl: string;
    categoryId: string;
    active: boolean;
    priceInCents: number;
    pricingRule: CatalogProductPricingRule;
    supportsHalfAndHalf: boolean;
    canBeUsedAsFlavor: boolean;
    halfAndHalfFlavorCategoryId: string | null;
    sortOrder: number;
  }>,
  organizationId?: string | null,
): Promise<CatalogProduct> {
  const res = await apiFetch(`${API_BASE_URL}/catalog/products/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
    body: JSON.stringify(patch),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProduct>(data, "product", "catalogProduct");
}

export async function deleteCatalogProduct(token: string, id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/catalog/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
}

/* ---------------- Catalog product option groups & options ---------------- */

export interface CatalogProductOption {
  id: string;
  optionGroupId?: string;
  name: string;
  key?: string;
  description?: string | null;
  priceDeltaInCents: number;
  linkedProductId?: string | null;
  active?: boolean;
  sortOrder?: number;
  [k: string]: unknown;
}

export interface CatalogProductOptionGroup {
  id: string;
  productId?: string;
  name: string;
  key?: string;
  description?: string | null;
  required?: boolean;
  minSelections?: number;
  maxSelections?: number;
  active?: boolean;
  sortOrder?: number;
  options?: CatalogProductOption[];
  [k: string]: unknown;
}

export interface CreateOptionGroupInput {
  name: string;
  key: string;
  description?: string | null;
  required?: boolean;
  minSelections?: number;
  maxSelections?: number;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateOptionGroupInput {
  name?: string;
  key?: string;
  description?: string | null;
  required?: boolean;
  minSelections?: number;
  maxSelections?: number;
  sortOrder?: number;
}

export interface CreateOptionInput {
  name: string;
  key: string;
  description?: string | null;
  priceDeltaInCents: number;
  linkedProductId?: string | null;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateOptionInput {
  name?: string;
  key?: string;
  description?: string | null;
  priceDeltaInCents?: number;
  linkedProductId?: string | null;
  sortOrder?: number;
}

export async function listCatalogProductOptionGroups(
  token: string,
  productId: string,
  organizationId?: string | null,
): Promise<CatalogProductOptionGroup[]> {
  const res = await apiFetch(
    `${API_BASE_URL}/catalog/products/${encodeURIComponent(productId)}/option-groups`,
    { headers: catalogHeaders(token, organizationId) },
  );
  const data = await handle<unknown>(res);
  const list = unwrap<CatalogProductOptionGroup>(data, "optionGroups");
  if (list.length > 0) return list;
  return unwrap<CatalogProductOptionGroup>(data, "groups");
}

export async function createCatalogProductOptionGroup(
  token: string,
  productId: string,
  input: CreateOptionGroupInput,
  organizationId?: string | null,
): Promise<CatalogProductOptionGroup> {
  const res = await apiFetch(
    `${API_BASE_URL}/catalog/products/${encodeURIComponent(productId)}/option-groups`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProductOptionGroup>(data, "optionGroup", "group");
}

export async function updateCatalogOptionGroup(
  token: string,
  groupId: string,
  patch: UpdateOptionGroupInput,
  organizationId?: string | null,
): Promise<CatalogProductOptionGroup> {
  const res = await apiFetch(
    `${API_BASE_URL}/catalog/option-groups/${encodeURIComponent(groupId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
      body: JSON.stringify(patch),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProductOptionGroup>(data, "optionGroup", "group");
}

export async function setCatalogOptionGroupStatus(
  token: string,
  groupId: string,
  active: boolean,
  organizationId?: string | null,
): Promise<CatalogProductOptionGroup> {
  const res = await apiFetch(
    `${API_BASE_URL}/catalog/option-groups/${encodeURIComponent(groupId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
      body: JSON.stringify({ active }),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProductOptionGroup>(data, "optionGroup", "group");
}

export async function createCatalogOption(
  token: string,
  groupId: string,
  input: CreateOptionInput,
  organizationId?: string | null,
): Promise<CatalogProductOption> {
  const res = await apiFetch(
    `${API_BASE_URL}/catalog/option-groups/${encodeURIComponent(groupId)}/options`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProductOption>(data, "option");
}

export async function updateCatalogOption(
  token: string,
  optionId: string,
  patch: UpdateOptionInput,
  organizationId?: string | null,
): Promise<CatalogProductOption> {
  const res = await apiFetch(
    `${API_BASE_URL}/catalog/options/${encodeURIComponent(optionId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
      body: JSON.stringify(patch),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProductOption>(data, "option");
}

export async function setCatalogOptionStatus(
  token: string,
  optionId: string,
  active: boolean,
  organizationId?: string | null,
): Promise<CatalogProductOption> {
  const res = await apiFetch(
    `${API_BASE_URL}/catalog/options/${encodeURIComponent(optionId)}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...catalogHeaders(token, organizationId) },
      body: JSON.stringify({ active }),
    },
  );
  const data = await handle<unknown>(res);
  return unwrapOne<CatalogProductOption>(data, "option");
}
