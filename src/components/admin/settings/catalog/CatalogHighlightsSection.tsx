import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { ToggleRow } from "@/components/admin/settings/shared-ui";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { listCatalogProducts, listCatalogCategories } from "@/lib/catalog-api";
import { cn } from "@/lib/utils";
import type { CatalogHighlightSettings } from "@/lib/catalog-settings-api";

interface Props {
  value: CatalogHighlightSettings;
  onChange: (patch: Partial<CatalogHighlightSettings>) => void;
}

function EntityCombobox({
  label,
  placeholder,
  emptyLabel,
  items,
  value,
  onChange,
  loading,
}: {
  label: string;
  placeholder: string;
  emptyLabel: string;
  items: { id: string; name: string }[];
  value: string | null;
  onChange: (v: string | null) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.id === value);

  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !selected && "text-muted-foreground")}>
              {loading ? "Carregando..." : selected ? selected.name : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar..." />
            <CommandList>
              <CommandEmpty>{emptyLabel}</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="text-muted-foreground">Nenhum</span>
                </CommandItem>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.name}
                    onSelect={() => {
                      onChange(it.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === it.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="truncate">{it.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function CatalogHighlightsSection({ value, onChange }: Props) {
  const { token } = useAuth();
  const { organizationId } = useOrganization();

  const productsQ = useQuery({
    queryKey: ["catalog", organizationId, "products", "for-highlights"],
    queryFn: () => listCatalogProducts(token!, organizationId),
    enabled: !!token && !!organizationId,
    staleTime: 60_000,
  });
  const categoriesQ = useQuery({
    queryKey: ["catalog", organizationId, "categories", "for-highlights"],
    queryFn: () => listCatalogCategories(token!, organizationId),
    enabled: !!token && !!organizationId,
    staleTime: 60_000,
  });

  return (
    <SettingsSection
      title="Destaques"
      description="Produtos, banners e mensagens em destaque."
    >
      <SettingsGroup columns={2}>
        <EntityCombobox
          label="Produto em destaque"
          placeholder="Selecionar produto..."
          emptyLabel="Nenhum produto encontrado."
          items={(productsQ.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
          value={value.featuredProductId}
          onChange={(v) => onChange({ featuredProductId: v })}
          loading={productsQ.isLoading}
        />
        <EntityCombobox
          label="Categoria em destaque"
          placeholder="Selecionar categoria..."
          emptyLabel="Nenhuma categoria encontrada."
          items={(categoriesQ.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
          value={value.featuredCategoryId}
          onChange={(v) => onChange({ featuredCategoryId: v })}
          loading={categoriesQ.isLoading}
        />
      </SettingsGroup>

      <ToggleRow
        label="Banner promocional ativo"
        checked={value.bannerActive}
        onChange={(v) => onChange({ bannerActive: v })}
      />

      <SettingsGroup columns={1}>
        <div className="grid gap-1.5">
          <Label htmlFor="hdr">Mensagem acima do catálogo</Label>
          <Textarea
            id="hdr"
            rows={2}
            value={value.headerMessage}
            onChange={(e) => onChange({ headerMessage: e.target.value })}
            placeholder="Ex.: Frete grátis acima de R$ 80"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ftr">Mensagem abaixo do catálogo</Label>
          <Textarea
            id="ftr"
            rows={2}
            value={value.footerMessage}
            onChange={(e) => onChange({ footerMessage: e.target.value })}
            placeholder="Ex.: Dúvidas? Fale conosco no WhatsApp"
          />
        </div>
      </SettingsGroup>
    </SettingsSection>
  );
}
