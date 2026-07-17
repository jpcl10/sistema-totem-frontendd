import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export interface AuditLog {
  id: string;
  action: string;
  description?: string | null;
  entity?: string | null;
  entityId?: string | null;
  userId?: string | null;
  user?: { id: string; name?: string; email?: string } | null;
  deviceId?: string | null;
  device?: { id: string; name?: string; type?: string } | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  eventId?: string;
}

export interface AuditLogListResponse {
  data: AuditLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  action?: string;
  entity?: string;
  userId?: string;
  deviceId?: string;
  startDate?: string;
  endDate?: string;
}

export async function listAuditLogs(
  token: string,
  eventId: string,
  query: AuditLogQuery = {},
): Promise<AuditLogListResponse> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    const s = String(v).trim();
    if (s === "") return;
    params.set(k, s);
  });
  const qs = params.toString();
  const url = `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/audit-logs${qs ? `?${qs}` : ""}`;
  // eslint-disable-next-line no-console
  // [redacted log]
  const res = await apiFetch(url, { headers: authHeaders(token) });
  if (!res.ok) throw await fromResponse(res);
  const data = await res.json();
  // eslint-disable-next-line no-console
  // [redacted log]
  // Normalize: backend returns { auditLogs, page, limit, total, totalPages }
  const logs: AuditLog[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.auditLogs)
    ? data.auditLogs
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.logs)
    ? data.logs
    : Array.isArray(data?.items)
    ? data.items
    : [];
  const page = Number(data?.page ?? query.page ?? 1);
  const limit = Number(data?.limit ?? query.limit ?? logs.length ?? 20);
  const total = Number(data?.total ?? logs.length);
  const totalPages = Number(data?.totalPages ?? Math.max(1, Math.ceil(total / Math.max(1, limit))));
  return { data: logs, page, limit, total, totalPages };
}

const SENSITIVE_KEYS = new Set([
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "webhooksecret",
  "webhook_secret",
  "password",
  "secret",
  "apikey",
  "api_key",
]);

export function maskSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSensitive);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        out[k] = "••••";
      } else {
        out[k] = maskSensitive(v);
      }
    }
    return out;
  }
  return value;
}
