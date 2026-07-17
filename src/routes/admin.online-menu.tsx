import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Plus, Pencil, Trash2, ExternalLink, Store as StoreIcon, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { EmptyState } from "@/components/admin/empty-state";
import { PageLoading } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { handleApiError } from "@/lib/api-error";
import {
  listOnlineStores,
  getOnlineStoreDetail,
  createOnlineCategory,
  updateOnlineCategory,
  deleteOnlineCategory,
  createOnlineProduct,
  updateOnlineProduct,
  deleteOnlineProduct,
  type OnlineCategory,
  type OnlineProduct,
} from "@/lib/online-store-api";
import { resolveAssetUrl } from "@/lib/auth";
import { useRequireModule } from "@/lib/require-module";
import { qk } from "@/lib/query-keys";

export const Route = createFileRoute("/admin/online-menu")({
  component: OnlineMenuPage,
});

function brl(cents?: number) {
  return ((cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function OnlineMenuPage() {
  useRequireModule(["ONLINE_ORDERS"]);
  const { token } = useAuth();
  const { organizationId } = useOrganization();
  const qc = useQueryClient();
  const [storeId, setStoreId] = useState<string | null>(null);

  const storesQ = useQuery({
    queryKey: qk.onlineOrders.stores(organizationId),
    enabled: Boolean(token && organizationId),
    queryFn: () => listOnlineStores(token!),
  });

  const stores = storesQ.data ?? [];
  const currentStoreId = storeId ?? stores[0]?.id ?? null;

  const detailQ = useQuery({
    queryKey: qk.onlineOrders.store(organizationId, currentStoreId ?? ""),
    enabled: Boolean(token && organizationId && currentStoreId),
    queryFn: () => getOnlineStoreDetail(token!, currentStoreId!),
  });

  const detail = detailQ.data;


  const invalidate = () =>
    qc.invalidateQueries({ queryKey: qk.onlineOrders.store(organizationId, currentStoreId ?? "") });


  return (
    <AdminLayout title="Cardápio Online" subtitle="Gerencie sua loja, categorias e produtos online.">
      {storesQ.isLoading ? (
        <PageLoading />

      ) : stores.length === 0 ? (
        <EmptyState
          icon={StoreIcon}
          title="Nenhuma loja online configurada"
          description="Configure uma loja online para começar a receber pedidos."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
            <StoreIcon className="h-5 w-5 text-primary" />
            {stores.length > 1 ? (
              <Select value={currentStoreId ?? undefined} onValueChange={setStoreId}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione a loja" />
                </SelectTrigger>
                <SelectContent>
                  {stores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="font-medium">{detail?.store?.name ?? stores[0]?.name}</div>
            )}
            {detail?.store?.slug && (
              <>
                <Badge variant="secondary">/{detail.store.slug}</Badge>
                <a
                  href={`/p/${detail.store.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Ver cardápio público <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </>
            )}
            {detail?.store && (
              <Badge variant={detail.store.active === false ? "destructive" : "default"} className="ml-auto">
                {detail.store.active === false ? "Inativa" : "Ativa"}
              </Badge>
            )}
          </div>

          {detailQ.isLoading ? (
            <PageLoading />

          ) : detailQ.error ? (
            <EmptyState
              icon={Package}
              title="Não foi possível carregar a loja"
              description={(detailQ.error as Error).message}
            />
          ) : (
            <Tabs defaultValue="products" className="mt-2">
              <TabsList>
                <TabsTrigger value="products">Produtos ({detail?.products.length ?? 0})</TabsTrigger>
                <TabsTrigger value="categories">
                  Categorias ({detail?.categories.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="products" className="mt-4">
                <ProductsTab
                  storeId={currentStoreId!}
                  categories={detail?.categories ?? []}
                  products={detail?.products ?? []}
                  onChange={invalidate}
                />
              </TabsContent>

              <TabsContent value="categories" className="mt-4">
                <CategoriesTab
                  storeId={currentStoreId!}
                  categories={detail?.categories ?? []}
                  onChange={invalidate}
                />
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </AdminLayout>
  );
}

/* -------- Products -------- */

function ProductsTab({
  storeId,
  categories,
  products,
  onChange,
}: {
  storeId: string;
  categories: OnlineCategory[];
  products: OnlineProduct[];
  onChange: () => void;
}) {
  const { token } = useAuth();
  const [editing, setEditing] = useState<OnlineProduct | null>(null);
  const [creating, setCreating] = useState(false);

  const toggle = useMutation({
    mutationFn: (p: OnlineProduct) =>
      updateOnlineProduct(token!, storeId, p.id, { active: !(p.active !== false) }),
    onSuccess: () => {
      onChange();
    },
    onError: (e) => handleApiError(e),
  });

  const del = useMutation({
    mutationFn: (p: OnlineProduct) => deleteOnlineProduct(token!, storeId, p.id),
    onSuccess: () => {
      toast.success("Produto excluído.");
      onChange();
    },
    onError: (e) => handleApiError(e),
  });

  const catName = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} disabled={categories.length === 0}>
          <Plus className="mr-1 h-4 w-4" /> Novo produto
        </Button>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto cadastrado"
          description={
            categories.length === 0
              ? "Crie primeiro uma categoria para cadastrar produtos."
              : "Cadastre seu primeiro produto para aparecer no cardápio online."
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-soft)]"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                {p.imageUrl ? (
                  <img
                    src={resolveAssetUrl(p.imageUrl)}
                    alt={p.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Package className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {catName.get(p.categoryId ?? "") ?? "Sem categoria"}
                    </div>
                  </div>
                  <Switch
                    checked={p.active !== false}
                    onCheckedChange={() => toggle.mutate(p)}
                  />
                </div>
                <div className="mt-1 text-sm font-semibold text-primary">
                  {brl(p.priceInCents)}
                </div>
                {p.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                )}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(p)}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`Excluir "${p.name}"?`)) del.mutate(p);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ProductDialog
          storeId={storeId}
          categories={categories}
          product={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            onChange();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProductDialog({
  storeId,
  categories,
  product,
  onClose,
  onSaved,
}: {
  storeId: string;
  categories: OnlineCategory[];
  product: OnlineProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const isEdit = !!product;
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [price, setPrice] = useState(
    product ? ((product.priceInCents ?? 0) / 100).toFixed(2) : "",
  );
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [active, setActive] = useState(product?.active !== false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !categoryId) {
      toast.error("Preencha nome e categoria.");
      return;
    }
    const priceCents = Math.round(parseFloat(price.replace(",", ".") || "0") * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      toast.error("Preço inválido.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateOnlineProduct(token!, storeId, product!.id, {
          name,
          description,
          imageUrl,
          priceInCents: priceCents,
          categoryId,
          active,
        });
        toast.success("Produto atualizado.");
      } else {
        await createOnlineProduct(token!, storeId, {
          name,
          description,
          imageUrl,
          priceInCents: priceCents,
          categoryId,
          active,
        });
        toast.success("Produto criado.");
      }
      onSaved();
    } catch (e) {
      handleApiError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar produto" : "Novo produto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Preço (R$)</Label>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label>URL da imagem</Label>
            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="active-toggle" />
            <Label htmlFor="active-toggle">Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------- Categories -------- */

function CategoriesTab({
  storeId,
  categories,
  onChange,
}: {
  storeId: string;
  categories: OnlineCategory[];
  onChange: () => void;
}) {
  const { token } = useAuth();
  const [editing, setEditing] = useState<OnlineCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const del = useMutation({
    mutationFn: (c: OnlineCategory) => deleteOnlineCategory(token!, storeId, c.id),
    onSuccess: () => {
      toast.success("Categoria excluída.");
      onChange();
    },
    onError: (e) => handleApiError(e),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="mr-1 h-4 w-4" /> Nova categoria
        </Button>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhuma categoria"
          description="Crie categorias para organizar seus produtos no cardápio online."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="font-medium">{c.name}</div>
                {c.description && (
                  <div className="truncate text-xs text-muted-foreground">{c.description}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={c.active === false ? "secondary" : "default"}>
                  {c.active === false ? "Inativa" : "Ativa"}
                </Badge>
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Excluir "${c.name}"?`)) del.mutate(c);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <CategoryDialog
          storeId={storeId}
          category={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            onChange();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryDialog({
  storeId,
  category,
  onClose,
  onSaved,
}: {
  storeId: string;
  category: OnlineCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const isEdit = !!category;
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [active, setActive] = useState(category?.active !== false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await updateOnlineCategory(token!, storeId, category!.id, { name, description, active });
        toast.success("Categoria atualizada.");
      } else {
        await createOnlineCategory(token!, storeId, { name, description, active });
        toast.success("Categoria criada.");
      }
      onSaved();
    } catch (e) {
      handleApiError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="cat-active" />
            <Label htmlFor="cat-active">Ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
