import { API_BASE_URL, authHeaders } from "./auth";
import { apiFetch, fromResponse } from "./api-error";

/* -------------------------------------------------------------------------- */
/* Types — mirror the real backend contract. Slots without a stable shape yet */
/* remain `unknown` so we never invent fields.                                */
/* -------------------------------------------------------------------------- */

export type BusinessHourChannel = "ALL" | "DELIVERY" | "PICKUP" | "DIGITAL_MENU" | "TOTEM" | "COUNTER";

export type BusinessHourContext = "ORGANIZATION" | "ONLINE_STORE" | "EVENT";

export type BrandingTheme = "LIGHT" | "DARK" | "SYSTEM" | string;

export interface GeneralSettings {
  legalName?: string | null;
  document?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  timezone?: string | null;
  locale?: string | null;
  currency?: string | null;
}

export interface BrandingSettings {
  logoUrl?: string | null;
  lightLogoUrl?: string | null;
  darkLogoUrl?: string | null;
  faviconUrl?: string | null;
  bannerDesktopUrl?: string | null;
  bannerMobileUrl?: string | null;
  socialImageUrl?: string | null;
  defaultProductImageUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  backgroundColor?: string | null;
  theme?: BrandingTheme | null;
}

export interface BusinessHourPeriod {
  open: string; // HH:mm
  close: string; // HH:mm
}

export interface BusinessHourDay {
  weekday: number; // 0..6
  open: boolean;
  is24h?: boolean;
  periods: BusinessHourPeriod[];
  channel: BusinessHourChannel;
  context: BusinessHourContext;
  contextId?: string | null;
  storeId?: string | null;
}

export interface BusinessHourException {
  id: string;
  date: string; // YYYY-MM-DD
  channel: BusinessHourChannel;
  context: BusinessHourContext;
  contextId?: string | null;
  storeId?: string | null;
  closed: boolean;
  is24h?: boolean;
  open?: string | null;
  close?: string | null;
  reason?: string | null;
}

export interface BusinessHoursPayload {
  weekly: BusinessHourDay[];
  exceptions: BusinessHourException[];
}

export interface SettingsPermissions {
  [key: string]: boolean | undefined;
}

export interface SettingsCapabilities {
  hasTotem?: boolean;
  hasPrinting?: boolean;
  hasOnlineOrders?: boolean;
  hasDelivery?: boolean;
  hasEvents?: boolean;
  hasPayments?: boolean;
  [key: string]: boolean | undefined;
}

export interface SettingsRoot {
  version: number;
  updatedAt: string;
  general: GeneralSettings;
  branding: BrandingSettings;
  businessHours: BusinessHoursPayload;
  onlineOrders: unknown | null;
  delivery: unknown | null;
  payments: unknown | null;
  printing: unknown | null;
  production: unknown | null;
  operation: unknown | null;
  totem: unknown | null;
  digitalMenu: unknown | null;
  notifications: unknown | null;
  integrations: unknown | null;
  security: unknown | null;
  modules: string[];
  permissions: SettingsPermissions;
  capabilities: SettingsCapabilities;
  existing: Record<string, unknown>;
  sources: Record<string, unknown>;
  effective: Record<string, unknown>;
}

export interface EffectiveSettings {
  openNow?: boolean;
  source?: "ORGANIZATION" | "ONLINE_STORE" | "EXCEPTION" | "OVERRIDE" | string;
  [key: string]: unknown;
}

export interface BusinessHoursFilters {
  contextType?: BusinessHourContext;
  context?: BusinessHourContext;
  contextId?: string | null;
  channel?: BusinessHourChannel;
  storeId?: string | null;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) throw await fromResponse(res);
  return (await res.json()) as T;
}

/* ---------------------------- Root & general ------------------------------ */

export async function getSettings(token: string): Promise<SettingsRoot> {
  const res = await apiFetch(`${API_BASE_URL}/settings`, {
    headers: authHeaders(token),
  });
  return handle<SettingsRoot>(res);
}

export async function updateGeneralSettings(
  token: string,
  body: Partial<GeneralSettings>,
): Promise<GeneralSettings> {
  const res = await apiFetch(`${API_BASE_URL}/settings/general`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<GeneralSettings>(res);
}

/* ------------------------------- Branding --------------------------------- */

/**
 * Normalize the /settings/branding response.
 *
 * The endpoint has shipped under different wrappers over time
 * (`{ branding: {...} }`, `{ settings: {...} }`, `{ data: {...} }`, or the
 * flat object). Accept every known shape so form hydration is resilient.
 */
export function unwrapBrandingResponse(response: unknown): BrandingSettings {
  const r = (response ?? {}) as Record<string, unknown>;
  const candidate =
    (r.branding as Record<string, unknown> | undefined) ??
    (r.settings as Record<string, unknown> | undefined) ??
    ((r.data as Record<string, unknown> | undefined)?.branding as
      | Record<string, unknown>
      | undefined) ??
    (r.data as Record<string, unknown> | undefined) ??
    r;
  return (candidate ?? {}) as BrandingSettings;
}

export async function getBrandingSettings(token: string): Promise<BrandingSettings> {
  const res = await apiFetch(`${API_BASE_URL}/settings/branding`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
  const raw = await res.json();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[branding] GET response", raw);
  }
  return unwrapBrandingResponse(raw);
}

export async function updateBrandingSettings(
  token: string,
  body: Partial<BrandingSettings>,
): Promise<BrandingSettings> {
  const res = await apiFetch(`${API_BASE_URL}/settings/branding`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await fromResponse(res);
  const raw = await res.json();
  return unwrapBrandingResponse(raw);
}

/* ---------------------------- Business hours ------------------------------ */

function toQuery(filters?: BusinessHoursFilters): string {
  if (!filters) return "";
  const p = new URLSearchParams();
  const contextType = filters.contextType ?? filters.context;
  const contextId = filters.contextId ?? filters.storeId ?? null;
  if (contextType && contextType !== "EVENT") p.set("contextType", contextType);
  if (filters.channel) p.set("channel", filters.channel);
  if (contextId && contextType === "ONLINE_STORE") p.set("storeId", contextId);
  if (contextId && contextType === "EVENT") p.set("eventId", contextId);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Accept `true`, `"true"`, `1`, `"1"` as truthy; anything else falsy. */
function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") return v.toLowerCase() === "true" || v === "1";
  return false;
}

/** Normalize time strings to "HH:mm" without TZ conversion. */
function toHHmm(v: unknown): string | null {
  if (v == null) return null;
  const m = String(v).match(/(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

function pickArray(raw: unknown, keys: string[]): unknown[] {
  if (Array.isArray(raw)) return raw;
  const r = (raw ?? {}) as Record<string, unknown>;
  for (const k of keys) if (Array.isArray(r[k])) return r[k] as unknown[];
  for (const wrapper of [
    "data",
    "settings",
    "businessHours",
    "business_hours",
    "payload",
    "result",
    "results",
    "items",
    "rows",
    "records",
  ]) {
    const nested = r[wrapper];
    if (nested && typeof nested === "object") {
      const found = pickArray(nested, keys);
      if (found.length > 0) return found;
    }
  }
  return [];
}

/**
 * Normalize /settings/business-hours into `{ weekly, exceptions }`.
 * Supports the official backend shape:
 *  - `{ businessHours: { weekly: [{ dayOfWeek, isClosed, is24Hours, opensAt, closesAt, ... }], exceptions: [...] } }`
 *  - one row per day/period, grouped into the screen's day model.
 */
export function unwrapBusinessHoursResponse(
  raw: unknown,
  filters?: BusinessHoursFilters,
): BusinessHoursPayload {
  const context = filters?.contextType ?? filters?.context ?? "ORGANIZATION";
  const channel = filters?.channel ?? "ALL";
  const contextId = filters?.contextId ?? filters?.storeId ?? null;
  const storeId = context === "ONLINE_STORE" ? contextId : null;

  const weeklyRaw = pickArray(raw, [
    "weekly",
    "hours",
    "businessHours",
    "business_hours",
    "days",
    "items",
    "rows",
    "records",
    "results",
    "data",
  ]);
  const exceptionsRaw = pickArray(raw, ["exceptions"]);

  const weeklyByDay = new Map<number, BusinessHourDay>();

  for (const row of weeklyRaw) {
    const r = (row ?? {}) as Record<string, unknown>;
    const weekday = Number(r.weekday ?? r.dayOfWeek ?? r.day ?? 0);
    const isClosed =
      r.isClosed !== undefined ? toBool(r.isClosed) : !toBool(r.open ?? r.isOpen ?? r.enabled);
    const open = !isClosed;
    const is24h = toBool(r.is24Hours ?? r.is24h ?? r.allDay);
    const rowChannel = ((r.channel as BusinessHourChannel) ?? channel) as BusinessHourChannel;
    const rowContext = ((r.contextType ?? r.context) as BusinessHourContext) ?? context;
    const rowContextId =
      (r.contextId as string | undefined) ??
      (r.storeId as string | undefined) ??
      (r.eventId as string | undefined) ??
      contextId;
    const rowStoreId =
      (r.storeId as string | undefined) ??
      (rowContext === "ONLINE_STORE" ? rowContextId : storeId);

    const day =
      weeklyByDay.get(weekday) ?? {
        weekday,
        open: false,
        is24h: false,
        periods: [],
        channel: rowChannel,
        context: rowContext,
        contextId: rowContextId,
        storeId: rowStoreId,
      };

    if (!open) {
      weeklyByDay.set(weekday, day);
      continue;
    }

    day.open = true;
    day.channel = rowChannel;
    day.context = rowContext;
    day.contextId = rowContextId;
    day.storeId = rowStoreId;

    if (is24h) {
      day.is24h = true;
      day.periods = [];
      weeklyByDay.set(weekday, day);
      continue;
    }

    let periods: BusinessHourPeriod[] = [];
    if (Array.isArray(r.periods) && r.periods.length > 0) {
      periods = (r.periods as Array<Record<string, unknown>>)
        .map((p) => ({
          open: toHHmm(p.opensAt ?? p.open ?? p.openTime ?? p.start) ?? "",
          close: toHHmm(p.closesAt ?? p.close ?? p.closeTime ?? p.end) ?? "",
        }))
        .filter((p) => p.open && p.close);
    } else {
      const o = toHHmm(r.opensAt ?? r.openTime ?? r.open);
      const c = toHHmm(r.closesAt ?? r.closeTime ?? r.close);
      if (o && c) periods = [{ open: o, close: c }];
    }

    day.periods.push(...periods);
    weeklyByDay.set(weekday, day);
  }

  const weekly = [...weeklyByDay.values()].sort((a, b) => a.weekday - b.weekday);

  const exceptions: BusinessHourException[] = exceptionsRaw.map((row) => {
    const r = (row ?? {}) as Record<string, unknown>;
    return {
      id: String(r.id ?? ""),
      date: String(r.date ?? ""),
      channel: ((r.channel as BusinessHourChannel) ?? channel) as BusinessHourChannel,
      context: ((r.contextType ?? r.context) as BusinessHourContext) ?? context,
      contextId:
        (r.contextId as string | undefined) ??
        (r.storeId as string | undefined) ??
        (r.eventId as string | undefined) ??
        contextId,
      storeId: (r.storeId as string | undefined) ?? (r.contextId as string | undefined) ?? storeId,
      closed: toBool(r.isClosed ?? r.closed),
      is24h: toBool(r.is24Hours ?? r.is24h),
      open: toHHmm(r.opensAt ?? r.open ?? r.openTime),
      close: toHHmm(r.closesAt ?? r.close ?? r.closeTime),
      reason: (r.reason as string | null | undefined) ?? null,
    };
  });

  return { weekly, exceptions };
}

export async function getBusinessHours(
  token: string,
  filters?: BusinessHoursFilters,
): Promise<BusinessHoursPayload> {
  const res = await apiFetch(`${API_BASE_URL}/settings/business-hours${toQuery(filters)}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw await fromResponse(res);
  const raw = await res.json();
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.debug("[business-hours] GET", filters, raw);
  }
  return unwrapBusinessHoursResponse(raw, filters);
}

export async function replaceBusinessHours(
  token: string,
  body: {
    weekly: BusinessHourDay[];
    context: BusinessHourContext;
    channel: BusinessHourChannel;
    contextId?: string | null;
    storeId?: string | null;
  },
): Promise<BusinessHoursPayload> {
  const contextId = body.contextId ?? body.storeId ?? null;
  const hours = body.weekly.flatMap((d) => {
    if (!d.open) {
      return [{
        dayOfWeek: d.weekday,
        periodIndex: 0,
        opensAt: "00:00",
        closesAt: "00:00",
        isClosed: true,
        is24Hours: false,
      }];
    }

    if (d.is24h) {
      return [{
        dayOfWeek: d.weekday,
        periodIndex: 0,
        opensAt: "00:00",
        closesAt: "23:59",
        isClosed: false,
        is24Hours: true,
      }];
    }

    return d.periods.map((period, periodIndex) => ({
      dayOfWeek: d.weekday,
      periodIndex,
      opensAt: period.open,
      closesAt: period.close,
      isClosed: false,
      is24Hours: false,
    }));
  });
  const payload = {
    contextType: body.context,
    storeId: body.context === "ONLINE_STORE" ? contextId : null,
    hours,
  };
  const res = await apiFetch(`${API_BASE_URL}/settings/business-hours`, {
    method: "PUT",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await fromResponse(res);
  const raw = await res.json();
  return unwrapBusinessHoursResponse(raw, {
    context: body.context,
    channel: body.channel,
    contextId,
    storeId: body.context === "ONLINE_STORE" ? contextId : null,
  });
}

export type NewBusinessHourException = Omit<BusinessHourException, "id">;

export async function createBusinessHourException(
  token: string,
  body: NewBusinessHourException,
): Promise<BusinessHourException> {
  const res = await apiFetch(`${API_BASE_URL}/settings/business-hours/exceptions`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<BusinessHourException>(res);
}

export async function updateBusinessHourException(
  token: string,
  id: string,
  body: Partial<NewBusinessHourException>,
): Promise<BusinessHourException> {
  const res = await apiFetch(
    `${API_BASE_URL}/settings/business-hours/exceptions/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handle<BusinessHourException>(res);
}

export async function deleteBusinessHourException(token: string, id: string): Promise<void> {
  const res = await apiFetch(
    `${API_BASE_URL}/settings/business-hours/exceptions/${encodeURIComponent(id)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  if (!res.ok) throw await fromResponse(res);
}

/* ------------------------------- Effective -------------------------------- */

export async function getEffectiveSettings(
  token: string,
  filters?: BusinessHoursFilters,
): Promise<EffectiveSettings> {
  const res = await apiFetch(`${API_BASE_URL}/settings/effective${toQuery(filters)}`, {
    headers: authHeaders(token),
  });
  return handle<EffectiveSettings>(res);
}

/* ========================================================================== */
/* Fase 2A — Loja Online / Delivery / Delivery Rules                          */
/* Fonte: docs/api/settings-phase2-contracts.md                               */
/* Reproduz EXATAMENTE os DTOs documentados. Não renomear, não adicionar.     */
/* ========================================================================== */

export type OnlineStoreSettingsSource = "ONLINE_STORE_SETTINGS" | "DEFAULT";
export type DeliveryFeeRuleType = "FLAT" | "NEIGHBORHOOD";

/** Persisted OnlineStoreSettings row (full record). */
export interface OnlineStoreSettings {
  id: string;
  organizationId: string;
  storeId: string;
  onlineOrderingEnabled: boolean;
  digitalMenuEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  counterEnabled: boolean;
  dineInEnabled: boolean;
  allowOrdersOutsideHours: boolean;
  autoAcceptOrders: boolean;
  minimumOrderInCents: number;
  estimatedPreparationMinutes: number;
  estimatedDeliveryMinutes: number;
  freeDeliveryAboveInCents: number | null;
  defaultDeliveryFeeInCents: number;
  closedMessage: string | null;
  checkoutNotice: string | null;
  orderConfirmationMessage: string | null;
  requireCustomerName: boolean;
  requireCustomerPhone: boolean;
  requireDeliveryAddress: boolean;
  allowCustomerNotes: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Effective view served by GET /settings/online-orders. */
export interface OnlineOrdersEffective {
  onlineOrderingEnabled: boolean;
  digitalMenuEnabled: boolean;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  counterEnabled: boolean;
  dineInEnabled: boolean;
  allowOrdersOutsideHours: boolean;
  autoAcceptOrders: boolean;
  minimumOrderInCents: number;
  estimatedPreparationMinutes: number;
  estimatedDeliveryMinutes: number;
  freeDeliveryAboveInCents: number | null;
  defaultDeliveryFeeInCents: number;
  closedMessage: string | null;
  checkoutNotice: string | null;
  orderConfirmationMessage: string | null;
  requireCustomerName: boolean;
  requireCustomerPhone: boolean;
  requireDeliveryAddress: boolean;
  allowCustomerNotes: boolean;
}

export interface GetOnlineOrdersSettingsResponse {
  storeId: string;
  settings: OnlineStoreSettings | null;
  effective: OnlineOrdersEffective;
  source: OnlineStoreSettingsSource;
}

export interface UpdateOnlineOrdersSettingsBody {
  onlineOrderingEnabled?: boolean;
  digitalMenuEnabled?: boolean;
  autoAcceptOrders?: boolean;
  minimumOrderInCents?: number;
  estimatedPreparationMinutes?: number;
  allowOrdersOutsideHours?: boolean;
  closedMessage?: string | null;
  checkoutNotice?: string | null;
  orderConfirmationMessage?: string | null;
  requireCustomerName?: boolean;
  requireCustomerPhone?: boolean;
  allowCustomerNotes?: boolean;
}

export interface UpdateOnlineOrdersSettingsResponse {
  settings: OnlineStoreSettings;
}

export interface DeliveryEffective {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  counterEnabled: boolean;
  dineInEnabled: boolean;
  estimatedDeliveryMinutes: number;
  freeDeliveryAboveInCents: number | null;
  defaultDeliveryFeeInCents: number;
  requireDeliveryAddress: boolean;
}

export interface GetDeliverySettingsResponse {
  storeId: string;
  settings: OnlineStoreSettings | null;
  delivery: DeliveryEffective;
  source: OnlineStoreSettingsSource;
}

export interface UpdateDeliverySettingsBody {
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  counterEnabled?: boolean;
  dineInEnabled?: boolean;
  allowOrdersOutsideHours?: boolean;
  estimatedDeliveryMinutes?: number;
  freeDeliveryAboveInCents?: number | null;
  defaultDeliveryFeeInCents?: number;
  requireDeliveryAddress?: boolean;
}

export interface UpdateDeliverySettingsResponse {
  settings: OnlineStoreSettings;
}

export interface DeliveryFeeRule {
  id: string;
  organizationId: string;
  storeId: string;
  name: string;
  type: DeliveryFeeRuleType;
  neighborhood: string | null;
  feeInCents: number;
  estimatedMinutes: number | null;
  minimumOrderInCents: number | null;
  freeDeliveryAboveInCents: number | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ListDeliveryFeeRulesResponse {
  rules: DeliveryFeeRule[];
}

export interface CreateDeliveryFeeRuleBody {
  storeId: string;
  name: string;
  type: DeliveryFeeRuleType;
  neighborhood?: string | null;
  feeInCents: number;
  estimatedMinutes?: number | null;
  minimumOrderInCents?: number | null;
  freeDeliveryAboveInCents?: number | null;
  active?: boolean;
  sortOrder?: number;
}

export interface UpdateDeliveryFeeRuleBody {
  name?: string;
  type?: DeliveryFeeRuleType;
  neighborhood?: string | null;
  feeInCents?: number;
  estimatedMinutes?: number | null;
  minimumOrderInCents?: number | null;
  freeDeliveryAboveInCents?: number | null;
  active?: boolean;
  sortOrder?: number;
}

export interface DeliveryFeeRuleMutationResponse {
  rule: DeliveryFeeRule;
}

export interface DeleteDeliveryFeeRuleResponse {
  deleted: true;
}

function storeQuery(storeId: string): string {
  return `?storeId=${encodeURIComponent(storeId)}`;
}

/* ------------------------- Online Orders settings ------------------------- */

export async function getOnlineOrdersSettings(
  token: string,
  storeId: string,
): Promise<GetOnlineOrdersSettingsResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/online-orders${storeQuery(storeId)}`, {
    headers: authHeaders(token),
  });
  return handle<GetOnlineOrdersSettingsResponse>(res);
}

export async function updateOnlineOrdersSettings(
  token: string,
  storeId: string,
  body: UpdateOnlineOrdersSettingsBody,
): Promise<UpdateOnlineOrdersSettingsResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/online-orders${storeQuery(storeId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<UpdateOnlineOrdersSettingsResponse>(res);
}

/* ----------------------------- Delivery settings -------------------------- */

export async function getDeliverySettings(
  token: string,
  storeId: string,
): Promise<GetDeliverySettingsResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/delivery${storeQuery(storeId)}`, {
    headers: authHeaders(token),
  });
  return handle<GetDeliverySettingsResponse>(res);
}

export async function updateDeliverySettings(
  token: string,
  storeId: string,
  body: UpdateDeliverySettingsBody,
): Promise<UpdateDeliverySettingsResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/delivery${storeQuery(storeId)}`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<UpdateDeliverySettingsResponse>(res);
}

/* --------------------------- Delivery fee rules --------------------------- */

export async function listDeliveryFeeRules(
  token: string,
  storeId: string,
): Promise<ListDeliveryFeeRulesResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/delivery/rules${storeQuery(storeId)}`, {
    headers: authHeaders(token),
  });
  return handle<ListDeliveryFeeRulesResponse>(res);
}

export async function createDeliveryFeeRule(
  token: string,
  body: CreateDeliveryFeeRuleBody,
): Promise<DeliveryFeeRuleMutationResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/delivery/rules`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<DeliveryFeeRuleMutationResponse>(res);
}

export async function updateDeliveryFeeRule(
  token: string,
  ruleId: string,
  body: UpdateDeliveryFeeRuleBody,
): Promise<DeliveryFeeRuleMutationResponse> {
  const res = await apiFetch(
    `${API_BASE_URL}/settings/delivery/rules/${encodeURIComponent(ruleId)}`,
    {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return handle<DeliveryFeeRuleMutationResponse>(res);
}

export async function deleteDeliveryFeeRule(
  token: string,
  ruleId: string,
): Promise<DeleteDeliveryFeeRuleResponse> {
  const res = await apiFetch(
    `${API_BASE_URL}/settings/delivery/rules/${encodeURIComponent(ruleId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
  return handle<DeleteDeliveryFeeRuleResponse>(res);
}

/* ========================================================================== */
/* Fase 2D — Printing settings                                                */
/* Fonte: docs/api/printing-settings-contracts.md                             */
/*   GET  /settings/printing  -> { settings, effective, source }              */
/*   PATCH /settings/printing -> { settings, effective }                      */
/* Enums oficiais e nomes de campos NÃO devem ser inventados.                 */
/* ========================================================================== */

export type PrintingSource =
  | "ONLINE_STORE"
  | "MANUAL_STORE"
  | "EVENT"
  | "MANUAL_EVENT"
  | "TOTEM"
  | "POS"
  | "API"
  | "WAITER";

export type PrintingSector = "COOK" | "BAR" | "GENERAL";

export type PrintMode = "FULL_ORDER" | "BY_SECTOR" | "BOTH";
export type PrinterPaperSize = "58mm" | "80mm";

export type PrintingSettingsSource = "ORGANIZATION_PRINTING_SETTINGS" | "DEFAULT";

export interface PrintingSourceConfig {
  enabled: boolean;
  autoPrint: boolean;
  printMode: PrintMode;
}

export interface PrintingSectorConfig {
  enabled: boolean;
}

/** Shape enviado e retornado pelo backend. Não inventar campos. */
export interface OrganizationPrintingSettings {
  printingEnabled?: boolean;
  autoPrintEnabled?: boolean;
  allowReprint?: boolean;
  splitBySector?: boolean;
  mergeCopies?: boolean;

  defaultPrinterDeviceId?: string | null;
  kitchenPrinterDeviceId?: string | null;
  barPrinterDeviceId?: string | null;
  expeditionPrinterDeviceId?: string | null;

  paperSize?: PrinterPaperSize;

  showLogo?: boolean;
  showPrices?: boolean;
  showQrCode?: boolean;
  showPayment?: boolean;
  showOrderSource?: boolean;
  showOrderNotes?: boolean;
  showItemNotes?: boolean;
  showOptions?: boolean;

  sources?: Partial<Record<PrintingSource, PrintingSourceConfig>>;
  sectors?: Partial<Record<PrintingSector, PrintingSectorConfig>>;
}

export interface EffectivePrintingSettings extends OrganizationPrintingSettings {
  sources: Record<PrintingSource, PrintingSourceConfig>;
  sectors: Record<PrintingSector, PrintingSectorConfig>;
}

export interface PrintingSettingsResponse {
  settings: OrganizationPrintingSettings | null;
  effective: EffectivePrintingSettings;
  source: PrintingSettingsSource;
}

/**
 * Corpo aceito pelo PATCH. Reflete exatamente os campos do backend.
 * Note: `printMode` NÃO existe no root — só em `sources.<X>.printMode`.
 * Não existe `printerDeviceIds` (array) — só os 4 IDs individuais.
 */
export interface UpdatePrintingSettingsBody {
  printingEnabled?: boolean;
  autoPrintEnabled?: boolean;
  allowReprint?: boolean;
  splitBySector?: boolean;
  mergeCopies?: boolean;

  defaultPrinterDeviceId?: string | null;
  kitchenPrinterDeviceId?: string | null;
  barPrinterDeviceId?: string | null;
  expeditionPrinterDeviceId?: string | null;

  paperSize?: PrinterPaperSize;

  showLogo?: boolean;
  showPrices?: boolean;
  showQrCode?: boolean;
  showPayment?: boolean;
  showOrderSource?: boolean;
  showOrderNotes?: boolean;
  showItemNotes?: boolean;
  showOptions?: boolean;

  sources?: Partial<Record<PrintingSource, Partial<PrintingSourceConfig>>>;
  sectors?: Partial<Record<PrintingSector, Partial<PrintingSectorConfig>>>;
}

export interface UpdatePrintingSettingsResponse {
  settings: OrganizationPrintingSettings;
  effective: EffectivePrintingSettings;
}

export async function getPrintingSettings(token: string): Promise<PrintingSettingsResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/printing`, {
    headers: authHeaders(token),
  });
  return handle<PrintingSettingsResponse>(res);
}

export async function updatePrintingSettings(
  token: string,
  body: UpdatePrintingSettingsBody,
): Promise<UpdatePrintingSettingsResponse> {
  const res = await apiFetch(`${API_BASE_URL}/settings/printing`, {
    method: "PATCH",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handle<UpdatePrintingSettingsResponse>(res);
}
