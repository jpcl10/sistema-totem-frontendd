import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type NfcCardStatus = "ACTIVE" | "BLOCKED" | "LOST";
export type NfcCardType = "CUSTOMER" | "STAFF" | "VIP" | "COMANDA";

export interface NfcCard {
  id: string;
  eventId: string;
  uid: string;
  code?: string | null;
  holderName?: string | null;
  type: NfcCardType;
  status: NfcCardStatus;
  balanceInCents?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [k: string]: unknown;
}

export interface CreateNfcCardInput {
  uid: string;
  code?: string | null;
  holderName?: string | null;
  type: NfcCardType;
  notes?: string | null;
}

export interface UpdateNfcCardInput {
  code?: string | null;
  holderName?: string | null;
  type?: NfcCardType;
  status?: NfcCardStatus;
  notes?: string | null;
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
    if (Array.isArray(obj.cards)) return obj.cards as T[];
  }
  return [];
}

function unwrapOne<T>(data: unknown, key: string): T {
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj[key] && typeof obj[key] === "object") return obj[key] as T;
    if (obj.card && typeof obj.card === "object") return obj.card as T;
    if (obj.data && typeof obj.data === "object") return obj.data as T;
  }
  return data as T;
}

const base = (eventId: string) =>
  `${API_BASE_URL}/events/${encodeURIComponent(eventId)}/nfc-cards`;

export async function listNfcCards(token: string, eventId: string): Promise<NfcCard[]> {
  const res = await apiFetch(base(eventId), { headers: authHeaders(token) });
  const data = await handle<unknown>(res);
  return unwrap<NfcCard>(data, "nfcCards");
}

export async function createNfcCard(
  token: string,
  eventId: string,
  input: CreateNfcCardInput,
): Promise<NfcCard> {
  const res = await apiFetch(base(eventId), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<NfcCard>(data, "nfcCard");
}

export async function getNfcCardByUid(
  token: string,
  eventId: string,
  uid: string,
): Promise<NfcCard | null> {
  const res = await apiFetch(`${base(eventId)}/uid/${encodeURIComponent(uid)}`, {
    headers: authHeaders(token),
  });
  if (res.status === 404) return null;
  const data = await handle<unknown>(res);
  return unwrapOne<NfcCard>(data, "nfcCard");
}

export async function readNfcCard(
  token: string,
  eventId: string,
  uid: string,
): Promise<NfcCard | null> {
  const res = await apiFetch(`${base(eventId)}/read`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ uid }),
  });
  if (res.status === 404) return null;
  const data = await handle<unknown>(res);
  return unwrapOne<NfcCard>(data, "nfcCard");
}

export async function updateNfcCard(
  token: string,
  eventId: string,
  id: string,
  patch: UpdateNfcCardInput,
): Promise<NfcCard> {
  const res = await apiFetch(`${base(eventId)}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(patch),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<NfcCard>(data, "nfcCard");
}

export async function blockNfcCard(
  token: string,
  eventId: string,
  id: string,
): Promise<NfcCard> {
  const res = await apiFetch(`${base(eventId)}/${encodeURIComponent(id)}/block`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({}),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<NfcCard>(data, "nfcCard");
}

export async function unblockNfcCard(
  token: string,
  eventId: string,
  id: string,
): Promise<NfcCard> {
  // Try dedicated endpoint first, fall back to PATCH status=ACTIVE.
  try {
    const res = await apiFetch(`${base(eventId)}/${encodeURIComponent(id)}/unblock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders(token) },
      body: JSON.stringify({}),
    });
    const data = await handle<unknown>(res);
    return unwrapOne<NfcCard>(data, "nfcCard");
  } catch {
    return updateNfcCard(token, eventId, id, { status: "ACTIVE" });
  }
}

/* ---------------- Cashless / Transactions ---------------- */

export type NfcTransactionType =
  | "TOPUP"
  | "PURCHASE"
  | "REFUND"
  | "ADJUSTMENT"
  | "BONUS"
  | "REVERSAL";

export interface NfcTransaction {
  id: string;
  cardId: string;
  type: NfcTransactionType;
  amountInCents: number;
  balanceBeforeInCents?: number;
  balanceAfterInCents?: number;
  description?: string | null;
  createdAt?: string;
  [k: string]: unknown;
}

export const NFC_TX_TYPE_LABEL: Record<NfcTransactionType, string> = {
  TOPUP: "Recarga",
  PURCHASE: "Consumo",
  REFUND: "Estorno",
  ADJUSTMENT: "Ajuste",
  BONUS: "Bônus",
  REVERSAL: "Reversão",
};

export async function listNfcTransactions(
  token: string,
  eventId: string,
  id: string,
): Promise<NfcTransaction[]> {
  const res = await apiFetch(`${base(eventId)}/${encodeURIComponent(id)}/transactions`, {
    headers: authHeaders(token),
  });
  const data = await handle<unknown>(res);
  return unwrap<NfcTransaction>(data, "transactions");
}

export interface CardAggregate {
  lastTx?: NfcTransaction;
  totalTopupCents: number;
  totalPurchaseCents: number;
  totalRefundCents: number;
  txCount: number;
  txs: NfcTransaction[];
}

export function emptyAggregate(): CardAggregate {
  return {
    lastTx: undefined,
    totalTopupCents: 0,
    totalPurchaseCents: 0,
    totalRefundCents: 0,
    txCount: 0,
    txs: [],
  };
}

export function aggregateTransactions(txs: NfcTransaction[]): CardAggregate {
  const sorted = [...txs].sort((a, b) =>
    (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
  );
  const agg = emptyAggregate();
  agg.txs = sorted;
  agg.lastTx = sorted[0];
  agg.txCount = sorted.length;
  for (const t of sorted) {
    const amt = Math.abs(t.amountInCents ?? 0);
    if (t.type === "TOPUP" || t.type === "BONUS") agg.totalTopupCents += amt;
    else if (t.type === "PURCHASE") agg.totalPurchaseCents += amt;
    else if (t.type === "REFUND") agg.totalRefundCents += amt;
  }
  return agg;
}

export async function loadCardAggregates(
  token: string,
  eventId: string,
  cardIds: string[],
  concurrency = 6,
): Promise<Record<string, CardAggregate>> {
  const out: Record<string, CardAggregate> = {};
  let i = 0;
  async function worker() {
    while (i < cardIds.length) {
      const idx = i++;
      const id = cardIds[idx];
      try {
        const txs = await listNfcTransactions(token, eventId, id);
        out[id] = aggregateTransactions(txs);
      } catch {
        out[id] = emptyAggregate();
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, cardIds.length) }, worker));
  return out;
}


async function postFinancial(
  token: string,
  eventId: string,
  id: string,
  op: "topup" | "debit" | "adjust" | "refund",
  body: Record<string, unknown>,
): Promise<NfcCard> {
  const res = await apiFetch(`${base(eventId)}/${encodeURIComponent(id)}/${op}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(body),
  });
  const data = await handle<unknown>(res);
  return unwrapOne<NfcCard>(data, "nfcCard");
}

export const topupNfcCard = (t: string, e: string, id: string, amountInCents: number, description?: string) =>
  postFinancial(t, e, id, "topup", { amountInCents, description });

export const debitNfcCard = (t: string, e: string, id: string, amountInCents: number, description?: string) =>
  postFinancial(t, e, id, "debit", { amountInCents, description });

export const adjustNfcCard = (t: string, e: string, id: string, newBalanceInCents: number, description?: string) =>
  postFinancial(t, e, id, "adjust", { newBalanceInCents, description });

export const refundNfcCard = (t: string, e: string, id: string, amountInCents: number, description?: string) =>
  postFinancial(t, e, id, "refund", { amountInCents, description });



export const NFC_TYPE_LABEL: Record<NfcCardType, string> = {
  CUSTOMER: "Cliente",
  VIP: "VIP",
  STAFF: "Equipe",
  COMANDA: "Comanda",
};

export const NFC_STATUS_LABEL: Record<NfcCardStatus, string> = {
  ACTIVE: "Ativo",
  BLOCKED: "Bloqueado",
  LOST: "Perdido",
};

export function formatBRL(cents?: number | null): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function normalizeUidDisplay(uid: string): string {
  return uid.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
}
