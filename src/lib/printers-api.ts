import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type PrinterSector = "FULL_ORDER" | "BAR" | "KITCHEN";
export type PrinterPaper = "58mm" | "80mm";
export type PrinterConnectionType = "TCP_IP" | "SK210_LOCAL";

export interface PrinterItem {
  id: string;
  eventId?: string;
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress: string;
  port: number;
  sector: PrinterSector;
  paperSize: PrinterPaper;
  active: boolean;
  // legacy alias
  ip?: string;
  [k: string]: unknown;
}

export interface CreatePrinterInput {
  name: string;
  connectionType: PrinterConnectionType;
  ipAddress: string;
  port: number;
  sector: PrinterSector;
  paperSize: PrinterPaper;
  active?: boolean;
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

function normalize(p: PrinterItem): PrinterItem {
  return {
    ...p,
    connectionType: (p.connectionType ?? "TCP_IP") as PrinterConnectionType,
    ipAddress: (p.ipAddress ?? p.ip ?? "") as string,
  };
}

export async function listPrinters(token: string, eventId: string): Promise<PrinterItem[]> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/printers`, {
    headers: authHeaders(token),
  });
  const data = await handle<unknown>(res);
  return unwrap<PrinterItem>(data, "printers").map(normalize);
}

export async function createPrinter(token: string, eventId: string, input: CreatePrinterInput): Promise<PrinterItem> {
  const res = await apiFetch(`${API_BASE_URL}/events/${encodeURIComponent(eventId)}/printers`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<PrinterItem | { printer: PrinterItem }>(res);
  const printer = "printer" in (data as object) ? (data as { printer: PrinterItem }).printer : (data as PrinterItem);
  return normalize(printer);
}

export async function updatePrinter(
  token: string,
  printerId: string,
  patch: Partial<CreatePrinterInput>,
): Promise<PrinterItem> {
  const res = await apiFetch(`${API_BASE_URL}/printers/${encodeURIComponent(printerId)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(patch),
  });
  const data = await handle<PrinterItem | { printer: PrinterItem }>(res);
  const printer = "printer" in (data as object) ? (data as { printer: PrinterItem }).printer : (data as PrinterItem);
  return normalize(printer);
}

export async function testPrinter(token: string, printerId: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/printers/${encodeURIComponent(printerId)}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw await fromResponse(res);
}
