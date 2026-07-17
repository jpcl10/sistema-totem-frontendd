/**
 * OrderCreationStrategy — abstracts how a manual order is created for
 * each operational surface (event, online store, POS, Totem). The
 * OrderCreationDrawer only calls `strategy.createOrder(draft)`; it
 * never knows which endpoint to hit.
 *
 * The frontend NEVER sends prices — the backend is the source of truth.
 */
import type { LucideIcon } from "lucide-react";
import { CalendarDays, Monitor, Receipt, Store as StoreIcon } from "lucide-react";
import { createManualSale, type ManualSalePaymentMethod } from "@/lib/orders-api";
import {
  createStoreManualSale,
  listOnlineStores,
  type OnlineStore,
} from "@/lib/online-store-api";

export type StrategyId = "event" | "store" | "pos" | "totem";

export interface OrderDraftItem {
  productId: string;
  quantity: number;
  selectedOptions?: Array<{ optionId: string; groupId?: string; quantity?: number }>;
  notes?: string;
}

export interface OrderDraft {
  items: OrderDraftItem[];
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddressId?: string;
  delivery?: {
    address: string;
    number: string;
    neighborhood: string;
    complement?: string;
    reference?: string;
  };
  paymentMethod: ManualSalePaymentMethod;
  cashReceived?: number; // in cents
  notes?: string;
  fulfillmentType?: "PICKUP" | "DINE_IN" | "DELIVERY";
}


export interface OrderCreationStrategy {
  id: StrategyId;
  label: string;
  contextLabel: string;
  icon: LucideIcon;
  createOrder(token: string, draft: OrderDraft): Promise<{ id: string }>;
}

export function EventOrderStrategy(eventId: string, eventName?: string): OrderCreationStrategy {
  return {
    id: "event",
    label: "Novo pedido no evento",
    contextLabel: eventName ?? "Evento",
    icon: CalendarDays,
    async createOrder(token, draft) {
      const paymentStatus = draft.paymentMethod === "PIX_MANUAL" ? "PENDING" : "PAID";
      const order = await createManualSale(token, eventId, {
        customerName: draft.customerName,
        paymentMethod: draft.paymentMethod,
        paymentStatus,
        items: draft.items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
      });
      return { id: order.id };
    },
  };
}

export function StoreOrderStrategy(storeId: string, storeName?: string): OrderCreationStrategy {
  return {
    id: "store",
    label: "Novo pedido na loja",
    contextLabel: storeName ?? "Loja",
    icon: StoreIcon,
    async createOrder(token, draft) {
      const map: Record<string, "PIX" | "CARD_ON_DELIVERY" | "CASH"> = {
        PIX_MANUAL: "PIX",
        CASH: "CASH",
        CREDIT_CARD: "CARD_ON_DELIVERY",
        DEBIT_CARD: "CARD_ON_DELIVERY",
      };
      const paymentMethod = map[draft.paymentMethod];
      if (!paymentMethod) {
        throw new Error("Método de pagamento indisponível para venda manual da loja.");
      }
      const order = await createStoreManualSale(token, storeId, {
        customerId: draft.customerId ?? null,
        customerAddressId: draft.customerAddressId ?? null,
        customer: {
          name: draft.customerName ?? null,
          phone: draft.customerPhone ?? null,
        },
        fulfillment: draft.fulfillmentType === "DELIVERY" ? "DELIVERY" : "PICKUP",
        delivery:
          draft.fulfillmentType === "DELIVERY" && draft.delivery
            ? {
                address: draft.delivery.address,
                number: draft.delivery.number,
                neighborhood: draft.delivery.neighborhood,
                complement: draft.delivery.complement ?? null,
                reference: draft.delivery.reference ?? null,
              }
            : undefined,
        paymentMethod,
        amountReceivedInCents:
          paymentMethod === "CASH" ? draft.cashReceived ?? null : undefined,
        notes: draft.notes ?? null,

        items: draft.items.map((it) => ({
          catalogProductId: it.productId,
          quantity: it.quantity,
          notes: it.notes ?? null,
          selectedOptions: (it.selectedOptions ?? [])
            .filter((o) => o.groupId)
            .map((o) => ({ optionGroupId: o.groupId as string, optionIds: [o.optionId] })),
        })),
      });
      return { id: order.id };
    },
  };
}

// Placeholders — kept so the button can render future entries without
// touching the drawer. Real implementations will replace these.
export function POSOrderStrategy(): OrderCreationStrategy {
  return {
    id: "pos",
    label: "Novo pedido no PDV",
    contextLabel: "PDV",
    icon: Receipt,
    async createOrder() {
      throw new Error("POS ainda não implementado.");
    },
  };
}

export function TotemOrderStrategy(): OrderCreationStrategy {
  return {
    id: "totem",
    label: "Novo pedido no Totem",
    contextLabel: "Totem",
    icon: Monitor,
    async createOrder() {
      throw new Error("Totem ainda não implementado.");
    },
  };
}

export async function resolveStrategies(opts: {
  token: string;
  hasEvents: boolean;
  hasOnline: boolean;
  currentEventId?: string;
  currentEventName?: string;
}): Promise<{
  strategies: OrderCreationStrategy[];
  onlineStores: OnlineStore[];
  needsEventSelection: boolean;
  needsStoreSelection: boolean;
}> {
  const strategies: OrderCreationStrategy[] = [];
  let onlineStores: OnlineStore[] = [];
  let needsEventSelection = false;
  let needsStoreSelection = false;

  if (opts.hasEvents) {
    if (opts.currentEventId) {
      strategies.push(EventOrderStrategy(opts.currentEventId, opts.currentEventName));
    } else {
      needsEventSelection = true;
    }
  }

  if (opts.hasOnline) {
    try {
      onlineStores = await listOnlineStores(opts.token);
    } catch {
      onlineStores = [];
    }
    if (onlineStores.length === 1) {
      strategies.push(StoreOrderStrategy(onlineStores[0].id, onlineStores[0].name));
    } else if (onlineStores.length > 1) {
      needsStoreSelection = true;
    }
  }

  return { strategies, onlineStores, needsEventSelection, needsStoreSelection };
}
