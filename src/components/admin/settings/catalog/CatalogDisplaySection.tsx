import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import type { CatalogDisplaySettings } from "@/lib/catalog-settings-api";

interface Props {
  value: CatalogDisplaySettings;
  onChange: (patch: Partial<CatalogDisplaySettings>) => void;
}

export function CatalogDisplaySection({ value, onChange }: Props) {
  const toggle =
    (key: keyof CatalogDisplaySettings) =>
    (v: boolean) =>
      onChange({ [key]: v } as Partial<CatalogDisplaySettings>);

  return (
    <SettingsSection
      title="Exibição"
      description="O que aparece para o cliente no cardápio digital."
    >
      <SettingsGroup columns={2}>
        <ToggleRow
          label="Mostrar categorias vazias"
          checked={value.showEmptyCategories}
          onChange={toggle("showEmptyCategories")}
        />
        <ToggleRow
          label="Mostrar descrição dos produtos"
          checked={value.showProductDescription}
          onChange={toggle("showProductDescription")}
        />
        <ToggleRow
          label="Mostrar imagens dos produtos"
          checked={value.showProductImages}
          onChange={toggle("showProductImages")}
        />
        <ToggleRow
          label="Mostrar produtos indisponíveis"
          checked={value.showUnavailableProducts}
          onChange={toggle("showUnavailableProducts")}
        />
        <ToggleRow
          label="Mostrar preços"
          checked={value.showPrices}
          onChange={toggle("showPrices")}
        />
        <ToggleRow
          label="Mostrar estoque disponível"
          checked={value.showStock}
          onChange={toggle("showStock")}
        />
        <ToggleRow
          label="Mostrar adicionais"
          checked={value.showAddons}
          onChange={toggle("showAddons")}
        />
        <ToggleRow
          label="Mostrar combos"
          checked={value.showCombos}
          onChange={toggle("showCombos")}
        />
        <ToggleRow
          label="Promoções primeiro"
          checked={value.promosFirst}
          onChange={toggle("promosFirst")}
        />
        <ToggleRow
          label="Mostrar tempo de preparo"
          checked={value.showPreparationTime}
          onChange={toggle("showPreparationTime")}
        />
      </SettingsGroup>
    </SettingsSection>
  );
}
