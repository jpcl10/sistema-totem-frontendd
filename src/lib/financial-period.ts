/**
 * Helper for the Financeiro V2 filter bar.
 *
 * Backend contract: `GET /financial-summary` accepts a `period` enum
 * (`TODAY`, `YESTERDAY`, `LAST_7_DAYS`, `LAST_30_DAYS`, `CUSTOM`, …) and
 * resolves the range server-side using the organization timezone.
 *
 * The frontend must NOT compute preset ranges locally with the browser
 * timezone. For presets we forward only the enum; for `CUSTOM` we forward
 * the two local calendar dates (YYYY-MM-DD) selected by the user and let
 * the backend resolve them in the org timezone.
 */

export const FINANCIAL_PERIOD_OPTIONS = [
  { value: "TODAY", label: "Hoje" },
  { value: "YESTERDAY", label: "Ontem" },
  { value: "LAST_7_DAYS", label: "Últimos 7 dias" },
  { value: "LAST_30_DAYS", label: "Últimos 30 dias" },
  { value: "CUSTOM", label: "Personalizado" },
] as const;

export type FinancialPeriodKey = (typeof FINANCIAL_PERIOD_OPTIONS)[number]["value"];

export const DEFAULT_ORG_TIMEZONE = "America/Sao_Paulo";

/**
 * Resolve the effective org timezone from a financial-summary response
 * or the general settings payload. Falls back to `America/Sao_Paulo`.
 * Never returns the browser timezone.
 */
export function resolveOrgTimezone(
  fromSummary?: string | null,
  fromSettings?: string | null,
): string {
  if (fromSummary && typeof fromSummary === "string") return fromSummary;
  if (fromSettings && typeof fromSettings === "string") return fromSettings;
  return DEFAULT_ORG_TIMEZONE;
}

/** Build query params for `GET /financial-summary` / `GET /orders/unified`. */
export function buildFinancialPeriodParams(
  period: FinancialPeriodKey,
  customStart?: string,
  customEnd?: string,
): { period: FinancialPeriodKey; startDate?: string; endDate?: string } {
  if (period === "CUSTOM") {
    return {
      period,
      startDate: customStart || undefined,
      endDate: customEnd || undefined,
    };
  }
  return { period };
}

/**
 * Format a timeseries `periodStart` (ISO UTC) using the org timezone and
 * the reported granularity. Used for chart axis and tooltip labels.
 */
export function formatTimeseriesLabel(
  iso: string,
  granularity: "HOUR" | "DAY" | "MONTH",
  timezone: string,
): string {
  try {
    const d = new Date(iso);
    if (granularity === "HOUR") {
      return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        timeZone: timezone,
      }).format(d).replace(":00", "h");
    }
    if (granularity === "MONTH") {
      return new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        year: "numeric",
        timeZone: timezone,
      }).format(d);
    }
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
    }).format(d);
  } catch {
    return iso;
  }
}
