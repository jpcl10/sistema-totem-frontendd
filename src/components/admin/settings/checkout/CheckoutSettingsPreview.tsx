import { Bike, ShoppingBag, Store, Utensils, CalendarClock, CheckCircle2 } from "lucide-react";
import type { CheckoutSettings } from "@/lib/checkout-settings-api";

interface Props {
  settings: CheckoutSettings;
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
}

export function CheckoutSettingsPreview({ settings }: Props) {
  const { flow, customer, order, payment, change, summary, confirmation } = settings;

  const modes: { key: keyof typeof flow; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "allowDelivery", label: "Delivery", icon: Bike },
    { key: "allowPickup", label: "Retirada", icon: ShoppingBag },
    { key: "allowCounter", label: "Balcão", icon: Store },
    { key: "allowDineIn", label: "No local", icon: Utensils },
    { key: "allowScheduling", label: "Agendar", icon: CalendarClock },
  ];
  const activeModes = modes.filter((m) => flow[m.key]);

  const pays: { key: keyof typeof payment; label: string }[] = [
    { key: "cash", label: "Dinheiro" },
    { key: "pix", label: "PIX" },
    { key: "credit", label: "Crédito" },
    { key: "debit", label: "Débito" },
    { key: "online", label: "Online" },
    { key: "voucher", label: "Vale" },
    { key: "onDelivery", label: "Na entrega" },
  ];
  const activePays = pays.filter((p) => payment[p.key]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow-soft)]">
      <div className="border-b border-border bg-card px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Checkout
        </p>
        <p className="text-sm font-medium text-foreground">Finalize seu pedido</p>
      </div>

      <div className="space-y-4 p-4 text-sm">
        {/* Modalidades */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Como deseja receber?</p>
          <div className="flex flex-wrap gap-2">
            {activeModes.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma modalidade ativa.</span>
            )}
            {activeModes.map((m) => {
              const Icon = m.icon;
              return (
                <span
                  key={m.key}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs"
                >
                  <Icon className="h-3 w-3" />
                  {m.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Dados do cliente */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Seus dados</p>
          <div className="space-y-2">
            {customer.requireName && (
              <div className="h-8 rounded-md border border-input bg-card px-2 text-xs leading-8 text-muted-foreground">
                Nome *
              </div>
            )}
            {customer.requirePhone && (
              <div className="h-8 rounded-md border border-input bg-card px-2 text-xs leading-8 text-muted-foreground">
                Telefone *
              </div>
            )}
            {customer.requireAddress && (
              <div className="h-8 rounded-md border border-input bg-card px-2 text-xs leading-8 text-muted-foreground">
                Endereço *
              </div>
            )}
            {customer.requireNotes && (
              <div className="rounded-md border border-input bg-card px-2 py-1 text-xs text-muted-foreground">
                {order.notesPlaceholder || "Observações"}
              </div>
            )}
          </div>
        </div>

        {/* Pagamento */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Pagamento</p>
          <div className="flex flex-wrap gap-1.5">
            {activePays.length === 0 && (
              <span className="text-xs text-muted-foreground">Nenhuma forma habilitada.</span>
            )}
            {activePays.map((p) => (
              <span
                key={p.key}
                className="rounded border border-border bg-card px-1.5 py-0.5 text-[11px]"
              >
                {p.label}
              </span>
            ))}
          </div>
          {payment.cash && change.allowChange && (
            <div className="mt-2 flex flex-wrap gap-1">
              {change.showExactAmountButton && (
                <span className="rounded bg-muted px-2 py-0.5 text-[11px]">Valor exato</span>
              )}
              {change.quickAdd10 && <span className="rounded bg-muted px-2 py-0.5 text-[11px]">+R$10</span>}
              {change.quickAdd20 && <span className="rounded bg-muted px-2 py-0.5 text-[11px]">+R$20</span>}
              {change.quickAdd50 && <span className="rounded bg-muted px-2 py-0.5 text-[11px]">+R$50</span>}
            </div>
          )}
        </div>

        {/* Resumo */}
        <div className="rounded-md border border-border bg-card p-3 text-xs">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Resumo</p>
          <div className="space-y-1">
            {summary.showSubtotal && (
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatBRL(4990)}</span>
              </div>
            )}
            {summary.showFee && (
              <div className="flex justify-between">
                <span>Taxa de entrega</span>
                <span>{formatBRL(500)}</span>
              </div>
            )}
            {summary.showDiscount && (
              <div className="flex justify-between text-emerald-600">
                <span>Desconto</span>
                <span>-{formatBRL(200)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold">
              <span>Total</span>
              <span>{formatBRL(5290)}</span>
            </div>
            {summary.showEstimatedTime && (
              <p className="pt-1 text-muted-foreground">Tempo estimado: 30-45 min</p>
            )}
          </div>
        </div>

        {order.preCheckoutMessage && (
          <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            {order.preCheckoutMessage}
          </p>
        )}

        {order.minOrderInCents > 0 && (
          <p className="text-[11px] text-muted-foreground">
            Pedido mínimo: {formatBRL(order.minOrderInCents)}
          </p>
        )}

        <button
          type="button"
          className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
          disabled
        >
          Finalizar pedido
        </button>

        {/* Confirmação */}
        <div className="rounded-md border border-dashed border-border p-3">
          <div className="mb-1 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <p className="text-sm font-medium">{confirmation.title || "Pedido confirmado!"}</p>
          </div>
          {confirmation.message && (
            <p className="text-xs text-muted-foreground">{confirmation.message}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1 text-[11px] text-muted-foreground">
            {confirmation.showOrderNumber && <span>#0001</span>}
            {confirmation.showEstimatedTime && <span>· 30-45 min</span>}
            {confirmation.showWhatsapp && <span>· WhatsApp</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
