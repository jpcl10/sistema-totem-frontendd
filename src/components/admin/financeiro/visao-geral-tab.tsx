import { useEffect, useMemo, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  DollarSign,
  Wallet,
  ShoppingCart,
  CheckCircle2,
  Clock,
  Ban,
  Receipt,
  TrendingUp,
  Loader2,
  Store,
  CalendarDays,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";

import {
  getGlobalFinancialSummary,
  type FinancialSummary,
  type EventItem,
  type FinancialTimeseries,
} from "@/lib/events-api";
import {
  listUnifiedOrders,
  type UnifiedOrderDTO,
  type UnifiedOrderFilters,
} from "@/lib/orders-api";
import { listOnlineStores, type OnlineStore } from "@/lib/online-store-api";
import { unifiedToKanbanOrder } from "@/components/admin/orders/unified-adapter";
import { OrderDetailsDrawer } from "@/components/admin/orders/order-details-drawer";
import { handleApiError } from "@/lib/api-error";
import {
  FINANCIAL_PERIOD_OPTIONS,
  buildFinancialPeriodParams,
  formatTimeseriesLabel,
  resolveOrgTimezone,
  type FinancialPeriodKey,
} from "@/lib/financial-period";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from "recharts";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useOrganization } from "@/contexts/organization-context";


// ────────────────────────── helpers ──────────────────────────

function formatCurrency(cents?: number | null) {
  if (cents == null || Number.isNaN(cents)) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

/** Start-of-day / end-of-day in the browser's local tz (assumed as org tz). */
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
const PERIOD_OPTIONS = FINANCIAL_PERIOD_OPTIONS;
type PeriodKey = FinancialPeriodKey;

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  PIX_MANUAL: "PIX manual",
  PIX_AUTOMATIC: "PIX automático",
  PIX: "PIX",
  NFC_BALANCE: "Saldo NFC",
  CASH: "Dinheiro",
  CREDIT_CARD: "Crédito",
  DEBIT_CARD: "Débito",
  COURTESY: "Cortesia",
  OTHER: "Outro",
};
const PAYMENT_METHOD_OPTIONS = Object.keys(PAYMENT_METHOD_LABEL);

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: "Pago",
  PENDING: "Pendente",
  FAILED: "Falha",
  CANCELLED: "Cancelado",
  REFUNDED: "Estornado",
  NOT_REQUIRED: "Não obrigatório",
};
const PAYMENT_STATUS_OPTIONS = Object.keys(PAYMENT_STATUS_LABEL);

const SOURCE_LABEL: Record<string, string> = {
  ONLINE: "Online",
  TOTEM: "Totem",
  EVENT: "Evento",
  POS: "POS",
  COMANDA: "Comanda",
  QR_MESA: "QR Mesa",
  GARCOM_MOBILE: "Garçom",
  API: "API",
  WHATSAPP: "WhatsApp",
  DIGITAL_MENU: "Cardápio digital",
  ADMIN: "Admin",
};
const SOURCE_OPTIONS = Object.keys(SOURCE_LABEL);

const ORDER_TYPE_LABEL: Record<string, string> = {
  EVENT_ORDER: "Pedido de evento",
  ONLINE_ORDER: "Pedido online",
};
const ORDER_TYPE_OPTIONS = Object.keys(ORDER_TYPE_LABEL);

const FULFILLMENT_LABEL: Record<string, string> = {
  DELIVERY: "Entrega",
  PICKUP: "Retirada",
  DINE_IN: "No local",
  COUNTER: "Balcão",
};
const FULFILLMENT_OPTIONS = Object.keys(FULFILLMENT_LABEL);

const STATUS_LABEL: Record<string, string> = {
  NEW: "Novo",
  CONFIRMED: "Confirmado",
  PREPARING: "Preparando",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu p/ entrega",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
};

const SORT_OPTIONS: {
  value: NonNullable<UnifiedOrderFilters["sortBy"]>;
  label: string;
}[] = [
  { value: "paidAt", label: "Pago em" },
  { value: "createdAt", label: "Criado em" },
  { value: "totalInCents", label: "Valor" },
  { value: "orderNumber", label: "Nº do pedido" },
];

// ────────────────────────── types ──────────────────────────

export interface FinanceiroFilters {
  period: PeriodKey;
  customStart: string; // yyyy-mm-dd
  customEnd: string;
  eventId: string;
  storeId: string;
  paymentMethod: string;
  paymentStatus: string;
  source: string;
  orderType: string;
  fulfillmentType: string;
  sortBy: NonNullable<UnifiedOrderFilters["sortBy"]>;
  sortOrder: NonNullable<UnifiedOrderFilters["sortOrder"]>;
}

const DEFAULT_FILTERS: FinanceiroFilters = {
  period: "TODAY",
  customStart: "",
  customEnd: "",
  eventId: "",
  storeId: "",
  paymentMethod: "",
  paymentStatus: "",
  source: "",
  orderType: "",
  fulfillmentType: "",
  sortBy: "paidAt",
  sortOrder: "desc",
};

const ALL_VALUE = "__all__";
const PAGE_SIZE = 50;

// ────────────────────────── main ──────────────────────────

export function VisaoGeralTab({
  token,
  events,
}: {
  token: string;
  events: EventItem[];
}) {
  const { organizationId } = useOrganization();
  const [filters, setFilters] = useState<FinanceiroFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [detailsOrder, setDetailsOrder] = useState<UnifiedOrderDTO | null>(null);
  const navigate = useNavigate();

  const periodParams = useMemo(
    () =>
      buildFinancialPeriodParams(
        filters.period,
        filters.customStart,
        filters.customEnd,
      ),
    [filters.period, filters.customStart, filters.customEnd],
  );

  const storesQuery = useQuery<OnlineStore[]>({
    queryKey: ["financeiro", organizationId, "stores"],
    queryFn: () => listOnlineStores(token),
    enabled: !!token && !!organizationId,
    staleTime: 60_000,
  });

  // Reset page when any filter changes.
  useEffect(() => {
    setPage(1);
  }, [
    filters.period,
    filters.customStart,
    filters.customEnd,
    filters.eventId,
    filters.storeId,
    filters.paymentMethod,
    filters.paymentStatus,
    filters.source,
    filters.orderType,
    filters.fulfillmentType,
    filters.sortBy,
    filters.sortOrder,
  ]);

  const summaryParams = useMemo<Record<string, string | undefined>>(() => {
    return {
      period: periodParams.period,
      startDate: periodParams.startDate,
      endDate: periodParams.endDate,
      eventId: filters.eventId || undefined,
      storeId: filters.storeId || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      source: filters.source || undefined,
      orderType: filters.orderType || undefined,
      fulfillmentType: filters.fulfillmentType || undefined,
    };
  }, [filters, periodParams]);

  const summaryQuery = useQuery<FinancialSummary>({
    queryKey: ["financeiro", organizationId, "summary", summaryParams],
    queryFn: () => getGlobalFinancialSummary(token, summaryParams),
    enabled: !!token && !!organizationId,
    staleTime: 15_000,
  });

  // Reuse the range resolved by the backend (in the org timezone) to filter
  // the unified orders table — this keeps the table consistent with the
  // cards and the chart without recomputing dates on the client.
  const resolvedRange = {
    startDate: summaryQuery.data?.summary?.period?.startDate,
    endDate: summaryQuery.data?.summary?.period?.endDate,
  };

  const ordersFilters = useMemo<UnifiedOrderFilters>(() => {
    const f: UnifiedOrderFilters = {
      page,
      limit: PAGE_SIZE,
      dateField: "paidAt",
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    };
    if (resolvedRange.startDate) f.startDate = resolvedRange.startDate;
    if (resolvedRange.endDate) f.endDate = resolvedRange.endDate;
    if (filters.eventId) f.eventId = filters.eventId;
    if (filters.storeId) f.storeId = filters.storeId;
    if (filters.paymentMethod) f.paymentMethod = filters.paymentMethod;
    if (filters.paymentStatus) f.paymentStatus = filters.paymentStatus;
    if (filters.source) f.source = filters.source;
    if (filters.orderType) f.orderType = filters.orderType;
    if (filters.fulfillmentType) f.fulfillmentType = filters.fulfillmentType;
    return f;
  }, [filters, resolvedRange.startDate, resolvedRange.endDate, page]);

  const ordersQuery = useQuery({
    queryKey: ["financeiro", organizationId, "orders-unified", ordersFilters],
    queryFn: () => listUnifiedOrders(token, ordersFilters),
    enabled: !!token && !!organizationId && !!resolvedRange.startDate,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });


  const stats = summaryQuery.data?.summary;
  const stores = storesQuery.data ?? [];
  const orders = ordersQuery.data?.data ?? [];
  const totalPages =
    ordersQuery.data?.totalPages ??
    (ordersQuery.data?.total && ordersQuery.data?.limit
      ? Math.max(1, Math.ceil(ordersQuery.data.total / ordersQuery.data.limit))
      : undefined);
  const totalOrders = ordersQuery.data?.total;

  const setFilter = <K extends keyof FinanceiroFilters>(
    key: K,
    value: FinanceiroFilters[K],
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  const resetFilters = () => setFilters(DEFAULT_FILTERS);

  const activeFilterCount = [
    filters.eventId,
    filters.storeId,
    filters.paymentMethod,
    filters.paymentStatus,
    filters.source,
    filters.orderType,
    filters.fulfillmentType,
  ].filter(Boolean).length;

  const gross =
    stats?.grossRevenueInCents ?? stats?.grossTotalInCents;
  const net = stats?.netRevenueInCents ?? stats?.netTotalInCents;
  const paidCount = stats?.paidOrdersCount ?? stats?.paidOrders;
  const pendingCount = stats?.pendingOrdersCount ?? stats?.pendingOrders;
  const canceledCount = stats?.canceledOrdersCount ?? stats?.cancelledOrders;
  const avgTicket = stats?.averageTicketInCents;
  const netEqualsGross =
    typeof gross === "number" && typeof net === "number" && gross === net;
  const limitations = Array.isArray(stats?.limitations)
    ? (stats?.limitations as string[])
    : undefined;

  const timezone = resolveOrgTimezone(stats?.period?.timezone);
  const timeseries = stats?.timeseries as FinancialTimeseries | undefined;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <FilterSelect
            label="Período"
            value={filters.period}
            onChange={(v) => setFilter("period", v as PeriodKey)}
            options={PERIOD_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            allowClear={false}
          />
          {filters.period === "CUSTOM" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">De</label>
                <Input
                  type="date"
                  value={filters.customStart}
                  onChange={(e) => setFilter("customStart", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Até</label>
                <Input
                  type="date"
                  value={filters.customEnd}
                  onChange={(e) => setFilter("customEnd", e.target.value)}
                />
              </div>
            </>
          )}
          <FilterSelect
            label="Evento"
            value={filters.eventId}
            onChange={(v) => setFilter("eventId", v)}
            options={[
              { value: "", label: "Todos os eventos" },
              ...events.map((e) => ({ value: e.id, label: e.name })),
            ]}
          />
          <FilterSelect
            label="Loja"
            value={filters.storeId}
            onChange={(v) => setFilter("storeId", v)}
            options={[
              { value: "", label: "Todas as lojas" },
              ...stores.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <FilterSelect
            label="Tipo de pedido"
            value={filters.orderType}
            onChange={(v) => setFilter("orderType", v)}
            options={[
              { value: "", label: "Todos os tipos" },
              ...ORDER_TYPE_OPTIONS.map((v) => ({
                value: v,
                label: ORDER_TYPE_LABEL[v],
              })),
            ]}
          />
          <FilterSelect
            label="Origem"
            value={filters.source}
            onChange={(v) => setFilter("source", v)}
            options={[
              { value: "", label: "Todas as origens" },
              ...SOURCE_OPTIONS.map((v) => ({
                value: v,
                label: SOURCE_LABEL[v],
              })),
            ]}
          />
          <FilterSelect
            label="Método de pagamento"
            value={filters.paymentMethod}
            onChange={(v) => setFilter("paymentMethod", v)}
            options={[
              { value: "", label: "Todos os métodos" },
              ...PAYMENT_METHOD_OPTIONS.map((v) => ({
                value: v,
                label: PAYMENT_METHOD_LABEL[v],
              })),
            ]}
          />
          <FilterSelect
            label="Status de pagamento"
            value={filters.paymentStatus}
            onChange={(v) => setFilter("paymentStatus", v)}
            options={[
              { value: "", label: "Todos os status" },
              ...PAYMENT_STATUS_OPTIONS.map((v) => ({
                value: v,
                label: PAYMENT_STATUS_LABEL[v],
              })),
            ]}
          />
          <FilterSelect
            label="Atendimento"
            value={filters.fulfillmentType}
            onChange={(v) => setFilter("fulfillmentType", v)}
            options={[
              { value: "", label: "Todos" },
              ...FULFILLMENT_OPTIONS.map((v) => ({
                value: v,
                label: FULFILLMENT_LABEL[v],
              })),
            ]}
          />
          <FilterSelect
            label="Ordenar por"
            value={filters.sortBy}
            onChange={(v) =>
              setFilter("sortBy", v as FinanceiroFilters["sortBy"])
            }
            options={SORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            allowClear={false}
          />
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="w-full"
            >
              Limpar filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>

      {summaryQuery.isError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {handleApiError(
            summaryQuery.error,
            "Não foi possível carregar o resumo financeiro.",
            { silent: true },
          )}
        </div>
      )}

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Receita bruta"
          value={formatCurrency(gross)}
          icon={DollarSign}
          color="primary"
          loading={summaryQuery.isLoading}
        />
        <StatCard
          label="Receita líquida"
          value={formatCurrency(net)}
          icon={TrendingUp}
          color="emerald"
          loading={summaryQuery.isLoading}
          tooltip={
            netEqualsGross
              ? "Receita líquida igual à bruta — o backend ainda não deduz taxas para este escopo."
              : undefined
          }
        />
        <StatCard
          label="Pedidos pagos"
          value={String(paidCount ?? 0)}
          hint={
            stats?.paidTotalInCents != null || stats?.grossRevenueInCents != null
              ? formatCurrency(stats?.paidTotalInCents ?? stats?.grossRevenueInCents)
              : undefined
          }
          icon={CheckCircle2}
          color="emerald"
          loading={summaryQuery.isLoading}
        />
        <StatCard
          label="Pendentes"
          value={String(pendingCount ?? 0)}
          hint={
            stats?.pendingTotalInCents != null
              ? formatCurrency(stats?.pendingTotalInCents)
              : undefined
          }
          icon={Clock}
          color="amber"
          loading={summaryQuery.isLoading}
        />
        <StatCard
          label="Cancelados"
          value={String(canceledCount ?? 0)}
          hint={
            stats?.cancelledTotalInCents != null
              ? formatCurrency(stats?.cancelledTotalInCents)
              : undefined
          }
          icon={Ban}
          loading={summaryQuery.isLoading}
        />

        <StatCard
          label="Ticket médio"
          value={formatCurrency(avgTicket)}
          icon={Receipt}
          loading={summaryQuery.isLoading}
        />
      </div>

      {limitations && limitations.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex gap-2">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <ul className="space-y-0.5">
            {limitations.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Distribuição */}
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
        <DistributionCard
          title="Por forma de pagamento"
          icon={Wallet}
          data={stats?.byPaymentMethod}
          counts={stats?.ordersCountByPaymentMethod}
          labelMap={PAYMENT_METHOD_LABEL}
          totalOverride={gross}
          loading={summaryQuery.isLoading}
        />
        <DistributionCard
          title="Por origem"
          icon={Store}
          data={stats?.bySource}
          counts={stats?.ordersCountBySource}
          labelMap={SOURCE_LABEL}
          totalOverride={gross}
          loading={summaryQuery.isLoading}
        />
        <DistributionCard
          title="Por tipo de pedido"
          icon={CalendarDays}
          data={stats?.byOrderType}
          counts={stats?.ordersCountByOrderType}
          labelMap={ORDER_TYPE_LABEL}
          totalOverride={gross}
          loading={summaryQuery.isLoading}
        />
        <DistributionCard
          title="Por atendimento"
          icon={ShoppingCart}
          data={stats?.byFulfillmentType}
          labelMap={FULFILLMENT_LABEL}
          totalOverride={gross}
          loading={summaryQuery.isLoading}
        />
      </div>

      {/* Evolução da receita */}
      <RevenueTimeseriesChart
        timeseries={timeseries}
        timezone={timezone}
        loading={summaryQuery.isLoading}
        hasError={summaryQuery.isError}
      />


      {/* Tabela */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-foreground">Pedidos</h3>
            <p className="text-xs text-muted-foreground">
              {ordersQuery.isLoading
                ? "Carregando…"
                : totalOrders != null
                  ? `${totalOrders} pedidos no filtro`
                  : `${orders.length} pedidos`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate({ to: "/admin/orders" })}
            className="gap-2"
          >
            Central de pedidos
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {ordersQuery.isError && (
          <div className="p-4 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">
            {handleApiError(
              ordersQuery.error,
              "Não foi possível carregar os pedidos.",
              { silent: true },
            )}
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Atendimento</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Pago em</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersQuery.isLoading && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                    Carregando pedidos…
                  </TableCell>
                </TableRow>
              )}
              {!ordersQuery.isLoading && orders.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-12 text-center text-muted-foreground"
                  >
                    Nenhum pedido encontrado para os filtros aplicados.
                  </TableCell>
                </TableRow>
              )}
              {orders.map((o) => {
                const method = (o.payment?.method ?? "").toUpperCase();
                const payStatus = (o.payment?.status ?? "").toUpperCase();
                const status = (o.status ?? "").toUpperCase();
                const fulfillmentType = (
                  o.fulfillmentDetails?.type ??
                  o.fulfillment?.type ??
                  ""
                )
                  .toString()
                  .toUpperCase();
                const orderTypeLabel =
                  ORDER_TYPE_LABEL[String(o.orderType ?? "").toUpperCase()] ??
                  "—";
                return (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => setDetailsOrder(o)}
                  >
                    <TableCell className="font-mono text-xs">
                      #{o.number ?? o.code ?? o.id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{o.customer?.name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {SOURCE_LABEL[o.origin] ?? o.origin ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{orderTypeLabel}</TableCell>
                    <TableCell className="text-xs">
                      {fulfillmentType
                        ? FULFILLMENT_LABEL[fulfillmentType] ?? fulfillmentType
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {method ? PAYMENT_METHOD_LABEL[method] ?? method : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs">
                          {STATUS_LABEL[status] ?? status ?? "—"}
                        </span>
                        {payStatus && (
                          <Badge
                            variant={
                              payStatus === "PAID"
                                ? "default"
                                : payStatus === "PENDING"
                                  ? "secondary"
                                  : "outline"
                            }
                            className="w-fit text-[10px]"
                          >
                            {PAYMENT_STATUS_LABEL[payStatus] ?? payStatus}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(o.totalInCents)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(o.payment?.paidAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailsOrder(o);
                        }}
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Paginação server-side */}
        <div className="flex items-center justify-between p-3 border-t border-border text-xs text-muted-foreground">
          <div>
            Página <span className="font-medium text-foreground">{page}</span>
            {totalPages ? ` de ${totalPages}` : ""}
            {typeof filters.sortBy === "string" && (
              <span className="ml-2 opacity-70">
                · ordenado por {SORT_OPTIONS.find((s) => s.value === filters.sortBy)?.label}
                {" "}
                ({filters.sortOrder})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || ordersQuery.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={
                ordersQuery.isFetching ||
                (typeof totalPages === "number" && page >= totalPages) ||
                (totalPages == null && orders.length < PAGE_SIZE)
              }
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setFilter(
                  "sortOrder",
                  filters.sortOrder === "asc" ? "desc" : "asc",
                )
              }
            >
              {filters.sortOrder === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
        </div>
      </div>

      <OrderDetailsDrawer
        open={!!detailsOrder}
        onOpenChange={(v) => !v && setDetailsOrder(null)}
        order={detailsOrder ? unifiedToKanbanOrder(detailsOrder) : null}
        busy={false}
        onAdvance={() => {
          if (detailsOrder) {
            setDetailsOrder(null);
            navigate({ to: "/admin/orders" });
          }
        }}
        onConfirmPayment={() => {
          if (detailsOrder) {
            setDetailsOrder(null);
            navigate({ to: "/admin/orders" });
          }
        }}
        onCancel={() => {
          if (detailsOrder) {
            setDetailsOrder(null);
            navigate({ to: "/admin/orders" });
          }
        }}
      />
    </div>
  );
}

// ────────────────────────── subcomponents ──────────────────────────

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allowClear = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allowClear?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value === "" ? ALL_VALUE : value}
        onValueChange={(v) => onChange(v === ALL_VALUE ? "" : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem
              key={o.value || ALL_VALUE}
              value={o.value === "" ? ALL_VALUE : o.value}
            >
              {o.label}
            </SelectItem>
          ))}
          {allowClear ? null : null}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  color,
  loading,
  tooltip,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: "emerald" | "amber" | "primary";
  loading?: boolean;
  tooltip?: string;
}) {
  const colors: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    primary: "bg-primary/10 text-primary border-primary/20",
  };
  const cls =
    (color && colors[color]) || "bg-muted text-muted-foreground border-border";
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-xl border ${cls}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex items-center gap-1">
          {tooltip && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {loading && (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tracking-tight text-foreground mt-0.5">
        {value}
      </p>
      {hint && (
        <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
      )}
    </div>
  );
}

function DistributionCard({
  title,
  icon: Icon,
  data,
  counts,
  labelMap,
  totalOverride,
  loading,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data?: Record<string, number>;
  counts?: Record<string, number>;
  labelMap: Record<string, string>;
  totalOverride?: number;
  loading?: boolean;
}) {
  const entries = Object.entries(data ?? {})
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => (b[1] as number) - (a[1] as number));

  // Total for percentage bars: prefer backend gross total when available,
  // otherwise fall back to the largest entry so bars remain visually scaled.
  // We never expose this number as revenue — it's only used to size bars.
  const barTotal =
    typeof totalOverride === "number" && totalOverride > 0
      ? totalOverride
      : entries[0]?.[1] ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        {loading && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem dados no período.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => {
            const pct =
              barTotal > 0
                ? Math.min(100, Math.round(((value as number) / barTotal) * 100))
                : 0;
            const c = counts?.[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">
                    {labelMap[key] ?? key}
                    {typeof c === "number" && (
                      <span className="ml-1 opacity-70">· {c}</span>
                    )}
                  </span>
                  <span className="font-semibold text-foreground">
                    {formatCurrency(value as number)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ────────────────────────── revenue timeseries ──────────────────────────

function RevenueTimeseriesChart({
  timeseries,
  timezone,
  loading,
  hasError,
}: {
  timeseries?: FinancialTimeseries;
  timezone: string;
  loading?: boolean;
  hasError?: boolean;
}) {
  const points = timeseries?.points ?? [];
  const granularity = timeseries?.granularity ?? "DAY";
  const chartData = points.map((p) => ({
    ...p,
    labelX: formatTimeseriesLabel(p.periodStart, granularity, timezone),
  }));
  const hasAny = chartData.some((p) => p.grossRevenueInCents > 0);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-foreground">Evolução da receita</h3>
          <p className="text-xs text-muted-foreground">
            Baseado em <code>paidAt</code>
          </p>
        </div>
        <Badge variant="outline" className="text-[11px] font-normal">
          Horários em {timezone}
        </Badge>
      </div>

      {loading && (
        <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
      )}

      {!loading && hasError && !timeseries && (
        <div className="h-64 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 flex items-center justify-center text-sm text-destructive">
          Não foi possível carregar a evolução.
        </div>
      )}

      {!loading && !hasError && !timeseries && (
        <div className="h-64 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
          Backend ainda não retornou <code className="mx-1">timeseries</code>.
          Assim que disponível, o gráfico aparece aqui automaticamente.
        </div>
      )}

      {!loading && timeseries && !hasAny && (
        <div className="h-64 rounded-xl border border-dashed border-border bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
          Nenhuma receita paga no período.
        </div>
      )}

      {!loading && timeseries && hasAny && (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="labelX" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v: number) =>
                  (v / 100).toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                    maximumFractionDigits: 0,
                  })
                }
              />
              <RechartsTooltip
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => {
                  if (name === "grossRevenueInCents") {
                    return [formatCurrency(value), "Receita bruta"];
                  }
                  if (name === "paidOrdersCount") return [value, "Pedidos pagos"];
                  if (name === "averageTicketInCents") {
                    return [formatCurrency(value), "Ticket médio"];
                  }
                  return [value, name];
                }}
                labelFormatter={(l) => String(l)}
              />
              <Area
                type="monotone"
                dataKey="grossRevenueInCents"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#revenueFill)"
              />
              <Area
                type="monotone"
                dataKey="paidOrdersCount"
                stroke="transparent"
                fill="transparent"
              />
              <Area
                type="monotone"
                dataKey="averageTicketInCents"
                stroke="transparent"
                fill="transparent"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
