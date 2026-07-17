import { useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleApiError } from "@/lib/api-error";
import { parseCurrencyToCents } from "@/lib/utils";
import type {
  CatalogProduct,
  CatalogProductOption,
} from "@/lib/catalog-api";

import { slugify } from "./helpers";
import { Field } from "./ui";

export function OptionForm({
  title,
  token,
  initial,
  catalogProducts,
  onCancel,
  onSubmit,
}: {
  title: string;
  token: string | null;
  initial: CatalogProductOption | null;
  catalogProducts: CatalogProduct[];
  onCancel: () => void;
  onSubmit: (values: {
    name: string;
    key: string;
    description?: string | null;
    priceDeltaInCents: number;
    linkedProductId?: string | null;
    sortOrder?: number;
    active?: boolean;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(!!initial?.key);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceInput, setPriceInput] = useState(
    typeof initial?.priceDeltaInCents === "number"
      ? (initial.priceDeltaInCents / 100).toFixed(2).replace(".", ",")
      : "0,00",
  );
  const [linkedProductId, setLinkedProductId] = useState<string>(
    initial?.linkedProductId ?? "",
  );
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState<boolean>(initial?.active !== false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleName = (v: string) => {
    setName(v);
    if (!keyTouched) setKey(slugify(v));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const trimmed = name.trim();
    const finalKey = key.trim() || slugify(trimmed);
    if (!trimmed) return setErr("Nome é obrigatório.");
    if (!finalKey) return setErr("Key é obrigatória.");
    const cents = parseCurrencyToCents(priceInput);
    if (cents == null || cents < 0) return setErr("Acréscimo inválido.");
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        name: trimmed,
        key: finalKey,
        description: description.trim() || null,
        priceDeltaInCents: cents,
        linkedProductId: linkedProductId || null,
        sortOrder: Number(sortOrder) || 0,
        ...(initial ? {} : { active }),
      });
    } catch (e2) {
      setErr(
        handleApiError(e2, "Não foi possível salvar a opção.", {
          silent: true,
        }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Configuração da opção.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              value={name}
              onChange={(e) => handleName(e.target.value)}
              disabled={submitting}
              required
              maxLength={80}
            />
          </Field>
          <Field label="Key">
            <Input
              value={key}
              onChange={(e) => {
                setKey(slugify(e.target.value));
                setKeyTouched(true);
              }}
              disabled={submitting}
              required
              maxLength={80}
            />
          </Field>
        </div>
        <Field label="Descrição (opcional)">
          <Textarea
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            disabled={submitting}
            maxLength={200}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Acréscimo (R$)">
            <Input
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="0,00"
              disabled={submitting}
            />
          </Field>
          <Field label="Ordem">
            <Input
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              disabled={submitting}
            />
          </Field>
        </div>
        <Field label="Produto vinculado (opcional)">
          <Select
            value={linkedProductId || "__none"}
            onValueChange={(v) =>
              setLinkedProductId(v === "__none" ? "" : v)
            }
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem vínculo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sem vínculo</SelectItem>
              {catalogProducts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {!initial && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Ativa</p>
              <p className="text-xs text-muted-foreground">
                Apenas opções ativas aparecem em novos pedidos.
              </p>
            </div>
            <Switch
              checked={active}
              onCheckedChange={setActive}
              disabled={submitting}
            />
          </div>
        )}

        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
