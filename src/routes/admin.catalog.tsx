// Pendências que exigiriam backend novo (não implementadas):
// - "Aplicar grupo a outras pizzas" (endpoint bulk apply).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Plus,
  Loader2,
  AlertCircle,
  FolderTree,
  Package,
  Tag,
  Pencil,
  Power,
  Search,
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  Upload,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List as ListIcon,
  AlertTriangle,
} from "lucide-react";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AdminLayout } from "@/components/admin-layout";
import { Badge } from "@/components/ui/badge";


import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import { useOrganization } from "@/contexts/organization-context";
import { qk } from "@/lib/query-keys";
import {
  createCatalogCategory,
  createCatalogProduct,
  listCatalogCategories,
  listCatalogProducts,
  listCatalogProductOptionGroups,
  updateCatalogCategory,
  updateCatalogProduct,
  type CatalogCategory,
  type CatalogProduct,
  type CategorySector,
} from "@/lib/catalog-api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useRequireModule } from "@/lib/require-module";

import type { ProductCounts } from "@/lib/catalog-helpers";
import {
  SectionHeader,
  EmptyBlock,
  MetricCard,
  StatusDot,
  SectorBadge,
} from "@/components/admin/catalog/catalog-ui";
import { ProductCard, ProductRow } from "@/components/admin/catalog/product-cards";
import {
  NewCategoryDialog,
  EditCategoryDialog,
} from "@/components/admin/catalog/category-dialogs";
import {
  NewProductDialog,
  EditProductDialog,
} from "@/components/admin/catalog/product-dialogs";

export const Route = createFileRoute("/admin/catalog")({
  component: CatalogPage,
});


function CatalogPage() {
  useRequireModule(["ONLINE_ORDERS", "EVENTS"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, user, loading: authLoading } = useAuth();
  const {
    organizationId,
    organizationName,
    loading: organizationLoading,
  } = useOrganization();
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, ProductCounts>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [prodOpen, setProdOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<CatalogCategory | null>(null);
  const [editingProd, setEditingProd] = useState<CatalogProduct | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NAME");
  const [catCollapsed, setCatCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const fetchRunRef = useRef(0);
  const countRunRef = useRef(0);



  useEffect(() => {
    if (!authLoading && !token) navigate({ to: "/admin/login" });
  }, [authLoading, token, navigate]);

  const resetCatalogState = () => {
    setCategories([]);
    setProducts([]);
    setProductCounts({});
    setError(null);
    setCatOpen(false);
    setProdOpen(false);
    setEditingCat(null);
    setEditingProd(null);
    setSearch("");
    setCategoryFilter("ALL");
    setSectorFilter("ALL");
    setStatusFilter("ALL");
  };

  const fetchProductCounts = async (t: string, orgId: string, prods: CatalogProduct[]) => {
    const runId = ++countRunRef.current;
    const entries = await Promise.all(
      prods.map(async (p) => {
        try {
          const groups = await listCatalogProductOptionGroups(t, p.id, orgId);
          const options = groups.reduce(
            (acc, g) => acc + (Array.isArray(g.options) ? g.options.length : 0),
            0,
          );
          return [p.id, { groups: groups.length, options }] as const;
        } catch {
          return [p.id, { groups: 0, options: 0 }] as const;
        }
      }),
    );
    if (runId !== countRunRef.current || orgId !== organizationId) return;
    setProductCounts(Object.fromEntries(entries));
  };

  const fetchAll = async (t: string, orgId: string) => {
    const runId = ++fetchRunRef.current;
    setLoading(true);
    setError(null);
    setProductCounts({});
    try {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: qk.catalog.categories(orgId) }),
        queryClient.cancelQueries({ queryKey: qk.catalog.products(orgId) }),
      ]);
      const [cats, prods] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: qk.catalog.categories(orgId),
          queryFn: () => listCatalogCategories(t, orgId),
          staleTime: 0,
        }),
        queryClient.fetchQuery({
          queryKey: qk.catalog.products(orgId),
          queryFn: () => listCatalogProducts(t, orgId),
          staleTime: 0,
        }),
      ]);
      if (runId !== fetchRunRef.current || orgId !== organizationId) return;
      setCategories(cats);
      setProducts(prods);
      void fetchProductCounts(t, orgId, prods);
    } catch (err) {
      if (runId !== fetchRunRef.current || orgId !== organizationId) return;
      setError(handleApiError(err, "Não foi possível carregar o catálogo."));
    } finally {
      if (runId === fetchRunRef.current && orgId === organizationId) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRunRef.current += 1;
    countRunRef.current += 1;
    void queryClient.cancelQueries({ queryKey: ["catalog"] });
    void queryClient.cancelQueries({ queryKey: ["catalog-categories"] });
    void queryClient.cancelQueries({ queryKey: ["catalog-products"] });
    resetCatalogState();

    if (!token || !organizationId || organizationLoading) {
      setLoading(Boolean(token && organizationLoading));
      return;
    }

    void fetchAll(token, organizationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, organizationId, organizationLoading]);

  const productCategoryId = (p: CatalogProduct) =>
    p.catalogCategoryId ?? p.categoryId ?? p.category?.id ?? "__none__";

  const isActive = (x: { active?: boolean }) => x.active !== false;

  const productsByCategory = useMemo(() => {
    const map = new Map<string, CatalogProduct[]>();
    for (const p of products) {
      const key = productCategoryId(p);
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [products]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort(
      (a, b) =>
        ((a.sortOrder as number | undefined) ?? 0) -
          ((b.sortOrder as number | undefined) ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }, [categories]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    }

    // Category
    if (categoryFilter !== "ALL") {
      result = result.filter(p => productCategoryId(p) === categoryFilter);
    }

    // Sector
    if (sectorFilter !== "ALL") {
      result = result.filter(p => {
        const catId = productCategoryId(p);
        const cat = categories.find(c => c.id === catId);
        return cat?.sector === sectorFilter;
      });
    }

    // Status
    if (statusFilter !== "ALL") {
      const active = statusFilter === "ACTIVE";
      result = result.filter(p => isActive(p) === active);
    }

    // Sort (imutável — usa cópia)
    result.sort((a, b) => {
      if (sortBy === "NAME") return a.name.localeCompare(b.name);
      return (
        ((a.sortOrder ?? 0) as number) - ((b.sortOrder ?? 0) as number) ||
        a.name.localeCompare(b.name)
      );
    });

    return result;
  }, [products, categories, search, categoryFilter, sectorFilter, statusFilter, sortBy]);


  const onToggleCategory = async (c: CatalogCategory) => {
    if (!token || !organizationId) return;
    const next = !isActive(c);
    try {
      await updateCatalogCategory(token, c.id, { active: next }, organizationId);
      const cats = organizationId
        ? await queryClient.fetchQuery({
            queryKey: qk.catalog.categories(organizationId),
            queryFn: () => listCatalogCategories(token, organizationId),
            staleTime: 0,
          }).catch(() => null)
        : await listCatalogCategories(token, organizationId).catch(() => null);
      if (cats) setCategories(cats);
      else setCategories((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: next } : x)));
      toast.success(next ? "Categoria ativada" : "Categoria desativada");
    } catch (e) {
      handleApiError(e, "Não foi possível atualizar a categoria.");
    }
  };

  const onToggleProduct = async (p: CatalogProduct) => {
    if (!token || !organizationId) return;
    const next = !isActive(p);
    try {
      await updateCatalogProduct(token, p.id, { active: next }, organizationId);
      const prods = organizationId
        ? await queryClient.fetchQuery({
            queryKey: qk.catalog.products(organizationId),
            queryFn: () => listCatalogProducts(token, organizationId),
            staleTime: 0,
          }).catch(() => null)
        : await listCatalogProducts(token, organizationId).catch(() => null);
      if (prods) {
        setProducts(prods);
        if (organizationId) void fetchProductCounts(token, organizationId, prods);
      }
      else setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: next } : x)));
      toast.success(next ? "Produto ativado" : "Produto desativado");
    } catch (e) {
      handleApiError(e, "Não foi possível atualizar o produto.");
    }
  };

  const totalCategories = categories.length;
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => isActive(p)).length;
  const inactiveProducts = totalProducts - activeProducts;

  return (
    <AdminLayout
      title="Catálogo"
      subtitle={organizationName ? `Categorias e produtos de ${organizationName}` : "Categorias e produtos da organização"}
    >
      {/* Page hero header */}
      <div className="mb-6 rounded-2xl border border-border/70 bg-gradient-to-br from-card via-card to-muted/30 p-6 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <Package className="h-3 w-3" />
              Catálogo
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Gerencie seu catálogo de produtos
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Centralize categorias e produtos da organização. Os preços e estoques são configurados por evento.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard icon={<FolderTree className="h-4 w-4" />} label="Categorias" value={totalCategories} tone="primary" />
          <MetricCard icon={<Package className="h-4 w-4" />} label="Produtos" value={totalProducts} tone="foreground" />
          <MetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Ativos" value={activeProducts} tone="success" />
          <MetricCard icon={<XCircle className="h-4 w-4" />} label="Inativos" value={inactiveProducts} tone="muted" />
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-card/60" />
          ))}
        </div>
      ) : (
        <>
          <SectionHeader
            icon={<FolderTree className="h-4 w-4" />}
            title="Categorias"
            subtitle="Organize o catálogo da organização"
            action={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setCatCollapsed((v) => !v)}
                  aria-expanded={!catCollapsed}
                  aria-label={catCollapsed ? "Expandir categorias" : "Recolher categorias"}
                >
                  {catCollapsed ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronUp className="h-4 w-4" />
                  )}
                  <span className="text-xs">{catCollapsed ? "Expandir" : "Recolher"}</span>
                </Button>
                <Dialog open={catOpen} onOpenChange={setCatOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="text-primary-foreground"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <Plus className="h-4 w-4" />
                      Nova categoria
                    </Button>
                  </DialogTrigger>
                  <NewCategoryDialog
                    token={token}
                    organizationId={organizationId}
                    onCreated={(c) => {
                    setCategories((prev) => [...prev, c]);
                    if (organizationId) {
                      void queryClient.invalidateQueries({ queryKey: qk.catalog.categories(organizationId) });
                    }
                    setCatOpen(false);
                  }}
                  />
                </Dialog>
              </div>
            }
          />

          {catCollapsed ? null : categories.length === 0 ? (
            <EmptyBlock
              icon={<FolderTree className="h-5 w-5" />}
              title="Nenhuma categoria"
              description="Crie a primeira categoria do catálogo da organização."
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sortedCategories.map((c) => {
                const active = isActive(c);
                const count = (productsByCategory.get(c.id) ?? []).length;
                return (
                  <div
                    key={c.id}
                    className="group relative flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 transition-all hover:border-border hover:shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
                      <Tag className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
                        <StatusDot active={active} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[11px] text-muted-foreground">
                          {c.slug ? `/${c.slug}` : "sem slug"}
                        </span>
                        <SectorBadge sector={c.sector} />
                        <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {count} {count === 1 ? "produto" : "produtos"}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => setEditingCat(c)}
                      aria-label={`Editar ${c.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0"
                          aria-label={`Mais ações em ${c.name}`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onToggleCategory(c)}>
                          <Power className="mr-2 h-4 w-4" />
                          {active ? "Desativar" : "Ativar"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}

            </div>
          )}

          <SectionHeader
            icon={<Package className="h-4 w-4" />}
            title="Produtos"
            subtitle="Itens disponíveis para vincular a eventos (preço definido por evento)"

            action={
              <Dialog open={prodOpen} onOpenChange={setProdOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    disabled={categories.length === 0}
                    className="text-primary-foreground"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    <Plus className="h-4 w-4" />
                    Novo produto
                  </Button>
                </DialogTrigger>
                <NewProductDialog
                  token={token}
                  organizationId={organizationId}
                  categories={categories}
                  onCreated={(p) => {
                    setProducts((prev) => [p, ...prev]);
                    if (organizationId) {
                      void queryClient.invalidateQueries({ queryKey: qk.catalog.products(organizationId) });
                    }
                    setProdOpen(false);
                  }}
                />
              </Dialog>
            }
          />

          <div className="mb-6 rounded-xl border border-border/70 bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
              </div>
              <ToggleGroup
                type="single"
                value={viewMode}
                onValueChange={(v) => v && setViewMode(v as "grid" | "list")}
                className="border border-border/70 bg-background"
                aria-label="Modo de visualização"
              >
                <ToggleGroupItem value="grid" aria-label="Visualização em grade" className="h-8 px-2">
                  <LayoutGrid className="h-4 w-4" />
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Visualização em lista" className="h-8 px-2">
                  <ListIcon className="h-4 w-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome ou descrição..."
                    className="h-10 border-border/70 bg-background pl-10 text-sm shadow-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Filtrar por categoria"
                >
                  <option value="ALL">Todas categorias</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <select
                  value={sectorFilter}
                  onChange={(e) => setSectorFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Filtrar por setor"
                >
                  <option value="ALL">Todos setores</option>
                  <option value="BAR">Bar</option>
                  <option value="KITCHEN">Cozinha</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-border/70 bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                  aria-label="Filtrar por status"
                >
                  <option value="ALL">Todos status</option>
                  <option value="ACTIVE">Ativos</option>
                  <option value="INACTIVE">Inativos</option>
                </select>
              </div>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyBlock
              icon={<Package className="h-5 w-5" />}
              title="Nenhum produto"
              description={
                categories.length === 0
                  ? "Crie uma categoria antes de cadastrar produtos."
                  : "Nenhum produto encontrado com os filtros atuais."
              }
            />
          ) : viewMode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  active={isActive(p)}
                  counts={productCounts[p.id] ?? { groups: 0, options: 0 }}
                  categoryName={
                    categories.find((c) => c.id === productCategoryId(p))?.name ?? "Sem categoria"
                  }
                  onEdit={() => setEditingProd(p)}
                  onToggle={() => onToggleProduct(p)}
                />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card">
              {filteredProducts.map((p) => (
                <ProductRow
                  key={p.id}
                  product={p}
                  active={isActive(p)}
                  counts={productCounts[p.id] ?? { groups: 0, options: 0 }}
                  categoryName={
                    categories.find((c) => c.id === productCategoryId(p))?.name ?? "Sem categoria"
                  }
                  onEdit={() => setEditingProd(p)}
                  onToggle={() => onToggleProduct(p)}
                />
              ))}
            </div>


          )}

        </>
      )}


      <Dialog open={!!editingCat} onOpenChange={(o) => !o && setEditingCat(null)}>
        {editingCat && (
          <EditCategoryDialog
            token={token}
            organizationId={organizationId}
            category={editingCat}
            onSaved={(updated) => {
              setCategories((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
              if (organizationId) {
                void queryClient.invalidateQueries({ queryKey: qk.catalog.categories(organizationId) });
              }
              setEditingCat(null);
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={!!editingProd}
        onOpenChange={(o) => {
          if (!o) {
            setEditingProd(null);
            if (token && organizationId) void fetchProductCounts(token, organizationId, products);
          }
        }}
      >
        {editingProd && (
          <EditProductDialog
            token={token}
            organizationId={organizationId}
            categories={categories}
            product={editingProd}
            products={products}
            onSaved={(updated) => {
              setProducts((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
              if (organizationId) {
                void queryClient.invalidateQueries({ queryKey: qk.catalog.products(organizationId) });
              }
              setEditingProd(null);
              if (token && organizationId) void fetchProductCounts(token, organizationId, products);
            }}
          />
        )}
      </Dialog>
    </AdminLayout>
  );
}
