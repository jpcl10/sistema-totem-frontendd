import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import type {
  CheckoutPaymentSettings,
  CheckoutChangeSettings,
} from "@/lib/checkout-settings-api";

interface Props {
  payment: CheckoutPaymentSettings;
  change: CheckoutChangeSettings;
  onPaymentChange: (patch: Partial<CheckoutPaymentSettings>) => void;
  onChangeChange: (patch: Partial<CheckoutChangeSettings>) => void;
}

export function CheckoutPaymentSection({
  payment,
  change,
  onPaymentChange,
  onChangeChange,
}: Props) {
  const tp =
    (key: keyof CheckoutPaymentSettings) =>
    (v: boolean) =>
      onPaymentChange({ [key]: v } as Partial<CheckoutPaymentSettings>);
  const tc =
    (key: keyof CheckoutChangeSettings) =>
    (v: boolean) =>
      onChangeChange({ [key]: v } as Partial<CheckoutChangeSettings>);

  return (
    <SettingsSection
      title="Pagamentos"
      description="Formas de pagamento visíveis no checkout. A configuração detalhada permanece em Pagamentos."
    >
      <SettingsGroup title="Formas aceitas" columns={2}>
        <ToggleRow label="Dinheiro" checked={payment.cash} onChange={tp("cash")} />
        <ToggleRow label="PIX" checked={payment.pix} onChange={tp("pix")} />
        <ToggleRow label="Cartão Crédito" checked={payment.credit} onChange={tp("credit")} />
        <ToggleRow label="Cartão Débito" checked={payment.debit} onChange={tp("debit")} />
        <ToggleRow label="Pagamento Online" checked={payment.online} onChange={tp("online")} />
        <ToggleRow label="Vale" checked={payment.voucher} onChange={tp("voucher")} />
        <ToggleRow label="Pagamento na entrega" checked={payment.onDelivery} onChange={tp("onDelivery")} />
      </SettingsGroup>

      <SettingsGroup title="Troco" description="Comportamento quando o cliente paga em dinheiro." columns={2}>
        <ToggleRow label="Permitir troco" checked={change.allowChange} onChange={tc("allowChange")} />
        <ToggleRow label="Troco obrigatório" checked={change.requireChange} onChange={tc("requireChange")} />
        <ToggleRow label='Mostrar botão "Valor Exato"' checked={change.showExactAmountButton} onChange={tc("showExactAmountButton")} />
        <ToggleRow label="Sugestão +R$ 10" checked={change.quickAdd10} onChange={tc("quickAdd10")} />
        <ToggleRow label="Sugestão +R$ 20" checked={change.quickAdd20} onChange={tc("quickAdd20")} />
        <ToggleRow label="Sugestão +R$ 50" checked={change.quickAdd50} onChange={tc("quickAdd50")} />
      </SettingsGroup>
    </SettingsSection>
  );
}
