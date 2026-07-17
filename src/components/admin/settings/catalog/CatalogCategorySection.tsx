import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogCategorySettings } from "@/lib/catalog-settings-api";

interface Props {
  value: CatalogCategorySettings;
  onChange: (patch: Partial<CatalogCategorySettings>) => void;
}

export function CatalogCategorySection({ value, onChange }: Props) {
  const toggle =
    (key: keyof CatalogCategorySettings) =>
    (v: boolean) =>
      onChange({ [key]: v } as Partial<CatalogCategorySettings>);

  return (
    <SettingsSection
      title="Categorias"
      description="Comportamento da navegação por categorias."
    >
      <SettingsGroup columns={2}>
        <ToggleRow
          label="Scroll horizontal"
          checked={value.horizontalScroll}
          onChange={toggle("horizontalScroll")}
        />
        <ToggleRow
          label="Categorias fixas ao rolar"
          checked={value.stickyCategories}
          onChange={toggle("stickyCategories")}
        />
        <ToggleRow
          label="Mostrar contador de produtos"
          checked={value.showProductCount}
          onChange={toggle("showProductCount")}
        />
        <ToggleRow
          label="Iniciar categorias recolhidas"
          checked={value.collapsedByDefault}
          onChange={toggle("collapsedByDefault")}
        />
        <ToggleRow
          label="Permitir busca"
          checked={value.enableSearch}
          onChange={toggle("enableSearch")}
        />
      </SettingsGroup>

      <div className="grid gap-1.5">
        <Label htmlFor="search-ph">Placeholder da busca</Label>
        <Input
          id="search-ph"
          value={value.searchPlaceholder}
          onChange={(e) => onChange({ searchPlaceholder: e.target.value })}
          placeholder="Ex.: Buscar produtos..."
        />
      </div>
    </SettingsSection>
  );
}
