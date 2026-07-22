import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  Package,
  Search,
  Pencil,
  Power,
  LayoutDashboard,
  Settings,
  Monitor,
  Tv,
  ExternalLink,
  Copy,
  DollarSign,
  CreditCard,
  Printer,
  ChevronRight,
  Filter,
  Receipt,
  Trash2,
} from "lucide-react";



import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminLayout } from "@/components/admin-layout";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useEventSocket } from "@/hooks/use-event-socket";
import { handleApiError } from "@/lib/api-error";
import { getEvent, getEventMetrics, type EventItem } from "@/lib/events-api";
import {
  listEventCatalogProducts,
  updateEventCatalogProduct,
  deleteEventCatalogProduct,
  listAvailableCatalogProducts,
  bulkLinkEventCatalogProducts,
  type CatalogOptionGroup,
  type AvailableCatalogProduct,
  type EventCatalogProduct,
} from "@/lib/catalog-api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatCurrencyFromCents, parseCurrencyToCents } from "@/lib/utils";
import { ProductImage } from "@/components/ProductImage";
import { EventLogo } from "@/components/EventLogo";
import { resolveAssetUrl } from "@/lib/auth";
import { getTotemUrl, getCallScreenUrl, openPublicUrl } from "@/lib/public-event-urls";
import { EventTotemSettings } from "@/components/event-settings/event-totem-settings";
import { EventOperationSettings } from "@/components/event-settings/event-operation-settings";
import { useRequireModule } from "@/lib/require-module";
import { useEffectivePaymentSettings } from "@/hooks/use-payment-settings";
import { usePrintingSettings } from "@/hooks/use-printing-settings";
import { useOrganization } from "@/contexts/organization-context";

export const Route = createFileRoute("/admin/events/$id")({
  component: EventDetailPage,
});

function epName(ep: EventCatalogProduct) {
  return ep.product?.name ?? ep.catalogProduct?.name ?? ep.name ?? "Produto";
}
function epImage(ep: EventCatalogProduct) {
  return ep.product?.imageUrl ?? ep.catalogProduct?.imageUrl ?? ep.imageUrl;
}
function epActive(ep: EventCatalogProduct) {
  if (typeof ep.active === "boolean") return ep.active;
  if (typeof ep.status === "string") return ep.status.toLowerCase() === "active";
  return true;
}

function EventDetailPage() {
  useRequireModule(["EVENTS"]);
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const { organizationSlug } = useOrganization();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [items, setItems] = useState<EventCatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EventCatalogProduct | null>(null);
  const [deletingItem, setDeletingItem] = useState<EventCatalogProduct | null>(null);

  // Filters for Products
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sectorFilter, setSectorFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("NAME");


  useEffect(() => {
    if (!authLoading && !token) navigate({ to: "/admin/login" });
  }, [authLoading, token, navigate]);

  const fetchAll = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const [ev, list, m] = await Promise.all([
        getEvent(t, id),
        listEventCatalogProducts(t, id).catch(() => []),
        getEventMetrics(t, id).catch(() => null),
      ]);
      setEvent(ev);
      setItems(list);
      setMetrics(m);
    } catch (err) {
      setError(handleApiError(err, "Não foi possível carregar o evento."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAll(token);
  }, [token, id]);

  // Debounce socket-triggered refetches to avoid request bursts
  const refetchScheduledRef = useRef(false);
  const scheduleRefetch = useCallback(() => {
    if (!token) return;
    if (refetchScheduledRef.current) return;
    refetchScheduledRef.current = true;
    window.setTimeout(() => {
      refetchScheduledRef.current = false;
      if (token) fetchAll(token);
    }, 400);
  }, [token]);

  useEventSocket({
    eventId: id,
    token,
    onOrderCreated: scheduleRefetch,
    onOrderUpdated: scheduleRefetch,
    onPaymentUpdated: scheduleRefetch,
  });


  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      const catalogProduct = item.catalogProduct;
      const category = (catalogProduct as any)?.catalogCategory;
      const cat = category?.name ?? "Sem categoria";
      set.add(cat);
    });

    return Array.from(set).sort();
  }, [items]);


  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(item => epName(item).toLowerCase().includes(q));
    }

    // Category
    if (categoryFilter !== "ALL") {
      result = result.filter(item => {
        const catalogProduct = item.catalogProduct;
        const category = (catalogProduct as any)?.catalogCategory;
        const cat = category?.name ?? "Sem categoria";
        return cat === categoryFilter;
      });

    }

    // Sector
    if (sectorFilter !== "ALL") {
      result = result.filter(item => {
        const catalogProduct = item.catalogProduct;
        const category = (catalogProduct as any)?.catalogCategory;
        const sector = category?.sector;
        return sector === sectorFilter;
      });

    }


    // Status
    if (statusFilter !== "ALL") {
      if (statusFilter === "ACTIVE") {
        result = result.filter(item => epActive(item) === true);
      } else if (statusFilter === "INACTIVE") {
        result = result.filter(item => epActive(item) === false);
      } else if (statusFilter === "SOLD_OUT") {
        result = result.filter(item => item.soldOut === true);
      }
    }

    // Stock
    if (stockFilter === "LOW") {
      result = result.filter(item => item.trackStock && (item.stockQuantity ?? 0) <= 5);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "NAME") return epName(a).localeCompare(epName(b));
      if (sortBy === "PRICE") return (a.priceInCents ?? 0) - (b.priceInCents ?? 0);
      return 0;
    });


    return result;
  }, [items, search, categoryFilter, sectorFilter, statusFilter, stockFilter, sortBy]);

  const onToggleActive = async (ep: EventCatalogProduct) => {
    if (!token) return;
    const next = !epActive(ep);
    try {
      await updateEventCatalogProduct(token, id, ep.id, { active: next });
      setItems(prev => prev.map(p => p.id === ep.id ? { ...p, active: next } : p));
      toast.success(next ? "Produto ativado" : "Produto desativado");
    } catch (err) {
      handleApiError(err, "Não foi possível atualizar o produto.");
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Carregando..." subtitle="Aguarde um momento">
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  if (!event) {
    return (
      <AdminLayout title="Evento não encontrado" subtitle="Ocorreu um erro ao carregar o evento">
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed p-12">
          <AlertCircle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">Não foi possível encontrar o evento solicitado.</p>
          <Button asChild>
            <Link to="/admin/events">Voltar para a lista</Link>
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={event.name}
      subtitle={`/${event.slug}`}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="hidden sm:flex">
            <Link to="/admin/events">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <Button size="sm" style={{ background: "var(--gradient-primary)" }} onClick={() => {
            const url = getTotemUrl(event.slug, organizationSlug);
            openPublicUrl(url);
          }}>
            <Monitor className="mr-2 h-4 w-4" />
            Ver autoatendimento
          </Button>
        </div>
      }
    >
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="w-full justify-start md:w-auto">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="products">Produtos</TabsTrigger>
            <TabsTrigger value="appearance">Aparência</TabsTrigger>
            <TabsTrigger value="operation">Operação</TabsTrigger>
            <TabsTrigger value="links">Links públicos</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Informações do Evento</CardTitle>
                    <CardDescription>Resumo operacional e status atual</CardDescription>
                  </div>
                  <Badge className={event.status === "active" ? "bg-emerald-500" : ""}>
                    {event.status === "active" ? "Ativo" : "Rascunho"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatItem 
                    label="Pedidos totais" 
                    value={metrics?.totalOrders ?? metrics?.ordersCount ?? 0} 
                    icon={Receipt} 
                  />
                  <StatItem 
                    label="Receita recebida" 
                    value={metrics?.totalRevenueInCents ? formatCurrency(metrics.totalRevenueInCents / 100) : "R$ 0,00"} 
                    icon={DollarSign} 
                  />
                  <StatItem 
                    label="Pagamentos pendentes" 
                    value={metrics?.ordersByStatus?.PENDING ?? metrics?.statusCounts?.PENDING ?? 0} 
                    icon={AlertCircle}
                    warning={(metrics?.ordersByStatus?.PENDING ?? 0) > 0}
                  />
                  <StatItem 
                    label="Total de produtos" 
                    value={items.length} 
                    icon={Package} 
                  />
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold">Alertas de configuração</h4>
                  <div className="grid gap-2">
                    {items.length === 0 && (
                      <ConfigAlert 
                        type="warning" 
                        title="Nenhum produto cadastrado" 
                        desc="O autoatendimento não mostrará nada até que você vincule produtos." 
                      />
                    )}
                    {!event.pixEnabled && (
                      <ConfigAlert 
                        type="error" 
                        title="Pagamentos não configurados para este evento." 
                        desc="Revise a configuração efetiva herdada da organização." 
                        action={
                          <Button asChild size="sm" variant="outline">
                            <Link to="/admin/settings/payments">Configurações de Pagamento</Link>
                          </Button>
                        }
                      />
                    )}
                    {!event.logoUrl && (
                      <ConfigAlert 
                        type="info" 
                        title="Logo ausente" 
                        desc="Adicionar um logo ajuda na identidade visual do seu evento." 
                      />
                    )}
                    {!event.startsAt && (
                      <ConfigAlert 
                        type="warning" 
                        title="Evento sem data definida" 
                        desc="Defina as datas para controle operacional." 
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operações rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <QuickActionButton icon={Monitor} label="Abrir autoatendimento" onClick={() => {
                  const url = getTotemUrl(event.slug, organizationSlug);
                  openPublicUrl(url);
                }} />
                <QuickActionButton icon={Tv} label="Painel de Chamada" onClick={() => {
                  const url = getCallScreenUrl(event.slug, organizationSlug);
                  openPublicUrl(url);
                }} />
                <QuickActionButton icon={Settings} label="Configurações" onClick={() => {}} />
                <QuickActionButton icon={Copy} label="Duplicar Evento (Breve)" onClick={() => toast.info("Em breve...")} />





              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Produtos do Evento</CardTitle>
                <CardDescription>Gerencie o que está sendo vendido neste evento</CardDescription>
              </div>
              <Button style={{ background: "var(--gradient-primary)" }} onClick={() => setIsAddModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Vincular Produto
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <SelectFilter 
                  label="Categoria" 
                  options={["ALL", ...categories]} 
                  value={categoryFilter} 
                  onChange={setCategoryFilter} 
                />
                <SelectFilter 
                  label="Setor" 
                  options={["ALL", "BAR", "KITCHEN"]} 
                  labels={{ "ALL": "Todos", "BAR": "Bar", "KITCHEN": "Cozinha" }}
                  value={sectorFilter} 
                  onChange={setSectorFilter} 
                />
                <SelectFilter 
                  label="Status" 
                  options={["ALL", "ACTIVE", "INACTIVE", "SOLD_OUT"]} 
                  labels={{ "ALL": "Todos", "ACTIVE": "Ativo", "INACTIVE": "Inativo", "SOLD_OUT": "Esgotado" }}
                  value={statusFilter} 
                  onChange={setStatusFilter} 
                />
                <SelectFilter 
                  label="Estoque" 
                  options={["ALL", "LOW"]} 
                  labels={{ "ALL": "Todos", "LOW": "Estoque baixo" }}
                  value={stockFilter} 
                  onChange={setStockFilter} 
                />
                <SelectFilter 
                  label="Ordenar" 
                  options={["NAME", "PRICE"]} 
                  labels={{ "NAME": "Nome", "PRICE": "Preço" }}
                  value={sortBy} 
                  onChange={setSortBy} 
                />

              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredItems.map((ep) => (
                  <ProductAdminCard 
                    key={ep.id} 
                    ep={ep} 
                    onToggle={() => onToggleActive(ep)}
                    onEdit={() => setEditingItem(ep)}
                    onDelete={() => setDeletingItem(ep)}
                  />
                ))}
                {filteredItems.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground">
                    Nenhum produto encontrado com os filtros atuais.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="links">
          <div className="rounded-lg border bg-muted/30 p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Os links públicos agora estão na Central de Links</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Gerencie todos os acessos públicos da sua organização e eventos em um só lugar.
              </p>
            </div>
            <Button asChild>
              <Link to="/admin/public-links" search={{ eventId: event.id }}>
                Abrir na Central de Links
              </Link>
            </Button>
          </div>
        </TabsContent>



        <TabsContent value="appearance">
          <EventTotemSettings eventId={id} />
        </TabsContent>
        <TabsContent value="operation">
          <div className="space-y-6">
            <EventPaymentInheritanceSummary eventId={id} />
            <EventPrintingInheritanceSummary />
            <EventOperationSettings eventId={id} onChanged={() => { /* refresh handled internally */ }} />
          </div>
        </TabsContent>

      </Tabs>

      <AddProductModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        eventId={id}
        token={token || ""}
        existingProductIds={items.map(i => i.catalogProductId || "")}
        onSuccess={(newItems) => {
          if (newItems.length > 0) setItems(prev => [...prev, ...newItems]);
          // Refetch to get canonical enriched payload (optionGroups, etc.)
          if (token) fetchAll(token);
          setIsAddModalOpen(false);
        }}
      />

      {editingItem && (
        <EditProductModal 
          item={editingItem}
          isOpen={!!editingItem}
          onClose={() => setEditingItem(null)}
          eventId={id}
          token={token || ""}
          onSuccess={(updatedItem) => {
            setItems(prev => prev.map(p => p.id === updatedItem.id ? updatedItem : p));
            setEditingItem(null);
          }}
        />
      )}

      {deletingItem && (
        <DeleteProductModal 
          item={deletingItem}
          isOpen={!!deletingItem}
          onClose={() => setDeletingItem(null)}
          eventId={id}
          token={token || ""}
          onSuccess={(deletedId) => {
            setItems(prev => prev.filter(p => p.id !== deletedId));
            setDeletingItem(null);
          }}
        />
      )}
    </AdminLayout>
  );
}

function StatItem({ label, value, icon: Icon, warning }: { label: string, value: string | number, icon: any, warning?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${warning ? "text-amber-500" : "text-primary/70"}`} />
        <span className={`text-lg font-bold ${warning ? "text-amber-600" : ""}`}>{value}</span>
      </div>
    </div>
  );
}

function ConfigAlert({
  type,
  title,
  desc,
  action,
}: {
  type: "warning" | "error" | "info";
  title: string;
  desc: string;
  action?: ReactNode;
}) {
  const styles = {
    warning: "bg-amber-500/10 border-amber-500/20 text-amber-600",
    error: "bg-red-500/10 border-red-500/20 text-red-600",
    info: "bg-blue-500/10 border-blue-500/20 text-blue-600",
  };
  return (
    <div className={`flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-start sm:justify-between ${styles[type]}`}>
      <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="text-xs opacity-80">{desc}</p>
      </div>
      </div>
      {action}
    </div>
  );
}

function EventPaymentInheritanceSummary({ eventId }: { eventId: string }) {
  const { data, isLoading, isError } = useEffectivePaymentSettings({
    contextType: "EVENT",
    eventId,
  });

  const methods = data?.methods;
  const enabledCount = methods ? Object.values(methods).filter(Boolean).length : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Pagamentos do evento
          </CardTitle>
          <CardDescription>
            Este evento herda os métodos e credenciais financeiras da organização.
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/settings/payments">Configurações de Pagamento</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando configuração efetiva...
          </div>
        ) : isError || !data ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
            Não foi possível carregar a configuração efetiva de pagamentos.
          </div>
        ) : (
          <>
            {enabledCount === 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Pagamentos não configurados para este evento.
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <PaymentMethodBadge label="PIX" enabled={data.methods.pix} />
              <PaymentMethodBadge label="Crédito" enabled={data.methods.credit} />
              <PaymentMethodBadge label="Débito" enabled={data.methods.debit} />
              <PaymentMethodBadge label="Dinheiro" enabled={data.methods.cash} />
              <PaymentMethodBadge label="Saldo NFC" enabled={data.methods.nfcBalance} />
            </div>
            <p className="text-xs text-muted-foreground">
              Credenciais não são configuradas no evento. Overrides aceitos pelo backend ficam na
              seção Contextos das configurações de pagamento.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function EventPrintingInheritanceSummary() {
  const { data, isLoading, isError } = usePrintingSettings();
  const effective = data?.effective;
  const eventSource = effective?.sources?.EVENT;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Impressão do evento
          </CardTitle>
          <CardDescription>
            A impressão é configurada na organização e aplicada por origem, setor e dispositivo.
          </CardDescription>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/settings/printing">Configuração global de impressão</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando configuração de impressão...
          </div>
        ) : isError || !effective ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
            Não foi possível carregar a configuração herdada de impressão.
          </div>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <InfoPill label="Origem Evento" value={eventSource?.enabled ? "Habilitada" : "Desabilitada"} />
              <InfoPill label="Impressão automática" value={eventSource?.autoPrint ? "Ativa" : "Inativa"} />
              <InfoPill label="Modo" value={eventSource?.printMode ?? "Herdado"} />
            </div>
            <p className="text-xs text-muted-foreground">
              Vincule impressoras e SK210 em Dispositivos; a regra global fica em Impressão.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentMethodBadge({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm">
      <span className="font-medium">{label}</span>
      <Badge variant={enabled ? "default" : "secondary"}>
        {enabled ? "Herdado" : "Bloqueado"}
      </Badge>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label, href, onClick }: { icon: any, label: string, href?: string, onClick?: () => void }) {
  const content = (
    <div className="flex w-full items-center justify-between rounded-xl border border-border p-3 transition-colors hover:bg-accent cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <span className="font-medium">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </div>
  );

  if (href) return <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>;
  return <div onClick={onClick}>{content}</div>;
}

function SelectFilter({ 
  label, 
  options, 
  value, 
  onChange, 
  labels = {} 
}: { 
  label: string, 
  options: string[], 
  value: string, 
  onChange: (v: string) => void,
  labels?: Record<string, string>
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-medium uppercase text-muted-foreground">{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{labels[opt] || (opt === "ALL" ? "Todos" : opt)}</option>
        ))}
      </select>
    </div>
  );
}


function ProductAdminCard({ ep, onToggle, onEdit, onDelete }: { ep: EventCatalogProduct, onToggle: () => void, onEdit: () => void, onDelete: () => void }) {


  const active = epActive(ep);
  const name = epName(ep);
  const img = resolveAssetUrl(epImage(ep));
  
  const catalogProduct = ep.catalogProduct;
  const category = (catalogProduct as any)?.catalogCategory;
  const categoryName = category?.name ?? "Sem categoria";
  const sector = category?.sector ?? null;
  const sectorLabel = sector === 'BAR' ? 'Bar' : sector === 'KITCHEN' ? 'Cozinha' : null;
  
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md">
      <div className="relative aspect-square overflow-hidden bg-muted">
        <ProductImage src={img} alt={name} className="h-full w-full object-cover" />
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {ep.soldOut && (
            <Badge variant="destructive" className="bg-red-600 animate-pulse">
              ESGOTADO
            </Badge>
          )}
          <Badge variant={active ? "default" : "secondary"} className={active ? "bg-emerald-500" : ""}>
            {active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium text-muted-foreground">
            {categoryName}{sectorLabel ? ` • ${sectorLabel}` : ""}
          </p>
          <h4 className="truncate font-bold text-foreground" title={name}>{name}</h4>
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-primary">
              {formatCurrencyFromCents(ep.priceInCents)}
            </p>
            {ep.priceSource === "EVENT" ? (
              <>
                <Badge variant="secondary" className="mt-0.5 text-[9px]">
                  Preço do evento
                </Badge>
                {typeof ep.catalogPriceInCents === "number" && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    Base: {formatCurrencyFromCents(ep.catalogPriceInCents)}
                  </p>
                )}
              </>
            ) : (
              <Badge variant="outline" className="mt-0.5 text-[9px]">
                Preço do catálogo
              </Badge>
            )}
          </div>
          {ep.trackStock ? (
            <span className={`text-[10px] font-bold ${(ep.stockQuantity ?? 0) <= 5 ? "text-amber-600" : "text-muted-foreground"}`}>
              {ep.soldOut ? "ESGOTADO" : `Estoque: ${ep.stockQuantity}`}
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground italic">
              Sem controle
            </span>
          )}
        </div>
        {(ep.optionGroups?.length ?? 0) > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            {ep.optionGroups!.length} grupo{ep.optionGroups!.length > 1 ? "s" : ""} de opções
            {ep.optionGroups![0]?.name ? ` • ${ep.optionGroups![0].name}` : ""}
          </p>
        )}
        <div className="mt-3 flex gap-1.5">
          <Button variant="outline" size="sm" className="h-8 flex-1 text-[11px] px-0" onClick={onEdit}>Editar</Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className={`h-8 flex-1 text-[11px] px-0 ${active ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}`}
            onClick={onToggle}
          >
            {active ? "Desativar" : "Ativar"}
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 px-0 text-destructive hover:bg-destructive/10"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

      </div>
    </div>
  );
}

function LinkCard({ title, desc, path }: { title: string, desc: string, path: string }) {
  const fullUrl = `${window.location.origin}${path}`;
  
  const copy = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success("Link copiado!");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 overflow-hidden rounded-lg bg-muted p-2">
          <span className="truncate text-xs font-mono text-muted-foreground">{fullUrl}</span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={copy}>
            <Copy className="mr-2 h-4 w-4" />
            Copiar
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => {
            openPublicUrl(path);
          }}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Abrir
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("QR Code em breve...")}>
            QR Code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddProductModal({
  isOpen,
  onClose,
  eventId,
  token,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  token: string;
  existingProductIds: string[];
  onSuccess: (newItems: EventCatalogProduct[]) => void;
}) {
  const [items, setItems] = useState<AvailableCatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSelected({});
      setSearch("");
      setDebouncedSearch("");
      setCategoryFilter("ALL");
    }
  }, [isOpen]);

  // Fetch available
  useEffect(() => {
    if (!isOpen || !token) return;
    let cancelled = false;
    setLoading(true);
    listAvailableCatalogProducts(token, eventId, {
      search: debouncedSearch || undefined,
      categoryId: categoryFilter,
    })
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err) => {
        if (!cancelled) handleApiError(err, "Não foi possível carregar o catálogo.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, token, eventId, debouncedSearch, categoryFilter]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((p) => {
      const c = p.category ?? p.catalogCategory;
      if (c?.id && c?.name) map.set(c.id, c.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const selectableIds = items.filter((p) => !p.alreadyLinked).map((p) => p.id);
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected[id]);
  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) {
        selectableIds.forEach((id) => delete next[id]);
      } else {
        selectableIds.forEach((id) => (next[id] = true));
      }
      return next;
    });
  };

  const handleBulk = async () => {
    const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
    if (ids.length === 0 || !token) return;
    setSubmitting(true);
    try {
      const res = await bulkLinkEventCatalogProducts(
        token,
        eventId,
        ids.map((catalogProductId) => ({
          catalogProductId,
          priceInCents: null,
          active: true,
          trackStock: false,
          stockQuantity: null,
        })),
      );
      const created = res.createdCount ?? res.created.length;
      const skipped = res.skippedCount ?? 0;
      if (created > 0) {
        toast.success(
          skipped > 0
            ? `${created} vinculado(s), ${skipped} já existia(m).`
            : `${created} produto(s) vinculado(s) com sucesso.`,
        );
      } else if (skipped > 0) {
        toast.info(`Nenhum novo produto vinculado — ${skipped} já existia(m).`);
      }
      onSuccess(res.created);
      setSelected({});
    } catch (err) {
      handleApiError(err, "Erro ao vincular produtos.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Vincular Produtos do Catálogo</DialogTitle>
          <DialogDescription>
            Selecione um ou mais produtos do catálogo desta organização para vender neste evento.
            O produto continuará no catálogo global.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-6">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produto..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="ALL">Todas as categorias</option>
              {categories.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <button
              type="button"
              className="underline-offset-2 hover:underline disabled:opacity-50"
              onClick={toggleAllVisible}
              disabled={selectableIds.length === 0}
            >
              {allVisibleSelected ? "Desmarcar todos" : "Selecionar todos visíveis"}
            </button>
            <span>{selectedCount} selecionado(s)</span>
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 pb-2 pt-3">
          {loading ? (
            <div className="flex py-12 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              {debouncedSearch || categoryFilter !== "ALL"
                ? "Nenhum produto encontrado com esses filtros."
                : "Esta organização ainda não possui produtos no catálogo."}
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((p) => {
                const linked = !!p.alreadyLinked;
                const cat = p.category ?? p.catalogCategory;
                const opts = p.optionGroups?.length ?? 0;
                return (
                  <label
                    key={p.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                      linked
                        ? "opacity-60 cursor-not-allowed bg-muted/40"
                        : "cursor-pointer hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    }`}
                  >
                    <Checkbox
                      checked={!!selected[p.id]}
                      disabled={linked}
                      onCheckedChange={() => !linked && toggle(p.id)}
                    />
                    <ProductImage src={resolveAssetUrl(p.imageUrl)} alt={p.name} size="xs" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold">{p.name}</p>
                        {linked && (
                          <Badge variant="secondary" className="text-[10px]">Já vinculado</Badge>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {cat?.name ?? "Sem categoria"}
                      </p>
                      {opts > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Possui {opts} grupo{opts > 1 ? "s" : ""} de opções
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">
                        {typeof p.priceInCents === "number"
                          ? formatCurrencyFromCents(p.priceInCents)
                          : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Preço do catálogo</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/30 p-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button
            onClick={handleBulk}
            disabled={submitting || selectedCount === 0}
            style={{ background: "var(--gradient-primary)" }}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Vincular selecionados{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProductModal({ 
  item, 
  isOpen, 
  onClose, 
  eventId, 
  token, 
  onSuccess 
}: { 
  item: EventCatalogProduct, 
  isOpen: boolean, 
  onClose: () => void, 
  eventId: string, 
  token: string, 
  onSuccess: (updatedItem: EventCatalogProduct) => void 
}) {
  const initialMode: "CATALOG" | "EVENT" =
    item.priceSource === "EVENT" || typeof item.eventPriceInCents === "number"
      ? "EVENT"
      : "CATALOG";
  const [priceMode, setPriceMode] = useState<"CATALOG" | "EVENT">(initialMode);
  const initialEventPriceCents =
    typeof item.eventPriceInCents === "number"
      ? item.eventPriceInCents
      : item.priceSource === "EVENT"
      ? item.priceInCents
      : null;
  const [price, setPrice] = useState(
    initialEventPriceCents != null
      ? (initialEventPriceCents / 100).toFixed(2).replace(".", ",")
      : "",
  );
  const catalogBaseCents =
    typeof item.catalogPriceInCents === "number"
      ? item.catalogPriceInCents
      : item.priceSource === "CATALOG"
      ? item.priceInCents
      : (item.catalogProduct as any)?.priceInCents;
  const [trackStock, setTrackStock] = useState(!!item.trackStock);
  const [stockQuantity, setStockQuantity] = useState((item.stockQuantity ?? 0).toString());
  const [active, setActive] = useState(epActive(item));
  const [soldOut, setSoldOut] = useState(!!item.soldOut);
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = async () => {
    if (!token) return;

    let priceInCents: number | null = null;
    if (priceMode === "EVENT") {
      const parsed = parseCurrencyToCents(price);
      if (parsed == null) {
        toast.error("Preço inválido");
        return;
      }
      priceInCents = parsed;
    }

    setSubmitting(true);
    const payload = {
      priceInCents, // null => usa o preço do catálogo
      active,
      trackStock,
      stockQuantity: parseInt(stockQuantity) || 0,
      soldOut,
    };
    try {
      const res = await updateEventCatalogProduct(token, eventId, item.id, payload);
      toast.success("Produto atualizado!");
      onSuccess(res);
    } catch (err) {
      handleApiError(err, "Erro ao atualizar produto.");
    } finally {
      setSubmitting(false);
    }
  };

  const name = epName(item);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Produto</DialogTitle>
          <DialogDescription>Ajuste as configurações do produto para este evento.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center gap-4 rounded-xl bg-muted/50 p-4 opacity-70">
            <ProductImage src={resolveAssetUrl(epImage(item))} alt={name} size="sm" />
            <div>
              <p className="font-bold">{name}</p>
              <p className="text-sm text-muted-foreground">
                {(item.catalogProduct as any)?.catalogCategory?.name || item.catalogProduct?.category?.name || item.product?.category?.name || "Sem categoria"}
              </p>
              <p className="text-[10px] text-muted-foreground italic mt-1">Campos globais não editáveis nesta tela</p>
            </div>

          </div>

          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border p-3">
              <Label>Preço do produto</Label>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="edit-price-mode"
                    className="mt-1"
                    checked={priceMode === "CATALOG"}
                    onChange={() => setPriceMode("CATALOG")}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Usar preço do catálogo</p>
                    <p className="text-xs text-muted-foreground">
                      Preço-base: {formatCurrencyFromCents(catalogBaseCents)}
                    </p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="edit-price-mode"
                    className="mt-1"
                    checked={priceMode === "EVENT"}
                    onChange={() => setPriceMode("EVENT")}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Preço específico deste evento</p>
                    {priceMode === "EVENT" && (
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="0,00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="mt-2"
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>


            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Produto Ativo</Label>
                <p className="text-xs text-muted-foreground">Visível no autoatendimento</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>Esgotado</Label>
                <p className="text-xs text-muted-foreground">Exibe badge "Esgotado"</p>
              </div>
              <Switch checked={soldOut} onCheckedChange={setSoldOut} />
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Controlar Estoque</Label>
                </div>
                <Switch checked={trackStock} onCheckedChange={setTrackStock} />
              </div>
              {trackStock && (
                <div className="pt-1">
                  <Label className="text-xs text-muted-foreground">Quantidade em estoque</Label>
                  <Input 
                    type="number" 
                    min="0"
                    value={stockQuantity} 
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleUpdate} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProductModal({ 
  item, 
  isOpen, 
  onClose, 
  eventId, 
  token, 
  onSuccess 
}: { 
  item: EventCatalogProduct, 
  isOpen: boolean, 
  onClose: () => void, 
  eventId: string, 
  token: string, 
  onSuccess: (deletedId: string) => void 
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleDelete = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await deleteEventCatalogProduct(token, eventId, item.id);
      toast.success("Produto removido do evento.");
      onSuccess(item.id);
    } catch (err) {
      handleApiError(err, "Erro ao remover produto.");
    } finally {
      setSubmitting(false);
    }
  };

  const name = epName(item);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
            <Trash2 className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center">Remover do Evento?</DialogTitle>
          <DialogDescription className="text-center">
            Você está prestes a remover o produto <strong>{name}</strong> apenas deste evento.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground mt-2">
          <p>O produto continuará existindo no seu catálogo global e poderá ser vinculado novamente a qualquer momento.</p>
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={submitting}>Cancelar</Button>
          <Button variant="destructive" onClick={handleDelete} className="flex-1" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sim, Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardPlaceholder({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Esta seção está sendo aprimorada.</CardDescription>
      </CardHeader>
      <CardContent className="flex h-40 flex-col items-center justify-center border-t text-muted-foreground">
        <Settings className="mb-2 h-8 w-8 opacity-20" />
        <p>Configurações avançadas em breve.</p>
      </CardContent>
    </Card>
  );
}
