import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata um valor em centavos (inteiro) como moeda BRL.
 * Ex.: 6000 -> "R$ 60,00"
 */
export function formatCurrencyFromCents(cents: number | null | undefined): string {
  const c = typeof cents === "number" && Number.isFinite(cents) ? cents : 0;
  return formatCurrency(c / 100);
}

/**
 * Converte uma string em reais para centavos.
 * Aceita "60", "60,00", "60.00", "R$ 60,00".
 * Retorna null se inválido. Nunca retorna negativo (clampa em 0).
 */
export function parseCurrencyToCents(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return null;
    return Math.round(input * 100);
  }
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  // Remove R$, espaços e separadores de milhar
  const cleaned = trimmed
    .replace(/[R$\s]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // pontos de milhar
    .replace(",", ".");
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}
