import { handleApiError, ApiError } from "@/lib/api-error";
import type { CatalogProduct, CategorySector } from "@/lib/catalog-api";

export function describeError(e: unknown, fallback: string): string {
  if (e instanceof ApiError && e.raw) {
    const raw = e.raw.length > 240 ? `${e.raw.slice(0, 240)}…` : e.raw;
    return `${e.message} (${raw})`;
  }
  return handleApiError(e, fallback, { silent: true });
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export type ProductCounts = { groups: number; options: number };

export function getProductCounts(product: CatalogProduct): ProductCounts {
  const groups = (product as { optionGroups?: unknown }).optionGroups;
  if (!Array.isArray(groups)) return { groups: 0, options: 0 };
  const opts = groups.reduce((acc: number, g: unknown) => {
    const arr = (g as { options?: unknown }).options;
    return acc + (Array.isArray(arr) ? arr.length : 0);
  }, 0);
  return { groups: groups.length, options: opts };
}

export const SECTOR_BADGE: Record<CategorySector, string> = {
  BAR: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  KITCHEN: "border-sky-500/40 bg-sky-500/10 text-sky-600",
};
