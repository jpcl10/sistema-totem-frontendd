import { useEffect, useRef, useState, type FormEvent } from "react";
import { AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  createCatalogProduct,
  updateCatalogProduct,
  type CatalogCategory,
  type CatalogProduct,
} from "@/lib/catalog-api";
import { CatalogOptionGroupsManager } from "@/components/admin/catalog-option-groups";
import { parseCurrencyToCents } from "@/lib/utils";
import { describeError, slugify } from "@/lib/catalog-helpers";
import { ProductImageUploader } from "./product-image-uploader";

const showLegacyPricingRuleSelector = false;

export function NewProductDialog({
  token,
  organizationId,
  categories,
  onCreated,
}: {
  token: string | null;
  organizationId: string | null;
  categories: CatalogCategory[];
  onCreated: (p: CatalogProduct) => void;
}) {
  const openedOrganizationId = useRef(organizationId);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugDirty, setSlugDirty] = useState(false);
  const [catalogCategoryId, setCatalogCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [priceInput, setPriceInput] = useState("");
  const [supportsHalfAndHalf, setSupportsHalfAndHalf] = useState(false);
  const [canBeUsedAsFlavor, setCanBeUsedAsFlavor] = useState(true);
  const [halfAndHalfFlavorCategoryId, setHalfAndHalfFlavorCategoryId] = useState<string>(
    categories[0]?.id ?? "",
  );
  const [sortOrderInput, setSortOrderInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!catalogCategoryId && categories[0]) setCatalogCategoryId(categories[0].id);
  }, [categories, catalogCategoryId]);

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
    if (!trimmed || !catalogCategoryId || !finalSlug) {
      setErr("Preencha nome, slug e categoria.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const priceCents = priceInput.trim() ? parseCurrencyToCents(priceInput) : null;
      if (priceInput.trim() && priceCents == null) {
        setErr("Preço inválido.");
        setSubmitting(false);
        return;
      }
      const sortOrderNum = sortOrderInput.trim() ? Number(sortOrderInput) : null;
      const p = await createCatalogProduct(token, {
        name: trimmed,
        slug: finalSlug,
        catalogCategoryId,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        priceInCents: priceCents ?? undefined,
        supportsHalfAndHalf,
        canBeUsedAsFlavor,
        halfAndHalfFlavorCategoryId:
          supportsHalfAndHalf
            ? halfAndHalfFlavorCategoryId || catalogCategoryId
            : null,
        sortOrder:
          sortOrderNum != null && Number.isFinite(sortOrderNum) ? sortOrderNum : undefined,
      }, organizationId);
      toast.success("Produto criado no catálogo");
      onCreated(p);
      setName("");
      setSlug("");
      setSlugDirty(false);
      setDescription("");
      setImageUrl("");
      setPriceInput("");
      setSortOrderInput("");
    } catch (e2) {
      setErr(describeError(e2, "Não foi possível criar o produto."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Novo produto do catálogo</DialogTitle>
          <DialogDescription>
          Produto global da organização. O preço é definido por evento.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prod-name">Nome</Label>
            <Input
              id="prod-name"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Coca-Cola 350ml"
              disabled={submitting}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-slug">Slug</Label>
            <Input
              id="prod-slug"
              value={slug}
              onChange={(e) => {
                setSlugDirty(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="coca-cola-350ml"
              disabled={submitting}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Categoria do catálogo</Label>
          <Select
            value={catalogCategoryId}
            onValueChange={setCatalogCategoryId}
            disabled={submitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Regra de preço</Label>
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox
                checked={supportsHalfAndHalf}
                onCheckedChange={(checked) => setSupportsHalfAndHalf(checked === true)}
                disabled={submitting}
              />
              <span>Permitir pizza meio a meio</span>
            </label>
            {/* Legacy pricing-rule selector intentionally hidden. */}
            {showLegacyPricingRuleSelector && (
            <Select
              value="STANDARD"
              onValueChange={() => undefined}
              disabled
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STANDARD">Preço padrão</SelectItem>
                <SelectItem value="MAX_SELECTED_FLAVOR">Meio a meio</SelectItem>
              </SelectContent>
            </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-half-cat">Categoria de sabores</Label>
            <Select
              value={halfAndHalfFlavorCategoryId}
              onValueChange={setHalfAndHalfFlavorCategoryId}
              disabled={submitting || !supportsHalfAndHalf}
            >
              <SelectTrigger id="prod-half-cat">
                <SelectValue placeholder="Usar a categoria do produto" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <Checkbox
            checked={canBeUsedAsFlavor}
            onCheckedChange={(checked) => setCanBeUsedAsFlavor(checked === true)}
            disabled={submitting}
          />
          <span>Permitir usar este produto como sabor</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="prod-price">Preço-base (R$)</Label>
            <Input
              id="prod-price"
              inputMode="decimal"
              value={priceInput}
              onChange={(e) => setPriceInput(e.target.value)}
              placeholder="60,00"
              disabled={submitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Preço-base do catálogo. Pode ser sobrescrito por evento.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-sort">Ordem</Label>
            <Input
              id="prod-sort"
              type="number"
              inputMode="numeric"
              value={sortOrderInput}
              onChange={(e) => setSortOrderInput(e.target.value)}
              placeholder="0"
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prod-desc">Descrição (opcional)</Label>
          <Textarea
            id="prod-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prod-img">Imagem do produto (opcional)</Label>
          <ProductImageUploader
            token={token}
            value={imageUrl}
            onChange={setImageUrl}
            disabled={submitting}
          />
          <Input
            id="prod-img"
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://... (ou envie um arquivo acima)"
            disabled={submitting}
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
              "Criar produto"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

export function EditProductDialog({
  token,
  organizationId,
  categories,
  product,
  products,
  onSaved,
}: {
  token: string | null;
  organizationId: string | null;
  categories: CatalogCategory[];
  product: CatalogProduct;
  products: CatalogProduct[];
  onSaved: (p: CatalogProduct) => void;
}) {
  const openedOrganizationId = useRef(organizationId);
  const initialCat =
    product.catalogCategoryId ?? product.categoryId ?? product.category?.id ?? categories[0]?.id ?? "";
  const [name, setName] = useState(product.name);
  const [slug, setSlug] = useState(product.slug ?? "");
  const [categoryId, setCategoryId] = useState<string>(initialCat);
  const [description, setDescription] = useState(product.description ?? "");
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const legacyHalfAndHalf = product.pricingRule === "MAX_SELECTED_FLAVOR";
  const [supportsHalfAndHalf, setSupportsHalfAndHalf] = useState<boolean>(
    product.supportsHalfAndHalf === true || legacyHalfAndHalf,
  );
  const [canBeUsedAsFlavor, setCanBeUsedAsFlavor] = useState<boolean>(
    product.canBeUsedAsFlavor !== false,
  );
  const [halfAndHalfFlavorCategoryId, setHalfAndHalfFlavorCategoryId] = useState<string>(
    product.halfAndHalfFlavorCategoryId ?? product.catalogCategoryId ?? initialCat,
  );
  const [priceInput, setPriceInput] = useState(
    typeof product.priceInCents === "number"
      ? (product.priceInCents / 100).toFixed(2).replace(".", ",")
      : "",
  );
  const [sortOrderInput, setSortOrderInput] = useState(
    typeof product.sortOrder === "number" ? String(product.sortOrder) : "",
  );
  const [active, setActive] = useState<boolean>(product.active !== false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const initialSnapshot = useRef({
    name: product.name,
    slug: product.slug ?? "",
    categoryId: initialCat,
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    supportsHalfAndHalf: product.supportsHalfAndHalf === true || legacyHalfAndHalf,
    canBeUsedAsFlavor: product.canBeUsedAsFlavor !== false,
    halfAndHalfFlavorCategoryId:
      product.halfAndHalfFlavorCategoryId ?? product.catalogCategoryId ?? initialCat,
    priceInput:
      typeof product.priceInCents === "number"
        ? (product.priceInCents / 100).toFixed(2).replace(".", ",")
        : "",
    sortOrderInput:
      typeof product.sortOrder === "number" ? String(product.sortOrder) : "",
    active: product.active !== false,
  });
  const dirty =
    name !== initialSnapshot.current.name ||
    slug !== initialSnapshot.current.slug ||
    categoryId !== initialSnapshot.current.categoryId ||
    description !== initialSnapshot.current.description ||
    imageUrl !== initialSnapshot.current.imageUrl ||
    supportsHalfAndHalf !== initialSnapshot.current.supportsHalfAndHalf ||
    canBeUsedAsFlavor !== initialSnapshot.current.canBeUsedAsFlavor ||
    halfAndHalfFlavorCategoryId !== initialSnapshot.current.halfAndHalfFlavorCategoryId ||
    priceInput !== initialSnapshot.current.priceInput ||
    sortOrderInput !== initialSnapshot.current.sortOrderInput ||
    active !== initialSnapshot.current.active;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!organizationId || openedOrganizationId.current !== organizationId) {
      setErr("A organização mudou. Feche e abra o formulário novamente.");
      return;
    }
    const trimmed = name.trim();
    const finalSlug = slug.trim() || slugify(trimmed);
    if (!trimmed || !categoryId || !finalSlug) {
      setErr("Preencha nome, slug e categoria.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const priceCents = priceInput.trim() ? parseCurrencyToCents(priceInput) : null;
      if (priceInput.trim() && priceCents == null) {
        setErr("Preço inválido.");
        setSubmitting(false);
        return;
      }
      const sortOrderNum = sortOrderInput.trim() ? Number(sortOrderInput) : null;
      const updated = await updateCatalogProduct(token, product.id, {
        name: trimmed,
        slug: finalSlug,
        categoryId,
        description: description.trim(),
        imageUrl: imageUrl.trim(),
        active,
        supportsHalfAndHalf,
        canBeUsedAsFlavor,
        halfAndHalfFlavorCategoryId:
          supportsHalfAndHalf
            ? halfAndHalfFlavorCategoryId || categoryId
            : null,
        ...(priceCents != null ? { priceInCents: priceCents } : {}),
        ...(sortOrderNum != null && Number.isFinite(sortOrderNum)
          ? { sortOrder: sortOrderNum }
          : {}),
      }, organizationId);
      toast.success("Produto atualizado");
      onSaved({ ...product, ...updated });
    } catch (e2) {
      setErr(describeError(e2, "Não foi possível atualizar o produto."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="flex h-dvh max-h-none w-full max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-lg">
      <DialogHeader className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="truncate">Editar produto do catálogo</DialogTitle>
            <DialogDescription>
              Atualize os dados do produto e gerencie seus grupos de opções.
            </DialogDescription>
          </div>
          {dirty && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
              aria-live="polite"
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              Alterações não salvas
            </span>
          )}
        </div>
      </DialogHeader>
      <Tabs defaultValue="data" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-4 grid grid-cols-2 sm:mx-6">
          <TabsTrigger value="data">Dados do produto</TabsTrigger>
          <TabsTrigger value="options">Grupos de opções</TabsTrigger>
        </TabsList>
        <TabsContent value="data" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <form id="edit-product-form" onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eprod-name">Nome</Label>
                <Input
                  id="eprod-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eprod-slug">Slug</Label>
                <Input
                  id="eprod-slug"
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Regra de preo</Label>
                <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <Checkbox
                    checked={supportsHalfAndHalf}
                    onCheckedChange={(checked) => setSupportsHalfAndHalf(checked === true)}
                    disabled={submitting}
                  />
                  <span>Permitir pizza meio a meio</span>
                </label>
                {/* Legacy pricing-rule selector intentionally hidden. */}
                {showLegacyPricingRuleSelector && (
                <Select
                  value="STANDARD"
                  onValueChange={() => undefined}
                  disabled
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                <SelectItem value="STANDARD">Preço padrão</SelectItem>
                    <SelectItem value="MAX_SELECTED_FLAVOR">Meio a meio</SelectItem>
                  </SelectContent>
                </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="eprod-half-cat">Categoria de sabores</Label>
                <Select
                  value={halfAndHalfFlavorCategoryId}
                  onValueChange={setHalfAndHalfFlavorCategoryId}
                  disabled={submitting || !supportsHalfAndHalf}
                >
                  <SelectTrigger id="eprod-half-cat">
                    <SelectValue placeholder="Usar categoria do produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <label className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <Checkbox
                checked={canBeUsedAsFlavor}
                onCheckedChange={(checked) => setCanBeUsedAsFlavor(checked === true)}
                disabled={submitting}
              />
              <span>Permitir usar este produto como sabor</span>
            </label>
            <div className="space-y-2">
              <Label>Categoria do catálogo</Label>
              <Select value={categoryId} onValueChange={setCategoryId} disabled={submitting}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="eprod-desc">Descrição (opcional)</Label>
              <Textarea
                id="eprod-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="eprod-img">Imagem do produto (opcional)</Label>
              <ProductImageUploader
                token={token}
                value={imageUrl}
                onChange={setImageUrl}
                disabled={submitting}
              />
              <Input
                id="eprod-img"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... (ou envie um arquivo acima)"
                disabled={submitting}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="eprod-price">Preço-base (R$)</Label>
                <Input
                  id="eprod-price"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="60,00"
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eprod-sort">Ordem</Label>
                <Input
                  id="eprod-sort"
                  type="number"
                  inputMode="numeric"
                  value={sortOrderInput}
                  onChange={(e) => setSortOrderInput(e.target.value)}
                  placeholder="0"
                  disabled={submitting}
                />
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
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {err && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{err}</span>
              </div>
            )}
          </form>
        </TabsContent>
        <TabsContent value="options" className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <CatalogOptionGroupsManager
            token={token}
            organizationId={organizationId}
            productId={product.id}
            catalogProducts={products}
            productPriceBaseInCents={product.priceInCents ?? 0}
          />
        </TabsContent>
      </Tabs>
      <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <Button
          type="submit"
          form="edit-product-form"
          disabled={submitting || !dirty}
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
      </div>
    </DialogContent>
  );
}
