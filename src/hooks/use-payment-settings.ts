import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import {
  createPaymentTerminal,
  getEffectivePaymentSettings,
  getOrganizationPaymentSettings,
  listPaymentTerminals,
  updateEventPaymentSettings,
  updateOnlineStorePaymentSettings,
  updateOrganizationPaymentSettings,
  updatePaymentProviderCredentials,
  type ContextPaymentSettingsInput,
  type CreatePaymentTerminalInput,
  type PaymentContextType,
  type PaymentProvider,
  type UpdateOrganizationPaymentSettingsInput,
  type UpdateProviderCredentialsInput,
} from "@/lib/payment-settings-api";

export function useOrganizationPaymentSettings() {
  const { token } = useAuth();
  const orgId = useOrgId();

  return useQuery({
    queryKey: qk.settings.payment(orgId),
    queryFn: () => getOrganizationPaymentSettings(token!),
    enabled: !!token && !!orgId,
  });
}

export function useUpdateOrganizationPaymentSettings() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateOrganizationPaymentSettingsInput) =>
      updateOrganizationPaymentSettings(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.payment(orgId) });
      queryClient.invalidateQueries({ queryKey: ["settings", orgId, "payment-effective"] });
    },
  });
}

export function useUpdatePaymentProviderCredentials() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      provider,
      input,
    }: {
      provider: PaymentProvider;
      input: UpdateProviderCredentialsInput;
    }) => updatePaymentProviderCredentials(token!, provider, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.payment(orgId) });
      queryClient.invalidateQueries({ queryKey: ["settings", orgId, "payment-effective"] });
    },
  });
}

export function usePaymentTerminals() {
  const { token } = useAuth();
  const orgId = useOrgId();

  return useQuery({
    queryKey: qk.settings.paymentTerminals(orgId),
    queryFn: () => listPaymentTerminals(token!),
    enabled: !!token && !!orgId,
  });
}

export function useCreatePaymentTerminal() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentTerminalInput) => createPaymentTerminal(token!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.paymentTerminals(orgId) });
    },
  });
}

export function useEffectivePaymentSettings(params?: {
  contextType?: PaymentContextType;
  eventId?: string | null;
  onlineStoreId?: string | null;
}) {
  const { token } = useAuth();
  const orgId = useOrgId();

  return useQuery({
    queryKey: qk.settings.paymentEffective(orgId, params),
    queryFn: () => getEffectivePaymentSettings(token!, params),
    enabled: !!token && !!orgId,
  });
}

export function useUpdateEventPaymentSettings(eventId: string | null) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContextPaymentSettingsInput) =>
      updateEventPaymentSettings(token!, eventId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.payment(orgId) });
      queryClient.invalidateQueries({ queryKey: ["settings", orgId, "payment-effective"] });
    },
  });
}

export function useUpdateOnlineStorePaymentSettings(storeId: string | null) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ContextPaymentSettingsInput) =>
      updateOnlineStorePaymentSettings(token!, storeId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.settings.payment(orgId) });
      queryClient.invalidateQueries({ queryKey: ["settings", orgId, "payment-effective"] });
    },
  });
}
