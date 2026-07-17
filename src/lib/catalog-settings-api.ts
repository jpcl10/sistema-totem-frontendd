/**
 * Catalog Online Settings — Fase 2B
 *
 * O backend GET/PATCH /settings/catalog ainda não foi contratado.
 * Este módulo define o DTO provisório e um adapter mockado por storeId
 * persistido em localStorage. Quando o backend estiver pronto, basta
 * substituir `mockGet` / `mockPatch` pelas chamadas reais mantendo a
 * mesma forma de dados.
 */

export type CatalogLayoutMode = "LIST" | "GRID" | "COMPACT";
export type ProductSortMode = "MANUAL" | "NAME" | "BEST_SELLING" | "RECENT";
export type CategorySortMode = "MANUAL" | "NAME";

export interface CatalogDisplaySettings {
  showEmptyCategories: boolean;
  showProductDescription: boolean;
  showProductImages: boolean;
  showUnavailableProducts: boolean;
  showPrices: boolean;
  showStock: boolean;
  showAddons: boolean;
  showCombos: boolean;
  promosFirst: boolean;
  showPreparationTime: boolean;
}

export interface CatalogCategorySettings {
  horizontalScroll: boolean;
  stickyCategories: boolean;
  showProductCount: boolean;
  collapsedByDefault: boolean;
  enableSearch: boolean;
  searchPlaceholder: string;
}

export interface CatalogProductSettings {
  maxProductsPerSection: number;
  highlightRecommended: boolean;
  highlightNew: boolean;
  highlightPromos: boolean;
  defaultProductImageUrl: string | null;
  lazyLoadImages: boolean;
  showUnavailableBadge: boolean;
}

export interface CatalogHighlightSettings {
  featuredProductId: string | null;
  featuredCategoryId: string | null;
  bannerActive: boolean;
  headerMessage: string;
  footerMessage: string;
}

export interface CatalogSettings {
  layout: CatalogLayoutMode;
  productSort: ProductSortMode;
  categorySort: CategorySortMode;
  display: CatalogDisplaySettings;
  category: CatalogCategorySettings;
  product: CatalogProductSettings;
  highlight: CatalogHighlightSettings;
}

export const defaultCatalogSettings: CatalogSettings = {
  layout: "GRID",
  productSort: "MANUAL",
  categorySort: "MANUAL",
  display: {
    showEmptyCategories: false,
    showProductDescription: true,
    showProductImages: true,
    showUnavailableProducts: true,
    showPrices: true,
    showStock: false,
    showAddons: true,
    showCombos: true,
    promosFirst: false,
    showPreparationTime: false,
  },
  category: {
    horizontalScroll: true,
    stickyCategories: true,
    showProductCount: false,
    collapsedByDefault: false,
    enableSearch: true,
    searchPlaceholder: "Buscar produtos...",
  },
  product: {
    maxProductsPerSection: 20,
    highlightRecommended: true,
    highlightNew: true,
    highlightPromos: true,
    defaultProductImageUrl: null,
    lazyLoadImages: true,
    showUnavailableBadge: true,
  },
  highlight: {
    featuredProductId: null,
    featuredCategoryId: null,
    bannerActive: false,
    headerMessage: "",
    footerMessage: "",
  },
};

const STORAGE_KEY = "defumar:catalog-settings";

function readAll(): Record<string, CatalogSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CatalogSettings>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, CatalogSettings>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

const UPDATED_AT_KEY = "defumar:catalog-settings:updatedAt";

function readUpdatedAt(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(UPDATED_AT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeUpdatedAt(map: Record<string, string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UPDATED_AT_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Mock GET /settings/catalog?storeId=... */
export async function getCatalogSettings(
  _token: string,
  storeId: string,
): Promise<{ settings: CatalogSettings; updatedAt: string | null }> {
  await new Promise((r) => setTimeout(r, 120));
  const all = readAll();
  const updated = readUpdatedAt();
  return {
    settings: all[storeId] ?? defaultCatalogSettings,
    updatedAt: updated[storeId] ?? null,
  };
}

/** Mock PATCH /settings/catalog?storeId=... */
export async function updateCatalogSettings(
  _token: string,
  storeId: string,
  body: CatalogSettings,
): Promise<{ settings: CatalogSettings; updatedAt: string }> {
  await new Promise((r) => setTimeout(r, 180));
  const all = readAll();
  all[storeId] = body;
  writeAll(all);
  const now = new Date().toISOString();
  const updated = readUpdatedAt();
  updated[storeId] = now;
  writeUpdatedAt(updated);
  return { settings: body, updatedAt: now };
}

