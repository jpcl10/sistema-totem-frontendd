import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

/**
 * Print queue / thermal receipt persistence layer.
 *
 * Architecture goals:
 * - Pure frontend persistence (localStorage) so we can deliver the entire
 *   operational flow before the physical printer is wired.
 * - Clean abstraction (`PrinterAdapter`) so Epson / Elgin / Bematech / USB /
 *   Network drivers can later be plugged in without touching call sites.
 * - Idempotent enqueueing keyed by `${orderId}:${sector}` so reloading orders
 *   never duplicates comandas.
 */

export type PrintSector = "BAR" | "KITCHEN";
export type PrintJobStatus = "PENDING" | "PRINTED" | "ERROR" | "CANCELLED";

export interface PrintItem {
  productId?: string;
  name: string;
  quantity: number;
  priceInCents: number;
  notes?: string;
  sector: PrintSector;
}

export interface PrintPayload {
  /** Free-form ESC/POS-friendly preview text (one item per line). */
  text: string;
  eventName: string;
  eventId?: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  createdAt: string;
  sector: PrintSector;
  items: PrintItem[];
  totalInCents: number;
  orderTotalInCents: number;
  status: string;
  printer?: {
    name?: string;
    connectionType?: string;
  };
}

export interface PrintJob {
  id: string;
  orderId: string;
  orderNumber: string;
  sector: PrintSector;
  status: PrintJobStatus;
  createdAt: string;
  updatedAt: string;
  printedAt?: string;
  attempts: number;
  lastError?: string;
  payload: PrintPayload;
}

// ---------- Persistence ----------

const STORAGE_KEY = "admin.printQueue.v1";
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) {
    try { l(); } catch { /* ignore */ }
  }
}

export function subscribePrintQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function readAll(): PrintJob[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrintJob[]) : [];
  } catch {
    return [];
  }
}

function writeAll(jobs: PrintJob[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
    notify();
  } catch { /* ignore quota */ }
}

export function listJobs(): PrintJob[] {
  return readAll().sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export function listJobsByStatus(status: PrintJobStatus | "ALL"): PrintJob[] {
  const all = listJobs();
  if (status === "ALL") return all;
  return all.filter((j) => j.status === status);
}

// ---------- Sector resolution ----------

type AnyRecord = Record<string, unknown>;

function pickSectorString(value: unknown): PrintSector | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.toUpperCase();
  if (v === "BAR") return "BAR";
  if (v === "KITCHEN" || v === "COZINHA") return "KITCHEN";
  return undefined;
}

/** Walks common shapes (item.sector, item.category.sector, item.product.category.sector...) */
function resolveItemSector(
  raw: AnyRecord,
  categoryIndex: Map<string, PrintSector>,
): PrintSector {
  const candidates: unknown[] = [
    raw.sector,
    (raw.category as AnyRecord | undefined)?.sector,
    (raw.catalogCategory as AnyRecord | undefined)?.sector,
    ((raw.catalogProduct as AnyRecord | undefined)?.catalogCategory as AnyRecord | undefined)?.sector,
    ((raw.catalogProduct as AnyRecord | undefined)?.category as AnyRecord | undefined)?.sector,
    ((raw.product as AnyRecord | undefined)?.category as AnyRecord | undefined)?.sector,
    ((raw.product as AnyRecord | undefined)?.catalogCategory as AnyRecord | undefined)?.sector,
  ];
  for (const c of candidates) {
    const s = pickSectorString(c);
    if (s) return s;
  }
  const categoryId =
    (typeof raw.categoryId === "string" ? raw.categoryId : undefined) ??
    (typeof (raw.product as AnyRecord | undefined)?.categoryId === "string"
      ? ((raw.product as AnyRecord).categoryId as string)
      : undefined);
  if (categoryId && categoryIndex.has(categoryId)) return categoryIndex.get(categoryId)!;
  // default fallback bucket
  return "KITCHEN";
}

// ---------- Receipt formatting (ESC/POS-friendly plain text) ----------

function pad(s: string, n: number) { return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length); }
function money(c: number) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

function buildReceiptText(p: Omit<PrintPayload, "text">): string {
  const width = 32; // 58mm = ~32 cols
  const line = "-".repeat(width);
  const center = (s: string) => {
    const t = s.length >= width ? s.slice(0, width) : " ".repeat(Math.max(0, Math.floor((width - s.length) / 2))) + s;
    return t;
  };
  const rows: string[] = [];
  rows.push(center(p.eventName.toUpperCase()));
  rows.push(center(`COMANDA ${p.sector === "BAR" ? "BAR" : "COZINHA"}`));
  rows.push(line);
  rows.push(`Pedido: ${p.orderNumber}`);
  rows.push(`Cliente: ${p.customerName}`);
  rows.push(`Data: ${new Date(p.createdAt).toLocaleString("pt-BR")}`);
  rows.push(`Status: ${p.status}`);
  rows.push(line);
  for (const it of p.items) {
    rows.push(`${pad(String(it.quantity) + "x", 4)}${pad(it.name, width - 4)}`);
    if (it.notes) rows.push(`   obs: ${it.notes}`);
  }
  rows.push(line);
  rows.push(`Subtotal setor: ${money(p.totalInCents)}`);
  rows.push(`Total pedido:   ${money(p.orderTotalInCents)}`);
  rows.push(line);
  rows.push(center("via " + p.sector));
  return rows.join("\n");
}

// ---------- Enqueue ----------

export interface OrderLike {
  id: string;
  number?: number | string;
  orderNumber?: number | string;
  code?: string;
  customerName?: string;
  customer?: { name?: string } | string;
  status?: string;
  createdAt?: string;
  totalInCents?: number;
  total?: number;
  items?: Array<AnyRecord>;
  eventId?: string;
}

interface EnqueueContext {
  eventName: string;
  eventId?: string;
  /** Optional categoryId -> sector index (from public menu). */
  categoryIndex?: Map<string, PrintSector>;
}

function orderNumberOf(o: OrderLike): string {
  const n = o.number ?? o.orderNumber ?? o.code ?? o.id.slice(-6).toUpperCase();
  return String(n);
}

function customerOf(o: OrderLike): string {
  if (typeof o.customer === "string") return o.customer;
  if (o.customer && typeof o.customer === "object" && o.customer.name) return o.customer.name;
  return o.customerName ?? "Cliente";
}

function orderTotal(o: OrderLike): number {
  if (typeof o.totalInCents === "number") return o.totalInCents;
  if (typeof o.total === "number") return Math.round(o.total * 100);
  let sum = 0;
  for (const it of o.items ?? []) {
    const q = Number(it.quantity ?? it.qty ?? 0);
    const p = Number(it.priceInCents ?? (typeof it.price === "number" ? it.price * 100 : 0));
    sum += q * p;
  }
  return sum;
}

/**
 * Idempotently create one print job per sector for the given order.
 * Returns the (possibly already-existing) jobs.
 */
export function enqueueJobsForOrder(order: OrderLike, ctx: EnqueueContext): PrintJob[] {
  const all = readAll();
  const existingKeys = new Set(all.map((j) => `${j.orderId}:${j.sector}`));
  const categoryIndex = ctx.categoryIndex ?? new Map<string, PrintSector>();

  const bySector = new Map<PrintSector, PrintItem[]>();
  for (const raw of order.items ?? []) {
    const sector = resolveItemSector(raw, categoryIndex);
    const item: PrintItem = {
      productId: typeof raw.productId === "string" ? raw.productId : undefined,
      name:
        (typeof raw.name === "string" && raw.name) ||
        (typeof raw.productName === "string" && raw.productName) ||
        "Item",
      quantity: Number(raw.quantity ?? raw.qty ?? 1),
      priceInCents: Number(
        raw.priceInCents ?? (typeof raw.price === "number" ? raw.price * 100 : 0),
      ),
      notes: typeof raw.notes === "string" ? raw.notes : undefined,
      sector,
    };
    const list = bySector.get(sector) ?? [];
    list.push(item);
    bySector.set(sector, list);
  }

  const orderNumber = orderNumberOf(order);
  const customerName = customerOf(order);
  const createdAt = order.createdAt ?? new Date().toISOString();
  const status = order.status ?? "PENDING";
  const totalAll = orderTotal(order);
  const newJobs: PrintJob[] = [];

  for (const [sector, items] of bySector) {
    const key = `${order.id}:${sector}`;
    if (existingKeys.has(key)) continue;
    const sectorTotal = items.reduce((s, i) => s + i.priceInCents * i.quantity, 0);
    const basePayload: Omit<PrintPayload, "text"> = {
      eventName: ctx.eventName,
      eventId: ctx.eventId,
      orderId: order.id,
      orderNumber,
      customerName,
      createdAt,
      sector,
      items,
      totalInCents: sectorTotal,
      orderTotalInCents: totalAll,
      status,
    };
    const payload: PrintPayload = { ...basePayload, text: buildReceiptText(basePayload) };
    const now = new Date().toISOString();
    // We no longer create local jobs for the Print Queue page.
    // The Print Queue should only display jobs fetched from the backend.
  }

  return all.filter((j) => j.orderId === order.id);
}

// ---------- Mutations ----------

function update(id: string, patch: Partial<PrintJob>) {
  const all = readAll();
  const next = all.map((j) => (j.id === id ? { ...j, ...patch, updatedAt: new Date().toISOString() } : j));
  writeAll(next);
}

export function markPrinted(id: string) {
  update(id, { status: "PRINTED", printedAt: new Date().toISOString() });
}
export function markError(id: string, message: string) {
  const all = readAll();
  const j = all.find((x) => x.id === id);
  update(id, { status: "ERROR", lastError: message, attempts: (j?.attempts ?? 0) + 1 });
}
export function reprint(id: string) {
  const all = readAll();
  const j = all.find((x) => x.id === id);
  if (!j) return;
  update(id, { status: "PENDING", lastError: undefined, attempts: (j.attempts ?? 0) + 1 });
}
export function cancelJob(id: string) {
  update(id, { status: "CANCELLED" });
}
export function removeJob(id: string) {
  writeAll(readAll().filter((j) => j.id !== id));
}

export async function listEventPrintJobs(token: string, eventId: string, params?: Record<string, string>): Promise<PrintJob[]> {
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/print-jobs${query}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
  const data = await res.json();
  const remoteJobs = Array.isArray(data) ? data : (data.printJobs || data.jobs || []);
  
  // Clean local storage and sync ONLY backend jobs
  // We keep localStorage for persistence of current event's state if offline,
  // but we must ensure we don't have "local-" jobs anymore.
  const localJobs = readAll().filter(j => !j.id.startsWith('local-'));
  const localMap = new Map(localJobs.map(j => [j.id, j]));
  
  const finalJobs: PrintJob[] = [];
  for (const rj of remoteJobs) {
    // Backend jobs must have a real ID
    finalJobs.push(rj);
  }
  
  // Overwrite local storage with strictly backend data for this event
  // to prevent "local-" contamination
  writeAll(finalJobs);
  
  return finalJobs;
}

export async function createTestPrintJobRequest(
  token: string,
  eventId: string,
  input: { deviceId: string; printerId?: string | null; sector: "GENERAL" | "BAR" | "KITCHEN" },
): Promise<PrintJob> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/print-jobs/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw await fromResponse(res);
  const data = await res.json();
  return (data.printJob || data) as PrintJob;
}

export async function cancelPrintJobRequest(token: string, id: string) {
  const res = await apiFetch(`${API_BASE_URL}/print-jobs/${encodeURIComponent(id)}/cancel`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
  cancelJob(id);
}

export async function markAsPrintedRequest(token: string, id: string) {
  const res = await apiFetch(`${API_BASE_URL}/print-jobs/${encodeURIComponent(id)}/printed`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
  markPrinted(id);
}

export async function retryPrintJobRequest(token: string, id: string) {
  const res = await apiFetch(`${API_BASE_URL}/print-jobs/${encodeURIComponent(id)}/retry`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
  reprint(id);
}

export function clearAll() { writeAll([]); }

// ---------- Printer Adapter abstraction (future hardware) ----------
//
// Implementations will live in src/lib/printers/{epson,elgin,bematech}.ts
// and be registered here. None are wired yet — kept as documented contract.

export interface PrinterAdapter {
  id: string;            // "epson-usb", "elgin-network", ...
  label: string;         // "Epson TM-T20 (USB)"
  brand: "EPSON" | "ELGIN" | "BEMATECH" | "GENERIC";
  transport: "USB" | "NETWORK" | "SERIAL" | "BLUETOOTH";
  /** Sends raw ESC/POS bytes to the device. */
  print(payload: PrintPayload): Promise<void>;
}

const adapters = new Map<string, PrinterAdapter>();
export function registerPrinterAdapter(a: PrinterAdapter) { adapters.set(a.id, a); }
export function listPrinterAdapters(): PrinterAdapter[] { return [...adapters.values()]; }
