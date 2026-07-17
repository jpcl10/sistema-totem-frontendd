import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  getSelectedOrg,
  setSelectedOrg,
  clearSelectedOrg,
  type SelectedOrg,
} from "@/lib/org-context";
import { fetchOrganization, type OrganizationDTO } from "@/lib/organization-api";
import { normalizeModules, type ModuleKey } from "@/lib/organization-modules";
import { disconnectSocket } from "@/lib/socket";
import { qk } from "@/lib/query-keys";

interface OrganizationContextValue {
  organization: OrganizationDTO | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  organizationModules: ModuleKey[];
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  loading: boolean;
  error: string | null;
  refreshOrganization: () => Promise<void>;
  switchOrganization: (org: SelectedOrg) => Promise<void>;
  exitImpersonation: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  const role = (user?.role || "").toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN";

  const [selected, setSelected] = useState<SelectedOrg | null>(() =>
    typeof window === "undefined" ? null : getSelectedOrg(),
  );

  // Keep local `selected` in sync with role changes / cross-tab writes.
  useEffect(() => {
    if (!isSuperAdmin) {
      setSelected(null);
      return;
    }
    setSelected(getSelectedOrg());
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("selectedOrganization")) {
        setSelected(getSelectedOrg());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [isSuperAdmin]);

  const impersonatedOrgId = isSuperAdmin ? selected?.id ?? null : null;
  const effectiveOrgId = impersonatedOrgId ?? user?.organizationId ?? null;

  const query = useQuery({
    queryKey: [...qk.organization.detail(effectiveOrgId), isSuperAdmin, !!impersonatedOrgId],
    enabled: !!token && !!effectiveOrgId,
    staleTime: 60_000,
    queryFn: () => fetchOrganization(token!, impersonatedOrgId),
  });

  const organization = query.data ?? null;
  const organizationModules = useMemo<ModuleKey[]>(
    () => normalizeModules(organization?.modules),
    [organization],
  );




  const refreshOrganization = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.organization.all() });
    await query.refetch();
  }, [queryClient, query]);

  const switchOrganization = useCallback(
    async (org: SelectedOrg) => {
      disconnectSocket();
      setSelectedOrg(org);
      setSelected(org);
      queryClient.clear();
      await router.invalidate();
    },
    [queryClient, router],
  );

  const exitImpersonation = useCallback(async () => {
    disconnectSocket();
    clearSelectedOrg();
    setSelected(null);
    queryClient.clear();
    await router.invalidate();
  }, [queryClient, router]);

  const value: OrganizationContextValue = {
    organization,
    organizationId: organization?.id ?? effectiveOrgId,
    organizationName: organization?.name ?? selected?.name ?? null,
    organizationSlug: organization?.slug ?? selected?.slug ?? null,
    organizationModules,
    isSuperAdmin,
    isImpersonating: isSuperAdmin && !!impersonatedOrgId,
    loading: query.isLoading || query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    refreshOrganization,
    switchOrganization,
    exitImpersonation,
  };

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
