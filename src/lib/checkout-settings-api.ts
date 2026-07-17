/**
 * Checkout Settings — Fase 2C
 *
 * O backend GET/PATCH /settings/checkout ainda não foi contratado.
 * Este módulo define o DTO provisório e um adapter mockado por storeId
 * persistido em localStorage. Quando o backend estiver pronto, substituir
 * `mockGet` / `mockPatch` pelas chamadas reais mantendo a forma de dados.
 */

export interface CheckoutFlowSettings {
  allowDelivery: boolean;
  allowPickup: boolean;
  allowCounter: boolean;
  allowDineIn: boolean;
  allowScheduling: boolean;
}

export interface CheckoutCustomerSettings {
  requireName: boolean;
  requirePhone: boolean;
  requireWhatsapp: boolean;
  requireAddress: boolean;
  requireNumber: boolean;
  requireComplement: boolean;
  requireNeighborhood: boolean;
  requireCity: boolean;
  requireZip: boolean;
  requireCpf: boolean;
  requireEmail: boolean;
  requireNotes: boolean;
}

export interface CheckoutOrderSettings {
  minOrderInCents: number;
  maxOrderInCents: number;
  preCheckoutMessage: string;
  postCheckoutMessage: string;
  notesPlaceholder: string;
}

export interface CheckoutPaymentSettings {
  cash: boolean;
  pix: boolean;
  credit: boolean;
  debit: boolean;
  online: boolean;
  voucher: boolean;
  onDelivery: boolean;
}

export interface CheckoutChangeSettings {
  allowChange: boolean;
  requireChange: boolean;
  showExactAmountButton: boolean;
  quickAdd10: boolean;
  quickAdd20: boolean;
  quickAdd50: boolean;
}

export interface CheckoutSummarySettings {
  showSubtotal: boolean;
  showFee: boolean;
  showDiscount: boolean;
  showEstimatedTime: boolean;
  showAddress: boolean;
  showNotes: boolean;
  showPaymentMethod: boolean;
}

export interface CheckoutConfirmationSettings {
  title: string;
  message: string;
  showOrderNumber: boolean;
  showNewOrderButton: boolean;
  showWhatsapp: boolean;
  showEstimatedTime: boolean;
}

export interface CheckoutSettings {
  flow: CheckoutFlowSettings;
  customer: CheckoutCustomerSettings;
  order: CheckoutOrderSettings;
  payment: CheckoutPaymentSettings;
  change: CheckoutChangeSettings;
  summary: CheckoutSummarySettings;
  confirmation: CheckoutConfirmationSettings;
}

export const defaultCheckoutSettings: CheckoutSettings = {
  flow: {
    allowDelivery: true,
    allowPickup: true,
    allowCounter: false,
    allowDineIn: false,
    allowScheduling: false,
  },
  customer: {
    requireName: true,
    requirePhone: true,
    requireWhatsapp: false,
    requireAddress: true,
    requireNumber: true,
    requireComplement: false,
    requireNeighborhood: true,
    requireCity: true,
    requireZip: false,
    requireCpf: false,
    requireEmail: false,
    requireNotes: false,
  },
  order: {
    minOrderInCents: 0,
    maxOrderInCents: 0,
    preCheckoutMessage: "",
    postCheckoutMessage: "",
    notesPlaceholder: "Ex.: sem cebola, ponto da carne...",
  },
  payment: {
    cash: true,
    pix: true,
    credit: true,
    debit: true,
    online: false,
    voucher: false,
    onDelivery: true,
  },
  change: {
    allowChange: true,
    requireChange: false,
    showExactAmountButton: true,
    quickAdd10: true,
    quickAdd20: true,
    quickAdd50: true,
  },
  summary: {
    showSubtotal: true,
    showFee: true,
    showDiscount: true,
    showEstimatedTime: true,
    showAddress: true,
    showNotes: true,
    showPaymentMethod: true,
  },
  confirmation: {
    title: "Pedido confirmado!",
    message: "Recebemos o seu pedido e já estamos preparando.",
    showOrderNumber: true,
    showNewOrderButton: true,
    showWhatsapp: true,
    showEstimatedTime: true,
  },
};

const STORAGE_KEY = "defumar:checkout-settings";

function readAll(): Record<string, CheckoutSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, CheckoutSettings>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, CheckoutSettings>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** Mock GET /settings/checkout?storeId=... */
export async function getCheckoutSettings(
  _token: string,
  storeId: string,
): Promise<CheckoutSettings> {
  await new Promise((r) => setTimeout(r, 120));
  const all = readAll();
  return all[storeId] ?? defaultCheckoutSettings;
}

/** Mock PATCH /settings/checkout?storeId=... */
export async function updateCheckoutSettings(
  _token: string,
  storeId: string,
  body: CheckoutSettings,
): Promise<CheckoutSettings> {
  await new Promise((r) => setTimeout(r, 180));
  const all = readAll();
  all[storeId] = body;
  writeAll(all);
  return body;
}
