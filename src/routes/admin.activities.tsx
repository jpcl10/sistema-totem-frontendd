import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Ban,
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit3,
  Image as ImageIcon,
  Inbox,
  LogIn,
  Monitor,
  Package,
  Printer,
  RefreshCw,
  Settings as SettingsIcon,
  ShoppingCart,
  Trash2,
  Undo2,
  UserPlus,
  XCircle,
  Eye,
  Search,
  User as UserIcon,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import { listEvents, type EventItem } from "@/lib/events-api";
import {
  listAuditLogs,
  maskSensitive,
  type AuditLog,
  type AuditLogQuery,
} from "@/lib/audit-logs-api";
import { useRequireModule } from "@/lib/require-module";

export const Route = createFileRoute("/admin/activities")({
  component: ActivitiesPage,
});

type PeriodKey = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";
type Tone =
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "info-soft"
  | "purple"
  | "neutral";

interface ActionMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: Tone;
}

const ACTION_META: Record<string, ActionMeta> = {
  ORDER_CREATED: { label: "Pedido criado", icon: ShoppingCart, tone: "info" },
  ORDER_UPDATED: { label: "Pedido atualizado", icon: Edit3, tone: "info-soft" },
  ORDER_CANCELLED: { label: "Pedido cancelado", icon: Ban, tone: "destructive" },
  PAYMENT_CREATED: { label: "Pagamento criado", icon: DollarSign, tone: "info" },
  PAYMENT_APPROVED: { label: "Pagamento aprovado", icon: CheckCircle2, tone: "success" },
  PAYMENT_EXPIRED: { label: "Pagamento expirado", icon: Clock, tone: "warning" },
  PAYMENT_REJECTED: { label: "Pagamento rejeitado", icon: XCircle, tone: "destructive" },
  PAYMENT_REFUNDED: { label: "Pagamento reembolsado", icon: Undo2, tone: "warning" },
  PAYMENT_MANUAL_MARKED: { label: "Pagamento manual", icon: DollarSign, tone: "default" },
  PRINT_JOB_CREATED: { label: "Impressão enfileirada", icon: Printer, tone: "purple" },
  PRINT_JOB_PRINTED: { label: "Impressão concluída", icon: Printer, tone: "success" },
  PRINT_JOB_ERROR: { label: "Erro de impressão", icon: AlertTriangle, tone: "destructive" },
  IMAGE_UPLOADED: { label: "Imagem enviada", icon: ImageIcon, tone: "purple" },
  DEVICE_CREATED: { label: "Dispositivo criado", icon: Monitor, tone: "info" },
  DEVICE_ACTIVATED: { label: "Dispositivo ativado", icon: Monitor, tone: "success" },
  DEVICE_REVOKED: { label: "Dispositivo revogado", icon: Ban, tone: "destructive" },
  EVENT_CREATED: { label: "Evento criado", icon: CalendarPlus, tone: "info" },
  EVENT_UPDATED: { label: "Evento atualizado", icon: SettingsIcon, tone: "info-soft" },
  EVENT_CLOSED: { label: "Evento encerrado", icon: Calendar, tone: "neutral" },
  PRODUCT_CREATED: { label: "Produto criado", icon: Package, tone: "info" },
  PRODUCT_UPDATED: { label: "Produto atualizado", icon: Package, tone: "info-soft" },
  PRODUCT_ACTIVATED: { label: "Produto ativado", icon: Package, tone: "success" },
  PRODUCT_DEACTIVATED: { label: "Produto desativado", icon: Ban, tone: "warning" },
  HALF_AND_HALF_ENABLED: { label: "Meio a meio ativado", icon: Package, tone: "success" },
  HALF_AND_HALF_DISABLED: { label: "Meio a meio desativado", icon: Package, tone: "warning" },
  FLAVOR_ELIGIBILITY_ENABLED: { label: "Sabor habilitado", icon: Package, tone: "success" },
  FLAVOR_ELIGIBILITY_DISABLED: { label: "Sabor desabilitado", icon: Package, tone: "warning" },
  PRODUCT_PRICE_CHANGED: { label: "Preço alterado", icon: DollarSign, tone: "warning" },
  PRODUCT_OPTION_CHANGED: { label: "Opção do produto alterada", icon: Package, tone: "info-soft" },
  STORE_FORCE_OPENED: { label: "Loja aberta manualmente", icon: CheckCircle2, tone: "success" },
  STORE_FORCE_CLOSED: { label: "Loja fechada manualmente", icon: Ban, tone: "destructive" },
  STORE_RETURNED_TO_AUTO: { label: "Loja voltou ao automático", icon: Clock, tone: "info" },
  STORE_AVAILABILITY_OVERRIDE_UPDATED: { label: "Status manual atualizado", icon: SettingsIcon, tone: "info-soft" },
  BUSINESS_HOURS_UPDATED: { label: "Horários alterados", icon: Clock, tone: "info-soft" },
  PAYMENT_SETTINGS_UPDATED: { label: "Pagamento configurado", icon: DollarSign, tone: "info-soft" },
  PAYMENT_PROVIDER_SETTINGS_UPDATED: { label: "Provedor configurado", icon: DollarSign, tone: "info-soft" },
  PAYMENT_PROVIDER_CONFIGURED: { label: "Provedor configurado", icon: DollarSign, tone: "info-soft" },
  PAYMENT_CREDENTIAL_UPDATED: { label: "Credencial atualizada", icon: DollarSign, tone: "warning" },
  EVENT_PRODUCT_CREATED: { label: "Produto no evento", icon: Package, tone: "info" },
  EVENT_PRODUCT_UPDATED: { label: "Produto/preço atualizado", icon: Package, tone: "info-soft" },
  EVENT_PRODUCT_DELETED: { label: "Produto removido", icon: Trash2, tone: "destructive" },
  USER_LOGGED_IN: { label: "Login realizado", icon: LogIn, tone: "success" },
  USER_CREATED: { label: "Usuário criado", icon: UserPlus, tone: "info" },
};

function metaFor(action: string): ActionMeta {
  return (
    ACTION_META[action] ?? { label: action, icon: Activity, tone: "default" }
  );
}

const TONE_CLASSES: Record<Tone, string> = {
  default: "bg-muted text-foreground",
  neutral: "bg-muted text-muted-foreground",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "info-soft": "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  purple: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
};

const BADGE_TONE_CLASSES: Record<Tone, string> = {
  default: "border-border bg-muted/60 text-foreground",
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  destructive: "border-destructive/20 bg-destructive/10 text-destructive",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "info-soft": "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  purple: "border-violet-500/20 bg-violet-500/10 text-violet-700 dark:text-violet-400",
};

const ENTITY_LABELS: Record<string, string> = {
  ORDER: "Pedido",
  PRODUCT: "Produto",
  EVENT: "Evento",
  DEVICE: "Dispositivo",
  PAYMENTTRANSACTION: "Pagamento",
  PAYMENT_TRANSACTION: "Pagamento",
  PAYMENT: "Pagamento",
  IMAGE: "Imagem",
  PRINTJOB: "Impressão",
  PRINT_JOB: "Impressão",
  USER: "Usuário",
  EVENTPRODUCT: "Produto do evento",
  EVENT_PRODUCT: "Produto do evento",
  CATALOGPRODUCT: "Produto do catálogo",
  CATALOG_PRODUCT: "Produto do catálogo",
  CATALOGPRODUCTOPTION: "Opção do produto",
  CATALOG_PRODUCT_OPTION: "Opção do produto",
  CATALOGPRODUCTOPTIONGROUP: "Grupo de opções",
  CATALOG_PRODUCT_OPTION_GROUP: "Grupo de opções",
  ONLINESTORE: "Loja online",
  ONLINE_STORE: "Loja online",
  ONLINESTORESETTINGS: "Configuração da loja",
  ONLINE_STORE_SETTINGS: "Configuração da loja",
  PAYMENTPROVIDERCREDENTIAL: "Credencial de pagamento",
  PAYMENT_PROVIDER_CREDENTIAL: "Credencial de pagamento",
  PAYMENTPROVIDERSETTINGS: "Provedor de pagamento",
  PAYMENT_PROVIDER_SETTINGS: "Provedor de pagamento",
};

function translateEntity(entity?: string | null): string | null {
  if (!entity) return null;
  const key = entity.toUpperCase().replace(/[\s-]/g, "_");
  return ENTITY_LABELS[key] ?? ENTITY_LABELS[entity.toUpperCase()] ?? entity;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime();
  if (!d) return "";
  const diff = Date.now() - d;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} ${m === 1 ? "minuto" : "minutos"} atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hora" : "horas"} atrás`;
  const days = Math.floor(h / 24);
  return `${days} ${days === 1 ? "dia" : "dias"} atrás`;
}

function periodToDates(period: PeriodKey): { startDate?: string; endDate?: string } {
  if (period === "all" || period === "custom") return {};
  const start = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (period === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (period === "yesterday") {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setTime(start.getTime());
    end.setHours(23, 59, 59, 999);
  } else if (period === "7d") {
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
  } else if (period === "30d") {
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return { startDate: start.toISOString(), endDate: end.toISOString() };
}

const LIMIT = 25;

function ActivitiesPage() {
  useRequireModule(["EVENTS"]);
  const { token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const orgId = useOrgId();

  const [eventId, setEventId] = useState<string>("all");

  // filters
  const [page, setPage] = useState(1);
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [deviceFilter, setDeviceFilter] = useState<string>("");

  const [selected, setSelected] = useState<AuditLog | null>(null);

  useEffect(() => {
    if (!authLoading && !token) navigate({ to: "/admin/login" });
  }, [authLoading, token, navigate]);

  const eventsQuery = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId,
  });
  const events: EventItem[] = eventsQuery.data ?? [];

  const query: AuditLogQuery = useMemo(() => {
    const dates =
      period === "custom"
        ? {
            startDate: customStart ? new Date(customStart).toISOString() : undefined,
            endDate: customEnd ? new Date(customEnd).toISOString() : undefined,
          }
        : periodToDates(period);
    return {
      page,
      limit: LIMIT,
      action: actionFilter !== "all" ? actionFilter : undefined,
      entity: entityFilter.trim() || undefined,
      userId: userFilter.trim() || undefined,
      deviceId: deviceFilter.trim() || undefined,
      eventId: eventId !== "all" ? eventId : undefined,
      ...dates,
    };
  }, [page, period, customStart, customEnd, actionFilter, entityFilter, userFilter, deviceFilter, eventId]);

  const logsQuery = useQuery({
    queryKey: qk.activities.list(orgId, { eventId, ...query }),
    queryFn: () => listAuditLogs(token!, undefined, query),
    enabled: !!token && !!orgId,
    placeholderData: (prev) => prev,
  });

  const logs: AuditLog[] = useMemo(
    () => logsQuery.data?.data ?? [],
    [logsQuery.data?.data],
  );
  const totalPages = logsQuery.data?.totalPages ?? 1;
  const total = logsQuery.data?.total ?? 0;
  const loading = logsQuery.isFetching;
  const error =
    logsQuery.error
      ? handleApiError(logsQuery.error, "Não foi possível carregar as atividades.", { silent: true })
      : eventsQuery.error
        ? handleApiError(eventsQuery.error, "Não foi possível carregar os eventos.", { silent: true })
        : null;
  const load = () => logsQuery.refetch();

  useEffect(() => {
    setPage(1);
  }, [period, customStart, customEnd, actionFilter, entityFilter, userFilter, deviceFilter, eventId]);

  const actionOptions = useMemo(() => {
    const known = Object.keys(ACTION_META);
    const fromData = Array.from(new Set(logs.map((l) => l.action)));
    return Array.from(new Set([...known, ...fromData])).sort();
  }, [logs]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (period !== "all") n++;
    if (actionFilter !== "all") n++;
    if (entityFilter.trim()) n++;
    if (userFilter.trim()) n++;
    if (deviceFilter.trim()) n++;
    return n;
  }, [period, actionFilter, entityFilter, userFilter, deviceFilter]);

  const clearFilters = () => {
    setPeriod("all");
    setCustomStart("");
    setCustomEnd("");
    setActionFilter("all");
    setEntityFilter("");
    setUserFilter("");
    setDeviceFilter("");
  };

  return (
    <AdminLayout
      title="Atividades"
      subtitle="Histórico operacional da organização: pedidos, pagamentos, impressões, produtos, loja online e alterações administrativas."
      actions={
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      {/* Filters */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Filtros</h3>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {activeFilterCount} ativo{activeFilterCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8">
              <X className="mr-1.5 h-3.5 w-3.5" />
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Evento</label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os eventos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os eventos</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="yesterday">Ontem</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ação</label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas</SelectItem>
                {actionOptions.map((a) => (
                  <SelectItem key={a} value={a}>
                    {metaFor(a).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Entidade</label>
            <Input
              placeholder="ex: Order, Product"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Usuário (ID)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="userId"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Dispositivo (ID)</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="deviceId"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
              />
            </div>
          </div>

          {period === "custom" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Início</label>
                <Input
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Fim</label>
                <Input
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-4 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
              <Inbox className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Nenhuma atividade encontrada
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhuma atividade encontrada para os filtros selecionados.
              </p>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <ol className="relative">
            {logs.map((log, idx) => {
              const meta = metaFor(log.action);
              const Icon = meta.icon;
              const entityLabel = translateEntity(log.entity);
              const isLast = idx === logs.length - 1;
              return (
                <li
                  key={log.id}
                  className="group relative flex items-start gap-4 px-4 py-4 transition-colors hover:bg-muted/30 sm:px-5"
                >
                  {/* Timeline rail */}
                  {!isLast && (
                    <span
                      className="absolute left-[2.05rem] top-14 bottom-0 w-px bg-border sm:left-[2.3rem]"
                      aria-hidden
                    />
                  )}

                  <div
                    className={`relative z-10 mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-card ${TONE_CLASSES[meta.tone]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{meta.label}</span>
                      {entityLabel && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-medium ${BADGE_TONE_CLASSES[meta.tone]}`}
                        >
                          {entityLabel}
                        </Badge>
                      )}
                    </div>

                    {log.description && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {log.description}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span
                        title={formatDateTime(log.createdAt)}
                        className="inline-flex items-center gap-1"
                      >
                        <Clock className="h-3 w-3" />
                        {formatDateTime(log.createdAt)}
                        <span className="text-muted-foreground/60">·</span>
                        <span>{relativeTime(log.createdAt)}</span>
                      </span>
                      {log.user?.name && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-3 w-3" />
                          {log.user.name}
                        </span>
                      )}
                      {!log.user?.name && log.userId && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <UserIcon className="h-3 w-3" />
                          {log.userId.slice(0, 8)}…
                        </span>
                      )}
                      {log.device?.name && (
                        <span className="inline-flex items-center gap-1">
                          <Monitor className="h-3 w-3" />
                          {log.device.name}
                        </span>
                      )}
                      {!log.device?.name && log.deviceId && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <Monitor className="h-3 w-3" />
                          {log.deviceId.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 opacity-70 group-hover:opacity-100"
                    onClick={() => setSelected(log)}
                  >
                    <Eye className="mr-1.5 h-4 w-4" />
                    <span className="hidden sm:inline">Ver detalhes</span>
                  </Button>
                </li>
              );
            })}
          </ol>
        )}

        {/* Pagination */}
        {!loading && !error && logs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
            <span className="text-muted-foreground">
              Página {page} de {totalPages} · {total} {total === 1 ? "registro" : "registros"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selected && (() => {
                const m = metaFor(selected.action);
                const Icon = m.icon;
                return (
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${TONE_CLASSES[m.tone]}`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                );
              })()}
              {selected ? metaFor(selected.action).label : "Detalhes"}
            </DialogTitle>
            <DialogDescription>
              {selected ? (
                <>
                  {selected.description ? `${selected.description} · ` : ""}
                  {formatDateTime(selected.createdAt)}
                </>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-5 text-sm">
              <Section title="Informações gerais">
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <DetailRow label="Ação" value={selected.action} mono />
                  <DetailRow
                    label="Entidade"
                    value={translateEntity(selected.entity) ?? "—"}
                  />
                  <DetailRow label="Entity ID" value={selected.entityId ?? "—"} mono />
                  <DetailRow label="Data/Hora" value={formatDateTime(selected.createdAt)} />
                  <DetailRow label="ID do log" value={selected.id} mono />
                </dl>
              </Section>

              {(selected.user?.name || selected.user?.email || selected.userId) && (
                <Section title="Usuário">
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DetailRow label="Nome" value={selected.user?.name ?? "—"} />
                    <DetailRow label="E-mail" value={selected.user?.email ?? "—"} />
                    {selected.userId && (
                      <DetailRow label="ID" value={selected.userId} mono />
                    )}
                  </dl>
                </Section>
              )}

              {(selected.device?.name || selected.device?.type || selected.deviceId) && (
                <Section title="Dispositivo">
                  <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <DetailRow label="Nome" value={selected.device?.name ?? "—"} />
                    <DetailRow label="Tipo" value={selected.device?.type ?? "—"} />
                    {selected.deviceId && (
                      <DetailRow label="ID" value={selected.deviceId} mono />
                    )}
                  </dl>
                </Section>
              )}

              <Section title="Metadata">
                <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed">
                  {JSON.stringify(maskSensitive(selected.metadata ?? {}), null, 2)}
                </pre>
              </Section>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 break-all text-sm text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}
