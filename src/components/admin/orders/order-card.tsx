import { AlertCircle, Clock, Loader2, MapPin, Truck, ShoppingBag, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Order } from "@/lib/orders-api";


import { OriginBadge, ContextBadge } from "./unified-badges";
import {
  customerOf,
  elapsed,
  elapsedMinutes,
  formatBRL,
  isOrderLate,
  nextStatusFor,
  orderLabel,
  orderShortId,
  totalCents,
  type SectorFilter,
} from "./helpers";

type FulfillmentKind = "DELIVERY" | "PICKUP" | "ON_SITE" | "DINE_IN" | "";

function getFulfillment(o: Order): FulfillmentKind {
  const rec = o as unknown as { __unifiedFulfillmentType?: string };
  return ((rec.__unifiedFulfillmentType ?? "").toUpperCase() as FulfillmentKind);
}

type FulfillmentAddress = {
  address?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
};

function getDeliveryAddress(o: Order): FulfillmentAddress | null {
  const rec = o as unknown as {
    __unifiedFulfillmentDetails?: { address?: FulfillmentAddress | null } | null;
  };
  return rec.__unifiedFulfillmentDetails?.address ?? null;
}

function formatDeliveryLine(a: FulfillmentAddress): string {
  const street = a.address ?? a.street ?? "";
  const parts = [
    [street, a.number].filter(Boolean).join(", "),
    a.neighborhood ?? "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function FulfillmentBadge({ kind }: { kind: FulfillmentKind }) {
  if (!kind) return null;
  const map: Record<string, { label: string; Icon: typeof Truck; cls: string }> = {
    DELIVERY: {
      label: "Entrega",
      Icon: Truck,
      cls: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    },
    PICKUP: {
      label: "Retirada",
      Icon: ShoppingBag,
      cls: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    },
    ON_SITE: {
      label: "No local",
      Icon: Utensils,
      cls: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    },
    DINE_IN: {
      label: "No local",
      Icon: Utensils,
      cls: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    },
  };
  const entry = map[kind];
  if (!entry) return null;
  const { Icon } = entry;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${entry.cls}`}
      title={entry.label}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {entry.label}
    </span>
  );
}

function itemMatchesSector(it: Record<string, unknown>, sectorFilter: SectorFilter): boolean {
  if (sectorFilter === "ALL") return true;
  const candidates: unknown[] = [
    it.sector,
    (it.category as Record<string, unknown> | undefined)?.sector,
    (it.catalogCategory as Record<string, unknown> | undefined)?.sector,
    ((it.catalogProduct as Record<string, unknown> | undefined)
      ?.catalogCategory as Record<string, unknown> | undefined)?.sector,
    ((it.catalogProduct as Record<string, unknown> | undefined)
      ?.category as Record<string, unknown> | undefined)?.sector,
    ((it.product as Record<string, unknown> | undefined)
      ?.catalogCategory as Record<string, unknown> | undefined)?.sector,
    ((it.product as Record<string, unknown> | undefined)
      ?.category as Record<string, unknown> | undefined)?.sector,
  ];
  return candidates.some((c) => {
    if (typeof c !== "string" || !c) return false;
    const n = c.toUpperCase();
    if (sectorFilter === "BAR") return n.includes("BAR");
    if (sectorFilter === "KITCHEN") return n.includes("COZINHA") || n.includes("KITCHEN");
    return n === sectorFilter;
  });
}

function paymentBadgeInfo(paymentStatus: string, paymentMethod: string): { cls: string; label: string } | null {
  if (paymentStatus === "PAID") {
    const styles: Record<string, { cls: string; label: string }> = {
      PIX_MANUAL: { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "PIX" },
      PIX_AUTOMATIC: { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "PIX" },
      PIX: { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "PIX" },
      NFC_BALANCE: { cls: "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-400", label: "NFC" },
      NFC: { cls: "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-400", label: "NFC" },
      CREDIT_CARD: { cls: "border-blue-500/30 bg-blue-500/15 text-blue-700 dark:text-blue-400", label: "Crédito" },
      DEBIT_CARD: { cls: "border-orange-500/30 bg-orange-500/15 text-orange-700 dark:text-orange-400", label: "Débito" },
      CASH: { cls: "border-slate-500/30 bg-slate-500/15 text-slate-700 dark:text-slate-300", label: "Dinheiro" },
      COURTESY: { cls: "border-pink-500/30 bg-pink-500/15 text-pink-700 dark:text-pink-400", label: "Cortesia" },
      MANUAL: { cls: "border-zinc-500/30 bg-zinc-500/15 text-zinc-700 dark:text-zinc-300", label: "Manual" },
      OTHER: { cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400", label: "Pago" },
    };
    return styles[paymentMethod] ?? styles.OTHER;
  }
  if (paymentStatus === "PENDING")
    return { cls: "border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-400 animate-pulse", label: "Aguardando" };
  if (paymentStatus === "NOT_REQUIRED")
    return { cls: "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-400", label: "Sem pagto" };
  const other: Record<string, string> = { FAILED: "Falhou", CANCELLED: "Cancelado", REFUNDED: "Estornado" };
  if (other[paymentStatus]) return { cls: "border-border bg-muted text-muted-foreground", label: other[paymentStatus] };
  return null;
}

export function OrderCard({
  order,
  sectorFilter,
  busy,
  highlight,
  lateMinutes,
  onAdvance,
  onConfirmPayment,
  onCancel,
  onOpenDetails,
}: {
  order: Order;
  sectorFilter: SectorFilter;
  busy: boolean;
  highlight?: boolean;
  lateMinutes: number;
  onAdvance: () => void;
  onConfirmPayment: () => void;
  onCancel: () => void;
  onOpenDetails?: () => void;
}) {
  const status = (order.status ?? "").toUpperCase();
  const cancelled = status === "CANCELLED";
  const terminal = cancelled || status === "DELIVERED" || status === "COMPLETED";
  const next = nextStatusFor(order);
  const items = (order.items ?? []).filter((it) =>
    itemMatchesSector(it as Record<string, unknown>, sectorFilter),
  );

  const mins = elapsedMinutes(order);
  const late = isOrderLate(order, lateMinutes);
  const critical = late && lateMinutes > 0 && mins >= lateMinutes * 2;
  const nearLimit = !late && lateMinutes > 0 && mins >= Math.max(1, lateMinutes - 5);

  // Soft rings: no strong red border on every late order.
  const toneRing = cancelled
    ? "border-red-500/25"
    : critical
      ? "border-red-500/40"
      : late
        ? "border-amber-500/40"
        : nearLimit
          ? "border-amber-500/20"
          : "border-border";

  // Vertical priority bar as a subtle signal channel.
  const priorityBar = cancelled
    ? "bg-red-500/40"
    : critical
      ? "bg-red-500"
      : late
        ? "bg-amber-500"
        : nearLimit
          ? "bg-amber-400/70"
          : "bg-transparent";

  const elapsedCls = critical
    ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
    : late
      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : nearLimit
        ? "border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-400"
        : "border-border bg-muted text-muted-foreground";

  const highlightCls = highlight
    ? "ring-2 ring-primary/70 shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_18%,transparent)] animate-pulse"
    : "";
  const opacityCls = cancelled ? "opacity-60" : "";

  const paymentStatus = (order.paymentStatus ?? "").toUpperCase();
  const paymentMethod = order.paymentMethod ?? "";
  const pay = paymentBadgeInfo(paymentStatus, paymentMethod);

  const fulfillment = getFulfillment(order);
  const deliveryAddr = fulfillment === "DELIVERY" ? getDeliveryAddress(order) : null;
  const deliveryLine = deliveryAddr ? formatDeliveryLine(deliveryAddr) : "";
  const totalC = totalCents(order);
  const totalStr = totalC > 0 ? formatBRL(totalC / 100) : "—";
  const visibleItems = items.slice(0, 3);
  const moreCount = Math.max(0, items.length - visibleItems.length);

  const cancellationReason =
    (order as unknown as { cancellationReason?: string; cancelReason?: string }).cancellationReason ??
    (order as unknown as { cancelReason?: string }).cancelReason ??
    "";

  const primaryAction = !terminal && next && paymentStatus !== "PENDING" && paymentStatus !== "FAILED";
  const paymentAction = (paymentStatus === "PENDING" || paymentStatus === "FAILED") && !cancelled;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border bg-card p-3 pl-4 shadow-[var(--shadow-soft)] transition-all hover:shadow-[var(--shadow-elegant)] ${toneRing} ${highlightCls} ${opacityCls} ${onOpenDetails ? "cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60" : ""}`}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      aria-label={onOpenDetails ? `Ver detalhes do pedido ${orderLabel(order)}` : undefined}
      onClick={(e) => {
        if (!onOpenDetails) return;
        const target = e.target as HTMLElement;
        if (target.closest("button, a, [role='button']")) return;
        onOpenDetails();
      }}
      onKeyDown={(e) => {
        if (!onOpenDetails) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails();
        }
      }}
    >
      <span aria-hidden="true" className={`absolute left-0 top-0 h-full w-1 ${priorityBar}`} />

      {/* 1. Header: number + origin/context + tempo */}
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-lg font-extrabold tracking-tight text-foreground leading-none">
              {orderLabel(order)}
            </p>
            <p
              className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70"
              title={order.id}
            >
              {orderShortId(order)}
            </p>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <OriginBadge order={order} />
            <ContextBadge order={order} />
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${elapsedCls}`}
          title={`${mins} min desde a criação`}
        >
          <Clock className="h-3 w-3" />
          {elapsed(order) || "—"}
        </span>
      </header>

      {/* 2. SLA / status badges */}
      {(cancelled || late) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {cancelled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
              Cancelado
            </span>
          )}
          {!cancelled && late && (
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${critical ? "border-red-500/50 bg-red-500/15 text-red-600 dark:text-red-400" : "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400"}`}
            >
              <AlertCircle className="h-3 w-3" />
              {critical ? "Crítico" : "Atrasado"}
            </span>
          )}
        </div>
      )}

      {/* 3. Cliente + fulfillment */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-foreground/90">
          {customerOf(order)}
        </p>
        <FulfillmentBadge kind={fulfillment} />
      </div>

      {/* 3b. Endereço de entrega (apenas DELIVERY) */}
      {fulfillment === "DELIVERY" && deliveryLine && (
        <div className="mt-1 flex items-start gap-1 text-[11px] text-muted-foreground">
          <MapPin className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2 leading-tight">
            {deliveryLine}
            {deliveryAddr?.complement ? ` — ${deliveryAddr.complement}` : ""}
          </span>
        </div>
      )}


      {/* 4. Itens (máx 3) */}
      {visibleItems.length > 0 && (
        <ul className="mt-2 space-y-0.5 border-t border-border/60 pt-2 text-xs text-foreground/90">
          {visibleItems.map((it, i) => {
            const qty = it.quantity ?? it.qty ?? 1;
            const name = it.name ?? it.productName ?? "Item";
            const rec = it as Record<string, unknown>;
            // Options / modifiers preview (nomes)
            const optionsArr = (rec.options as Array<Record<string, unknown>> | undefined)
              ?? (rec.selectedOptions as Array<Record<string, unknown>> | undefined)
              ?? (rec.modifiers as Array<Record<string, unknown>> | undefined)
              ?? [];
            const optionNames = optionsArr
              .map((op) => (op.name as string) ?? (op.label as string) ?? "")
              .filter(Boolean)
              .slice(0, 3);
            return (
              <li key={it.id ?? i} className="min-w-0">
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className="font-bold text-primary">{qty}x</span>
                  <span className="truncate font-medium">{name}</span>
                </div>
                {optionNames.length > 0 && (
                  <p className="pl-4 text-[10px] leading-tight text-muted-foreground truncate">
                    · {optionNames.join(" · ")}
                  </p>
                )}
              </li>
            );
          })}
          {moreCount > 0 && (
            <li className="text-[10px] font-medium text-muted-foreground">
              + {moreCount} item{moreCount > 1 ? "s" : ""}
            </li>
          )}
        </ul>
      )}

      {cancelled && cancellationReason && (
        <p className="mt-2 rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1 text-[10px] text-red-700 dark:text-red-300">
          <span className="font-semibold">Motivo:</span> {cancellationReason}
        </p>
      )}

      {/* 5. Pagamento + total */}
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <div className="min-w-0">
          {pay && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pay.cls}`}>
              {pay.label}
            </span>
          )}
        </div>
        <span className="text-base font-bold text-foreground">{totalStr}</span>
      </div>

      {/* 6. Ação principal (rodapé) + cancelar secundária */}
      {(primaryAction || paymentAction || (!terminal && !next)) && (
        <footer className="mt-2 flex items-center gap-2">
          {paymentAction && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 flex-1 text-xs border-amber-500/50 text-amber-700 hover:bg-amber-500/10 hover:text-amber-700 dark:text-amber-400"
              disabled={busy}
              onClick={onConfirmPayment}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar pagamento"}
            </Button>
          )}
          {primaryAction && next && (
            <Button
              size="sm"
              disabled={busy}
              onClick={onAdvance}
              className="h-9 flex-1 text-xs font-bold text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : next.label}
            </Button>
          )}
          {!terminal && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onCancel}
              className="h-9 px-2 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
              aria-label="Cancelar pedido"
            >
              Cancelar
            </Button>
          )}
        </footer>
      )}
    </article>
  );
}
