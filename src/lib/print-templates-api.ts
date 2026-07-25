import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

export type PrintTemplateType = "PRODUCTION" | "CUSTOMER" | "DELIVERY" | "CASHIER" | "TEST";
export type TemplatePrintMode = "FULL_ORDER" | "BY_SECTOR" | "ONE_TICKET_PER_ITEM";

export type PrintTemplate = {
  id: string;
  organizationId?: string | null;
  eventId?: string | null;
  printerId?: string | null;
  name: string;
  templateType: PrintTemplateType;
  paperWidthMm: 58 | 80;
  logoUrl?: string | null;
  logoEnabled: boolean;
  logoWidthPx: number;
  title?: string | null;
  subtitle?: string | null;
  showOrderNumber: boolean;
  showDate: boolean;
  showTime: boolean;
  showOrigin: boolean;
  showOperator: boolean;
  showCustomer: boolean;
  showSector: boolean;
  showObservations: boolean;
  itemFontSize: number;
  titleFontSize: number;
  quantityBold: boolean;
  footerText?: string | null;
  copies: number;
  feedLines: number;
  autoCut: boolean;
  printMode: TemplatePrintMode;
  isDefault: boolean;
  isActive: boolean;
};

export type PrintTemplatePreview = {
  paperWidthMm: 58 | 80;
  columns: number;
  lines: Array<{
    type: "text" | "separator" | "logo" | "blank";
    text?: string;
    align?: "left" | "center" | "right";
    bold?: boolean;
    size?: "normal" | "large";
    url?: string;
    widthPx?: number;
  }>;
};

export type PrintTemplateInput = Omit<PrintTemplate, "id">;

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return res.json() as Promise<T>;
}

export async function listPrintTemplates(token: string): Promise<PrintTemplate[]> {
  const res = await apiFetch(`${API_BASE_URL}/print-templates`, {
    headers: authHeaders(token),
  });
  const data = await handle<{ templates: PrintTemplate[] }>(res);
  return data.templates;
}

export async function createPrintTemplate(token: string, input: PrintTemplateInput): Promise<PrintTemplate> {
  const res = await apiFetch(`${API_BASE_URL}/print-templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<{ template: PrintTemplate }>(res);
  return data.template;
}

export async function updatePrintTemplate(token: string, id: string, input: Partial<PrintTemplateInput>): Promise<PrintTemplate> {
  const res = await apiFetch(`${API_BASE_URL}/print-templates/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify(input),
  });
  const data = await handle<{ template: PrintTemplate }>(res);
  return data.template;
}

export async function duplicatePrintTemplate(token: string, id: string): Promise<PrintTemplate> {
  const res = await apiFetch(`${API_BASE_URL}/print-templates/${encodeURIComponent(id)}/duplicate`, {
    method: "POST",
    headers: authHeaders(token),
  });
  const data = await handle<{ template: PrintTemplate }>(res);
  return data.template;
}

export async function setDefaultPrintTemplate(token: string, id: string): Promise<PrintTemplate> {
  const res = await apiFetch(`${API_BASE_URL}/print-templates/${encodeURIComponent(id)}/default`, {
    method: "POST",
    headers: authHeaders(token),
  });
  const data = await handle<{ template: PrintTemplate }>(res);
  return data.template;
}

export async function deletePrintTemplate(token: string, id: string): Promise<void> {
  const res = await apiFetch(`${API_BASE_URL}/print-templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
}

export async function previewPrintTemplate(token: string, template: Partial<PrintTemplateInput>): Promise<PrintTemplatePreview> {
  const res = await apiFetch(`${API_BASE_URL}/print-templates/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders(token) },
    body: JSON.stringify({ template }),
  });
  return handle<PrintTemplatePreview>(res);
}
