/**
 * Universal payment methods shown in the UI, plus per-domain mappers
 * that convert them into the technical values each backend expects.
 *
 * The UI must NEVER know about domain-specific enums like PIX_MANUAL
 * or CARD_ON_DELIVERY. It only works with UniversalPaymentMethod.
 */
import type { UnifiedOrderType } from "@/lib/orders-api";

export type UniversalPaymentMethod =
  | "PIX"
  | "CASH"
  | "CREDIT"
  | "DEBIT"
  | "COURTESY"
  | "NFC_BALANCE"
  | "OTHER";

export interface UniversalPaymentOption {
  value: UniversalPaymentMethod;
  label: string;
}

/** Options rendered in the Select. Order matters for UX. */
export const UNIVERSAL_PAYMENT_OPTIONS: UniversalPaymentOption[] = [
  { value: "PIX", label: "PIX" },
  { value: "CASH", label: "Dinheiro" },
  { value: "CREDIT", label: "Cartão de Crédito" },
  { value: "DEBIT", label: "Cartão de Débito" },
  { value: "COURTESY", label: "Cortesia" },
  { value: "NFC_BALANCE", label: "Saldo NFC" },
  { value: "OTHER", label: "Outro" },
];

const EVENT_MAP: Partial<Record<UniversalPaymentMethod, string>> = {
  PIX: "PIX_MANUAL",
  CASH: "CASH",
  CREDIT: "CREDIT_CARD",
  DEBIT: "DEBIT_CARD",
  COURTESY: "COURTESY",
  NFC_BALANCE: "NFC_BALANCE",
  OTHER: "OTHER",
};

const ONLINE_MAP: Partial<Record<UniversalPaymentMethod, string>> = {
  PIX: "PIX",
  CASH: "CASH",
  CREDIT: "CARD_ON_DELIVERY",
  DEBIT: "CARD_ON_DELIVERY",
};

/**
 * Translate a universal method into the technical value expected by
 * the given domain. Returns null when the method is not compatible
 * with the domain — callers must abort the request and warn the user.
 */
export function mapUniversalPaymentMethod(
  orderType: UnifiedOrderType | string | undefined | null,
  method: UniversalPaymentMethod,
): string | null {
  const type = String(orderType ?? "").toUpperCase();
  if (type === "EVENT_ORDER") return EVENT_MAP[method] ?? null;
  if (type === "ONLINE_ORDER") return ONLINE_MAP[method] ?? null;
  // Unknown domain: fall back to EVENT mapping to avoid breaking legacy calls.
  return EVENT_MAP[method] ?? null;
}
