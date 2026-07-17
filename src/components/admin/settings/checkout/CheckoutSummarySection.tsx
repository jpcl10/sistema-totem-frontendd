import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import type { CheckoutSummarySettings } from "@/lib/checkout-settings-api";

interface Props {
  value: CheckoutSummarySettings;
  onChange: (patch: Partial<CheckoutSummarySettings>) => void;
}

export function CheckoutSummarySection({ value, onChange }: Props) {
  const t =
    (key: keyof CheckoutSummarySettings) =>
    (v: boolean) =>
      onChange({ [key]: v } as Partial<CheckoutSummarySettings>);

  return (
    <SettingsSection
      title="Resumo"
      description="O que exibir no resumo antes da finalização."
    >
      <SettingsGroup columns={2}>
        <ToggleRow label="Mostrar subtotal" checked={value.showSubtotal} onChange={t("showSubtotal")} />
        <ToggleRow label="Mostrar taxa" checked={value.showFee} onChange={t("showFee")} />
        <ToggleRow label="Mostrar desconto" checked={value.showDiscount} onChange={t("showDiscount")} />
        <ToggleRow label="Mostrar tempo estimado" checked={value.showEstimatedTime} onChange={t("showEstimatedTime")} />
        <ToggleRow label="Mostrar endereço" checked={value.showAddress} onChange={t("showAddress")} />
        <ToggleRow label="Mostrar observações" checked={value.showNotes} onChange={t("showNotes")} />
        <ToggleRow label="Mostrar forma de pagamento" checked={value.showPaymentMethod} onChange={t("showPaymentMethod")} />
      </SettingsGroup>
    </SettingsSection>
  );
}
