import {
  ChevronDown,
  ChevronRight,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  Power,
  Ruler,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrencyFromCents } from "@/lib/utils";
import type {
  CatalogProduct,
  CatalogProductOption,
  CatalogProductOptionGroup,
} from "@/lib/catalog-api";

import { isSizeGroup } from "./helpers";
import { IconAction } from "./ui";

export function GroupRow({
  group,
  isOpen,
  onToggle,
  onAddOption,
  onEditGroup,
  onToggleGroupStatus,
  onEditOption,
  onToggleOptionStatus,
  catalogProducts,
  productPriceBaseInCents,
}: {
  group: CatalogProductOptionGroup;
  isOpen: boolean;
  onToggle: () => void;
  onAddOption: () => void;
  onEditGroup: () => void;
  onToggleGroupStatus: () => void;
  onEditOption: (o: CatalogProductOption) => void;
  onToggleOptionStatus: (o: CatalogProductOption) => void;
  catalogProducts: CatalogProduct[];
  productPriceBaseInCents: number;
}) {
  const inactive = group.active === false;
  const options = [...(group.options ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const sizeGroup = isSizeGroup(group);
  const min = group.minSelections ?? 0;
  const max = group.maxSelections ?? 1;
  const rule =
    min === max
      ? `Exatamente ${max}`
      : max === 1
        ? "Selecionar 1"
        : `${min}–${max}`;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-card ${
        inactive ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          className="mt-0.5 rounded p-1 hover:bg-muted"
          onClick={onToggle}
          aria-label={isOpen ? "Recolher grupo" : "Expandir grupo"}
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{group.name}</span>
            {sizeGroup && (
              <Badge className="gap-1 text-[10px]" variant="outline">
                <Ruler className="h-3 w-3" /> Tamanhos
              </Badge>
            )}
            {group.required ? (
              <Badge variant="default" className="text-[10px]">
                Obrigatório
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">
                Opcional
              </Badge>
            )}
            {inactive && (
              <Badge variant="destructive" className="text-[10px]">
                Inativo
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-4">
            <span>
              <span className="text-muted-foreground/70">Tipo:</span>{" "}
              {max === 1 ? "Único" : "Múltiplo"}
            </span>
            <span>
              <span className="text-muted-foreground/70">Regra:</span> {rule}
            </span>
            <span>
              <span className="text-muted-foreground/70">Ordem:</span>{" "}
              {group.sortOrder ?? 0}
            </span>
            <span>
              <span className="text-muted-foreground/70">Opções:</span>{" "}
              {options.length}
            </span>
          </div>
          {group.description && (
            <p className="text-xs text-muted-foreground">{group.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconAction label="Adicionar opção" onClick={onAddOption}>
            <Plus className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction label="Editar grupo" onClick={onEditGroup}>
            <Pencil className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction
            label={inactive ? "Ativar grupo" : "Desativar grupo"}
            onClick={onToggleGroupStatus}
          >
            <Power className="h-3.5 w-3.5" />
          </IconAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                aria-label="Mais ações"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  toast.info("Duplicar grupo estará disponível em breve.")
                }
              >
                <Copy className="mr-2 h-3.5 w-3.5" /> Duplicar grupo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isOpen && (
        <div className="border-t bg-muted/20 p-3">
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Sem opções ainda. Use “+” acima para adicionar.
            </p>
          ) : sizeGroup ? (
            <div className="overflow-x-auto rounded border bg-background">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Tamanho</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Acréscimo
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      Preço final
                    </th>
                    <th className="px-3 py-2 text-right font-medium">Ordem</th>
                    <th className="px-3 py-2 text-center font-medium">
                      Status
                    </th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {options.map((o) => {
                    const oInactive = o.active === false;
                    const finalCents =
                      productPriceBaseInCents + (o.priceDeltaInCents ?? 0);
                    return (
                      <tr
                        key={o.id}
                        className={oInactive ? "opacity-60" : ""}
                      >
                        <td className="px-3 py-1.5 font-medium">{o.name}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {o.priceDeltaInCents > 0 ? "+ " : ""}
                          {formatCurrencyFromCents(o.priceDeltaInCents)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                          {formatCurrencyFromCents(finalCents)}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {o.sortOrder ?? 0}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {oInactive ? (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              Inativa
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">
                              Ativa
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <IconAction
                            label="Editar opção"
                            onClick={() => onEditOption(o)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction
                            label={oInactive ? "Ativar" : "Desativar"}
                            onClick={() => onToggleOptionStatus(o)}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </IconAction>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {options.map((o) => {
                const oInactive = o.active === false;
                const linked = catalogProducts.find(
                  (cp) => cp.id === o.linkedProductId,
                );
                return (
                  <li
                    key={o.id}
                    className={`flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-sm ${
                      oInactive ? "opacity-60" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{o.name}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {o.priceDeltaInCents > 0 ? "+ " : ""}
                          {formatCurrencyFromCents(o.priceDeltaInCents)}
                        </span>
                        {oInactive && (
                          <Badge
                            variant="destructive"
                            className="text-[10px]"
                          >
                            Inativa
                          </Badge>
                        )}
                        {linked && (
                          <Badge variant="outline" className="text-[10px]">
                            → {linked.name}
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          Ordem {o.sortOrder ?? 0}
                        </span>
                      </div>
                    </div>
                    <IconAction
                      label="Editar opção"
                      onClick={() => onEditOption(o)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </IconAction>
                    <IconAction
                      label={oInactive ? "Ativar" : "Desativar"}
                      onClick={() => onToggleOptionStatus(o)}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </IconAction>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
