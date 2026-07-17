import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useEventSocket } from "@/hooks/use-event-socket";
import { API_BASE_URL } from "@/lib/auth";
import { qk } from "@/lib/query-keys";
import {
  CalendarDays,
  ShoppingCart,
  TrendingUp,
  Activity,
  DollarSign,
  Loader2,
  AlertCircle,
  Receipt,
  ChefHat,
  Wine,
  Package,
  CheckCircle2,
  Clock,
  Printer,
  AlertTriangle,
  Ban,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { AdminLayout } from "@/components/admin-layout";
import { EmptyState } from "@/components/admin/empty-state";
import { useOrganization } from "@/contexts/organization-context";
import {
  listEvents,
  getEventMetrics,
  type EventItem,
  type EventMetrics,
  getFinancialSummary,
  type FinancialSummary,
} from "@/lib/events-api";
import { listEventPrintJobs, type PrintJob } from "@/lib/print-queue";
import { handleApiError } from "@/lib/api-error";
import { useQuery } from "@tanstack/react-query";
import { listUnifiedOrders } from "@/lib/orders-api";
import { listOrdersByEvent, type Order } from "@/lib/orders-api";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

const ACTIVE_STATUSES = new Set(["active", "published", "ACTIVE", "PUBLISHED"]);

function formatCurrency(cents?: number) {
  if (cents == null || Number.isNaN(cents)) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pickRevenueCents(f?: FinancialSummary | null): number {
  return f?.summary?.paidTotalInCents ?? 0;
}
function pickTicketCents(f?: FinancialSummary | null): number {
  if (!f) return 0;
  return f.summary?.averageTicketInCents ?? 0;
}
function pickOrdersCount(m?: EventMetrics | null): number {
  return m?.totalOrders ?? m?.ordersCount ?? 0;
}
function statusCount(m: EventMetrics | null, key: string): number {
  const counts = m?.ordersByStatus ?? m?.statusCounts;
  if (!counts) return 0;
  return counts[key] ?? counts[key.toLowerCase()] ?? counts[key.toUpperCase()] ?? 0;
}
function sectorValue(m: EventMetrics | null, key: "BAR" | "KITCHEN"): number {
  const s = (m?.salesBySector ?? m?.sectorSales) as Record<string, number | undefined> | undefined;
  if (!s) return 0;
  return s[key] ?? s[key.toLowerCase()] ?? s[key === "BAR" ? "bar" : "kitchen"] ?? 0;
}

function numberFrom(...values: unknown[]): number {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return 0;
}

function itemQuantity(item: Record<string, unknown>): number {
  return numberFrom(item.quantity, item.qty, item.count);
}

function itemTotalInCents(item: Record<string, unknown>): number {
  const quantity = itemQuantity(item) || 1;
  const explicitTotal = numberFrom(item.totalInCents, item.total_in_cents, item.total, item.subtotalInCents, item.subtotal_in_cents);
  if (explicitTotal > 0) return explicitTotal;
  return numberFrom(item.priceInCents, item.unitPriceInCents, item.price_in_cents, item.unit_price_in_cents, item.price) * quantity;
}

function itemName(item: Record<string, unknown>): string {
  const product = item.product && typeof item.product === "object" ? (item.product as Record<string, unknown>) : null;
  const catalogProduct = item.catalogProduct && typeof item.catalogProduct === "object" ? (item.catalogProduct as Record<string, unknown>) : null;
  return String(item.name ?? item.productName ?? item.product_name ?? product?.name ?? catalogProduct?.name ?? "Produto");
}

function itemSector(item: Record<string, unknown>): string | undefined {
  const product = item.product && typeof item.product === "object" ? (item.product as Record<string, unknown>) : null;
  const catalogProduct = item.catalogProduct && typeof item.catalogProduct === "object" ? (item.catalogProduct as Record<string, unknown>) : null;
  const category = item.category && typeof item.category === "object" ? (item.category as Record<string, unknown>) : null;
  const catalogCategory = item.catalogCategory && typeof item.catalogCategory === "object" ? (item.catalogCategory as Record<string, unknown>) : null;
  const productCategory = product?.category && typeof product.category === "object" ? (product.category as Record<string, unknown>) : null;
  const productCatalogCategory = product?.catalogCategory && typeof product.catalogCategory === "object" ? (product.catalogCategory as Record<string, unknown>) : null;
  const catalogProductCategory = catalogProduct?.category && typeof catalogProduct.category === "object" ? (catalogProduct.category as Record<string, unknown>) : null;
  const catalogProductCatalogCategory = catalogProduct?.catalogCategory && typeof catalogProduct.catalogCategory === "object" ? (catalogProduct.catalogCategory as Record<string, unknown>) : null;
  const raw =
    item.sector ??
    item.productSector ??
    item.product_sector ??
    product?.sector ??
    catalogProduct?.sector ??
    category?.sector ??
    catalogCategory?.sector ??
    productCategory?.sector ??
    productCatalogCategory?.sector ??
    catalogProductCategory?.sector ??
    catalogProductCatalogCategory?.sector;
  return typeof raw === "string" ? raw : undefined;
}

function normalizeSectorKey(raw?: string): "BAR" | "KITCHEN" | null {
  const value = (raw ?? "").toUpperCase();
  if (value.includes("BAR")) return "BAR";
  if (value.includes("KITCHEN") || value.includes("COZINHA")) return "KITCHEN";
  return null;
}

function buildMetricsFromOrders(orders: Order[], financialSummary: FinancialSummary | null): EventMetrics {
  const ordersByStatus: Record<string, number> = {};
  const salesBySector: Record<"BAR" | "KITCHEN", number> = { BAR: 0, KITCHEN: 0 };
  const itemsBySector: Record<"BAR" | "KITCHEN", number> = { BAR: 0, KITCHEN: 0 };
  const products = new Map<string, { name: string; quantity: number; totalInCents: number; sector?: string }>();
  let totalProductsSold = 0;

  for (const order of orders) {
    const status = String(order.status || "UNKNOWN").toUpperCase();
    ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;

    const items = Array.isArray(order.items) ? order.items : [];
    for (const rawItem of items) {
      const item = rawItem as Record<string, unknown>;
      const quantity = itemQuantity(item);
      const totalInCents = itemTotalInCents(item);
      const sector = itemSector(item);
      const sectorKey = normalizeSectorKey(sector);
      const name = itemName(item);
      const productKey = String(item.productId ?? item.product_id ?? name);

      totalProductsSold += quantity;

      if (sectorKey) {
        salesBySector[sectorKey] += totalInCents;
        itemsBySector[sectorKey] += quantity;
      }

      const current = products.get(productKey) ?? { name, quantity: 0, totalInCents: 0, sector };
      current.quantity += quantity;
      current.totalInCents += totalInCents;
      current.sector = current.sector ?? sector;
      products.set(productKey, current);
    }
  }

  const hasUsefulOrderStatus = Object.entries(ordersByStatus).some(
    ([status, count]) => status !== "UNKNOWN" && count > 0,
  );
  if (!hasUsefulOrderStatus && financialSummary?.summary) {
    const summary = financialSummary.summary;
    if (summary.pendingOrders > 0) ordersByStatus.PENDING = summary.pendingOrders;
    if (summary.cancelledOrders > 0) ordersByStatus.CANCELLED = summary.cancelledOrders;
    if (summary.paidOrders > 0) ordersByStatus.DELIVERED = summary.paidOrders;
  }

  return {
    totalOrders: financialSummary?.summary?.totalOrders ?? orders.length,
    ordersCount: financialSummary?.summary?.totalOrders ?? orders.length,
    ordersByStatus,
    statusCounts: ordersByStatus,
    totalProductsSold,
    salesBySector,
    sectorSales: salesBySector,
    itemsBySector,
    topProducts: Array.from(products.values())
      .filter((product) => product.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.totalInCents - a.totalInCents)
      .slice(0, 10),
  };
}

function buildMetricsFromPrintJobs(printJobs: PrintJob[]): EventMetrics {
  const salesBySector: Record<"BAR" | "KITCHEN", number> = { BAR: 0, KITCHEN: 0 };
  const itemsBySector: Record<"BAR" | "KITCHEN", number> = { BAR: 0, KITCHEN: 0 };
  const products = new Map<string, { name: string; quantity: number; totalInCents: number; sector?: string }>();
  const orderIds = new Set<string>();
  let totalProductsSold = 0;

  for (const job of printJobs) {
    if (job.status === "CANCELLED") continue;
    if (job.orderId) orderIds.add(job.orderId);
    const sectorKey = normalizeSectorKey(job.sector) ?? "KITCHEN";
    const items = Array.isArray(job.payload?.items) ? job.payload.items : [];
    for (const rawItem of items) {
      const item = rawItem as unknown as Record<string, unknown>;
      const quantity = itemQuantity(item);
      const totalInCents = itemTotalInCents(item);
      const name = itemName(item);
      const productKey = String(item.productId ?? item.product_id ?? `${sectorKey}:${name}`);

      totalProductsSold += quantity;
      salesBySector[sectorKey] += totalInCents;
      itemsBySector[sectorKey] += quantity;

      const current = products.get(productKey) ?? { name, quantity: 0, totalInCents: 0, sector: sectorKey };
      current.quantity += quantity;
      current.totalInCents += totalInCents;
      products.set(productKey, current);
    }
  }

  return {
    totalOrders: orderIds.size,
    ordersCount: orderIds.size,
    totalProductsSold,
    salesBySector,
    sectorSales: salesBySector,
    itemsBySector,
    topProducts: Array.from(products.values())
      .filter((product) => product.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.totalInCents - a.totalInCents)
      .slice(0, 10),
  };
}

function mergeMetrics(primary: EventMetrics | null, fallback: EventMetrics): EventMetrics {
  return {
    ...(primary ?? {}),
    totalOrders: pickOrdersCount(primary) || fallback.totalOrders,
    ordersCount: primary?.ordersCount ?? primary?.totalOrders ?? fallback.ordersCount,
    totalProductsSold: numberFrom(primary?.totalProductsSold) || fallback.totalProductsSold,
    ordersByStatus: Object.keys(primary?.ordersByStatus ?? {}).length ? primary?.ordersByStatus : fallback.ordersByStatus,
    statusCounts: Object.keys(primary?.statusCounts ?? {}).length ? primary?.statusCounts : fallback.statusCounts,
    salesBySector: Object.values(primary?.salesBySector ?? {}).some((v) => numberFrom(v) > 0) ? primary?.salesBySector : fallback.salesBySector,
    sectorSales: Object.values(primary?.sectorSales ?? {}).some((v) => numberFrom(v) > 0) ? primary?.sectorSales : fallback.sectorSales,
    itemsBySector: Object.values(((primary as any)?.itemsBySector ?? {}) as Record<string, unknown>).some((v) => numberFrom(v) > 0)
      ? (primary as any).itemsBySector
      : (fallback as any).itemsBySector,
    topProducts: Array.isArray(primary?.topProducts) && primary.topProducts.length > 0 ? primary.topProducts : fallback.topProducts,
  };
}

function DashboardPage() {
  const navigate = useNavigate();
  const { user: profile, token, loading } = useAuth();
  const { organizationModules, organizationName, organizationId, error: organizationError } = useOrganization();
  const hasEvents = organizationModules.includes("EVENTS");
  const hasOnlineOrders = organizationModules.includes("ONLINE_ORDERS");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("EVENT");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [metrics, setMetrics] = useState<EventMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [printJobs, setPrintJobs] = useState<PrintJob[]>([]);
  const [eventOrders, setEventOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!loading && !token) navigate({ to: "/admin/login" });
  }, [loading, token, navigate]);

  // organizationId already destructured above

  // Reset selection whenever organization changes to avoid stale event IDs
  useEffect(() => {
    setSelectedId(null);
    setEvents([]);
    setMetrics(null);
    setFinancialSummary(null);
    setPrintJobs([]);
    setEventOrders([]);
    setMetricsError(null);
    setEventsError(null);
  }, [organizationId]);

  useEffect(() => {
    if (!token) return;
    if (!hasEvents) {
      setEvents([]);
      setEventsLoading(false);
      setEventsError(null);
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      setEventsError(null);
      try {
        const list = await listEvents(token);
        if (cancelled) return;
        setEvents(list);
        setSelectedId((prev) => {
          if (prev && list.some((e) => e.id === prev)) return prev;
          return list.length > 0 ? list[0].id : null;
        });
      } catch (err) {
        if (!cancelled) setEventsError(handleApiError(err, "Não foi possível carregar os eventos."));
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, hasEvents, organizationId]);

  const refetchMetrics = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token || !selectedId) return;
      if (!opts?.silent) {
        setMetricsLoading(true);
        setMetrics(null);
        setFinancialSummary(null);
        setPrintJobs([]);
        setEventOrders([]);
      }
      setMetricsError(null);

      const params: Record<string, string> = { period: selectedPeriod };
      if (selectedPeriod === "CUSTOM") {
        if (customStartDate) params.startDate = customStartDate;
        if (customEndDate) params.endDate = customEndDate;
      }

      const metricsUrl = `${API_BASE_URL}/events/${selectedId}/metrics?${new URLSearchParams(params).toString()}`;
      const financialUrl = `${API_BASE_URL}/events/${selectedId}/financial-summary?${new URLSearchParams(params).toString()}`;

      // [redacted log]
      const [mRes, fRes, pRes, oRes] = await Promise.allSettled([
        getEventMetrics(token, selectedId, params),
        getFinancialSummary(token, selectedId, params),
        listEventPrintJobs(token, selectedId, params),
        listOrdersByEvent(token, selectedId),
      ]);

      // [redacted log]
      setMetrics(mRes.status === "fulfilled" ? mRes.value : null);
      setFinancialSummary(fRes.status === "fulfilled" ? fRes.value : null);
      setPrintJobs(pRes.status === "fulfilled" ? pRes.value : []);
      setEventOrders(oRes.status === "fulfilled" ? oRes.value : []);

      // Only surface an error banner if BOTH metrics and financial-summary failed
      if (mRes.status === "rejected" && fRes.status === "rejected" && oRes.status === "rejected") {
        setMetricsError(handleApiError(mRes.reason, "Não foi possível carregar as métricas do evento."));
      } else {
        setMetricsError(null);
      }

      if (!opts?.silent) setMetricsLoading(false);
    },
    [token, selectedId, selectedPeriod, customStartDate, customEndDate],
  );

  useEffect(() => {
    refetchMetrics();
  }, [refetchMetrics]);

  // Socket.IO realtime — refetch metrics on order/payment events (debounced)
  const scheduledRef = useRef(false);
  const triggerRefetch = useCallback(() => {
    if (scheduledRef.current) return;
    scheduledRef.current = true;
    setTimeout(() => {
      scheduledRef.current = false;
      refetchMetrics({ silent: true });
    }, 300);
  }, [refetchMetrics]);

  useEventSocket({
    eventId: selectedId,
    token,
    onOrderCreated: triggerRefetch,
    onOrderUpdated: triggerRefetch,
    onPaymentUpdated: triggerRefetch,
  });

  const activeEventsCount = useMemo(
    () => events.filter((e) => ACTIVE_STATUSES.has((e.status ?? "").toString())).length,
    [events],
  );

  const dashboardMetrics = useMemo(
    () => mergeMetrics(mergeMetrics(metrics, buildMetricsFromOrders(eventOrders, financialSummary)), buildMetricsFromPrintJobs(printJobs)),
    [metrics, eventOrders, financialSummary, printJobs],
  );

  const sectorChart = useMemo(() => {
    const barVal = sectorValue(dashboardMetrics, "BAR");
    const kitchenVal = sectorValue(dashboardMetrics, "KITCHEN");
    const barQty = (dashboardMetrics?.itemsBySector as any)?.BAR ?? (dashboardMetrics?.itemsBySector as any)?.bar ?? 0;
    const kitchenQty = (dashboardMetrics?.itemsBySector as any)?.KITCHEN ?? (dashboardMetrics?.itemsBySector as any)?.kitchen ?? 0;

    return [
      {
        name: "Bar",
        total: barVal / 100,
        qty: barQty,
        ticket: barQty > 0 ? barVal / barQty : 0,
      },
      {
        name: "Cozinha",
        total: kitchenVal / 100,
        qty: kitchenQty,
        ticket: kitchenQty > 0 ? kitchenVal / kitchenQty : 0,
      },
    ];
  }, [dashboardMetrics]);

  const topProducts = useMemo(() => {
    const list = dashboardMetrics?.topProducts ?? [];
    return list
      .map((p) => {
        const rawSector = (p as any).sector ?? (p as any).productSector;
        let sector = "Sem setor";
        if (rawSector) {
          const s = String(rawSector).toUpperCase();
          if (s.includes("BAR")) sector = "Bar";
          else if (s.includes("COZINHA") || s.includes("KITCHEN")) sector = "Cozinha";
          else sector = rawSector;
        }
        return {
          name: p.name ?? p.productName ?? "—",
          quantity: p.quantity ?? p.qty ?? 0,
          total: p.totalInCents ?? p.total ?? 0,
          sector,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [dashboardMetrics]);

  const printSummary = useMemo(() => {
    const s = { PENDING: 0, PRINTED: 0, ERROR: 0, CANCELLED: 0 };
    printJobs.forEach((j) => {
      const st = (j.status ?? "").toUpperCase();
      if (st in s) s[st as keyof typeof s]++;
    });
    return s;
  }, [printJobs]);

  const alerts = useMemo(() => {
    return {
      pendingPayment: financialSummary?.summary?.pendingOrders ?? 0,
      preparing: statusCount(dashboardMetrics, "PREPARING"),
      ready: statusCount(dashboardMetrics, "READY"),
      printErrors: printSummary.ERROR,
      late: (dashboardMetrics as any)?.lateOrdersCount ?? 0,
    };
  }, [financialSummary, dashboardMetrics, printSummary]);

  useEffect(() => {
    const selectedEvent = events.find(e => e.id === selectedId);
    const cancelledRevenue = financialSummary?.summary?.cancelledOrders ?? 0;
    const sectorSales = dashboardMetrics?.salesBySector ?? dashboardMetrics?.sectorSales;

    // [redacted log]
  }, [selectedId, selectedPeriod, dashboardMetrics, financialSummary, printSummary, events, topProducts]);

  const showEventsUI = hasEvents;
  const onlyOnlineOrders = hasOnlineOrders && !hasEvents;
  const noModules = organizationModules.length === 0 && !organizationError;

  return (
    <AdminLayout
      title="Dashboard"
      subtitle={onlyOnlineOrders ? "Visão geral dos pedidos online" : noModules ? undefined : "Visão geral do seu sistema"}
    >
      {organizationError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Não foi possível carregar a organização</p>
              <p className="mt-1 opacity-90">{organizationError}</p>
            </div>
          </div>
        </div>
      ) : noModules && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-700 dark:text-amber-300">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Nenhum módulo habilitado para esta organização</p>
              <p className="mt-1 opacity-90">Solicite ao administrador da plataforma que habilite os módulos necessários para começar a usar o painel.</p>
            </div>
          </div>
        </div>
      )}

      {onlyOnlineOrders && (
        <div
          className="relative overflow-hidden rounded-2xl border border-border p-6 text-primary-foreground shadow-[var(--shadow-elegant)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <p className="text-sm opacity-90">Bem-vindo de volta</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {organizationName ?? profile?.name ?? "Administrador"} 👋
            </h2>
            <p className="mt-2 max-w-lg text-sm opacity-90">
              Gerencie seus pedidos online, cardápio e financeiro em tempo real.
            </p>
          </div>
        </div>
      )}

      {showEventsUI && (
      <div
        className="relative overflow-hidden rounded-2xl border border-border p-6 text-primary-foreground shadow-[var(--shadow-elegant)]"
        style={{ background: "var(--gradient-primary)" }}
      >
        <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm opacity-90">Bem-vindo de volta</p>
            <h2 className="mt-1 text-2xl font-semibold">
              {loading ? "Carregando..." : (profile?.name ?? "Administrador")} 👋
            </h2>
            <p className="mt-2 max-w-lg text-sm opacity-90">
              Acompanhe os eventos, pedidos e métricas do seu totem em um só lugar.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="w-full sm:w-48">
                <label className="mb-1 block text-xs font-medium opacity-90">Período</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger className="border-white/20 bg-white/10 text-primary-foreground backdrop-blur hover:bg-white/20">
                    <SelectValue placeholder="Selecione o período" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAY">Hoje</SelectItem>
                    <SelectItem value="24H">Últimas 24h</SelectItem>
                    <SelectItem value="EVENT">Evento inteiro</SelectItem>
                    <SelectItem value="7D">Últimos 7 dias</SelectItem>
                    <SelectItem value="CUSTOM">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-72">
                <label className="mb-1 block text-xs font-medium opacity-90">Evento</label>
                <Select
                  value={selectedId ?? undefined}
                  onValueChange={(v) => setSelectedId(v)}
                  disabled={eventsLoading || events.length === 0}
                >
                  <SelectTrigger className="border-white/20 bg-white/10 text-primary-foreground backdrop-blur hover:bg-white/20">
                    <SelectValue
                      placeholder={
                        eventsLoading
                          ? "Carregando..."
                          : events.length === 0
                            ? "Nenhum evento"
                            : "Selecione"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {selectedPeriod === "CUSTOM" && (
              <div className="flex flex-col gap-3 sm:flex-row animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="w-full sm:w-48">
                  <label className="mb-1 block text-xs font-medium opacity-90">Data inicial</label>
                  <input 
                    type="date" 
                    className="w-full h-10 px-3 rounded-md border border-white/20 bg-white/10 text-primary-foreground backdrop-blur text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                </div>
                <div className="w-full sm:w-48">
                  <label className="mb-1 block text-xs font-medium opacity-90">Data final</label>
                  <input 
                    type="date" 
                    className="w-full h-10 px-3 rounded-md border border-white/20 bg-white/10 text-primary-foreground backdrop-blur text-sm focus:outline-none focus:ring-2 focus:ring-white/30"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      )}


      {eventsError && <ErrorBanner message={eventsError} />}

      {hasOnlineOrders && <OnlineOrdersSection />}

      {!hasEvents && !hasOnlineOrders && organizationModules.length > 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum módulo operacional habilitado"
          description={`A organização ${organizationName ?? ""} não tem os módulos de eventos ou pedidos online ativos.`}
        />
      )}


      {hasEvents && !eventsLoading && events.length === 0 && (
        <EmptyState
          icon={CalendarDays}
          title="Nenhum evento cadastrado"
          description="Crie seu primeiro evento para começar a acompanhar métricas, pedidos e receita em tempo real."
          action={{ label: "Criar evento", onClick: () => navigate({ to: "/admin/events" }) }}
        />
      )}

      {eventsError && <ErrorBanner message={eventsError} />}

      {hasEvents && events.length > 0 && (<>

      {hasOnlineOrders && (
        <div className="flex items-center justify-between pt-2">
          <h3 className="text-lg font-semibold tracking-tight">Operação de Eventos</h3>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

        <StatCard
          label="Evento Selecionado"
          value={events.find(e => e.id === selectedId)?.name ?? "—"}
          icon={CalendarDays}
          hint={`Status: ${(() => {
            const ev = events.find(e => e.id === selectedId);
            if (!ev) return "Não informado";
            if (ev.active === true) return "Ativo";
            if (ev.active === false) return "Inativo";
            return "Não informado";
          })()}`}
        />
        <StatCard
          label="Total de pedidos"
          value={metricsLoading ? "…" : String(pickOrdersCount(dashboardMetrics))}
          icon={ShoppingCart}
        />
        <StatCard
          label="Receita recebida"
          value={metricsLoading ? "…" : formatCurrency(financialSummary?.summary?.paidTotalInCents)}
          icon={DollarSign}
        />
        <StatCard
          label="Receita pendente"
          value={metricsLoading ? "…" : formatCurrency(financialSummary?.summary?.pendingTotalInCents)}
          icon={AlertCircle}
        />
        <StatCard
          label="Produtos vendidos"
          value={metricsLoading ? "…" : String(dashboardMetrics?.totalProductsSold ?? 0)}
          icon={Package}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Receita cancelada"
          value={metricsLoading ? "…" : formatCurrency(financialSummary?.summary?.cancelledTotalInCents)}
          icon={AlertCircle}
        />
        <StatCard
          label="Pedidos pagos"
          value={metricsLoading ? "…" : String(financialSummary?.summary?.paidOrders ?? 0)}
          icon={CheckCircle2}
        />
        <StatCard
          label="Pedidos pendentes"
          value={metricsLoading ? "…" : String(financialSummary?.summary?.pendingOrders ?? 0)}
          icon={Clock}
        />
        <StatCard
          label="Ticket médio"
          value={metricsLoading ? "…" : formatCurrency(financialSummary?.summary?.averageTicketInCents)}
          icon={TrendingUp}
        />

      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Status dos pedidos</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              Tempo real
            </span>
          </div>
          {metricsLoading ? (
            <LoadingBlock />
          ) : metricsError ? (
            <ErrorBlock message={metricsError} />
          ) : !selectedId ? (
            <EmptyBlock message="Selecione um evento para visualizar." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatusPill label="Preparando" value={statusCount(dashboardMetrics, "PREPARING")} tone="amber" />
              <StatusPill label="Prontos" value={statusCount(dashboardMetrics, "READY")} tone="blue" />
              <StatusPill label="Entregues" value={statusCount(dashboardMetrics, "DELIVERED")} tone="emerald" />
              <StatusPill label="Cancelados" value={statusCount(dashboardMetrics, "CANCELLED")} tone="rose" />
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="font-semibold text-foreground">Alertas operacionais</h3>
          </div>
          {metricsLoading ? (
            <LoadingBlock />
          ) : !selectedId ? (
            <EmptyBlock message="Selecione um evento." />
          ) : (
            <ul className="space-y-3 text-sm">
              <SummaryRow
                icon={Clock}
                label="Pagamento pendente"
                value={String(alerts.pendingPayment)}
                tone={alerts.pendingPayment > 0 ? "amber" : undefined}
              />
              <SummaryRow
                icon={ChefHat}
                label="Pedidos em preparo"
                value={String(alerts.preparing)}
              />
              <SummaryRow
                icon={CheckCircle2}
                label="Aguardando retirada"
                value={String(alerts.ready)}
                tone={alerts.ready > 0 ? "blue" : undefined}
              />
              <SummaryRow
                icon={AlertCircle}
                label="Erros de impressão"
                value={String(alerts.printErrors)}
                tone={alerts.printErrors > 0 ? "rose" : undefined}
              />
              <SummaryRow
                icon={Clock}
                label="Pedidos atrasados"
                value={String(alerts.late)}
                tone={alerts.late > 0 ? "rose" : undefined}
              />
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center gap-2">
            <Printer className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-foreground">Resumo de impressão</h3>
          </div>
          {metricsLoading ? (
            <LoadingBlock />
          ) : !selectedId ? (
            <EmptyBlock message="Selecione um evento." />
          ) : (
            <ul className="space-y-3 text-sm">
              <SummaryRow
                icon={Clock}
                label="Pendentes"
                value={String(printSummary.PENDING)}
                onClick={() => navigate({ to: "/admin/print-queue", search: { status: "PENDING" } })}
              />
              <SummaryRow
                icon={CheckCircle2}
                label="Concluídas"
                value={String(printSummary.PRINTED)}
                onClick={() => navigate({ to: "/admin/print-queue", search: { status: "PRINTED" } })}
              />
              <SummaryRow
                icon={AlertCircle}
                label="Com erro"
                value={String(printSummary.ERROR)}
                tone={printSummary.ERROR > 0 ? "rose" : undefined}
                onClick={() => navigate({ to: "/admin/print-queue", search: { status: "ERROR" } })}
              />
              <SummaryRow
                icon={Ban}
                label="Canceladas"
                value={String(printSummary.CANCELLED)}
                onClick={() => navigate({ to: "/admin/print-queue", search: { status: "CANCELLED" } })}
              />

            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Vendas Bar x Cozinha</h3>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Wine className="h-3.5 w-3.5" /> Bar
              </span>
              <span className="inline-flex items-center gap-1">
                <ChefHat className="h-3.5 w-3.5" /> Cozinha
              </span>
            </div>
          </div>
          {metricsLoading ? (
            <LoadingBlock />
          ) : !selectedId ? (
            <EmptyBlock message="Selecione um evento." />
          ) : sectorChart.every((s) => s.total === 0) ? (
            <EmptyBlock message="Sem vendas por setor ainda." />
          ) : (
            <div className="space-y-6">
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sectorChart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) =>
                        Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      }
                      width={80}
                    />
                    <Tooltip
                      formatter={(v: number) =>
                        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      }
                      contentStyle={{
                        borderRadius: 8,
                        border: "1px solid hsl(var(--border))",
                        background: "hsl(var(--card))",
                      }}
                    />
                    <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} label={{ position: 'top', fill: 'hsl(var(--foreground))', fontSize: 10, formatter: (v: number) => v > 0 ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }) : '' }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {sectorChart.map((s) => (
                  <div key={s.name} className="rounded-xl border border-border bg-background/60 p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.name}</p>
                    <p className="text-lg font-bold">{formatCurrency(s.total * 100)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {s.qty} itens • Ticket: {formatCurrency(s.ticket)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-foreground">Top produtos vendidos</h3>
            <Package className="h-4 w-4 text-muted-foreground" />
          </div>
          {metricsLoading ? (
            <LoadingBlock />
          ) : !selectedId ? (
            <EmptyBlock message="Selecione um evento." />
          ) : topProducts.length === 0 ? (
            <EmptyBlock message="Nenhum produto vendido ainda." />
          ) : (
            <ul className="divide-y divide-border">
              {topProducts.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-sm font-medium text-foreground" title={p.name}>
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.sector}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {p.quantity}x
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(p.total)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      </>)}
    </AdminLayout>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StatusPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald" | "rose";
}) {
  const tones: Record<typeof tone, string> = {
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: "amber" | "rose" | "blue";
  onClick?: () => void;
}) {
  const tones = {
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-700 hover:bg-amber-500/10",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-700 hover:bg-rose-500/10",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-700 hover:bg-blue-500/10",
  };
  return (
    <li 
      className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors ${
        tone ? tones[tone] : "border-border bg-background/60 text-muted-foreground hover:bg-accent/50"
      } ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className={`font-semibold ${tone ? "" : "text-foreground"}`}>{value}</span>
    </li>
  );
}

function LoadingBlock() {
  return (
    <div className="flex h-32 items-center justify-center text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Carregando...
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex h-32 flex-col items-center justify-center text-center text-sm text-muted-foreground">
      <TrendingUp className="mb-2 h-8 w-8 opacity-40" />
      {message}
    </div>
  );
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function OnlineOrdersSection() {
  const { token } = useAuth();
  const { organizationId } = useOrganization();
  const q = useQuery({
    queryKey: qk.orders.unified(organizationId, { origin: "ONLINE", dashboard: true }),
    enabled: !!token && !!organizationId,
    queryFn: () => listUnifiedOrders(token!, { origin: "ONLINE" }),
    refetchInterval: 20_000,
  });

  const orders = q.data?.data ?? [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter((o) => {
    if (!o.createdAt) return false;
    return new Date(o.createdAt).getTime() >= today.getTime();
  });

  const statusOf = (o: { status?: unknown }) =>
    String(o.status ?? "").toUpperCase();
  const countByStatus = (s: string) =>
    orders.filter((o) => statusOf(o) === s).length;

  const paidToday = todayOrders.filter((o) => statusOf(o) !== "CANCELLED");
  const revenueToday = paidToday.reduce(
    (sum, o) => sum + (typeof o.totalInCents === "number" ? o.totalInCents : 0),
    0,
  );
  const ordersToday = paidToday.length;
  const avgTicket = ordersToday > 0 ? revenueToday / ordersToday : 0;

  if (q.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <LoadingBlock />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="Nenhum pedido online recebido ainda."
        description="Seus pedidos aparecerão aqui assim que os clientes começarem a comprar."
        action={{ label: "Ver pedidos online", href: "/admin/orders?origin=ONLINE" }}
      />
    );
  }


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">Pedidos Online</h3>
        <span className="text-xs text-muted-foreground">Atualiza automaticamente</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pedidos hoje" value={String(ordersToday)} icon={ShoppingCart} />
        <StatCard label="Receita hoje" value={formatCurrency(revenueToday)} icon={DollarSign} />
        <StatCard label="Ticket médio" value={formatCurrency(avgTicket)} icon={TrendingUp} />
        <StatCard label="Total de pedidos" value={String(orders.length)} icon={Receipt} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatusPill label="Novos" value={countByStatus("NEW") + countByStatus("CONFIRMED")} tone="blue" />
        <StatusPill label="Em preparo" value={countByStatus("PREPARING")} tone="amber" />
        <StatusPill label="Em entrega" value={countByStatus("OUT_FOR_DELIVERY")} tone="blue" />
        <StatusPill label="Concluídos" value={countByStatus("COMPLETED")} tone="emerald" />
        <StatusPill label="Cancelados" value={countByStatus("CANCELLED")} tone="rose" />
      </div>
    </div>
  );
}

