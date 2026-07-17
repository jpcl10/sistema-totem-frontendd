import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useOrganization } from "@/contexts/organization-context";
import type { ModuleKey } from "./organization-modules";

/**
 * Client-side guard: if the current organization is loaded and does NOT
 * include the required module, redirect to /admin/dashboard.
 *
 * Non-blocking (does not throw during render) and safe while org is loading.
 */
export function useRequireModule(required: ModuleKey | ModuleKey[]) {
  const { organizationModules, loading, organizationId } = useOrganization();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !organizationId) return;
    const list = Array.isArray(required) ? required : [required];
    const ok = list.some((m) => organizationModules.includes(m));
    if (!ok) {
      toast.error("Módulo não disponível para esta organização.");
      navigate({ to: "/admin/dashboard", replace: true });
    }
  }, [loading, organizationId, organizationModules, required, navigate]);
}
