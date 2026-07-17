// Admin Customers API — matches audited contracts from backend.
// Do not invent fields; only what the backend documents.
import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type CustomerSource =
  | "ONLINE"
  | "EVENT"
  | "ADMIN"
  | "IMPORT"
  | "API"
  | "TOTEM"
  | "POS"
  | "WHATSAPP";

export type CustomerInterestSource =
  | "MANUAL"
  | "ONLINE_ORDER"
  | "EVENT"
  | "IMPORT"
  | "API";

export const CUSTOMER_SOURCE_LABEL: Record<CustomerSource, string> = {
  ONLINE: "Cardápio Digital",
  EVENT: "Evento",
  ADMIN: "Cadastro Manual",
  IMPORT: "Importação",
  API: "API",
  TOTEM: "Totem",
  POS: "PDV",
  WHATSAPP: "WhatsApp",
};

export interface Customer {
  id: string;
  organizationId: string;
  name: string;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  normalizedEmail: string | null;
  document: string | null;
  normalizedDocument: string | null;
  birthDate: string | null;
  notes: string | null;
  active: boolean;
  firstSource: CustomerSource | null;
  lastSource: CustomerSource | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  organizationId: string;
  customerId: string;
  label: string | null;
  recipientName: string | null;
  street: string;
  number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  complement: string | null;
  reference: string | null;
  active: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Interest {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerInterestLink {
  id?: string;
  interestId: string;
  interest?: Interest;
  source?: CustomerInterestSource;
  createdAt?: string;
}

export interface CustomerSummary {
  // Canonical fields (per audit)
  totalOrders: number;
  totalOnlineOrders: number;
  totalEventOrders: number;
  totalSpent: number; // in cents
  totalSpentOnline: number;
  totalSpentEvents: number;
  averageTicket: number; // cents
  lastOrderAt: string | null;
  lastOrderSource: CustomerSource | null;
  activeTabs: number;
  activeCredentials: number;
  // Legacy aliases — do not use in UI
  onlineOrdersCount?: number;
  eventOrdersCount?: number;
  totalOrdersCount?: number;
  totalSpentInCents?: number;
}

export interface CustomerDetail extends Customer {
  addresses: CustomerAddress[];
  interests: CustomerInterestLink[];
  summary: CustomerSummary;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListCustomersParams {
  search?: string;
  active?: boolean;
  phone?: string;
  email?: string;
  document?: string;
  interestId?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "name" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface ListCustomersResponse {
  data: Customer[];
  pagination: Pagination;
}

export interface CreateCustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  birthDate?: string | null;
  notes?: string | null;
  active?: boolean;
}
export type UpdateCustomerInput = Partial<CreateCustomerInput>;

export interface CreateAddressInput {
  label?: string | null;
  recipientName?: string | null;
  street: string;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  reference?: string | null;
  active?: boolean;
  isDefault?: boolean;
}
export type UpdateAddressInput = Partial<CreateAddressInput>;

export interface CreateInterestInput {
  name: string;
  key: string;
  active?: boolean;
}
export type UpdateInterestInput = Partial<CreateInterestInput>;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const jsonHeaders = (token: string) => ({
  "Content-Type": "application/json",
  ...authHeaders(token),
});

function qs(params: Record<string, unknown> | object): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === "") continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

/* ================= Customers ================= */

export async function listCustomers(
  token: string,
  params: ListCustomersParams = {},
): Promise<ListCustomersResponse> {
  const res = await apiFetch(`${API_BASE_URL}/customers${qs(params)}`, {
    headers: authHeaders(token),
  });
  return handle<ListCustomersResponse>(res);
}

export async function getCustomer(token: string, customerId: string): Promise<CustomerDetail> {
  const res = await apiFetch(`${API_BASE_URL}/customers/${encodeURIComponent(customerId)}`, {
    headers: authHeaders(token),
  });
  return handle<CustomerDetail>(res);
}

export async function createCustomer(
  token: string,
  input: CreateCustomerInput,
): Promise<Customer> {
  const res = await apiFetch(`${API_BASE_URL}/customers`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  return handle<Customer>(res);
}

export async function updateCustomer(
  token: string,
  customerId: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  const res = await apiFetch(`${API_BASE_URL}/customers/${encodeURIComponent(customerId)}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  return handle<Customer>(res);
}

export async function setCustomerStatus(
  token: string,
  customerId: string,
  active: boolean,
): Promise<Customer> {
  const res = await apiFetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/status`,
    {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ active }),
    },
  );
  return handle<Customer>(res);
}

/* ================= Addresses ================= */

export async function listCustomerAddresses(
  token: string,
  customerId: string,
): Promise<CustomerAddress[]> {
  const res = await apiFetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/addresses`,
    { headers: authHeaders(token) },
  );
  const data = await handle<{ addresses: CustomerAddress[] }>(res);
  return data.addresses ?? [];
}

export async function createCustomerAddress(
  token: string,
  customerId: string,
  input: CreateAddressInput,
): Promise<CustomerAddress> {
  const res = await apiFetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/addresses`,
    {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(input),
    },
  );
  return handle<CustomerAddress>(res);
}

export async function updateCustomerAddress(
  token: string,
  customerId: string,
  addressId: string,
  input: UpdateAddressInput,
): Promise<CustomerAddress> {
  const res = await apiFetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify(input),
    },
  );
  return handle<CustomerAddress>(res);
}

export async function setCustomerAddressStatus(
  token: string,
  customerId: string,
  addressId: string,
  active: boolean,
): Promise<CustomerAddress> {
  const res = await apiFetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/addresses/${encodeURIComponent(addressId)}/status`,
    {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ active }),
    },
  );
  return handle<CustomerAddress>(res);
}

/* ================= Interests ================= */

export interface ListInterestsParams {
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listInterests(
  token: string,
  params: ListInterestsParams = {},
): Promise<Interest[]> {
  const res = await apiFetch(`${API_BASE_URL}/interests${qs(params)}`, {
    headers: authHeaders(token),
  });
  const data = await handle<{ data: Interest[]; pagination: Pagination }>(res);
  return data.data ?? [];
}

export async function createInterest(
  token: string,
  input: CreateInterestInput,
): Promise<Interest> {
  const res = await apiFetch(`${API_BASE_URL}/interests`, {
    method: "POST",
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  return handle<Interest>(res);
}

export async function updateInterest(
  token: string,
  interestId: string,
  input: UpdateInterestInput,
): Promise<Interest> {
  const res = await apiFetch(`${API_BASE_URL}/interests/${encodeURIComponent(interestId)}`, {
    method: "PATCH",
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  return handle<Interest>(res);
}

export async function setInterestStatus(
  token: string,
  interestId: string,
  active: boolean,
): Promise<Interest> {
  const res = await apiFetch(
    `${API_BASE_URL}/interests/${encodeURIComponent(interestId)}/status`,
    {
      method: "PATCH",
      headers: jsonHeaders(token),
      body: JSON.stringify({ active }),
    },
  );
  return handle<Interest>(res);
}

/* ================= Customer × Interest ================= */

export async function attachCustomerInterest(
  token: string,
  customerId: string,
  interestId: string,
  source: CustomerInterestSource = "MANUAL",
): Promise<unknown> {
  const res = await apiFetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/interests`,
    {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ interestId, source }),
    },
  );
  return handle<unknown>(res);
}

export async function detachCustomerInterest(
  token: string,
  customerId: string,
  interestId: string,
): Promise<{ removed: boolean }> {
  const res = await apiFetch(
    `${API_BASE_URL}/customers/${encodeURIComponent(customerId)}/interests/${encodeURIComponent(interestId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  return handle<{ removed: boolean }>(res);
}
