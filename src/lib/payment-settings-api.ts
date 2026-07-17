import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export interface PaymentProviderSetting {
  id: string;
  provider: "MERCADO_PAGO";
  enabled: boolean;
  pixEnabled: boolean;
  cardEnabled: boolean;
  terminalEnabled: boolean;
  webhookUrl?: string;
  publicKeyConfigured: boolean;
  accessTokenConfigured: boolean;
  webhookSecretConfigured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePaymentProviderInput {
  enabled: boolean;
  pixEnabled: boolean;
  cardEnabled: boolean;
  terminalEnabled: boolean;
  webhookUrl?: string;
  accessToken?: string;
  publicKey?: string;
  webhookSecret?: string;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

export async function listPaymentProviderSettings(token: string): Promise<PaymentProviderSetting[]> {
  const res = await apiFetch(`${API_BASE_URL}/payment-provider-settings`, {
    headers: authHeaders(token),
  });
  const data = await handle<PaymentProviderSetting[] | { settings: PaymentProviderSetting[] }>(res);
  return Array.isArray(data) ? data : data.settings;
}

export async function updatePaymentProviderSettings(
  token: string,
  provider: string,
  input: UpdatePaymentProviderInput
): Promise<PaymentProviderSetting> {
  const res = await apiFetch(`${API_BASE_URL}/payment-provider-settings/${encodeURIComponent(provider)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  return handle<PaymentProviderSetting>(res);
}
