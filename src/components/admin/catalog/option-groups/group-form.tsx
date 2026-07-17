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
import type { CatalogProductOptionGroup } from "@/lib/catalog-api";

import { slugify } from "./helpers";
import { Field } from "./ui";

export function GroupForm({
  title,
  token,
  initial,
  onCancel,
  onSubmit,
}: {
  title: string;
  token: string | null;
  initial: CatalogProductOptionGroup | null;
  onCancel: () => void;
  onSubmit: (values: {
    name: string;
    key: string;
    description?: string | null;
    required?: boolean;
    minSelections?: number;
    maxSelections?: number;
    sortOrder?: number;
    active?: boolean;
  }) => Promise<void>;
}) {
  const detectSize = (g: CatalogProductOptionGroup | null) =>
    !!g &&
    (/(tamanho|size)/i.test(g.name ?? "") ||
      /(tamanho|size)/i.test(g.key ?? ""));
  const [groupType, setGroupType] = useState<"COMMON" | "SIZE">(
    detectSize(initial) ? "SIZE" : "COMMON",
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [key, setKey] = useState(initial?.key ?? "");
  const [keyTouched, setKeyTouched] = useState(!!initial?.key);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [required, setRequired] = useState<boolean>(initial?.required ?? false);
  const [minSelections, setMinSelections] = useState(
    String(initial?.minSelections ?? 0),
  );
  const [maxSelections, setMaxSelections] = useState(
    String(initial?.maxSelections ?? 1),
  );
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [active, setActive] = useState<boolean>(initial?.active !== false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleType = (t: "COMMON" | "SIZE") => {
    setGroupType(t);
    if (t === "SIZE") {
      if (!name.trim()) {
        setName("Escolha o tamanho");
        if (!keyTouched) setKey("tamanho");
      } else if (!keyTouched) {
        setKey("tamanho");
      }
      setRequired(true);
      setMinSelections("1");
      setMaxSelections("1");
    }
  };

  const handleName = (v: string) => {
    setName(v);
    if (!keyTouched) setKey(slugify(v));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const trimmed = name.trim();
    const finalKey = key.trim() || slugify(trimmed);
    const min = Number(minSelections);
    const max = Number(maxSelections);
    if (!trimmed) return setErr("Nome é obrigatório.");
    if (!finalKey) return setErr("Key é obrigatória.");
    if (!Number.isFinite(min) || min < 0) return setErr("Mínimo inválido.");
    if (!Number.isFinite(max) || max < 1) return setErr("Máximo inválido.");
    if (max < min) return setErr("Máximo deve ser ≥ Mínimo.");
    if (required && min < 1)
      return setErr("Grupos obrigatórios exigem mínimo ≥ 1.");
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit({
        name: trimmed,
        key: finalKey,
        description: description.trim() || null,
        required,
        minSelections: min,
        maxSelections: max,
        sortOrder: Number(sortOrder) || 0,
        ...(initial ? {} : { active }),
      });
    } catch (e2) {
      setErr(
        handleApiError(e2, "Não foi possível salvar o grupo.", { silent: true }),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Configuração do grupo de opções.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Tipo do grupo">
          <Select
            value={groupType}
            onValueChange={(v) => handleType(v as "COMMON" | "SIZE")}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="COMMON">Comum</SelectItem>
              <SelectItem value="SIZE">Tamanhos</SelectItem>
            </SelectContent>
          </Select>
          {groupType === "SIZE" && (
            <p className="text-xs text-muted-foreground">
              Escolha única obrigatória. Ex.: Pequena, Média, Grande.
            </p>
          )}
        </Field>
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
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mínimo">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={minSelections}
              onChange={(e) => setMinSelections(e.target.value)}
              disabled={submitting || groupType === "SIZE"}
            />
          </Field>
          <Field label="Máximo">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={maxSelections}
              onChange={(e) => setMaxSelections(e.target.value)}
              disabled={submitting || groupType === "SIZE"}
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
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <p className="text-sm font-medium">Obrigatório</p>
            <p className="text-xs text-muted-foreground">
              Cliente precisa selecionar ao menos o mínimo.
            </p>
          </div>
          <Switch
            checked={required}
            onCheckedChange={setRequired}
            disabled={submitting || groupType === "SIZE"}
          />
        </div>

        {!initial && (
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Apenas grupos ativos aparecem em novos pedidos.
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
