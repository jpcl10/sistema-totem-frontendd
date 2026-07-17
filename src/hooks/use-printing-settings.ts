import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPrintingSettings,
  updatePrintingSettings,
  type UpdatePrintingSettingsBody,
} from "@/lib/settings-api";
import { listDevices } from "@/lib/devices-api";
import { qk } from "@/lib/query-keys";
import { useAuth } from "@/lib/auth-context";
import { useOrgId } from "@/hooks/use-org-id";

/**
 * Fase 2D — Impressão.
 * Fonte de verdade: OrganizationPrintingSettings via /settings/printing.
 */
export function usePrintingSettings() {
  const { token } = useAuth();
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.settings.printing(orgId),
    queryFn: () => getPrintingSettings(token!),
    enabled: !!token && !!orgId,
    staleTime: 30_000,
  });
}

export function useUpdatePrintingSettings() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdatePrintingSettingsBody) => updatePrintingSettings(token!, body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.settings.printing(orgId) }),
        qc.invalidateQueries({ queryKey: qk.settings.root(orgId) }),
        qc.invalidateQueries({ queryKey: qk.settings.effective(orgId) }),
      ]);
    },
  });
}

/**
 * Lista de dispositivos filtrada em PRINTER, usada para vincular impressoras
 * à organização / sources / sectors.
 */
export function usePrinterDevices() {
  const { token } = useAuth();
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.devices.list(orgId, { type: "PRINTER+SK210" }),
    queryFn: async () => {
      const all = await listDevices(token!);
      return all.filter((d) => d.type === "PRINTER" || d.type === "SK210");
    },
    enabled: !!token && !!orgId,
    staleTime: 30_000,
  });
}
