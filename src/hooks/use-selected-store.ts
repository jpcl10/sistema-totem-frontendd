import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { listOnlineStores, type OnlineStore } from "@/lib/online-store-api";
import { useAuth } from "@/lib/auth-context";
import { useOrgId } from "@/hooks/use-org-id";
import { qk } from "@/lib/query-keys";

export type StoreSelectionStatus =
  | "loading"
  | "unauthenticated"
  | "empty"
  | "ready";

export interface UseSelectedStoreResult {
  status: StoreSelectionStatus;
  stores: OnlineStore[];
  storeId: string | null;
  selectedStore: OnlineStore | null;
  select: (storeId: string) => void;
  error: unknown;
}

/**
 * Resolves the operational storeId for Loja Online / Delivery settings.
 *
 * Rules (per Fase 2A plan):
 *  - storeId NEVER falls back to organizationId.
 *  - 1 loja  → auto-select and reflect on URL (`?storeId=...`).
 *  - N lojas → returns the list; caller renders <StoreSelector />.
 *  - 0 lojas → status = "empty"; caller renders <PageEmpty />.
 *  - Preserves storeId on URL for F5 / deep link.
 */
export function useSelectedStore(
  urlStoreId: string | null | undefined,
): UseSelectedStoreResult {
  const { token } = useAuth();
  const orgId = useOrgId();
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: qk.onlineOrders.stores(orgId),
    queryFn: () => listOnlineStores(token!),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  });

  const stores = q.data ?? [];

  const storeId = useMemo(() => {
    if (urlStoreId && stores.some((s) => s.id === urlStoreId)) return urlStoreId;
    if (stores.length === 1) return stores[0]!.id;
    return null;
  }, [urlStoreId, stores]);

  // Reflect auto-selection on the URL so F5 / share works.
  useEffect(() => {
    if (!storeId) return;
    if (urlStoreId === storeId) return;
    navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({ ...prev, storeId }),
      replace: true,
    });
  }, [storeId, urlStoreId, navigate]);

  const selectedStore = stores.find((s) => s.id === storeId) ?? null;

  let status: StoreSelectionStatus = "ready";
  if (!token) status = "unauthenticated";
  else if (q.isLoading) status = "loading";
  else if (stores.length === 0) status = "empty";

  return {
    status,
    stores,
    storeId,
    selectedStore,
    error: q.error,
    select: (id: string) => {
      navigate({
        to: ".",
        search: (prev: Record<string, unknown>) => ({ ...prev, storeId: id }),
      });
    },
  };
}
