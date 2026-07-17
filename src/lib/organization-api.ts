import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";
import type { ModuleKey } from "./organization-modules";

export interface OrganizationDTO {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  active?: boolean;
  status?: string;
  logoUrl?: string;
  modules?: unknown;
  usersCount?: number;

  // Future-facing SaaS fields (optional, ignored today)
  plan?: { id: string; name: string; trialEndsAt?: string } | null;
  limits?: { users?: number; orders?: number; events?: number; devices?: number } | null;
  usage?: { users?: number; orders?: number; events?: number; devices?: number } | null;

  [k: string]: unknown;
}

function unwrap(data: unknown): OrganizationDTO | null {
  if (!data || typeof data !== "object") return null;
  const anyData = data as Record<string, unknown>;
  if (anyData.organization && typeof anyData.organization === "object") {
    return anyData.organization as OrganizationDTO;
  }
  if (anyData.data && typeof anyData.data === "object" && (anyData.data as Record<string, unknown>).id) {
    return anyData.data as OrganizationDTO;
  }
  if (anyData.id) return anyData as OrganizationDTO;
  return null;
}

/**
 * Fetch the organization the current admin is currently viewing.
 *
 * - SUPER_ADMIN + selectedOrganizationId → GET /super-admin/organizations/:id
 * - ADMIN / OPERATOR → GET /users/profile, and derive the organization
 *   from `user.organization` (fallback: minimal DTO built from the profile).
 *
 * The `/organizations/me` endpoint does NOT exist on the backend and must
 * never be called.
 */
export async function fetchOrganization(
  token: string,
  superAdminOrgId?: string | null,
): Promise<OrganizationDTO> {
  if (superAdminOrgId) {
    const res = await apiFetch(
      `${API_BASE_URL}/super-admin/organizations/${superAdminOrgId}`,
      { headers: authHeaders(token) },
    );
    if (!res.ok) throw await fromResponse(res, "Não foi possível carregar a organização.");
    const org = unwrap(await res.json());
    if (!org) throw new Error("Resposta inválida ao carregar organização.");
    return org;
  }

  // ADMIN / OPERATOR: derive from /users/profile
  const res = await apiFetch(`${API_BASE_URL}/users/profile`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res, "Não foi possível carregar o perfil.");
  const data = await res.json();
  const user = (data.user ?? data) as Record<string, unknown>;

  const embedded = unwrap(user.organization);
  if (embedded) {
    // Merge modules from the user payload if the embedded org doesn't include them.
    if (embedded.modules == null) {
      embedded.modules =
        (user.modules as unknown) ??
        (user.organizationModules as unknown) ??
        (user.moduleKeys as unknown) ??
        [];
    }
    return embedded;
  }

  // Fallback: synthesize a minimal DTO from the profile fields we have.
  const orgId = (user.organizationId as string) || (user.organization_id as string);
  if (!orgId) throw new Error("Perfil do usuário não possui organização vinculada.");
  return {
    id: orgId,
    name: (user.organizationName as string) ?? "",
    slug: (user.organizationSlug as string) ?? undefined,
    modules:
      (user.modules as unknown) ??
      (user.organizationModules as unknown) ??
      (user.moduleKeys as unknown) ??
      [],
  };
}

export type { ModuleKey };
