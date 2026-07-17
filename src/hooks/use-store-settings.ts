import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getOnlineOrdersSettings,
  updateOnlineOrdersSettings,
  getDeliverySettings,
  updateDeliverySettings,
  listDeliveryFeeRules,
  createDeliveryFeeRule,
  updateDeliveryFeeRule,
  deleteDeliveryFeeRule,
  type UpdateOnlineOrdersSettingsBody,
  type UpdateDeliverySettingsBody,
  type CreateDeliveryFeeRuleBody,
  type UpdateDeliveryFeeRuleBody,
} from "@/lib/settings-api";
import { qk } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { useOrgId } from "@/hooks/use-org-id";

/**
 * TanStack Query hooks for the Loja Online / Delivery admin surfaces.
 * All keys are scoped by orgId + storeId (storeId is never orgId).
 * Contracts source: docs/api/settings-phase2-contracts.md.
 */

export function useOnlineOrdersSettings(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.settings.onlineOrders(orgId, storeId ?? null),
    queryFn: () => getOnlineOrdersSettings(token!, storeId!),
    enabled: !!token && !!orgId && !!storeId,
    staleTime: 30_000,
  });
}

export function useUpdateOnlineOrdersSettings(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateOnlineOrdersSettingsBody) =>
      updateOnlineOrdersSettings(token!, storeId!, body),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.settings.onlineOrders(orgId, storeId ?? null),
      });
      qc.invalidateQueries({
        queryKey: qk.settings.delivery(orgId, storeId ?? null),
      });
    },
  });
}

export function useDeliverySettings(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.settings.delivery(orgId, storeId ?? null),
    queryFn: () => getDeliverySettings(token!, storeId!),
    enabled: !!token && !!orgId && !!storeId,
    staleTime: 30_000,
  });
}

export function useUpdateDeliverySettings(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateDeliverySettingsBody) =>
      updateDeliverySettings(token!, storeId!, body),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.settings.delivery(orgId, storeId ?? null),
      });
      qc.invalidateQueries({
        queryKey: qk.settings.onlineOrders(orgId, storeId ?? null),
      });
    },
  });
}

export function useDeliveryFeeRules(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.settings.deliveryRules(orgId, storeId ?? null),
    queryFn: () => listDeliveryFeeRules(token!, storeId!),
    enabled: !!token && !!orgId && !!storeId,
    staleTime: 30_000,
  });
}

export function useCreateDeliveryFeeRule(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Omit<CreateDeliveryFeeRuleBody, "storeId">) =>
      createDeliveryFeeRule(token!, { ...body, storeId: storeId! }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.settings.deliveryRules(orgId, storeId ?? null),
      });
    },
  });
}

export function useUpdateDeliveryFeeRule(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ruleId: string; body: UpdateDeliveryFeeRuleBody }) =>
      updateDeliveryFeeRule(token!, input.ruleId, input.body),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.settings.deliveryRules(orgId, storeId ?? null),
      });
    },
  });
}

export function useDeleteDeliveryFeeRule(storeId: string | null | undefined) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => deleteDeliveryFeeRule(token!, ruleId),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: qk.settings.deliveryRules(orgId, storeId ?? null),
      });
    },
  });
}
