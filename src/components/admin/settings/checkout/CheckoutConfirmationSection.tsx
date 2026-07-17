import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CheckoutConfirmationSettings } from "@/lib/checkout-settings-api";

interface Props {
  value: CheckoutConfirmationSettings;
  onChange: (patch: Partial<CheckoutConfirmationSettings>) => void;
}

export function CheckoutConfirmationSection({ value, onChange }: Props) {
  const t =
    (key: keyof CheckoutConfirmationSettings) =>
    (v: boolean) =>
      onChange({ [key]: v } as Partial<CheckoutConfirmationSettings>);

  return (
    <SettingsSection
      title="Confirmação"
      description="Tela exibida após o pedido ser enviado."
    >
      <SettingsGroup columns={1}>
        <div className="space-y-2">
          <Label>Título</Label>
          <Input
            value={value.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Mensagem</Label>
          <Textarea
            rows={2}
            value={value.message}
            onChange={(e) => onChange({ message: e.target.value })}
          />
        </div>
      </SettingsGroup>

      <SettingsGroup columns={2}>
        <ToggleRow label="Mostrar número do pedido" checked={value.showOrderNumber} onChange={t("showOrderNumber")} />
        <ToggleRow label='Mostrar botão "Novo Pedido"' checked={value.showNewOrderButton} onChange={t("showNewOrderButton")} />
        <ToggleRow label="Mostrar WhatsApp" checked={value.showWhatsapp} onChange={t("showWhatsapp")} />
        <ToggleRow label="Mostrar tempo estimado" checked={value.showEstimatedTime} onChange={t("showEstimatedTime")} />
      </SettingsGroup>
    </SettingsSection>
  );
}
