import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import type { CheckoutCustomerSettings } from "@/lib/checkout-settings-api";

interface Props {
  value: CheckoutCustomerSettings;
  onChange: (patch: Partial<CheckoutCustomerSettings>) => void;
}

export function CheckoutCustomerSection({ value, onChange }: Props) {
  const toggle =
    (key: keyof CheckoutCustomerSettings) =>
    (v: boolean) =>
      onChange({ [key]: v } as Partial<CheckoutCustomerSettings>);

  return (
    <SettingsSection
      title="Dados do Cliente"
      description="Quais informações são obrigatórias na finalização."
    >
      <SettingsGroup columns={2}>
        <ToggleRow label="Nome obrigatório" checked={value.requireName} onChange={toggle("requireName")} />
        <ToggleRow label="Telefone obrigatório" checked={value.requirePhone} onChange={toggle("requirePhone")} />
        <ToggleRow label="WhatsApp obrigatório" checked={value.requireWhatsapp} onChange={toggle("requireWhatsapp")} />
        <ToggleRow label="Endereço obrigatório" checked={value.requireAddress} onChange={toggle("requireAddress")} />
        <ToggleRow label="Número obrigatório" checked={value.requireNumber} onChange={toggle("requireNumber")} />
        <ToggleRow label="Complemento" checked={value.requireComplement} onChange={toggle("requireComplement")} />
        <ToggleRow label="Bairro obrigatório" checked={value.requireNeighborhood} onChange={toggle("requireNeighborhood")} />
        <ToggleRow label="Cidade obrigatória" checked={value.requireCity} onChange={toggle("requireCity")} />
        <ToggleRow label="CEP obrigatório" checked={value.requireZip} onChange={toggle("requireZip")} />
        <ToggleRow label="CPF" checked={value.requireCpf} onChange={toggle("requireCpf")} />
        <ToggleRow label="E-mail" checked={value.requireEmail} onChange={toggle("requireEmail")} />
        <ToggleRow label="Observações" checked={value.requireNotes} onChange={toggle("requireNotes")} />
      </SettingsGroup>
    </SettingsSection>
  );
}
