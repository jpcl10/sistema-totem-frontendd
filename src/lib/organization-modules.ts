// Module registry: maps enabled organization modules to admin navigation items.
import {
  LayoutDashboard,
  CalendarDays,
  Package,
  ShoppingCart,
  Settings,
  Printer,
  DollarSign,
  Monitor,
  Activity,
  CreditCard,
  Link2,
  Users,
  type LucideIcon,
} from "lucide-react";


export type ModuleKey =
  | "ONLINE_ORDERS"
  | "DELIVERY"
  | "EVENTS"
  | "TOTEM"
  | "PAYMENTS"
  | "FINANCIAL"
  | "PRINTING"
  | "WHATSAPP"
  | "DEVICES"
  | "NFC_CASHLESS"
  | "REPORTS"
  | "LOYALTY";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  to: string;
  search?: Record<string, string>;
  disabled?: boolean;
}

// Base items every admin sees.
export const BASE_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, to: "/admin/dashboard" },
  { label: "Clientes", icon: Users, to: "/admin/customers" },
];

export const MENU_BY_MODULE: Record<ModuleKey, NavItem[]> = {
  ONLINE_ORDERS: [
    { label: "Catálogo", icon: Package, to: "/admin/catalog" },
    { label: "Pedidos", icon: ShoppingCart, to: "/admin/orders" },
    { label: "Financeiro", icon: DollarSign, to: "/admin/financeiro" },
  ],
  DELIVERY: [],
  EVENTS: [
    { label: "Eventos", icon: CalendarDays, to: "/admin/events" },
    { label: "Catálogo", icon: Package, to: "/admin/catalog" },
    { label: "Pedidos", icon: ShoppingCart, to: "/admin/orders" },
  ],
  TOTEM: [
    { label: "Totem", icon: Monitor, to: "/admin/devices" },
  ],
  PAYMENTS: [{ label: "Pagamentos", icon: CreditCard, to: "/admin/financeiro" }],
  FINANCIAL: [{ label: "Financeiro", icon: DollarSign, to: "/admin/financeiro" }],
  PRINTING: [{ label: "Impressão", icon: Printer, to: "/admin/print-queue" }],
  WHATSAPP: [],
  DEVICES: [{ label: "Dispositivos", icon: Monitor, to: "/admin/devices" }],
  NFC_CASHLESS: [
    { label: "Cartões NFC", icon: CreditCard, to: "/admin/nfc-cards" },
  ],
  REPORTS: [],
  LOYALTY: [],
};

export const TAIL_ITEMS: NavItem[] = [
  { label: "Links Públicos", icon: Link2, to: "/admin/public-links" },
  { label: "Configurações", icon: Settings, to: "/admin/settings" },
];


const EVENTS_TAIL: NavItem[] = [
  { label: "Atividades", icon: Activity, to: "/admin/activities" },
];

const MODULE_LABELS: Record<ModuleKey, string> = {
  ONLINE_ORDERS: "Pedidos Online",
  DELIVERY: "Delivery",
  EVENTS: "Eventos",
  TOTEM: "Totem",
  PAYMENTS: "Pagamentos",
  FINANCIAL: "Financeiro",
  PRINTING: "Impressão",
  WHATSAPP: "WhatsApp",
  DEVICES: "Dispositivos",
  NFC_CASHLESS: "NFC Cashless",
  REPORTS: "Relatórios",
  LOYALTY: "Fidelidade",
};

export function moduleLabel(m: ModuleKey): string {
  return MODULE_LABELS[m] ?? m;
}

/** Best-effort normalization of a backend `modules` payload into a ModuleKey list. */
export function normalizeModules(input: unknown): ModuleKey[] {
  if (!input) return [];
  const known = Object.keys(MENU_BY_MODULE) as ModuleKey[];
  const set = new Set<ModuleKey>();

  const add = (v: unknown) => {
    if (typeof v !== "string") return;
    const k = v.toUpperCase().replace(/[-\s]/g, "_") as ModuleKey;
    if (known.includes(k)) set.add(k);
  };

  if (Array.isArray(input)) {
    for (const it of input) {
      if (typeof it === "string") add(it);
      else if (it && typeof it === "object") {
        const obj = it as { key?: string; name?: string; module?: string; moduleKey?: string; enabled?: boolean };
        if (obj.enabled === false) continue;
        add(obj.moduleKey || obj.key || obj.name || obj.module);
      }
    }
  } else if (typeof input === "object") {
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === false) continue;
      if (v && typeof v === "object" && (v as { enabled?: boolean }).enabled === false) continue;
      add(k);
    }
  }
  return Array.from(set);
}

/** Build the admin sidebar nav from the active modules. Deduped by `to`. */
export function buildNavItems(modules: ModuleKey[]): NavItem[] {
  const items: NavItem[] = [...BASE_ITEMS];
  const seenTo = new Set(items.map((i) => i.to));
  const push = (it: NavItem) => {
    if (it.disabled) return;
    if (seenTo.has(it.to)) return;
    seenTo.add(it.to);
    items.push(it);
  };
  for (const m of modules) {
    for (const it of MENU_BY_MODULE[m] ?? []) push(it);
  }
  if (modules.includes("EVENTS")) {
    for (const it of EVENTS_TAIL) push(it);
  }
  for (const it of TAIL_ITEMS) push(it);
  return items;
}
