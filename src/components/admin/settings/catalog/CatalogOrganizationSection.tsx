import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CategorySortMode,
  ProductSortMode,
} from "@/lib/catalog-settings-api";

interface Props {
  productSort: ProductSortMode;
  categorySort: CategorySortMode;
  onProductSort: (v: ProductSortMode) => void;
  onCategorySort: (v: CategorySortMode) => void;
}

const PRODUCT_OPTS: { id: ProductSortMode; label: string }[] = [
  { id: "MANUAL", label: "Manual" },
  { id: "NAME", label: "Nome" },
  { id: "BEST_SELLING", label: "Mais vendidos" },
  { id: "RECENT", label: "Mais recentes" },
];

const CATEGORY_OPTS: { id: CategorySortMode; label: string }[] = [
  { id: "MANUAL", label: "Manual" },
  { id: "NAME", label: "Nome" },
];

export function CatalogOrganizationSection({
  productSort,
  categorySort,
  onProductSort,
  onCategorySort,
}: Props) {
  return (
    <SettingsSection
      title="Organização"
      description="Como produtos e categorias são ordenados."
    >
      <SettingsGroup columns={2}>
        <div className="grid gap-1.5">
          <Label>Ordenação de produtos</Label>
          <Select
            value={productSort}
            onValueChange={(v) => onProductSort(v as ProductSortMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_OPTS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Ordenação de categorias</Label>
          <Select
            value={categorySort}
            onValueChange={(v) => onCategorySort(v as CategorySortMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTS.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsGroup>
    </SettingsSection>
  );
}
