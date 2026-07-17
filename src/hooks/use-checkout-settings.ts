import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useOrgId } from "@/hooks/use-org-id";
import {
  getCheckoutSettings,
  updateCheckoutSettings,
  type CheckoutSettings,
} from "@/lib/checkout-settings-api";

const key = (orgId: string | null, storeId: string) =>
  ["checkout-settings", orgId, storeId] as const;

export function useCheckoutSettings(storeId: string) {
  const { token } = useAuth();
  const orgId = useOrgId();
  return useQuery({
    queryKey: key(orgId, storeId),
    queryFn: () => getCheckoutSettings(token!, storeId),
    enabled: !!token && !!storeId,
    staleTime: 30_000,
  });
}

export function useUpdateCheckoutSettings(storeId: string) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CheckoutSettings) =>
      updateCheckoutSettings(token!, storeId, body),
    onSuccess: (data) => {
      qc.setQueryData(key(orgId, storeId), data);
    },
  });
}
