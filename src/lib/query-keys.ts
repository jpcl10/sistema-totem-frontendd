/**
 * Centralized, typed query-key factory.
 *
 * Convention: `[domain, organizationId, ...args]`. Public/platform-scoped
 * keys omit `organizationId` (e.g. `superAdmin.*`, `publicStore.*`).
 *
 * Always use these factories — never inline array literals — so
 * invalidation targets stay consistent.
 *
 *   queryClient.invalidateQueries({ queryKey: qk.customers.all(orgId) })
 *   useQuery({ queryKey: qk.orders.list(orgId, eventId, filters), ... })
 */

type OrgId = string | null | undefined;

export const qk = {
  organization: {
    all: () => ["organization"] as const,
    detail: (orgId: OrgId) => ["organization", orgId] as const,
  },

  customers: {
    all: (orgId: OrgId) => ["customers", orgId] as const,
    list: (orgId: OrgId, filters?: unknown) =>
      ["customers", orgId, "list", filters ?? null] as const,
    detail: (orgId: OrgId, id: string) =>
      ["customers", orgId, "detail", id] as const,
    addresses: (orgId: OrgId, id: string) =>
      ["customers", orgId, "detail", id, "addresses"] as const,
    interests: (orgId: OrgId, id: string) =>
      ["customers", orgId, "detail", id, "interests"] as const,
    summary: (orgId: OrgId, id: string) =>
      ["customers", orgId, "detail", id, "summary"] as const,
  },

  interests: {
    all: (orgId: OrgId) => ["interests", orgId] as const,
  },

  catalog: {
    all: (orgId: OrgId) => ["catalog", orgId] as const,
    products: (orgId: OrgId) => ["catalog-products", orgId] as const,
    productDetail: (orgId: OrgId, productId: string) =>
      ["catalog-products", orgId, productId] as const,
    productOptionGroups: (orgId: OrgId, productId: string) =>
      ["catalog-products", orgId, productId, "option-groups"] as const,
    categories: (orgId: OrgId) => ["catalog-categories", orgId] as const,
  },

  orders: {
    all: (orgId: OrgId) => ["orders", orgId] as const,
    list: (orgId: OrgId, eventId?: string | null, filters?: unknown) =>
      ["orders", orgId, "list", eventId ?? null, filters ?? null] as const,
    detail: (orgId: OrgId, orderId: string) =>
      ["orders", orgId, "detail", orderId] as const,
    unified: (orgId: OrgId, filters?: unknown) =>
      ["orders", orgId, "unified", filters ?? null] as const,
  },

  onlineOrders: {
    all: (orgId: OrgId) => ["online-orders", orgId] as const,
    list: (orgId: OrgId, storeId?: string | null) =>
      ["online-orders", orgId, "list", storeId ?? null] as const,
    dashboard: (orgId: OrgId) =>
      ["online-orders", orgId, "dashboard"] as const,
    stores: (orgId: OrgId) => ["online-stores", orgId] as const,
    store: (orgId: OrgId, storeId: string) =>
      ["online-stores", orgId, storeId] as const,
    availability: (orgId: OrgId, storeId: string | null | undefined) =>
      ["online-stores", orgId, storeId ?? null, "availability"] as const,
  },

  events: {
    all: (orgId: OrgId) => ["events", orgId] as const,
    list: (orgId: OrgId) => ["events", orgId, "list"] as const,
    detail: (orgId: OrgId, eventId: string) =>
      ["events", orgId, "detail", eventId] as const,
  },

  financeiro: {
    all: (orgId: OrgId) => ["financeiro", orgId] as const,
    byEvent: (orgId: OrgId, eventId: string) =>
      ["financeiro", orgId, "event", eventId] as const,
  },

  devices: {
    all: (orgId: OrgId) => ["devices", orgId] as const,
    list: (orgId: OrgId, filters?: unknown) =>
      ["devices", orgId, "list", filters ?? null] as const,
    detail: (orgId: OrgId, deviceId: string) =>
      ["devices", orgId, "detail", deviceId] as const,
  },

  nfcCards: {
    all: (orgId: OrgId) => ["nfc-cards", orgId] as const,
    list: (orgId: OrgId, eventId?: string | null, filters?: unknown) =>
      ["nfc-cards", orgId, "list", eventId ?? null, filters ?? null] as const,
    detail: (orgId: OrgId, cardId: string) =>
      ["nfc-cards", orgId, "detail", cardId] as const,
  },

  printQueue: {
    all: (orgId: OrgId) => ["print-queue", orgId] as const,
    list: (orgId: OrgId, filters?: unknown) =>
      ["print-queue", orgId, "list", filters ?? null] as const,
  },

  printers: {
    all: (orgId: OrgId) => ["printers", orgId] as const,
  },

  activities: {
    all: (orgId: OrgId) => ["activities", orgId] as const,
    list: (orgId: OrgId, filters?: unknown) =>
      ["activities", orgId, "list", filters ?? null] as const,
  },

  callScreen: {
    bootstrap: (type: "STORE" | "EVENT", slug: string) =>
      ["call-screen", type, slug, "bootstrap"] as const,
    orders: (type: "STORE" | "EVENT", slug: string) =>
      ["call-screen", type, slug, "orders"] as const,
  },

  publicLinks: {
    all: (orgId: OrgId) => ["public-links", orgId] as const,
    list: (orgId: OrgId) => ["public-links", orgId, "list"] as const,
    events: (orgId: OrgId) => ["public-links-events", orgId] as const,
  },

  settings: {
    all: (orgId: OrgId) => ["settings", orgId] as const,
    root: (orgId: OrgId) => ["settings", orgId, "root"] as const,
    general: (orgId: OrgId) => ["settings", orgId, "general"] as const,
    branding: (orgId: OrgId) => ["settings", orgId, "branding"] as const,
    businessHours: (
      orgId: OrgId,
      filters?: {
        contextType?: string | null;
        context?: string | null;
        contextId?: string | null;
        storeId?: string | null;
        channel?: string | null;
      } | null,
    ) =>
      [
        "settings",
        orgId,
        "business-hours",
        filters?.contextType ?? filters?.context ?? null,
        filters?.contextId ?? filters?.storeId ?? null,
        filters?.channel ?? null,
      ] as const,
    effective: (
      orgId: OrgId,
      filters?: {
        contextType?: string | null;
        context?: string | null;
        contextId?: string | null;
        storeId?: string | null;
        channel?: string | null;
      } | null,
    ) =>
      [
        "settings",
        orgId,
        "effective",
        filters?.contextType ?? filters?.context ?? null,
        filters?.contextId ?? filters?.storeId ?? null,
        filters?.channel ?? null,
      ] as const,
    payment: (orgId: OrgId) => ["settings", orgId, "payment"] as const,
    paymentEffective: (
      orgId: OrgId,
      filters?: {
        contextType?: string | null;
        eventId?: string | null;
        onlineStoreId?: string | null;
      } | null,
    ) =>
      [
        "settings",
        orgId,
        "payment-effective",
        filters?.contextType ?? null,
        filters?.eventId ?? null,
        filters?.onlineStoreId ?? null,
      ] as const,
    paymentTerminals: (orgId: OrgId) =>
      ["settings", orgId, "payment-terminals"] as const,
    paymentReferences: (orgId: OrgId) =>
      ["settings", orgId, "payment-references"] as const,
    printing: (orgId: OrgId) => ["settings", orgId, "printing"] as const,
    onlineOrders: (orgId: OrgId, storeId: string | null | undefined) =>
      ["settings", orgId, "online-orders", storeId ?? null] as const,
    delivery: (orgId: OrgId, storeId: string | null | undefined) =>
      ["settings", orgId, "delivery", storeId ?? null] as const,
    deliveryRules: (orgId: OrgId, storeId: string | null | undefined) =>
      ["settings", orgId, "delivery-rules", storeId ?? null] as const,
  },


  dashboard: {
    all: (orgId: OrgId) => ["dashboard", orgId] as const,
  },

  // Platform-scoped (no organizationId).
  superAdmin: {
    organizations: () => ["super-admin", "organizations"] as const,
    users: () => ["super-admin", "users"] as const,
    modules: () => ["super-admin", "modules"] as const,
    plans: () => ["super-admin", "plans"] as const,
  },

  // Public storefront (no organizationId; scoped by slug).
  publicStore: {
    bySlug: (slug: string) => ["public-store", slug] as const,
    customerLookup: (slug: string, phone: string) =>
      ["public-store", slug, "customer-lookup", phone] as const,
  },

} as const;

export type QueryKeyFactory = typeof qk;
