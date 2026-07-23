import { useRef, useState, type FormEvent } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createCatalogCategory,
  updateCatalogCategory,
  type CatalogCategory,
  type CategorySector,
} from "@/lib/catalog-api";
import { describeError, slugify } from "@/lib/catalog-helpers";

export function NewCategoryDialog({
  token,
  organizationId,
  onCreated,
}: {
  token: string | null;
  organizationId: string | null;
  onCreated: (c: CatalogCategory) => void;
}) {
  const openedOrganizationId = useRef(organizationId);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState<CategorySector>("BAR");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onNameChange = (v: string) => {
    setName(v);
    if (!slugDirty) setSlug(slugify(v));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!organizationId || openedOrganizationId.current !== organizationId) {
      setErr("A organização mudou. Feche e abra o formulário novamente.");
      return;
    }
    const trimmed = name.trim();
    const finalSlug = slug.trim() || slugify(trimmed);
    if (!trimmed || !finalSlug) {
      setErr("Informe nome e slug válidos.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const c = await createCatalogCategory(token, {
        name: trimmed,
        slug: finalSlug,
        sector,
        description: description.trim() || undefined,
      }, organizationId);
      toast.success("Categoria criada com sucesso");
      onCreated(c);
      setName("");
      setSlug("");
      setSlugDirty(false);
      setDescription("");
      setSector("BAR");
    } catch (e2) {
      setErr(describeError(e2, "Não foi possível criar a categoria."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nova categoria do catálogo</DialogTitle>
        <DialogDescription>Categoria global da organização.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cat-name">Nome</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Bebidas"
            disabled={submitting}
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-slug">Slug</Label>
          <Input
            id="cat-slug"
            value={slug}
            onChange={(e) => {
              setSlugDirty(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="bebidas"
            disabled={submitting}
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Setor operacional</Label>
          <Select value={sector} onValueChange={(v) => setSector(v as CategorySector)} disabled={submitting}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BAR">Bar</SelectItem>
              <SelectItem value="KITCHEN">Cozinha</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Define para qual painel operacional os pedidos serão direcionados.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cat-desc">Descrição (opcional)</Label>
          <Textarea
            id="cat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
            rows={3}
            maxLength={300}
          />
        </div>
        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <DialogFooter>
          <Button
            type="submit"
            disabled={submitting}
            className="text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Criando...
              </>
            ) : (
              "Criar categoria"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function EditCategoryDialog({
  token,
  organizationId,
  category,
  onSaved,
}: {
  token: string | null;
  organizationId: string | null;
  category: CatalogCategory;
  onSaved: (c: CatalogCategory) => void;
}) {
  const openedOrganizationId = useRef(organizationId);
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug ?? "");
  const [description, setDescription] = useState(category.description ?? "");
  const [sector, setSector] = useState<CategorySector>((category.sector as CategorySector) ?? "BAR");
  const [active, setActive] = useState<boolean>(category.active !== false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!organizationId || openedOrganizationId.current !== organizationId) {
      setErr("A organização mudou. Feche e abra o formulário novamente.");
      return;
    }
    const trimmed = name.trim();
    const finalSlug = slug.trim() || slugify(trimmed);
    if (!trimmed || !finalSlug) {
      setErr("Informe nome e slug válidos.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const updated = await updateCatalogCategory(token, category.id, {
        name: trimmed,
        slug: finalSlug,
        sector,
        active,
        description: description.trim() || undefined,
      }, organizationId);
      toast.success("Categoria atualizada");
      onSaved({ ...category, ...updated });
    } catch (e2) {
      setErr(describeError(e2, "Não foi possível atualizar a categoria."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Editar categoria</DialogTitle>
        <DialogDescription>Atualize os dados da categoria global.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ecat-name">Nome</Label>
          <Input
            id="ecat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            maxLength={80}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ecat-slug">Slug</Label>
          <Input
            id="ecat-slug"
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            disabled={submitting}
            maxLength={80}
            required
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Setor</Label>
            <Select value={sector} onValueChange={(v) => setSector(v as CategorySector)} disabled={submitting}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BAR">Bar</SelectItem>
                <SelectItem value="KITCHEN">Cozinha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={active ? "active" : "inactive"}
              onValueChange={(v) => setActive(v === "active")}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativa</SelectItem>
                <SelectItem value="inactive">Inativa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ecat-desc">Descrição (opcional)</Label>
          <Textarea
            id="ecat-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={submitting}
            maxLength={300}
          />
        </div>
        {err && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{err}</span>
          </div>
        )}
        <DialogFooter>
          <Button
            type="submit"
            disabled={submitting}
            className="text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
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
