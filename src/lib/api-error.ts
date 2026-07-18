import { toast } from "sonner";
import { authStorage } from "./auth";
import { reactToContextError } from "@/lib/context-errors";

/**
 * Standardized API error with friendly Portuguese message.
 * Always throw an ApiError from API helpers — never a raw Error with a
 * backend message. This guarantees handleApiError() can produce a clean
 * user-facing message and never leak "Failed to fetch" or raw stack traces.
 */
export class ApiError extends Error {
  status: number;
  code: string;
  raw?: string;

  constructor(message: string, opts: { status?: number; code?: string; raw?: string } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = opts.status ?? 0;
    this.code = opts.code ?? "UNKNOWN";
    this.raw = opts.raw;
  }
}

/* -----------------------------------------------------------
 *  Friendly message catalog
 * --------------------------------------------------------- */

const FRIENDLY_BY_CODE: Record<string, string> = {
  // Network
  NETWORK: "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
  TIMEOUT: "O servidor demorou demais para responder. Tente novamente em instantes.",
  OFFLINE: "Você está offline. Conecte-se à internet para continuar.",
  WEBSOCKET: "Conexão em tempo real perdida. Tentando reconectar...",

  // Auth
  INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
  USER_NOT_FOUND: "Usuário não encontrado.",
  TOKEN_EXPIRED: "Sua sessão expirou. Faça login novamente.",
  UNAUTHORIZED: "Sessão inválida. Faça login novamente.",
  FORBIDDEN: "Você não tem permissão para realizar esta ação.",

  // CRUD
  EVENT_NOT_FOUND: "Evento não encontrado.",
  ORDER_NOT_FOUND: "Pedido não encontrado.",
  CATEGORY_EXISTS: "Já existe uma categoria com esse nome ou slug.",
  PRODUCT_EXISTS: "Já existe um produto com esse nome ou slug.",
  SLUG_DUPLICATE: "Esse identificador (slug) já está em uso. Escolha outro.",
  CONFLICT: "Esse registro já existe.",
  VALIDATION: "Dados inválidos. Revise os campos e tente novamente.",
  NOT_FOUND: "Registro não encontrado.",

  // Public store / fulfillment
  DELIVERY_DISABLED: "Esta loja não está aceitando entregas no momento. Escolha retirada no balcão.",
  PICKUP_DISABLED: "Esta loja não está aceitando retirada no momento.",
  FULFILLMENT_DISABLED: "Esta loja não está aceitando pedidos no momento.",
  STORE_CLOSED: "O estabelecimento está fechado no momento.",
  MINIMUM_ORDER_NOT_MET: "Pedido mínimo não atingido.",

  // Upload
  FILE_INVALID: "Arquivo inválido. Envie uma imagem nos formatos JPG, PNG ou WEBP.",
  FILE_TOO_LARGE: "Imagem muito grande. O tamanho máximo permitido é 5 MB.",
  UPLOAD_FAILED: "Não foi possível enviar a imagem. Tente novamente.",

  // Server
  SERVER: "O servidor encontrou um problema. Tente novamente em instantes.",
  RATE_LIMIT: "Muitas tentativas. Aguarde alguns segundos e tente novamente.",
  UNKNOWN: "Algo deu errado. Tente novamente.",

  // Tenant / platform context (new backend contract)
  TENANT_CONTEXT_REQUIRED: "Selecione uma organização para continuar.",
  TENANT_NOT_FOUND: "A organização selecionada não foi encontrada.",
  TENANT_ACCESS_DENIED: "Você não possui acesso a esta organização.",
  PLATFORM_CONTEXT_REQUIRED: "Esta ação só pode ser executada no painel da plataforma.",
  SUPER_ADMIN_REQUIRED: "Acesso restrito ao administrador da plataforma.",
};

const CONTEXT_CODES = new Set([
  "TENANT_CONTEXT_REQUIRED",
  "TENANT_NOT_FOUND",
  "TENANT_ACCESS_DENIED",
  "PLATFORM_CONTEXT_REQUIRED",
  "SUPER_ADMIN_REQUIRED",
]);

/** Heuristic mapping based on raw backend message to a stable code. */
function inferCode(status: number, raw: string): string {
  const r = raw.toLowerCase();

  // Auth
  if (status === 401) {
    if (r.includes("expired")) return "TOKEN_EXPIRED";
    if (r.includes("invalid") && (r.includes("password") || r.includes("credential")))
      return "INVALID_CREDENTIALS";
    return "UNAUTHORIZED";
  }
  if (status === 403) return "FORBIDDEN";

  if (r.includes("user not found") || r.includes("usuário não encontrado")) return "USER_NOT_FOUND";
  if (r.includes("invalid password") || r.includes("senha inválida") || r.includes("senha invalida"))
    return "INVALID_CREDENTIALS";
  if (r.includes("invalid credentials")) return "INVALID_CREDENTIALS";
  if (r.includes("token") && (r.includes("expired") || r.includes("expirado"))) return "TOKEN_EXPIRED";

  // CRUD
  if (r.includes("slug") && (r.includes("exist") || r.includes("duplicate") || r.includes("já existe") || r.includes("ja existe") || r.includes("in use")))
    return "SLUG_DUPLICATE";
  if (r.includes("category") && (r.includes("exist") || r.includes("duplicate"))) return "CATEGORY_EXISTS";
  if (r.includes("product") && (r.includes("exist") || r.includes("duplicate"))) return "PRODUCT_EXISTS";
  if (r.includes("event") && r.includes("not found")) return "EVENT_NOT_FOUND";
  if (r.includes("order") && r.includes("not found")) return "ORDER_NOT_FOUND";

  // Upload
  if (r.includes("file too large") || r.includes("payload too large") || r.includes("muito grande"))
    return "FILE_TOO_LARGE";
  if (r.includes("invalid file") || r.includes("invalid image") || r.includes("unsupported"))
    return "FILE_INVALID";
  if (r.includes("upload")) return "UPLOAD_FAILED";

  // Status-based fallbacks
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 413) return "FILE_TOO_LARGE";
  if (status === 415) return "FILE_INVALID";
  if (status === 422 || status === 400) return "VALIDATION";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "SERVER";
  return "UNKNOWN";
}

/** Build a friendly ApiError from a fetch Response. Reads JSON safely. */
export async function fromResponse(res: Response, fallback?: string): Promise<ApiError> {
  let raw = "";
  let backendCode: string | undefined;
  try {
    const txt = await res.text();
    if (txt) {
      try {
        const obj = JSON.parse(txt) as Record<string, unknown>;
        raw =
          (obj.message as string) ??
          (obj.error as string) ??
          (typeof obj.detail === "string" ? (obj.detail as string) : "") ??
          txt;
        if (typeof obj.code === "string") backendCode = obj.code.toUpperCase();
      } catch {
        raw = txt;
      }
    }
  } catch {
    /* ignore */
  }
  // Prefer explicit backend code when it's one we recognize.
  const code =
    backendCode && (FRIENDLY_BY_CODE[backendCode] || CONTEXT_CODES.has(backendCode))
      ? backendCode
      : inferCode(res.status, raw);
  const message = FRIENDLY_BY_CODE[code] ?? fallback ?? FRIENDLY_BY_CODE.UNKNOWN;
  const err = new ApiError(message, { status: res.status, code, raw });
  // Trigger global reaction for context errors (guarded against loops).
  if (CONTEXT_CODES.has(code)) {
    try {
      reactToContextError(code, message);
    } catch {
      /* ignore */
    }
  }
  return err;
}

/** Wrap a network/fetch failure (TypeError, AbortError) in a friendly ApiError. */
export function fromNetworkError(err: unknown): ApiError {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return new ApiError(FRIENDLY_BY_CODE.OFFLINE, { code: "OFFLINE" });
  }
  if (err instanceof DOMException && err.name === "AbortError") {
    return new ApiError(FRIENDLY_BY_CODE.TIMEOUT, { code: "TIMEOUT" });
  }
  return new ApiError(FRIENDLY_BY_CODE.NETWORK, {
    code: "NETWORK",
    raw: err instanceof Error ? err.message : String(err),
  });
}

/* -----------------------------------------------------------
 *  apiFetch — fetch wrapper with timeout + friendly errors
 * --------------------------------------------------------- */

export interface ApiFetchOptions extends RequestInit {
  /** Timeout in ms. Default 20s. */
  timeoutMs?: number;
}

/**
 * Tenant context header injection.
 *
 * Backend now uses a header, not a query string, to resolve the tenant:
 *   x-organization-id: <organizationId>
 *
 * Rules:
 * - SUPER_ADMIN impersonating an org (defumar.impersonation) → attach the
 *   header on ALL calls EXCEPT platform endpoints (/super-admin, /sessions,
 *   /users/profile, /public/*).
 * - ADMIN / OPERATOR → never attach; the JWT already carries the tenant.
 * - Never attach on /super-admin/* — that's platform context and the backend
 *   rejects it with PLATFORM_CONTEXT_REQUIRED.
 */
let currentRoleSnapshot: string | null = null;
export function setCurrentRoleSnapshot(role: string | null | undefined) {
  currentRoleSnapshot = role ? role.toUpperCase() : null;
}

function parseCanonicalImpersonation(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("defumar.impersonation");
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as { organizationId?: string };
    const organizationId = typeof session.organizationId === "string" ? session.organizationId.trim() : "";
    return organizationId || null;
  } catch {
    return null;
  }
}

function resolveTenantOrganizationId(): string | null {
  const role = currentRoleSnapshot ?? authStorage.getUser()?.role?.toUpperCase() ?? null;
  if (role === "SUPER_ADMIN") {
    return parseCanonicalImpersonation();
  }
  const organizationId = authStorage.getUser()?.organizationId?.trim() ?? "";
  return organizationId || null;
}

function withTenantHeader(url: string, headers: HeadersInit | undefined): HeadersInit | undefined {
  if (typeof window === "undefined") return headers;
  try {
    const orgId = resolveTenantOrganizationId();
    if (!orgId) return headers;

    const parsed = new URL(url, "http://x.local");
    const path = parsed.pathname;
    const normalizedPath = path.startsWith("/api/") ? path.slice(4) : path;
    if (
      normalizedPath.startsWith("/super-admin") ||
      normalizedPath.startsWith("/sessions") ||
      normalizedPath.startsWith("/users/profile") ||
      normalizedPath.startsWith("/public/")
    ) {
      return headers;
    }

    const merged = new Headers(headers ?? {});
    if (!merged.has("x-organization-id")) merged.set("x-organization-id", orgId);
    return merged;
  } catch {
    return headers;
  }
}

export async function apiFetch(input: string, init: ApiFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 20_000, signal, headers, ...rest } = init;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    const finalHeaders = withTenantHeader(input, headers);
    return await fetch(input, { ...rest, headers: finalHeaders, signal: controller.signal });
  } catch (err) {
    throw fromNetworkError(err);
  } finally {
    clearTimeout(t);
  }
}

/* -----------------------------------------------------------
 *  Public consumers
 * --------------------------------------------------------- */

/** Convert any thrown value into a friendly user-facing message. */
export function toFriendlyMessage(err: unknown, fallback = FRIENDLY_BY_CODE.UNKNOWN): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof DOMException && err.name === "AbortError") return FRIENDLY_BY_CODE.TIMEOUT;
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) return FRIENDLY_BY_CODE.NETWORK;
  if (err instanceof Error) {
    // If somebody threw a raw Error using our friendly text, pass through.
    if (Object.values(FRIENDLY_BY_CODE).includes(err.message)) return err.message;
    // Avoid leaking technical messages.
    if (/failed to fetch|networkerror|load failed/i.test(err.message)) return FRIENDLY_BY_CODE.NETWORK;
    return fallback;
  }
  return fallback;
}

/**
 * Toast a friendly error and return its message (so callers can also setError()).
 * Pass { silent: true } to skip the toast.
 */
export function handleApiError(
  err: unknown,
  fallback?: string,
  opts: { silent?: boolean; toastId?: string } = {},
): string {
  const msg = toFriendlyMessage(err, fallback);
  if (!opts.silent) {
    toast.error(msg, { id: opts.toastId });
  }
  // Help debugging in dev console without exposing to user
  if (typeof console !== "undefined" && err instanceof ApiError && err.raw) {
    console.warn("[ApiError]", err.code, err.status, err.raw);
  } else if (typeof console !== "undefined") {
    console.warn("[ApiError]", err);
  }
  return msg;
}

export const friendlyMessages = FRIENDLY_BY_CODE;
