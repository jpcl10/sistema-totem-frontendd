import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useOrgId } from "@/hooks/use-org-id";
import {
  getCatalogSettings,
  updateCatalogSettings,
  type CatalogSettings,
} from "@/lib/catalog-settings-api";

const key = (orgId: string | null, storeId: string) =>
  ["catalog-settings", orgId, storeId] as const;

export function useCatalogSettings(storeId: string) {
  const { token } = useAuth();
  const orgId = useOrgId();
  return useQuery({
    queryKey: key(orgId, storeId),
    queryFn: () => getCatalogSettings(token!, storeId),
    enabled: !!token && !!storeId,
    staleTime: 30_000,
  });
}

export function useUpdateCatalogSettings(storeId: string) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CatalogSettings) =>
      updateCatalogSettings(token!, storeId, body),
    onSuccess: (data) => {
      qc.setQueryData(key(orgId, storeId), data);
    },
  });
}
