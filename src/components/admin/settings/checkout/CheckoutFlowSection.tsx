import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import type { CheckoutFlowSettings } from "@/lib/checkout-settings-api";

interface Props {
  value: CheckoutFlowSettings;
  onChange: (patch: Partial<CheckoutFlowSettings>) => void;
}

export function CheckoutFlowSection({ value, onChange }: Props) {
  const toggle =
    (key: keyof CheckoutFlowSettings) =>
    (v: boolean) =>
      onChange({ [key]: v } as Partial<CheckoutFlowSettings>);

  return (
    <SettingsSection
      title="Fluxo"
      description="Modalidades de atendimento disponíveis no checkout."
    >
      <SettingsGroup columns={2}>
        <ToggleRow label="Permitir Delivery" checked={value.allowDelivery} onChange={toggle("allowDelivery")} />
        <ToggleRow label="Permitir Retirada" checked={value.allowPickup} onChange={toggle("allowPickup")} />
        <ToggleRow label="Permitir Balcão" checked={value.allowCounter} onChange={toggle("allowCounter")} />
        <ToggleRow label="Permitir Consumo Local" checked={value.allowDineIn} onChange={toggle("allowDineIn")} />
        <ToggleRow label="Permitir Agendamento" checked={value.allowScheduling} onChange={toggle("allowScheduling")} />
      </SettingsGroup>
    </SettingsSection>
  );
}
