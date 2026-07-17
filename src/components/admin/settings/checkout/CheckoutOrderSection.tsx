import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CheckoutOrderSettings } from "@/lib/checkout-settings-api";

interface Props {
  value: CheckoutOrderSettings;
  onChange: (patch: Partial<CheckoutOrderSettings>) => void;
}

function centsToReais(cents: number): string {
  return cents ? (cents / 100).toFixed(2) : "";
}
function reaisToCents(str: string): number {
  const n = Number(str.replace(",", "."));
  return isFinite(n) ? Math.round(n * 100) : 0;
}

export function CheckoutOrderSection({ value, onChange }: Props) {
  return (
    <SettingsSection
      title="Pedido"
      description="Limites e mensagens exibidas no fluxo do pedido."
    >
      <SettingsGroup columns={2}>
        <div className="space-y-2">
          <Label>Pedido mínimo (R$)</Label>
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={centsToReais(value.minOrderInCents)}
            onChange={(e) => onChange({ minOrderInCents: reaisToCents(e.target.value) })}
          />
        </div>
        <div className="space-y-2">
          <Label>Pedido máximo (R$)</Label>
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={centsToReais(value.maxOrderInCents)}
            onChange={(e) => onChange({ maxOrderInCents: reaisToCents(e.target.value) })}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup columns={1}>
        <div className="space-y-2">
          <Label>Mensagem antes do checkout</Label>
          <Textarea
            rows={2}
            value={value.preCheckoutMessage}
            onChange={(e) => onChange({ preCheckoutMessage: e.target.value })}
            placeholder="Ex.: Confirme seus dados antes de finalizar."
          />
        </div>
        <div className="space-y-2">
          <Label>Mensagem após confirmação</Label>
          <Textarea
            rows={2}
            value={value.postCheckoutMessage}
            onChange={(e) => onChange({ postCheckoutMessage: e.target.value })}
            placeholder="Ex.: Obrigado pelo pedido!"
          />
        </div>
        <div className="space-y-2">
          <Label>Placeholder das observações</Label>
          <Input
            value={value.notesPlaceholder}
            onChange={(e) => onChange({ notesPlaceholder: e.target.value })}
          />
        </div>
      </SettingsGroup>
    </SettingsSection>
  );
}
