/**
 * Visual badges for the Central Operacional unified feed:
 * - Origin badge (icon + text), NEVER color-only for a11y.
 * - Context badge (store for online orders, event for event orders).
 *
 * Data comes from the adapter markers (`__unifiedOrigin`,
 * `__unifiedSourceType`, `__unifiedContext`) attached in
 * `unified-adapter.ts`. Falls back to `originLabel` from the DTO when
 * present, otherwise a neutral copy.
 */
import {
  Smartphone,
  Monitor,
  LayoutDashboard,
  Store as StoreIcon,
  MessageCircle,
  Plug,
  CalendarDays,
  Tag,
  Building2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Order } from "@/lib/orders-api";
import type { AdaptedOrderMeta } from "./unified-adapter";
import { contextLabel } from "./helpers";

type Origin =
  | "DIGITAL_MENU"
  | "TOTEM"
  | "ADMIN"
  | "POS"
  | "WHATSAPP"
  | "API"
  | string;

const ORIGIN_MAP: Record<
  string,
  { label: string; Icon: LucideIcon; cls: string }
> = {
  DIGITAL_MENU: {
    label: "Cardápio digital",
    Icon: Smartphone,
    cls: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  TOTEM: {
    label: "Totem",
    Icon: Monitor,
    cls: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  ADMIN: {
    label: "Painel",
    Icon: LayoutDashboard,
    cls: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  POS: {
    label: "PDV",
    Icon: StoreIcon,
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  WHATSAPP: {
    label: "WhatsApp",
    Icon: MessageCircle,
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  API: {
    label: "API",
    Icon: Plug,
    cls: "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  },
};

type MaybeUnified = Order &
  Partial<AdaptedOrderMeta> & { originLabel?: string };

export function OriginBadge({ order }: { order: Order }) {
  const o = order as MaybeUnified;
  const origin = (o.__unifiedOrigin ?? "") as Origin;
  const entry = ORIGIN_MAP[origin];
  const label = entry?.label ?? o.originLabel ?? "Origem não informada";
  const Icon = entry?.Icon ?? Tag;
  const cls =
    entry?.cls ??
    "border-border bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${cls}`}
      aria-label={`Origem: ${label}`}
      title={label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="truncate max-w-[10rem]">{label}</span>
    </span>
  );
}

export function ContextBadge({ order }: { order: Order }) {
  const o = order as MaybeUnified;
  const isOnline = o.__unifiedSourceType === "ONLINE";
  const { label } = contextLabel(order);
  const Icon = isOnline ? Building2 : CalendarDays;
  const finalLabel = label ?? "Contexto não informado";
  const kind = isOnline ? "Loja" : "Evento";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
      aria-label={`${kind}: ${finalLabel}`}
      title={`${kind}: ${finalLabel}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="truncate max-w-[10rem]">{finalLabel}</span>
    </span>
  );
}
