import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type PaymentProvider =
  | "MANUAL"
  | "MERCADO_PAGO"
  | "STONE"
  | "PAGSEGURO"
  | "CIELO"
  | "GETNET"
  | "OTHER";

export type PaymentEnvironment = "SANDBOX" | "PRODUCTION";
export type PaymentContextType = "EVENT" | "ONLINE_STORE" | "POS";

export interface PaymentProviderStatus {
  provider: PaymentProvider;
  active: boolean;
  configured: boolean;
  environment: PaymentEnvironment;
}

export interface EffectivePaymentSettings {
  organizationId: string;
  contextType: PaymentContextType | "ORGANIZATION";
  contextId: string | null;
  methods: {
    pix: boolean;
    credit: boolean;
    debit: boolean;
    cash: boolean;
    nfcBalance: boolean;
  };
  defaultProvider: PaymentProvider;
  pixExpirationMinutes: number;
  maxInstallments: number;
  environment: PaymentEnvironment;
  providers: PaymentProviderStatus[];
  inheritedFromOrganization: boolean;
}

export type OrganizationPaymentSettings = EffectivePaymentSettings;

export interface UpdateOrganizationPaymentSettingsInput {
  pixEnabled?: boolean;
  creditEnabled?: boolean;
  debitEnabled?: boolean;
  cashEnabled?: boolean;
  nfcBalanceEnabled?: boolean;
  defaultProvider?: PaymentProvider;
  pixExpirationMinutes?: number;
  maxInstallments?: number;
  environment?: PaymentEnvironment;
}

export interface UpdateProviderCredentialsInput {
  environment: PaymentEnvironment;
  active?: boolean;
  credentials?: Record<string, unknown>;
  publicMetadata?: Record<string, unknown> | null;
}

export interface PaymentProviderCredentialStatus {
  id: string;
  provider: PaymentProvider;
  environment: PaymentEnvironment;
  active: boolean;
  configured: boolean;
  publicMetadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContextPaymentSettingsInput {
  inheritOrganizationSettings?: boolean;
  pixEnabledOverride?: boolean | null;
  creditEnabledOverride?: boolean | null;
  debitEnabledOverride?: boolean | null;
  cashEnabledOverride?: boolean | null;
  nfcBalanceEnabledOverride?: boolean | null;
  maxInstallmentsOverride?: number | null;
}

export interface PaymentTerminal {
  id: string;
  organizationId: string;
  deviceId: string | null;
  eventId: string | null;
  onlineStoreId: string | null;
  provider: PaymentProvider;
  externalTerminalId: string;
  status?: "ACTIVE" | "INACTIVE" | "MAINTENANCE";
  active: boolean;
  lastSeenAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentTerminalInput {
  provider: PaymentProvider;
  externalTerminalId: string;
  deviceId?: string | null;
  eventId?: string | null;
  onlineStoreId?: string | null;
  active?: boolean;
  metadata?: Record<string, unknown> | null;
}

async function handle<T>(res: Response, fallback?: string): Promise<T> {
  if (!res.ok) throw await fromResponse(res, fallback);
  return res.json() as Promise<T>;
}

function unwrapPaymentSettings(data: unknown): EffectivePaymentSettings {
  if (data && typeof data === "object" && "paymentSettings" in data) {
    return (data as { paymentSettings: EffectivePaymentSettings }).paymentSettings;
  }
  return data as EffectivePaymentSettings;
}

export async function getOrganizationPaymentSettings(
  token: string,
): Promise<OrganizationPaymentSettings> {
  const res = await apiFetch(`${API_BASE_URL}/payment-settings/organization`, {
    headers: authHeaders(token),
  });
  return unwrapPaymentSettings(await handle<unknown>(res));
}

export async function updateOrganizationPaymentSettings(
  token: string,
  input: UpdateOrganizationPaymentSettingsInput,
): Promise<OrganizationPaymentSettings> {
  const res = await apiFetch(`${API_BASE_URL}/payment-settings/organization`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  return unwrapPaymentSettings(await handle<unknown>(res));
}

export async function updatePaymentProviderCredentials(
  token: string,
  provider: PaymentProvider,
  input: UpdateProviderCredentialsInput,
): Promise<PaymentProviderCredentialStatus> {
  const res = await apiFetch(
    `${API_BASE_URL}/payment-settings/providers/${encodeURIComponent(provider)}/credentials`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(input),
    },
  );
  const data = await handle<unknown>(res);
  if (data && typeof data === "object" && "credential" in data) {
    return (data as { credential: PaymentProviderCredentialStatus }).credential;
  }
  return data as PaymentProviderCredentialStatus;
}

export async function getEffectivePaymentSettings(
  token: string,
  params?: {
    contextType?: PaymentContextType;
    eventId?: string | null;
    onlineStoreId?: string | null;
  },
): Promise<EffectivePaymentSettings> {
  const qs = new URLSearchParams();
  if (params?.contextType) qs.set("contextType", params.contextType);
  if (params?.eventId) qs.set("eventId", params.eventId);
  if (params?.onlineStoreId) qs.set("onlineStoreId", params.onlineStoreId);
  const query = qs.toString() ? `?${qs}` : "";
  const res = await apiFetch(`${API_BASE_URL}/payment-settings/effective${query}`, {
    headers: authHeaders(token),
  });
  return unwrapPaymentSettings(await handle<unknown>(res));
}

export async function updateEventPaymentSettings(
  token: string,
  eventId: string,
  input: ContextPaymentSettingsInput,
): Promise<EffectivePaymentSettings> {
  const res = await apiFetch(
    `${API_BASE_URL}/payment-settings/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(input),
    },
  );
  return unwrapPaymentSettings(await handle<unknown>(res));
}

export async function updateOnlineStorePaymentSettings(
  token: string,
  storeId: string,
  input: ContextPaymentSettingsInput,
): Promise<EffectivePaymentSettings> {
  const res = await apiFetch(
    `${API_BASE_URL}/payment-settings/online-stores/${encodeURIComponent(storeId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify(input),
    },
  );
  return unwrapPaymentSettings(await handle<unknown>(res));
}

export async function listPaymentTerminals(token: string): Promise<PaymentTerminal[]> {
  const res = await apiFetch(`${API_BASE_URL}/payment-terminals`, {
    headers: authHeaders(token),
  });
  const data = await handle<unknown>(res);
  if (Array.isArray(data)) return data as PaymentTerminal[];
  if (data && typeof data === "object" && Array.isArray((data as { terminals?: unknown }).terminals)) {
    return (data as { terminals: PaymentTerminal[] }).terminals;
  }
  return [];
}

export async function createPaymentTerminal(
  token: string,
  input: CreatePaymentTerminalInput,
): Promise<PaymentTerminal> {
  const res = await apiFetch(`${API_BASE_URL}/payment-terminals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<unknown>(res);
  if (data && typeof data === "object" && "terminal" in data) {
    return (data as { terminal: PaymentTerminal }).terminal;
  }
  return data as PaymentTerminal;
}
