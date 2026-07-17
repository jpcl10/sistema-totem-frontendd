// Global reaction to tenant/platform context errors returned by the API.
//
// Codes handled:
//   TENANT_CONTEXT_REQUIRED   → super-admin missing/invalid impersonation
//   TENANT_NOT_FOUND          → impersonated org doesn't exist
//   TENANT_ACCESS_DENIED      → caller has no access to this tenant
//   PLATFORM_CONTEXT_REQUIRED → global call unexpectedly carried x-organization-id
//   SUPER_ADMIN_REQUIRED      → platform route hit without super-admin role
//
// Anti-loop: each redirect is guarded by a one-shot flag so consecutive
// failing requests can't ping-pong the router. Reset on next successful
// user navigation via `resetContextErrorGuard()`.

import { toast } from "sonner";
import { clearSelectedOrg, getImpersonation } from "@/lib/org-context";
import { disconnectSocket } from "@/lib/socket";

let redirecting = false;

export function resetContextErrorGuard() {
  redirecting = false;
}

function getRole(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return "";
    return ((JSON.parse(raw) as { role?: string }).role || "").toUpperCase();
  } catch {
    return "";
  }
}

function getQueryClient(): { clear: () => void } | null {
  if (typeof window === "undefined") return null;
  const qc = (window as unknown as { __queryClient?: { clear: () => void } }).__queryClient;
  return qc ?? null;
}

function goTo(path: string) {
  if (typeof window === "undefined") return;
  if (window.location.pathname === path) return;
  window.location.assign(path);
}

/**
 * React to a context error. Returns true if the error was handled.
 * Safe to call from anywhere; guarded against re-entry.
 */
export function reactToContextError(code: string, message: string): boolean {
  if (redirecting) return true;
  const role = getRole();
  const isSuper = role === "SUPER_ADMIN";
  const hadImpersonation = !!getImpersonation();

  switch (code) {
    case "TENANT_CONTEXT_REQUIRED": {
      if (!isSuper) return false;
      redirecting = true;
      clearSelectedOrg();
      disconnectSocket();
      getQueryClient()?.clear();
      toast.error(message);
      goTo("/super-admin/organizations");
      return true;
    }
    case "TENANT_NOT_FOUND": {
      if (!isSuper) {
        toast.error(message);
        return true;
      }
      redirecting = true;
      clearSelectedOrg();
      disconnectSocket();
      getQueryClient()?.clear();
      toast.error(message);
      goTo("/super-admin/organizations");
      return true;
    }
    case "TENANT_ACCESS_DENIED": {
      if (!isSuper) {
        // ADMIN/OPERATOR — just surface the error, keep the session intact.
        toast.error(message);
        return true;
      }
      redirecting = true;
      if (hadImpersonation) clearSelectedOrg();
      disconnectSocket();
      getQueryClient()?.clear();
      toast.error(message);
      goTo("/super-admin/organizations");
      return true;
    }
    case "PLATFORM_CONTEXT_REQUIRED": {
      // Do NOT auto-retry. The caller sent x-organization-id on a platform
      // endpoint; just surface the error.
      toast.error(message);
      return true;
    }
    case "SUPER_ADMIN_REQUIRED": {
      toast.error(message);
      return true;
    }
    default:
      return false;
  }
}
