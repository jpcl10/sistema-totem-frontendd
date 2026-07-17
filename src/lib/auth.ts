// Runtime URLs are configured through Vite environment variables.
const RAW_API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const RAW_APP_URL = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
const RAW_SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined)?.trim();

export const API_URL = RAW_API_URL && RAW_API_URL.length > 0 ? RAW_API_URL : "";
export const APP_URL = RAW_APP_URL && RAW_APP_URL.length > 0 ? RAW_APP_URL : "";
export const SOCKET_URL = RAW_SOCKET_URL && RAW_SOCKET_URL.length > 0 ? RAW_SOCKET_URL : API_URL;
export const API_BASE_URL = API_URL;

if (!API_BASE_URL && typeof window !== "undefined") {
  // Fail loud if no backend URL is configured.
  // eslint-disable-next-line no-console
  console.error("VITE_API_URL is not configured. API calls will be blocked.");
}

const TOKEN_KEY = "admin_token";

export const API_HEADERS = {} as const;


export function resolveAssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  // Encode path segments to safely handle spaces and unicode in filenames
  const encode = (path: string) =>
    path
      .split("/")
      .map((seg, i) => (i === 0 && seg === "" ? "" : encodeURIComponent(decodeURIComponent(seg))))
      .join("/");
  if (trimmed.startsWith("/")) return `${API_BASE_URL}${encode(trimmed)}`;
  if (trimmed.startsWith("uploads/")) return `${API_BASE_URL}/${encode(trimmed)}`;
  return trimmed;
}

export function authHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = { ...API_HEADERS };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// User profile is intentionally kept in memory only. Persisting the profile
// (including the user's role) in localStorage lets any XSS payload read it
// and impersonate the user; we re-derive it from the server on each load.
let inMemoryUser: UserProfile | null = null;

// Purge any legacy persisted profile from previous versions of the app.
if (typeof window !== "undefined") {
  try {
    localStorage.removeItem("admin_user");
  } catch {
    /* ignore */
  }
}

export const authStorage = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getUser(): UserProfile | null {
    return inMemoryUser;
  },
  setUser(user: UserProfile | null) {
    inMemoryUser = user;
  },
  clear() {
    inMemoryUser = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
    }
  },
};


export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
}

export interface LoginResponse {
  token: string;
  user: UserProfile;
}

import { apiFetch, fromResponse, ApiError } from "./api-error";

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/**
 * Extrai e valida um UserProfile a partir de payloads no formato
 * `{ user: {...} }` ou `{...}`. Nunca retorna undefined; lança erro claro
 * quando o payload não bate com o contrato mínimo.
 */
export function extractUser(payload: unknown): UserProfile {
  const candidate =
    isObject(payload) && "user" in payload ? (payload as { user: unknown }).user : payload;

  if (!isObject(candidate)) {
    throw new ApiError("Perfil inválido retornado pelo servidor.", { code: "UNKNOWN" });
  }
  const c = candidate as Record<string, unknown>;
  const name = typeof c.name === "string" ? c.name : "";
  const email = typeof c.email === "string" ? c.email : "";
  const role = typeof c.role === "string" ? c.role : "";
  const organizationId = typeof c.organizationId === "string" ? c.organizationId : "";
  if (!email || !role || !organizationId) {
    throw new ApiError("Perfil inválido retornado pelo servidor.", { code: "UNKNOWN" });
  }
  return {
    id: typeof c.id === "string" ? c.id : undefined,
    name,
    email,
    role,
    organizationId,
  };
}

export async function loginRequest(email: string, password: string): Promise<LoginResponse> {
  const res = await apiFetch(`${API_BASE_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...API_HEADERS },
    body: JSON.stringify({ email, password }),
  });
  if (import.meta.env.DEV) console.info("[auth] /sessions status", res.status);
  if (res.status === 401) {
    throw new ApiError("E-mail ou senha inválidos.", { status: 401, code: "INVALID_CREDENTIALS" });
  }
  if (!res.ok) throw await fromResponse(res, "Não foi possível entrar. Tente novamente.");
  const data = await res.json();
  const token = data.token ?? data.access_token ?? data.accessToken;
  if (!token || typeof token !== "string") {
    throw new ApiError("Resposta inválida do servidor.", { code: "UNKNOWN" });
  }
  const user = extractUser(data);
  if (import.meta.env.DEV) console.info("[auth] login user valid:", true);
  return { token, user };
}

export async function fetchProfile(token: string, timeoutMs = 8_000): Promise<UserProfile> {
  const res = await apiFetch(`${API_BASE_URL}/users/profile`, {
    headers: authHeaders(token),
    timeoutMs,
  });
  if (import.meta.env.DEV) console.info("[auth] /users/profile status", res.status);
  if (!res.ok) throw await fromResponse(res, "Não foi possível carregar o perfil.");
  const data = await res.json();
  const user = extractUser(data);
  if (import.meta.env.DEV) console.info("[auth] profile user valid:", true);
  return user;
}
