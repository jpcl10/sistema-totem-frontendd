import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DeliveryFeeRule,
  DeliveryFeeRuleType,
} from "@/lib/settings-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: DeliveryFeeRule | null;
  onSubmit?: (values: DeliveryRuleFormValues) => void | Promise<void>;
  submitting?: boolean;
}

/**
 * Values captured by the form. Maps 1:1 to CreateDeliveryFeeRuleBody
 * / UpdateDeliveryFeeRuleBody in settings-api.ts.
 */
export interface DeliveryRuleFormValues {
  name: string;
  type: DeliveryFeeRuleType;
  neighborhood: string | null;
  feeInCents: number;
  estimatedMinutes: number | null;
  minimumOrderInCents: number | null;
  freeDeliveryAboveInCents: number | null;
  active: boolean;
  sortOrder: number;
}

const EMPTY: DeliveryRuleFormValues = {
  name: "",
  type: "NEIGHBORHOOD",
  neighborhood: "",
  feeInCents: 0,
  estimatedMinutes: null,
  minimumOrderInCents: null,
  freeDeliveryAboveInCents: null,
  active: true,
  sortOrder: 0,
};

export function DeliveryRuleDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  submitting,
}: Props) {
  const [values, setValues] = useState<DeliveryRuleFormValues>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setValues(
      initial
        ? {
            name: initial.name,
            type: initial.type,
            neighborhood: initial.neighborhood ?? "",
            feeInCents: initial.feeInCents,
            estimatedMinutes: initial.estimatedMinutes,
            minimumOrderInCents: initial.minimumOrderInCents,
            freeDeliveryAboveInCents: initial.freeDeliveryAboveInCents,
            active: initial.active,
            sortOrder: initial.sortOrder,
          }
        : EMPTY,
    );
  }, [open, initial]);

  const isEdit = !!initial;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar regra" : "Nova regra de taxa"}</DialogTitle>
          <DialogDescription>
            Regras fixas se aplicam a qualquer entrega. Regras por bairro têm precedência.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              placeholder="Ex.: Centro, Bairro Alto…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Tipo</Label>
              <Select
                value={values.type}
                onValueChange={(v: DeliveryFeeRuleType) =>
                  setValues({ ...values, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEIGHBORHOOD">Bairro</SelectItem>
                  <SelectItem value="FLAT">Fixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input
                id="neighborhood"
                value={values.neighborhood ?? ""}
                disabled={values.type === "FLAT"}
                onChange={(e) =>
                  setValues({ ...values, neighborhood: e.target.value })
                }
                placeholder="Ex.: Centro"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="fee">Taxa (R$)</Label>
              <Input
                id="fee"
                type="number"
                min={0}
                step="0.01"
                value={(values.feeInCents / 100).toString()}
                onChange={(e) =>
                  setValues({
                    ...values,
                    feeInCents: Math.round(Number(e.target.value || 0) * 100),
                  })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="min">Estimativa (min)</Label>
              <Input
                id="min"
                type="number"
                min={0}
                value={values.estimatedMinutes ?? ""}
                onChange={(e) =>
                  setValues({
                    ...values,
                    estimatedMinutes: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="minorder">Pedido mínimo (R$)</Label>
              <Input
                id="minorder"
                type="number"
                min={0}
                step="0.01"
                value={
                  values.minimumOrderInCents != null
                    ? (values.minimumOrderInCents / 100).toString()
                    : ""
                }
                onChange={(e) =>
                  setValues({
                    ...values,
                    minimumOrderInCents: e.target.value
                      ? Math.round(Number(e.target.value) * 100)
                      : null,
                  })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="free">Frete grátis acima de (R$)</Label>
              <Input
                id="free"
                type="number"
                min={0}
                step="0.01"
                value={
                  values.freeDeliveryAboveInCents != null
                    ? (values.freeDeliveryAboveInCents / 100).toString()
                    : ""
                }
                onChange={(e) =>
                  setValues({
                    ...values,
                    freeDeliveryAboveInCents: e.target.value
                      ? Math.round(Number(e.target.value) * 100)
                      : null,
                  })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
            <div>
              <Label htmlFor="active" className="text-sm">Ativa</Label>
              <p className="text-xs text-muted-foreground">
                Regras inativas não aparecem no checkout.
              </p>
            </div>
            <Switch
              id="active"
              checked={values.active}
              onCheckedChange={(v) => setValues({ ...values, active: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSubmit?.({
                ...values,
                neighborhood:
                  values.type === "FLAT"
                    ? null
                    : (values.neighborhood ?? "").trim() || null,
              })
            }
            disabled={submitting || !values.name.trim()}
          >
            {submitting ? "Salvando…" : isEdit ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
