import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type DeviceType = "TOTEM" | "PRINTER" | "CALL_SCREEN" | "SK210";
export type DeviceStatus = "ACTIVE" | "PAUSED" | "OFFLINE" | "MAINTENANCE";
export type DeviceAuthStatus = "PENDING" | "ACTIVE" | "REVOKED";

export interface Device {
  id: string;
  organizationId: string;
  eventId: string | null;
  storeId: string | null;
  name: string;
  code: string;
  locationName: string | null;
  type: DeviceType;
  status: DeviceStatus;
  authStatus: DeviceAuthStatus;
  appVersion?: string | null;
  lastSeenAt: string | null;
  lastHeartbeatAt: string | null;
  lastActivatedAt?: string | null;
  lastIpAddress?: string | null;
  lastUserAgent?: string | null;
  metadata: Record<string, unknown> | null;
  event?: { id: string; name: string; slug?: string } | null;
  store?: { id: string; name: string; slug?: string } | null;
  // NOTE: `tokenHash` / `deviceSecretHash` intentionally omitted — nunca expor no client.
  [k: string]: unknown;
}

export interface CreateDeviceInput {
  name: string;
  code: string;
  type: DeviceType;
  /** Vínculo mutuamente exclusivo com `storeId`. */
  eventId?: string | null;
  /** Vínculo mutuamente exclusivo com `eventId`. */
  storeId?: string | null;
  locationName?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateDeviceInput {
  name?: string;
  eventId?: string | null;
  storeId?: string | null;
  locationName?: string | null;
  type?: DeviceType;
  status?: DeviceStatus;
  metadata?: Record<string, unknown> | null;
}


export interface DeviceCredentials {
  deviceCode: string;
  deviceSecret: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

function unwrap<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj[key])) return obj[key] as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function unwrapOne<T>(data: unknown, key: string): T {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj[key] && typeof obj[key] === "object") return obj[key] as T;
    if (obj.data && typeof obj.data === "object") return obj.data as T;
  }
  return data as T;
}

export async function listDevices(token: string): Promise<Device[]> {
  const res = await apiFetch(`${API_BASE_URL}/devices`, { headers: authHeaders(token) });
  const data = await handle<unknown>(res);
  return unwrap<Device>(data, "devices");
}

export async function getDevice(token: string, id: string): Promise<Device> {
  const res = await apiFetch(`${API_BASE_URL}/devices/${encodeURIComponent(id)}`, {
    headers: authHeaders(token),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<Device>(data, "device");
}

export async function createDevice(token: string, input: CreateDeviceInput): Promise<Device> {
  const res = await apiFetch(`${API_BASE_URL}/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<Device>(data, "device");
}

export async function updateDevice(
  token: string,
  id: string,
  patch: UpdateDeviceInput,
): Promise<Device> {
  const res = await apiFetch(`${API_BASE_URL}/devices/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(patch),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<Device>(data, "device");
}

export async function regenerateDeviceCredentials(
  token: string,
  id: string,
): Promise<DeviceCredentials> {
  const res = await apiFetch(
    `${API_BASE_URL}/devices/${encodeURIComponent(id)}/regenerate-credentials`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({}),
    },
  );
  const data = await handle<unknown>(res);
  const obj = (data && typeof data === "object" ? (data as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const inner = (obj.credentials || obj.data || obj) as Record<string, unknown>;
  const device = (obj.device || inner.device || {}) as Record<string, unknown>;
  const deviceCode = String(
    inner.deviceCode ??
      inner.device_code ??
      inner.code ??
      device.code ??
      device.deviceCode ??
      "",
  );
  const deviceSecret = String(
    inner.deviceSecret ?? inner.device_secret ?? inner.secret ?? "",
  );
  return { deviceCode, deviceSecret };
}
