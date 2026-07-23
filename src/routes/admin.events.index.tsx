import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import {
  Plus,
  Loader2,
  CalendarDays,
  AlertCircle,
  Settings,
  MoreVertical,
  Monitor,
  Tv,
  Receipt,
  DollarSign,
  Copy,
  ExternalLink,
  Power,
  ChevronRight,
  Search,
  Trash2,
  RotateCcw,
  Eye,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL, resolveAssetUrl } from "@/lib/auth";
import { getTotemUrl, getCallScreenUrl, openPublicUrl } from "@/lib/public-event-urls";
import { AdminLayout } from "@/components/admin-layout";
import {
  createEvent,
  listEvents,
  updateEvent,
  type EventItem,
  getEventMetrics,
  archiveEvent,
  restoreEvent,
  reopenEvent,
  deleteEvent,
} from "@/lib/events-api";
import { handleApiError, toFriendlyMessage } from "@/lib/api-error";
import { toast } from "sonner";
import { EventLogo } from "@/components/EventLogo";
import { formatCurrency } from "@/lib/utils";
import { useRequireModule } from "@/lib/require-module";
import { useOrganization } from "@/contexts/organization-context";

export const Route = createFileRoute("/admin/events/")({
  component: EventsPage,
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toDatetimeLocal(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateRange(start?: string, end?: string) {
  if (!start) return "Data não definida";
  const s = new Date(start);
  const startStr = s.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (!end) return startStr;
  const e = new Date(end);
  const endStr = e.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${startStr} - ${endStr}`;
}

function EventsPage() {
  useRequireModule(["EVENTS"]);
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const { organizationSlug } = useOrganization();
  
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !token) navigate({ to: "/admin/login" });
  }, [authLoading, token, navigate]);

  const {
    data: events = [],
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId,
  });
  const error = queryError ? handleApiError(queryError, "Não foi possível carregar os eventos.") : null;

  // Load metrics in background whenever events list refreshes
  useEffect(() => {
    if (!token || events.length === 0) return;
    events.forEach(async (ev) => {
      try {
        const m = await getEventMetrics(token, ev.id);
        setMetrics(prev => ({ ...prev, [ev.id]: m }));
      } catch (e) {
        console.error(`Failed to load metrics for event ${ev.id}`, e);
      }
    });
  }, [events, token]);

  const filteredEvents = useMemo(() => {
    let result = [...events];

    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(ev => 
        ev.name.toLowerCase().includes(q) || 
        ev.slug.toLowerCase().includes(q)
      );
    }

    // Status
    if (statusFilter !== "ALL") {
      result = result.filter(ev => {
        const isActive = ev.active === true && ev.closed === false;
        const isInactive = (ev.active === false || !ev.active) && ev.closed === false;
        const isClosed = ev.closed === true;

        if (statusFilter === "ACTIVE") return isActive;
        if (statusFilter === "INACTIVE") return isInactive;
        if (statusFilter === "CLOSED") return isClosed;
        return true;
      });
    }

    return result;
  }, [events, search, statusFilter]);


  const handleEventAction = async (action: string, event: EventItem) => {
    if (!token) return;
    try {
      let response;
      if (action === "ACTIVATE") response = await restoreEvent(token, event.id);
      else if (action === "DEACTIVATE") response = await archiveEvent(token, event.id);
      else if (action === "REOPEN") response = await reopenEvent(token, event.id);
      else if (action === "DELETE") response = await deleteEvent(token, event.id);
      else return;

      await queryClient.invalidateQueries({ queryKey: qk.events.list(orgId) });
      toast.success(`Ação '${action}' realizada com sucesso.`);
    } catch (err) {
      console.error("EVENT ACTION ERROR:", err);
      if (action === "DELETE" && String(err).includes("operational data")) {
        toast.error("Este evento possui dados operacionais e não pode ser excluído. Desative o evento para preservar o histórico.");
      } else {
        handleApiError(err, `Não foi possível realizar a ação ${action}.`);
      }
    }
  };

  const handleDuplicate = async (event: EventItem) => {
    if (!token) return;
    toast.info("Funcionalidade de duplicação sendo preparada...");
    // Future implementation: createEvent with partial data from current event
  };

  return (
    <AdminLayout
      title="Eventos"
      subtitle="Gerencie todos os eventos da sua organização"
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Plus className="h-4 w-4" />
              Novo evento
            </Button>
          </DialogTrigger>
          <NewEventDialog
            token={token}
              onCreated={(_ev) => {
              queryClient.invalidateQueries({ queryKey: qk.events.list(orgId) });
              setOpen(false);
            }}
          />
        </Dialog>
      }
    >
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-border bg-card/60"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState onNew={() => setOpen(true)} />
      ) : (
        <>
          <Card className="mb-6 shadow-sm">
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar evento pelo nome ou slug..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium uppercase text-muted-foreground">Status</label>
                  <select 
                    value={statusFilter} 
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="ALL">Todos os status</option>
                    <option value="ACTIVE">Ativo</option>
                    <option value="INACTIVE">Inativo</option>
                    <option value="CLOSED">Fechado</option>
                  </select>
                </div>

              </div>
            </CardContent>
          </Card>

          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              Nenhum evento encontrado com os filtros atuais.
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((ev) => (
                <EventCard 
                  key={ev.id} 
                  event={ev} 
                  organizationSlug={organizationSlug}
                  metrics={metrics[ev.id]}
                  onAction={(action) => handleEventAction(action, ev)}
                  onDuplicate={() => handleDuplicate(ev)}
                />
              ))}
            </div>
          )}
        </>
      )}

    </AdminLayout>
  );
}

function EventCard({ 
  event, 
  organizationSlug,
  metrics,
  onAction,
  onDuplicate
}: { 
  event: EventItem; 
  organizationSlug?: string | null;
  metrics?: any;
  onAction: (action: string) => void;
  onDuplicate: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const primary = event.primaryColor || "#6366f1";
  const secondary = event.secondaryColor || "#a855f7";
  
  const isActive = event.active === true && event.closed === false;
  const isInactive = (event.active === false || !event.active) && event.closed === false;
  const isClosed = event.closed === true;

  const isAdmin = user?.role === "SUPER_ADMIN" || user?.role === "ADMIN";
  const isSuperAdmin = user?.role === "SUPER_ADMIN";

  const statusLabel = isClosed ? "Fechado" : isInactive ? "Inativo" : "Ativo";
  const statusClassName = isClosed 
    ? "bg-red-500/10 text-red-600 border-red-500/20" 
    : isInactive 
    ? "text-muted-foreground border-muted-foreground/30" 
    : "bg-emerald-500 hover:bg-emerald-600 border-none text-white";

  const stats = [
    { label: "Pedidos", value: metrics?.totalOrders ?? metrics?.ordersCount ?? null, icon: Receipt },
    { label: "Receita", value: metrics?.totalRevenueInCents ? formatCurrency(metrics.totalRevenueInCents / 100) : null, icon: DollarSign },
  ];

  const pendingPayments = metrics?.ordersByStatus?.PENDING ?? metrics?.statusCounts?.PENDING ?? 0;

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: string;
    title: string;
    description: string;
    confirmText: string;
    requireName?: boolean;
    nameInput?: string;
  }>({
    open: false,
    action: "",
    title: "",
    description: "",
    confirmText: ""
  });

  const openModal = (action: string) => {
    if (action === "DEACTIVATE") {
      setConfirmModal({
        open: true,
        action,
        title: "Desativar evento?",
        description: "O evento ficará inativo e deixará de aceitar novos pedidos. Os dados, pedidos, pagamentos e relatórios serão mantidos.",
        confirmText: "Desativar"
      });
    } else if (action === "ACTIVATE") {
      setConfirmModal({
        open: true,
        action,
        title: "Ativar evento?",
        description: "O evento voltará a ficar ativo e disponível para operação.",
        confirmText: "Ativar"
      });
    } else if (action === "REOPEN") {
      setConfirmModal({
        open: true,
        action,
        title: "Reabrir evento?",
        description: "O fechamento será removido e o evento voltará a ficar ativo.",
        confirmText: "Reabrir evento"
      });
    } else if (action === "DELETE") {
      setConfirmModal({
        open: true,
        action,
        title: "Excluir evento definitivamente?",
        description: "Essa ação não poderá ser desfeita. Eventos com pedidos, pagamentos, impressões ou fechamento não podem ser excluídos.",
        confirmText: "Excluir",
        requireName: true,
        nameInput: ""
      });
    }
  };

  return (
    <Card className="group overflow-hidden border-border bg-card shadow-sm transition-all hover:shadow-md">
      <div
        className="relative h-28 cursor-pointer overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
        onClick={() => navigate({ to: "/admin/events/$id", params: { id: event.id } })}
      >
        <div className="absolute inset-0 bg-black/5 transition-opacity group-hover:bg-black/10" />
        
        {event.bannerUrl && (
          <img 
            src={resolveAssetUrl(event.bannerUrl)} 
            alt={event.name}
            className="absolute inset-0 h-full w-full object-cover opacity-30 mix-blend-overlay"
          />
        )}

        <Badge 
          className={`absolute top-3 right-3 shadow-sm ${statusClassName}`}
          variant={isActive ? "default" : "outline"}
        >
          {statusLabel}
        </Badge>
        
        <div className="absolute -bottom-6 left-5">
          <EventLogo src={event.logoUrl} alt={event.name} size="md" className="border-4 border-card shadow-md" />
        </div>
      </div>

      <CardContent className="px-5 pt-8 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div 
            className="min-w-0 flex-1 cursor-pointer"
            onClick={() => navigate({ to: "/admin/events/$id", params: { id: event.id } })}
          >
            <h3 className="truncate text-lg font-bold text-foreground" title={event.name}>
              {event.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">/{event.slug}</p>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {isActive && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/events/$id" params={{ id: event.id }} className="flex w-full items-center gap-2 font-medium">
                      <Settings className="h-4 w-4" /> Gerenciar
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const url = getTotemUrl(event.slug, organizationSlug);
                    if (!url) {
                      toast.error("Slug da organização não carregado. Não foi possível abrir o totem.");
                      return;
                    }
                    openPublicUrl(url);
                  }}>
                    <Monitor className="h-4 w-4" /> Abrir autoatendimento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const url = getCallScreenUrl(event.slug, organizationSlug);
                    openPublicUrl(url);
                  }}>
                    <Tv className="h-4 w-4" /> Tela de Chamada
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin/orders" search={{ eventId: event.id }} className="flex w-full items-center gap-2">
                      <Receipt className="h-4 w-4" /> Ver Pedidos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/financeiro" search={{ eventId: event.id }} className="flex w-full items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Ver Financeiro
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onDuplicate}>
                    <Copy className="h-4 w-4" /> Duplicar Evento
                  </DropdownMenuItem>
                  {(isAdmin || isSuperAdmin) && (
                    <DropdownMenuItem onClick={() => openModal("DEACTIVATE")} className="text-amber-600">
                      <Power className="h-4 w-4" /> Desativar evento
                    </DropdownMenuItem>
                  )}
                  {(isAdmin || isSuperAdmin) && (
                    <DropdownMenuItem onClick={() => openModal("DELETE")} className="text-destructive">
                      <Trash2 className="h-4 w-4" /> Excluir evento
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {isInactive && (
                <>
                  {(isAdmin || isSuperAdmin) && (
                    <DropdownMenuItem onClick={() => openModal("ACTIVATE")} className="font-medium text-emerald-600">
                      <Power className="h-4 w-4" /> Ativar evento
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link to="/admin/financeiro" search={{ eventId: event.id }} className="flex w-full items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Ver Financeiro
                    </Link>
                  </DropdownMenuItem>
                  {(isAdmin || isSuperAdmin) && (
                    <DropdownMenuItem onClick={() => openModal("DELETE")} className="text-destructive">
                      <Trash2 className="h-4 w-4" /> Excluir evento
                    </DropdownMenuItem>
                  )}
                </>
              )}

              {isClosed && (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/admin/financeiro" search={{ eventId: event.id, tab: "closing" }} className="flex w-full items-center gap-2 font-medium">
                      <Eye className="h-4 w-4" /> Ver fechamento
                    </Link>
                  </DropdownMenuItem>
                  {(isAdmin || isSuperAdmin) && (
                    <DropdownMenuItem onClick={() => openModal("REOPEN")} className="text-emerald-600">
                      <RotateCcw className="h-4 w-4" /> Reabrir evento
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          <span>{formatDateRange(event.startsAt, event.endsAt)}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border/50 py-3">
          {stats.map((stat, i) => (
            <div key={i} className="space-y-0.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <div className="flex items-center gap-1.5">
                <stat.icon className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-sm font-semibold">
                  {stat.value ?? <span className="text-[10px] font-normal text-muted-foreground/60 italic">N/A</span>}
                </span>
              </div>
            </div>
          ))}
        </div>

        {pendingPayments > 0 && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>{pendingPayments} pagamentos pendentes</span>
          </div>
        )}

        <div className="mt-4">
          <Button 
            variant="outline" 
            className="w-full justify-between font-medium group/btn"
            asChild
          >
            <Link to="/admin/events/$id" params={{ id: event.id }}>
              Gerenciar Evento
              <ChevronRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </Link>
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmModal.open} onOpenChange={(o) => setConfirmModal(prev => ({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmModal.title}</DialogTitle>
            <DialogDescription>{confirmModal.description}</DialogDescription>
          </DialogHeader>
          
          {confirmModal.requireName && (
            <div className="space-y-2 py-2">
              <p className="text-sm font-medium">Digite <span className="font-bold select-none">"{event.name}"</span> para confirmar:</p>
              <Input 
                value={confirmModal.nameInput}
                onChange={(e) => setConfirmModal(prev => ({ ...prev, nameInput: e.target.value }))}
                placeholder={event.name}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}>
              Cancelar
            </Button>
            <Button 
              variant={confirmModal.action === "DELETE" ? "destructive" : "default"}
              disabled={confirmModal.requireName && confirmModal.nameInput !== event.name}
              onClick={() => {
                onAction(confirmModal.action);
                setConfirmModal(prev => ({ ...prev, open: false }));
              }}
            >
              {confirmModal.confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
      <div
        className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <CalendarDays className="h-6 w-6" />
      </div>
      <h3 className="font-semibold text-foreground">Nenhum evento ainda</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Crie seu primeiro evento para começar a vender pelo totem.
      </p>
      <Button
        onClick={onNew}
        className="mt-5 text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        <Plus className="h-4 w-4" />
        Novo evento
      </Button>
    </div>
  );
}

function NewEventDialog({
  token,
  onCreated,
}: {
  token: string | null;
  onCreated: (ev: EventItem) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [primaryColor, setPrimaryColor] = useState("#6366f1");
  const [secondaryColor, setSecondaryColor] = useState("#a855f7");
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const [startsAt, setStartsAt] = useState(toDatetimeLocal(now));
  const [endsAt, setEndsAt] = useState(toDatetimeLocal(tomorrow));
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleName = (v: string) => {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErr(null);
    if (!name || !slug) {
      setErr("Preencha nome e slug");
      return;
    }
    setSubmitting(true);
    try {
      const ev = await createEvent(token, {
        name,
        slug,
        primaryColor,
        secondaryColor,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      onCreated(ev);
      toast.success("Evento criado com sucesso!");
    } catch (e2) {
      setErr(toFriendlyMessage(e2, "Não foi possível criar o evento."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Novo evento</DialogTitle>
        <DialogDescription>Configure as informações principais do evento.</DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="name">Nome</label>
          <input
            id="name"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={name}
            onChange={(e) => handleName(e.target.value)}
            placeholder="Festival de Verão 2025"
            disabled={submitting}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="slug">Slug</label>
          <input
            id="slug"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="festival-verao-2025"
            disabled={submitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            id="primary"
            label="Cor primária"
            value={primaryColor}
            onChange={setPrimaryColor}
            disabled={submitting}
          />
          <ColorField
            id="secondary"
            label="Cor secundária"
            value={secondaryColor}
            onChange={setSecondaryColor}
            disabled={submitting}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="startsAt">Início</label>
            <input
              id="startsAt"
              type="datetime-local"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor="endsAt">Término</label>
            <input
              id="endsAt"
              type="datetime-local"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              disabled={submitting}
            />
          </div>
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
              "Criar evento"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent p-0 overflow-hidden"
          aria-label={label}
        />
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono uppercase"
        />
      </div>
    </div>
  );
}
