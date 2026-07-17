import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AssetUploader } from "@/components/admin/asset-uploader";
import { useAuth } from "@/lib/auth-context";
import type { CatalogProductSettings } from "@/lib/catalog-settings-api";

interface Props {
  value: CatalogProductSettings;
  onChange: (patch: Partial<CatalogProductSettings>) => void;
}

export function CatalogProductsSection({ value, onChange }: Props) {
  const { token } = useAuth();
  const toggle =
    (key: keyof CatalogProductSettings) =>
    (v: boolean) =>
      onChange({ [key]: v } as Partial<CatalogProductSettings>);

  return (
    <SettingsSection
      title="Produtos"
      description="Regras para exibição dos produtos no cardápio."
    >
      <SettingsGroup columns={2}>
        <div className="grid gap-1.5">
          <Label htmlFor="maxp">Máx. de produtos por seção</Label>
          <Input
            id="maxp"
            type="number"
            min={1}
            value={String(value.maxProductsPerSection)}
            onChange={(e) =>
              onChange({ maxProductsPerSection: Number(e.target.value) || 1 })
            }
          />
        </div>
        <AssetUploader
          label="Imagem padrão do produto"
          description="Exibida quando o produto não tem imagem própria."
          token={token}
          value={value.defaultProductImageUrl}
          onChange={(url) => onChange({ defaultProductImageUrl: url })}
        />
      </SettingsGroup>

      <SettingsGroup columns={2}>
        <ToggleRow
          label="Destacar recomendados"
          checked={value.highlightRecommended}
          onChange={toggle("highlightRecommended")}
        />
        <ToggleRow
          label="Destacar novidades"
          checked={value.highlightNew}
          onChange={toggle("highlightNew")}
        />
        <ToggleRow
          label="Destacar promoções"
          checked={value.highlightPromos}
          onChange={toggle("highlightPromos")}
        />
        <ToggleRow
          label="Lazy loading das imagens"
          checked={value.lazyLoadImages}
          onChange={toggle("lazyLoadImages")}
        />
        <ToggleRow
          label="Selo de indisponível"
          checked={value.showUnavailableBadge}
          onChange={toggle("showUnavailableBadge")}
        />
      </SettingsGroup>
    </SettingsSection>
  );
}
