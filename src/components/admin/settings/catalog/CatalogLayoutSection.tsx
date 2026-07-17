import { LayoutGrid, LayoutList, Rows3 } from "lucide-react";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { cn } from "@/lib/utils";
import type { CatalogLayoutMode } from "@/lib/catalog-settings-api";

interface Props {
  value: CatalogLayoutMode;
  onChange: (v: CatalogLayoutMode) => void;
}

const OPTIONS: {
  id: CatalogLayoutMode;
  label: string;
  hint: string;
  Icon: typeof LayoutGrid;
}[] = [
  { id: "LIST", label: "Lista", hint: "Cards largos, ideal para leitura", Icon: LayoutList },
  { id: "GRID", label: "Grid", hint: "Duas colunas com imagens", Icon: LayoutGrid },
  { id: "COMPACT", label: "Compacto", hint: "Denso, foca em preço", Icon: Rows3 },
];

export function CatalogLayoutSection({ value, onChange }: Props) {
  return (
    <SettingsSection
      title="Layout"
      description="Como os produtos são organizados no cardápio."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map(({ id, label, hint, Icon }) => {
          const active = value === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                active
                  ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                  : "border-border hover:bg-accent/40",
              )}
            >
              <Icon
                className={cn("h-5 w-5", active ? "text-primary" : "text-muted-foreground")}
              />
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </button>
          );
        })}
      </div>
    </SettingsSection>
  );
}
