import { useEffect, useMemo, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/** Option shape — compatible with catalog-api CatalogProductOption. */
export interface CustomizeOption {
  id: string;
  name: string;
  /** Preferred field from catalog. */
  priceDeltaInCents?: number;
  /** Fallback for legacy shapes. */
  priceInCents?: number;
  active?: boolean;
  sortOrder?: number;
}

/** Option group — compatible with catalog-api CatalogProductOptionGroup. */
export interface CustomizeOptionGroup {
  id: string;
  name: string;
  key?: string;
  required?: boolean;
  minSelections?: number;
  maxSelections?: number;
  sortOrder?: number;
  options?: CustomizeOption[];
}

export interface CustomizeProduct {
  id: string;
  name: string;
  imageUrl?: string;
  priceInCents: number;
  optionGroups?: CustomizeOptionGroup[];
}

export type SelectedOptionMap = Record<string, string[]>; // groupId -> optionIds

/** Addon delta for a single option, tolerant to both field names. */
export function optionDeltaCents(o: CustomizeOption): number {
  return o.priceDeltaInCents ?? o.priceInCents ?? 0;
}

/** True when a group represents pizza sizes (shows final price, not delta). */
function isSizeGroup(g: { name?: string; key?: string }): boolean {
  return (
    /(tamanho|size|pizza-size)/i.test(g.key ?? "") ||
    /(tamanho|size)/i.test(g.name ?? "")
  );
}

/**
 * Single source of truth for the visual estimate. Backend stays the
 * authority — this never leaves the UI.
 *   base + Σ selectedOption.priceDeltaInCents, then × quantity.
 */
export function calculateConfiguredItemTotal(
  product: { priceInCents: number; optionGroups?: CustomizeOptionGroup[] },
  selected: SelectedOptionMap,
  quantity: number,
): { unitCents: number; addonsCents: number; totalCents: number } {
  let addonsCents = 0;
  for (const g of product.optionGroups ?? []) {
    const sel = selected[g.id] ?? [];
    for (const opt of g.options ?? []) {
      if (sel.includes(opt.id)) addonsCents += optionDeltaCents(opt);
    }
  }
  const unitCents = (product.priceInCents ?? 0) + addonsCents;
  return {
    unitCents,
    addonsCents,
    totalCents: unitCents * Math.max(1, quantity),
  };
}

export interface CustomizeResult {
  quantity: number;
  selectedOptions: Array<{ optionGroupId: string; optionIds: string[] }>;
  notes: string;
  addonsCents: number; // estimate only, backend is source of truth
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: CustomizeProduct | null;
  loading?: boolean;
  initial?: {
    quantity?: number;
    selected?: SelectedOptionMap;
    notes?: string;
  };
  onConfirm: (result: CustomizeResult) => void;
};

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** Returns true when a product NEEDS customization before entering cart. */
export function productNeedsCustomization(p: {
  optionGroups?: CustomizeOptionGroup[];
}): boolean {
  const groups = p.optionGroups ?? [];
  return groups.some(
    (g) => g.required === true || (g.minSelections ?? 0) > 0,
  );
}

/**
 * Handles required/optional option groups. Renders in sortOrder,
 * respects required / minSelections / maxSelections, shows per-option
 * addons and a live estimated total. Emits selectedOptions in the
 * exact shape the backend expects — never sends price.
 */
export function ProductCustomizeDialog({
  open,
  onOpenChange,
  product,
  loading,
  initial,
  onConfirm,
}: Props) {
  const [selected, setSelected] = useState<SelectedOptionMap>({});
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    setSelected(initial?.selected ?? {});
    setQuantity(initial?.quantity ?? 1);
    setNotes(initial?.notes ?? "");
  }, [open, product, initial]);

  const groups = useMemo(() => {
    const list = (product?.optionGroups ?? []).slice();
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return list;
  }, [product]);

  const toggleOption = (group: CustomizeOptionGroup, optionId: string) => {
    setSelected((prev) => {
      const current = prev[group.id] ?? [];
      const max = group.maxSelections ?? (group.required ? 1 : Infinity);
      const isSingle = max === 1;
      if (current.includes(optionId)) {
        // Required single-select never fully clears
        if (isSingle && group.required) return prev;
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (isSingle) return { ...prev, [group.id]: [optionId] };
      if (current.length >= max) return prev;
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const { addonsCents, totalCents: estimateTotal } = useMemo(
    () =>
      calculateConfiguredItemTotal(
        { priceInCents: product?.priceInCents ?? 0, optionGroups: groups },
        selected,
        quantity,
      ),
    [product, groups, selected, quantity],
  );

  const missingRequired = useMemo(() => {
    return groups.some((g) => {
      const sel = selected[g.id] ?? [];
      const min = g.required ? Math.max(1, g.minSelections ?? 1) : g.minSelections ?? 0;
      return sel.length < min;
    });
  }, [groups, selected]);

  const handleConfirm = () => {
    if (!product) return;
    const payload = groups
      .map((g) => ({
        optionGroupId: g.id,
        optionIds: selected[g.id] ?? [],
      }))
      .filter((g) => g.optionIds.length > 0);
    onConfirm({
      quantity,
      selectedOptions: payload,
      notes: notes.trim(),
      addonsCents,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[min(96vw,560px)] flex-col gap-0 p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border px-5 py-3">
          <DialogTitle className="text-base">
            {product?.name ?? "Personalizar"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Escolha as opções deste produto. Preços finais confirmados pelo servidor.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-5">
            {loading && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando opções…
              </div>
            )}

            {!loading && groups.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Este produto não possui opções.
              </div>
            )}

            {!loading &&
              groups.map((g) => {
                const sel = selected[g.id] ?? [];
                const max = g.maxSelections ?? (g.required ? 1 : Infinity);
                const min = g.required ? Math.max(1, g.minSelections ?? 1) : g.minSelections ?? 0;
                const isMulti = max !== 1;
                const sizeGroup = isSizeGroup(g);
                const basePrice = product?.priceInCents ?? 0;
                const opts = (g.options ?? [])
                  .filter((o) => o.active !== false)
                  .slice()
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

                return (
                  <div key={g.id} className="rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{g.name}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {g.required ? "Obrigatório" : "Opcional"}
                          {" · "}
                          {isMulti
                            ? `Escolha ${min > 0 ? `mín ${min}` : "até"} ${
                                Number.isFinite(max) ? `máx ${max}` : ""
                              }`.trim()
                            : "Escolha 1"}
                        </div>
                      </div>
                      {g.required && sel.length < min && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                          Selecionar
                        </span>
                      )}
                    </div>
                    <div className="divide-y divide-border">
                      {opts.map((o) => {
                        const active = sel.includes(o.id);
                        const disabled =
                          !active && !isMulti ? false : !active && sel.length >= max;
                        const delta = optionDeltaCents(o);
                        return (
                          <button
                            key={o.id}
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleOption(g, o.id)}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition",
                              active && "bg-primary/5",
                              disabled && "opacity-40",
                            )}
                          >
                            <span
                              className={cn(
                                "grid h-5 w-5 shrink-0 place-items-center border",
                                isMulti ? "rounded" : "rounded-full",
                                active
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border bg-background",
                              )}
                            >
                              {active && (
                                <svg viewBox="0 0 20 20" className="h-3 w-3" fill="currentColor">
                                  <path d="M7.629 13.233 4.4 10.004l-1.4 1.4 4.629 4.63 9.4-9.4-1.4-1.4z" />
                                </svg>
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{o.name}</span>
                            {sizeGroup ? (
                              <span className="flex flex-col items-end leading-tight">
                                {delta > 0 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{brl(delta)}
                                  </span>
                                )}
                                <span className="text-xs font-semibold tabular-nums">
                                  {brl(basePrice + delta)}
                                </span>
                              </span>
                            ) : (
                              delta > 0 && (
                                <span className="text-xs font-medium text-muted-foreground">
                                  +{brl(delta)}
                                </span>
                              )
                            )}
                          </button>
                        );
                      })}
                      {opts.length === 0 && (
                        <div className="px-3 py-3 text-xs text-muted-foreground">
                          Sem opções ativas.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

            <div>
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Observações
              </div>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: sem cebola, ponto da carne…"
                rows={2}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center gap-2 border-t border-border bg-background p-3 sm:justify-between">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <span className="w-8 text-center text-sm font-semibold tabular-nums">
              {quantity}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9"
              onClick={() => setQuantity((q) => q + 1)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            className="h-11 flex-1 sm:flex-none sm:min-w-[220px] text-sm font-bold"
            disabled={missingRequired}
            onClick={handleConfirm}
          >
            {missingRequired ? (
              "Selecione as opções obrigatórias"
            ) : (
              <>Adicionar · {brl(estimateTotal)}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
