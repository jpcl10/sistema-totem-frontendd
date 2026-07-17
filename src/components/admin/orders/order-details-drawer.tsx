/**
 * Unified order details drawer — operational view.
 *
 * Right-side Sheet. No new endpoints. Reuses status mutations delegated by
 * the parent via `onAdvance` / `onConfirmPayment` / `onCancel`, and
 * `nextStatusFor` for the primary action label. Payment/fulfillment/print
 * blocks render only real data from the UnifiedOrderDTO (adapter markers).
 */
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  Printer,
  Phone,
  MapPin,
  StickyNote,
  Clock,
  User,
  Truck,
  ShoppingBag,
  Utensils,
  ExternalLink,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Order } from "@/lib/orders-api";

import { OriginBadge, ContextBadge } from "./unified-badges";
import type { AdaptedOrder } from "./unified-adapter";
import {
  contextLabel,
  customerOf,
  elapsed,
  formatBRL,
  nextStatusFor,
  orderLabel,
  totalCents,
} from "./helpers";

const FALLBACK = "—";

function formatDateTime(iso?: string | null): string {
  if (!iso) return FALLBACK;
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return FALLBACK;
  }
}

const STATUS_LABELS: Record<string, string> = {
  NEW: "Novo",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu para entrega",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const STATUS_TONE: Record<string, string> = {
  NEW: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  CONFIRMED: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PREPARING: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  READY: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  OUT_FOR_DELIVERY: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  COMPLETED: "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  DELIVERED: "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  CANCELLED: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  PIX: "PIX",
  PIX_MANUAL: "PIX",
  PIX_AUTOMATIC: "PIX",
  CASH: "Dinheiro",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Cartão de débito",
  CARD_ON_DELIVERY: "Cartão na entrega",
  NFC: "NFC",
  NFC_BALANCE: "NFC (saldo)",
  COURTESY: "Cortesia",
  MANUAL: "Manual",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  NOT_REQUIRED: "Sem pagamento",
  FAILED: "Falhou",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
};

const FULFILLMENT_LABELS: Record<string, { label: string; Icon: typeof Truck }> = {
  DELIVERY: { label: "Entrega", Icon: Truck },
  PICKUP: { label: "Retirada no balcão", Icon: ShoppingBag },
  ON_SITE: { label: "Consumo no local", Icon: Utensils },
  DINE_IN: { label: "Consumo no local", Icon: Utensils },
};

function Field({
  label,
  children,
  icon,
}: {
  label: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-sm text-foreground break-words">{children}</div>
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {icon}
      {children}
    </h3>
  );
}

type AddressRec = {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  reference?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  zip?: string;
};

function pickAddress(o: AdaptedOrder | null): AddressRec | null {
  if (!o) return null;
  // Prefer the normalized fulfillmentDetails.address (Fase 2A contract).
  const details = o.__unifiedFulfillmentDetails;
  if (details?.address) {
    const a = details.address;
    return {
      street: a.address || undefined,
      number: a.number || undefined,
      neighborhood: a.neighborhood || undefined,
      complement: a.complement ?? undefined,
      reference: a.reference ?? undefined,
    };
  }
  return null;
}


export function OrderDetailsDrawer({
  order,
  open,
  busy,
  onOpenChange,
  onAdvance,
  onConfirmPayment,
  onCancel,
}: {
  order: Order | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onAdvance: () => void;
  onConfirmPayment: () => void;
  onCancel: () => void;
}) {
  const o = (order as AdaptedOrder | null) ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px] lg:max-w-[620px]"
      >
        {o && <DrawerBody
          o={o}
          busy={busy}
          onAdvance={onAdvance}
          onConfirmPayment={onConfirmPayment}
          onCancel={onCancel}
          onClose={() => onOpenChange(false)}
        />}
      </SheetContent>
    </Sheet>
  );
}

function DrawerBody({
  o,
  busy,
  onAdvance,
  onConfirmPayment,
  onCancel,
  onClose,
}: {
  o: AdaptedOrder;
  busy: boolean;
  onAdvance: () => void;
  onConfirmPayment: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const status = ((o.status as string) ?? "").toUpperCase();
  const cancelled = status === "CANCELLED";
  const terminal = cancelled || status === "DELIVERED" || status === "COMPLETED";
  const next = nextStatusFor(o);
  const paymentStatus = (o.paymentStatus ?? "").toUpperCase();
  const paymentMethod = (o.paymentMethod ?? "").toUpperCase();
  const canConfirmPayment =
    !cancelled && (paymentStatus === "PENDING" || paymentStatus === "FAILED");
  const canAdvance =
    !!next && !cancelled && paymentStatus !== "PENDING" && paymentStatus !== "FAILED";

  // Consume ONLY the normalized fulfillmentDetails from the adapter.
  const details = o.__unifiedFulfillmentDetails ?? null;
  const fulfillmentType = (details?.type ?? "").toString().toUpperCase();
  const fulfillmentEntry = FULFILLMENT_LABELS[fulfillmentType];



  const customerObj = (o.customer && typeof o.customer === "object"
    ? (o.customer as Record<string, unknown>)
    : null);
  const customerId = (customerObj?.id as string) ?? "";
  const phone =
    (customerObj?.phone as string) ??
    (o as unknown as { customerPhone?: string }).customerPhone ??
    "";
  const email =
    (customerObj?.email as string) ??
    (o as unknown as { customerEmail?: string }).customerEmail ??
    "";

  const notes =
    (o as unknown as { notes?: string; observation?: string }).notes ??
    (o as unknown as { observation?: string }).observation ??
    "";

  const items = o.items ?? [];
  const totalC = totalCents(o);
  const totalStr = totalC > 0 ? formatBRL(totalC / 100) : FALLBACK;

  const printing = (o as unknown as { printing?: Record<string, unknown> }).printing;
  const printingEnabled = Boolean(printing?.enabled);
  const printJobs = (printing?.jobs as number | undefined) ?? undefined;
  const printPending = (printing?.pending as number | undefined) ?? undefined;
  const printErrors = (printing?.errors as number | undefined) ?? undefined;
  const printLast = (printing?.lastPrintedAt as string | undefined) ?? undefined;

  const address = pickAddress(o);
  const { kind, label: ctxLabel } = contextLabel(o);
  const elapsedStr = elapsed(o);
  const statusTone =
    STATUS_TONE[status] ?? "border-border bg-muted text-foreground/80";

  const paymentMethodLabel =
    PAYMENT_METHOD_LABELS[paymentMethod] ??
    (paymentMethod ? paymentMethod : "Não rastreado");
  const paymentStatusLabel =
    PAYMENT_STATUS_LABELS[paymentStatus] ?? (paymentStatus || FALLBACK);

  return (
    <>
      {/* Header fixo */}
      <header className="shrink-0 border-b bg-card px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xl font-extrabold tracking-tight text-foreground">
              Pedido {orderLabel(o)}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {ctxLabel ? `${kind}: ${ctxLabel} · ` : ""}
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {elapsedStr || FALLBACK}
              </span>
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}
          >
            {STATUS_LABELS[status] ?? status ?? FALLBACK}
          </span>
          <OriginBadge order={o} />
          <ContextBadge order={o} />
        </div>
      </header>

      {/* Corpo rolável */}
      <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
        {/* Resumo operacional */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Cliente" icon={<User className="h-3 w-3" aria-hidden="true" />}>
            {customerOf(o) || FALLBACK}
          </Field>
          {phone && (
            <Field label="Telefone" icon={<Phone className="h-3 w-3" aria-hidden="true" />}>
              {phone}
            </Field>
          )}
          {fulfillmentEntry && (
            <Field
              label="Fulfillment"
              icon={<fulfillmentEntry.Icon className="h-3 w-3" aria-hidden="true" />}
            >
              {fulfillmentEntry.label}
            </Field>
          )}
          <Field label="Pagamento">{paymentMethodLabel}</Field>
          <Field label="Total">
            <span className="font-bold text-primary">{totalStr}</span>
          </Field>
          <Field label="Criado em">{formatDateTime(o.createdAt)}</Field>
        </div>

        {/* Cliente detalhado */}
        {(email || customerId) && (
          <>
            <Separator className="my-4" />
            <SectionTitle icon={<User className="h-3.5 w-3.5" />}>Cliente</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              {email && <Field label="E-mail">{email}</Field>}
              {customerId && (
                <div className="col-span-2">
                  <Button asChild variant="outline" size="sm" className="h-8">
                    <Link to="/admin/customers/$id" params={{ id: customerId }}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Abrir cliente
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Entrega / Retirada */}
        {fulfillmentEntry && (
          <>
            <Separator className="my-4" />
            <SectionTitle icon={<fulfillmentEntry.Icon className="h-3.5 w-3.5" />}>
              {fulfillmentEntry.label}
            </SectionTitle>
            {fulfillmentType === "DELIVERY" && address ? (
              <div className="rounded-md border border-border/60 bg-muted/30 p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">
                      {address.street || FALLBACK}
                      {address.number ? `, ${address.number}` : ""}
                    </p>
                    {address.neighborhood && (
                      <p className="text-muted-foreground">{address.neighborhood}</p>
                    )}
                    {(address.city || address.state) && (
                      <p className="text-muted-foreground">
                        {[address.city, address.state].filter(Boolean).join(" · ")}
                        {address.zipCode || address.zip
                          ? ` · CEP ${address.zipCode ?? address.zip}`
                          : ""}
                      </p>
                    )}
                    {address.complement && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold">Complemento:</span> {address.complement}
                      </p>
                    )}
                    {address.reference && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold">Referência:</span> {address.reference}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : fulfillmentType === "DELIVERY" ? (
              <p className="text-xs text-muted-foreground">Endereço não informado.</p>
            ) : null}
          </>
        )}

        {/* Itens */}
        <Separator className="my-4" />
        <SectionTitle>Itens ({items.length})</SectionTitle>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum item informado.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => {
              const rec = it as Record<string, unknown>;
              const qty = (rec.quantity as number) ?? (rec.qty as number) ?? 1;
              const name = (rec.name as string) ?? (rec.productName as string) ?? "Item";
              const unit =
                (rec.priceInCents as number | undefined) ??
                (typeof rec.totalInCents === "number" && qty > 0
                  ? Math.round((rec.totalInCents as number) / qty)
                  : undefined);
              const lineTotal =
                (rec.totalInCents as number | undefined) ??
                (typeof unit === "number" ? unit * qty : undefined);
              const opts =
                (rec.options as Array<Record<string, unknown>> | undefined) ??
                (rec.selectedOptions as Array<Record<string, unknown>> | undefined) ??
                (rec.modifiers as Array<Record<string, unknown>> | undefined) ??
                [];
              const itemNotes =
                (rec.notes as string) ?? (rec.observation as string) ?? "";
              return (
                <li
                  key={(rec.id as string) ?? i}
                  className="rounded-md border border-border/60 bg-muted/30 p-3"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-primary">{qty}x</span>{" "}
                      <span className="font-medium text-foreground">{name}</span>
                    </div>
                    {typeof lineTotal === "number" && (
                      <span className="shrink-0 text-sm font-semibold text-foreground">
                        {formatBRL(lineTotal / 100)}
                      </span>
                    )}
                  </div>
                  {typeof unit === "number" && qty > 1 && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {formatBRL(unit / 100)} cada
                    </p>
                  )}
                  {opts.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 pl-3 text-xs text-muted-foreground">
                      {opts.map((op, j) => {
                        const opName = (op.name as string) ?? "";
                        const opValue = (op.value as string) ?? "";
                        const label =
                          opName && opValue
                            ? `${opName}: ${opValue}`
                            : opName || opValue || "";
                        const opPrice = op.priceInCents as number | undefined;
                        if (!label) return null;
                        return (
                          <li key={j} className="flex justify-between gap-2">
                            <span className="truncate">• {label}</span>
                            {typeof opPrice === "number" && opPrice > 0 && (
                              <span>+{formatBRL(opPrice / 100)}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {itemNotes && (
                    <p className="mt-1.5 flex items-start gap-1 pl-3 text-[11px] italic text-muted-foreground">
                      <StickyNote className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      {itemNotes}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {notes && (
          <>
            <Separator className="my-4" />
            <Field
              label="Observação do pedido"
              icon={<StickyNote className="h-3 w-3" aria-hidden="true" />}
            >
              {notes}
            </Field>
          </>
        )}

        {/* Pagamento */}
        <Separator className="my-4" />
        <SectionTitle>Pagamento</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Método">{paymentMethodLabel}</Field>
          <Field label="Status">{paymentStatusLabel}</Field>
          <Field label="Total">
            <span className="font-bold text-primary">{totalStr}</span>
          </Field>
          {typeof o.amountPaidInCents === "number" && o.amountPaidInCents > 0 && (
            <Field label="Valor recebido">
              {formatBRL(o.amountPaidInCents / 100)}
            </Field>
          )}
          {typeof o.changeForInCents === "number" && o.changeForInCents > 0 && (
            <Field label="Troco">{formatBRL(o.changeForInCents / 100)}</Field>
          )}
          {o.paidAt && <Field label="Pago em">{formatDateTime(o.paidAt)}</Field>}
        </div>
        {o.paymentNotes && (
          <p className="mt-2 text-xs text-muted-foreground">{o.paymentNotes}</p>
        )}

        {/* Impressão */}
        <Separator className="my-4" />
        <SectionTitle icon={<Printer className="h-3.5 w-3.5" />}>Impressão</SectionTitle>
        {!printing || !printingEnabled ? (
          <p className="text-xs text-muted-foreground">
            Impressão automática ainda não habilitada para este pedido.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {typeof printJobs === "number" && (
              <Field label="Jobs">{printJobs}</Field>
            )}
            {typeof printPending === "number" && (
              <Field label="Pendentes">{printPending}</Field>
            )}
            {typeof printErrors === "number" && (
              <Field label="Erros">{printErrors}</Field>
            )}
            {printLast && (
              <Field label="Última impressão">{formatDateTime(printLast)}</Field>
            )}
          </div>
        )}

        {/* Datas */}
        <Separator className="my-4" />
        <SectionTitle>Datas</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Criado em">{formatDateTime(o.createdAt)}</Field>
          <Field label="Atualizado em">{formatDateTime(o.updatedAt)}</Field>
          {o.paidAt && <Field label="Pago em">{formatDateTime(o.paidAt)}</Field>}
          {(() => {
            const scheduled = (o as unknown as { fulfillment?: { scheduledAt?: string } })
              .fulfillment?.scheduledAt;
            return scheduled ? (
              <Field label="Agendado para">{formatDateTime(scheduled)}</Field>
            ) : null;
          })()}

        </div>
      </div>

      {/* Footer fixo */}
      <footer
        className="shrink-0 border-t bg-card px-5 py-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Fechar
          </Button>
          {!terminal && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={onCancel}
              className="border-red-500/40 text-red-600 hover:bg-red-500/10"
            >
              Cancelar
            </Button>
          )}
          {canConfirmPayment && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={onConfirmPayment}
              className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-400"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Confirmar pagamento"
              )}
            </Button>
          )}
          {canAdvance && next && (
            <Button
              disabled={busy}
              onClick={onAdvance}
              className="text-primary-foreground font-bold"
              style={{ background: "var(--gradient-primary)" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : next.label}
            </Button>
          )}
        </div>
      </footer>
    </>
  );
}
