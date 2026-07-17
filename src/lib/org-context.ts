// Impersonation session for SUPER_ADMIN.
// Persisted under `defumar.impersonation` (canonical) and mirrored to the
// legacy keys so existing callers keep working.

const IMPERSONATION_KEY = "defumar.impersonation";

// Legacy keys (kept in sync for back-compat with callers that read them).
// @deprecated Do not read `selectedOrganizationId` when `defumar.impersonation`
// exists. New code MUST use `getImpersonation()` or the `useOrgId()` hook.
// Remaining known consumers of the legacy key:
//   - src/lib/api-error.ts (withTenantHeader fallback) — read only if the
//     canonical session is missing.
//   - src/lib/org-context.ts (legacy fallback in getImpersonation).
// TODO: remove after full audit; keep mirror writes until then.
const ID_KEY = "selectedOrganizationId";
const NAME_KEY = "selectedOrganizationName";
const SLUG_KEY = "selectedOrganizationSlug";

export interface ImpersonationSession {
  organizationId: string;
  organizationName: string;
  organizationSlug?: string;
  startedAt: string;
}

export interface SelectedOrg {
  id: string;
  name?: string;
  slug?: string;
}

export function setSelectedOrg(org: SelectedOrg) {
  if (typeof window === "undefined") return;
  const session: ImpersonationSession = {
    organizationId: org.id,
    organizationName: org.name ?? "",
    organizationSlug: org.slug,
    startedAt: new Date().toISOString(),
  };
  localStorage.setItem(IMPERSONATION_KEY, JSON.stringify(session));

  // Legacy mirror.
  localStorage.setItem(ID_KEY, org.id);
  if (org.name) localStorage.setItem(NAME_KEY, org.name);
  else localStorage.removeItem(NAME_KEY);
  if (org.slug) localStorage.setItem(SLUG_KEY, org.slug);
  else localStorage.removeItem(SLUG_KEY);
  localStorage.setItem("selected_organization_id", org.id);
}

export function clearSelectedOrg() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(IMPERSONATION_KEY);
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(SLUG_KEY);
  localStorage.removeItem("selected_organization_id");
}

export function getImpersonation(): ImpersonationSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(IMPERSONATION_KEY);
  if (raw) {
    try {
      const s = JSON.parse(raw) as ImpersonationSession;
      if (s.organizationId) return s;
    } catch {
      /* ignore */
    }
  }
  // Legacy fallback.
  const id = localStorage.getItem(ID_KEY);
  if (!id) return null;
  return {
    organizationId: id,
    organizationName: localStorage.getItem(NAME_KEY) ?? "",
    organizationSlug: localStorage.getItem(SLUG_KEY) ?? undefined,
    startedAt: new Date().toISOString(),
  };
}

export function getSelectedOrg(): SelectedOrg | null {
  const s = getImpersonation();
  if (!s) return null;
  return { id: s.organizationId, name: s.organizationName, slug: s.organizationSlug };
}

export function getCurrentUserRole(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("admin_user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { role?: string };
    return (u.role || "").toUpperCase() || null;
  } catch {
    return null;
  }
}

export function isSuperAdminActive(): boolean {
  return getCurrentUserRole() === "SUPER_ADMIN";
}
