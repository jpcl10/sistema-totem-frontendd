import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";

/**
 * Single source of truth for the tenant used by admin operational queries.
 *
 * - SUPER_ADMIN → impersonated organization from `useOrganization()`.
 * - ADMIN / OPERATOR → `user.organizationId` from `useAuth()`.
 * - Anything else (no session, no impersonation) → `null`.
 *
 * Callers should treat `null` as "not ready" and disable dependent queries
 * (e.g. `useQuery({ enabled: !!orgId, queryKey: qk.foo.list(orgId!) })`).
 *
 * Replaces the deprecated `getEffectiveOrganizationId()` in
 * `src/lib/effective-org.ts`, which reads localStorage and returns `null`
 * for ADMIN because the user profile is no longer persisted (XSS hardening).
 */
export function useOrgId(): string | null {
  const { user } = useAuth();
  const { organizationId: impersonatedOrgId, isSuperAdmin } = useOrganization();
  if (isSuperAdmin) return impersonatedOrgId ?? null;
  return user?.organizationId ?? null;
}
