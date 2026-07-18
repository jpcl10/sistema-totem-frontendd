import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
import { resolveUnifiedOrderTotalCents } from "@/components/admin/orders/unified-adapter";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
});

const ACTIVE_STATUSES = new Set(["ACTIVE", "PUBLISHED"]);
const INACTIVE_STATUSES = new Set(["DRAFT", "CANCELLED", "CANCELED", "CLOSED", "ENDED", "INACTIVE", "ARCHIVED"]);

function isEventActive(event: EventItem): boolean {
  if (event.active === true) return true;
  if (event.active === false) return false;
  const status = String(event.status ?? "").trim().toUpperCase();
  if (!status || INACTIVE_STATUSES.has(status)) return false;
  return ACTIVE_STATUSES.has(status);
}

function periodLabel(period: string): string {
  const labels: Record<string, string> = {
    TODAY: "hoje",
    "24H": "nas últimas 24h",
    EVENT: "no evento",
    "7D": "nos últimos 7 dias",
    CUSTOM: "no período",
  };
  return labels[period] ?? "no período";
}

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

function filterOrdersByPeriod(
  orders: Order[],
  period: string,
  customStartDate?: string,
  customEndDate?: string,
): Order[] {
  if (period === "EVENT") return orders;

  const now = new Date();
  let start: Date | null = null;
  let end: Date | null = null;

  if (period === "TODAY") {
    start = new Date(now);
    start.setHours(0, 0, 0, 0);
  } else if (period === "24H") {
    start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "7D") {
    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (period === "CUSTOM") {
    if (customStartDate) {
      start = new Date(`${customStartDate}T00:00:00`);
    }
    if (customEndDate) {
      end = new Date(`${customEndDate}T23:59:59.999`);
    }
  }

  if (!start && !end) return orders;

  return orders.filter((order) => {
    if (!order.createdAt) return false;
    const createdAt = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdAt)) return false;
    if (start && createdAt < start.getTime()) return false;
    if (end && createdAt > end.getTime()) return false;
    return true;
  });
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
    () => events.filter(isEventActive).length,
    [events],
  );

  const eventOrdersInSelectedPeriod = useMemo(
    () => filterOrdersByPeriod(eventOrders, selectedPeriod, customStartDate, customEndDate),
    [eventOrders, selectedPeriod, customStartDate, customEndDate],
  );

  const dashboardMetrics = useMemo(
    () => mergeMetrics(mergeMetrics(metrics, buildMetricsFromOrders(eventOrdersInSelectedPeriod, financialSummary)), buildMetricsFromPrintJobs(printJobs)),
    [metrics, eventOrdersInSelectedPeriod, financialSummary, printJobs],
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

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedId) ?? null,
    [events, selectedId],
  );

  const selectedEventStatus = useMemo(() => {
    if (!selectedEvent) return "Sem evento selecionado";
    if (isEventActive(selectedEvent)) return "Evento ativo";
    if (selectedEvent.active === false) return "Evento inativo";
    const raw = String(selectedEvent.status ?? "").toUpperCase();
    if (raw) return raw;
    return "Status não informado";
  }, [selectedEvent]);

  const primaryKpis = useMemo(
    () => [
      {
        label: "Receita no período",
        value: metricsLoading ? "..." : financialSummary ? formatCurrency(pickRevenueCents(financialSummary)) : "Indisponível",
        hint: periodLabel(selectedPeriod),
        icon: DollarSign,
        tone: "cyan" as const,
      },
      {
        label: "Pedidos no período",
        value: metricsLoading ? "..." : String(pickOrdersCount(dashboardMetrics)),
        hint: financialSummary ? `${financialSummary.summary?.paidOrders ?? 0} pagos` : periodLabel(selectedPeriod),
        icon: ShoppingCart,
        tone: "blue" as const,
      },
      {
        label: "Ticket médio",
        value: metricsLoading ? "..." : financialSummary ? formatCurrency(pickTicketCents(financialSummary)) : "Indisponível",
        hint: "Receita paga / pedidos pagos",
        icon: TrendingUp,
        tone: "success" as const,
      },
      {
        label: "Pendências",
        value: metricsLoading
          ? "..."
          : financialSummary
            ? String((financialSummary.summary?.pendingOrders ?? 0) + printSummary.ERROR)
            : printSummary.ERROR > 0
              ? String(printSummary.ERROR)
              : "Indisponível",
        hint: "Pagamentos + impressão",
        icon: AlertTriangle,
        tone:
          (financialSummary?.summary?.pendingOrders ?? 0) + printSummary.ERROR > 0
            ? ("warning" as const)
            : ("muted" as const),
      },
    ],
    [dashboardMetrics, financialSummary, metricsLoading, printSummary.ERROR, selectedPeriod],
  );

  const orderFlow = useMemo(
    () => [
      {
        label: "Novos",
        value:
          statusCount(dashboardMetrics, "NEW") +
          statusCount(dashboardMetrics, "PENDING") +
          statusCount(dashboardMetrics, "CONFIRMED"),
        tone: "blue" as const,
      },
      {
        label: "Em preparo",
        value: statusCount(dashboardMetrics, "PREPARING"),
        tone: "amber" as const,
      },
      {
        label: "Prontos",
        value: statusCount(dashboardMetrics, "READY"),
        tone: "cyan" as const,
      },
      {
        label: "Concluídos",
        value:
          statusCount(dashboardMetrics, "DELIVERED") +
          statusCount(dashboardMetrics, "COMPLETED"),
        tone: "emerald" as const,
      },
      {
        label: "Cancelados",
        value: statusCount(dashboardMetrics, "CANCELLED"),
        tone: "rose" as const,
      },
    ],
    [dashboardMetrics],
  );

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
      subtitle={onlyOnlineOrders ? "Operação da loja online" : noModules ? undefined : "Operação em tempo real"}
    >
      {organizationError ? (
        <ErrorBanner message={organizationError} title="Não foi possível carregar a organização" />
      ) : noModules ? (
        <Panel tone="warning">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Nenhum módulo habilitado para esta organização</p>
              <p className="mt-1 text-sm opacity-90">
                Solicite ao administrador da plataforma que habilite os módulos necessários.
              </p>
            </div>
          </div>
        </Panel>
      ) : null}

      {(showEventsUI || onlyOnlineOrders) && (
        <DashboardHeader
          loading={loading}
          userName={profile?.name ?? organizationName ?? "Administrador"}
          organizationName={organizationName}
          showEventControls={showEventsUI}
          selectedPeriod={selectedPeriod}
          setSelectedPeriod={setSelectedPeriod}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          events={events}
          eventsLoading={eventsLoading}
          selectedPeriodIsCustom={selectedPeriod === "CUSTOM"}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          setCustomStartDate={setCustomStartDate}
          setCustomEndDate={setCustomEndDate}
          selectedEventName={selectedEvent?.name}
          selectedEventStatus={selectedEventStatus}
          activeEventsCount={activeEventsCount}
        />
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

      {hasEvents && events.length > 0 && (
        <div className="space-y-5">
          {hasOnlineOrders && (
            <SectionHeader
              title="Operação de eventos"
              description="Indicadores do evento selecionado, sem misturar com a loja online."
            />
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {primaryKpis.map((item) => (
              <KpiCard key={item.label} {...item} />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
            <Panel className="p-5">
              <PanelTitle
                icon={Activity}
                title="Operação em tempo real"
                description="Leitura rápida do fluxo atual de pedidos."
                badge="Tempo real"
              />
              {metricsLoading ? (
                <LoadingBlock compact />
              ) : metricsError ? (
                <ErrorBlock message={metricsError} />
              ) : !selectedId ? (
                <EmptyBlock message="Selecione um evento para visualizar a operação." compact />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {orderFlow.map((item) => (
                    <StatusPill key={item.label} {...item} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel className="p-5">
              <PanelTitle
                icon={AlertTriangle}
                title="Alertas operacionais"
                description="Pontos que pedem atenção da equipe."
              />
              {metricsLoading ? (
                <LoadingBlock compact />
              ) : !selectedId ? (
                <EmptyBlock message="Selecione um evento." compact />
              ) : (
                <div className="space-y-2">
                  <ActionRow
                    icon={Clock}
                    label="Pagamentos pendentes"
                    value={String(alerts.pendingPayment)}
                    tone={alerts.pendingPayment > 0 ? "amber" : "muted"}
                    onClick={() => navigate({ to: "/admin/financeiro" })}
                  />
                  <ActionRow
                    icon={ChefHat}
                    label="Pedidos em preparo"
                    value={String(alerts.preparing)}
                    tone={alerts.preparing > 0 ? "amber" : "muted"}
                    onClick={() => navigate({ to: "/admin/orders", search: { eventId: selectedId ?? "" } })}
                  />
                  <ActionRow
                    icon={CheckCircle2}
                    label="Aguardando retirada"
                    value={String(alerts.ready)}
                    tone={alerts.ready > 0 ? "blue" : "muted"}
                    onClick={() => navigate({ to: "/admin/orders", search: { eventId: selectedId ?? "" } })}
                  />
                  <ActionRow
                    icon={AlertCircle}
                    label="Erros de impressão"
                    value={String(alerts.printErrors)}
                    tone={alerts.printErrors > 0 ? "rose" : "muted"}
                    onClick={() => navigate({ to: "/admin/print-queue", search: { status: "ERROR" } })}
                  />
                  <ActionRow
                    icon={Clock}
                    label="Pedidos atrasados"
                    value={String(alerts.late)}
                    tone={alerts.late > 0 ? "rose" : "muted"}
                  />
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <Panel className="p-5">
              <PanelTitle
                icon={Printer}
                title="Impressão"
                description="Fila de impressão do evento selecionado."
              />
              {metricsLoading ? (
                <LoadingBlock compact />
              ) : !selectedId ? (
                <EmptyBlock message="Selecione um evento." compact />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <MiniMetric
                    label="Pendentes"
                    value={printSummary.PENDING}
                    icon={Clock}
                    onClick={() => navigate({ to: "/admin/print-queue", search: { status: "PENDING" } })}
                  />
                  <MiniMetric
                    label="Concluídas"
                    value={printSummary.PRINTED}
                    icon={CheckCircle2}
                    tone="success"
                    onClick={() => navigate({ to: "/admin/print-queue", search: { status: "PRINTED" } })}
                  />
                  <MiniMetric
                    label="Com erro"
                    value={printSummary.ERROR}
                    icon={AlertCircle}
                    tone={printSummary.ERROR > 0 ? "danger" : "muted"}
                    onClick={() => navigate({ to: "/admin/print-queue", search: { status: "ERROR" } })}
                  />
                  <MiniMetric
                    label="Canceladas"
                    value={printSummary.CANCELLED}
                    icon={Ban}
                    onClick={() => navigate({ to: "/admin/print-queue", search: { status: "CANCELLED" } })}
                  />
                </div>
              )}
            </Panel>

            <Panel className="p-5">
              <PanelTitle
                icon={Receipt}
                title="Resumo financeiro"
                description="Receita e situação de pagamento no período."
              />
              {metricsLoading ? (
                <LoadingBlock compact />
              ) : !selectedId ? (
                <EmptyBlock message="Selecione um evento." compact />
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <FinancialTile
                    label="Pendente"
                    value={formatCurrency(financialSummary?.summary?.pendingTotalInCents)}
                    count={`${financialSummary?.summary?.pendingOrders ?? 0} pedidos`}
                    tone="amber"
                  />
                  <FinancialTile
                    label="Pago"
                    value={formatCurrency(financialSummary?.summary?.paidTotalInCents)}
                    count={`${financialSummary?.summary?.paidOrders ?? 0} pedidos`}
                    tone="emerald"
                  />
                  <FinancialTile
                    label="Cancelado"
                    value={formatCurrency(financialSummary?.summary?.cancelledTotalInCents)}
                    count={`${financialSummary?.summary?.cancelledOrders ?? 0} pedidos`}
                    tone="rose"
                  />
                </div>
              )}
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Panel className="p-5">
              <PanelTitle
                icon={Wine}
                title="Vendas por setor"
                description="Distribuição entre bar e cozinha."
              />
              {metricsLoading ? (
                <LoadingBlock />
              ) : !selectedId ? (
                <EmptyBlock message="Selecione um evento." />
              ) : sectorChart.every((sector) => sector.total === 0) ? (
                <EmptyBlock message="Sem vendas por setor ainda neste período." />
              ) : (
                <div className="space-y-4">
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectorChart}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) =>
                            Number(value).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                              maximumFractionDigits: 0,
                            })
                          }
                          width={72}
                        />
                        <Tooltip
                          formatter={(value: number) =>
                            value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          }
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                          }}
                        />
                        <Bar dataKey="total" fill="#00A6FB" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {sectorChart.map((sector) => (
                      <div key={sector.name} className="rounded-lg border border-border bg-background/60 p-3">
                        <p className="text-xs font-medium text-muted-foreground">{sector.name}</p>
                        <p className="mt-1 text-lg font-semibold">{formatCurrency(sector.total * 100)}</p>
                        <p className="text-xs text-muted-foreground">
                          {sector.qty} itens · Ticket {formatCurrency(sector.ticket)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>

            <Panel className="p-5">
              <PanelTitle
                icon={Package}
                title="Top produtos vendidos"
                description="Produtos com maior receita no período."
              />
              {metricsLoading ? (
                <LoadingBlock />
              ) : !selectedId ? (
                <EmptyBlock message="Selecione um evento." />
              ) : topProducts.length === 0 ? (
                <EmptyBlock message="Nenhum produto vendido ainda." />
              ) : (
                <ul className="divide-y divide-border">
                  {topProducts.slice(0, 8).map((product, index) => (
                    <li key={`${product.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#00A6FB]/10 text-xs font-semibold text-[#00A6FB]">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground" title={product.name}>
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{product.sector}</p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold">{formatCurrency(product.total)}</p>
                        <p className="text-xs text-muted-foreground">{product.quantity}x</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function DashboardHeader({
  loading,
  userName,
  organizationName,
  showEventControls,
  selectedPeriod,
  setSelectedPeriod,
  selectedId,
  setSelectedId,
  events,
  eventsLoading,
  selectedPeriodIsCustom,
  customStartDate,
  customEndDate,
  setCustomStartDate,
  setCustomEndDate,
  selectedEventName,
  selectedEventStatus,
  activeEventsCount,
}: {
  loading: boolean;
  userName: string;
  organizationName?: string | null;
  showEventControls: boolean;
  selectedPeriod: string;
  setSelectedPeriod: (value: string) => void;
  selectedId: string | null;
  setSelectedId: (value: string) => void;
  events: EventItem[];
  eventsLoading: boolean;
  selectedPeriodIsCustom: boolean;
  customStartDate: string;
  customEndDate: string;
  setCustomStartDate: (value: string) => void;
  setCustomEndDate: (value: string) => void;
  selectedEventName?: string;
  selectedEventStatus: string;
  activeEventsCount: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-[#00A6FB]/20 bg-[#081F38] p-5 text-[#F8FAFC] shadow-[0_18px_45px_rgba(8,31,56,0.22)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_12%,rgba(0,212,255,0.22),transparent_30%),linear-gradient(135deg,rgba(0,166,251,0.18),transparent_45%)]" />
      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-[#F8FAFC]/90">
              {organizationName ?? "Defumar Events"}
            </span>
            {showEventControls && (
              <span className="rounded-full border border-[#00D4FF]/30 bg-[#00D4FF]/10 px-2.5 py-1 text-xs font-medium text-[#BFF4FF]">
                {eventsLoading
                  ? "Carregando eventos..."
                  : `${activeEventsCount} evento${activeEventsCount === 1 ? "" : "s"} ativo${activeEventsCount === 1 ? "" : "s"}`}
              </span>
            )}
          </div>
          <p className="text-sm text-[#94A3B8]">Bem-vindo de volta</p>
          <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight">
            {loading ? "Carregando..." : userName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[#CBD5E1]">
            {showEventControls
              ? "Acompanhe vendas, pedidos, impressão e alertas operacionais no contexto selecionado."
              : "Acompanhe a operação da loja online com indicadores de venda e status dos pedidos."}
          </p>
        </div>

        {showEventControls && (
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[560px]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#CBD5E1]">Período</label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="border-white/15 bg-white/10 text-[#F8FAFC] backdrop-blur hover:bg-white/15">
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#CBD5E1]">Evento</label>
              <Select
                value={selectedId ?? undefined}
                onValueChange={setSelectedId}
                disabled={eventsLoading || events.length === 0}
              >
                <SelectTrigger className="border-white/15 bg-white/10 text-[#F8FAFC] backdrop-blur hover:bg-white/15">
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
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPeriodIsCustom && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#CBD5E1]">Data inicial</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-md border border-white/15 bg-white/10 px-3 text-sm text-[#F8FAFC] outline-none backdrop-blur focus:ring-2 focus:ring-[#00D4FF]/40"
                    value={customStartDate}
                    onChange={(event) => setCustomStartDate(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#CBD5E1]">Data final</label>
                  <input
                    type="date"
                    className="h-10 w-full rounded-md border border-white/15 bg-white/10 px-3 text-sm text-[#F8FAFC] outline-none backdrop-blur focus:ring-2 focus:ring-[#00D4FF]/40"
                    value={customEndDate}
                    onChange={(event) => setCustomEndDate(event.target.value)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showEventControls && (
        <div className="relative mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs text-[#CBD5E1]">
          <span className="font-medium text-[#F8FAFC]">{selectedEventName ?? "Nenhum evento selecionado"}</span>
          <span className="text-[#64748B]">•</span>
          <span>{selectedEventStatus}</span>
        </div>
      )}
    </section>
  );
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function Panel({
  children,
  className = "p-4",
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: "warning";
}) {
  const toneClass =
    tone === "warning"
      ? "border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#B45309] dark:text-[#FDE68A]"
      : "border-border bg-card text-foreground shadow-[var(--shadow-soft)]";
  return <section className={`rounded-xl border ${toneClass} ${className}`}>{children}</section>;
}

function PanelTitle({
  icon: Icon,
  title,
  description,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  badge?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#00A6FB]/10 text-[#00A6FB]">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {badge && (
        <span className="shrink-0 rounded-full bg-[#00D4FF]/10 px-2.5 py-1 text-xs font-medium text-[#0284C7]">
          {badge}
        </span>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "cyan" | "blue" | "success" | "warning" | "muted";
}) {
  const toneMap = {
    cyan: "border-[#00D4FF]/25 bg-[#00D4FF]/8 text-[#0891B2]",
    blue: "border-[#00A6FB]/25 bg-[#00A6FB]/8 text-[#0284C7]",
    success: "border-[#22C55E]/25 bg-[#22C55E]/8 text-[#16A34A]",
    warning: "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#D97706]",
    muted: "border-border bg-card text-muted-foreground",
  } as const;

  return (
    <div className={`rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)] ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-current/10">
          <Icon className="h-4 w-4" />
        </div>
      </div>
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
  tone: "amber" | "blue" | "cyan" | "emerald" | "rose";
}) {
  const tones: Record<typeof tone, string> = {
    amber: "bg-[#F59E0B]/10 text-[#D97706] border-[#F59E0B]/25",
    blue: "bg-[#3B82F6]/10 text-[#2563EB] border-[#3B82F6]/25",
    cyan: "bg-[#00D4FF]/10 text-[#0891B2] border-[#00D4FF]/25",
    emerald: "bg-[#22C55E]/10 text-[#16A34A] border-[#22C55E]/25",
    rose: "bg-[#EF4444]/10 text-[#DC2626] border-[#EF4444]/25",
  };
  return (
    <div className={`rounded-lg border p-3 ${tones[tone]}`}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: "amber" | "rose" | "blue" | "muted";
  onClick?: () => void;
}) {
  const tones = {
    amber: "border-[#F59E0B]/25 bg-[#F59E0B]/10 text-[#B45309] hover:bg-[#F59E0B]/15",
    rose: "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#B91C1C] hover:bg-[#EF4444]/15",
    blue: "border-[#3B82F6]/25 bg-[#3B82F6]/10 text-[#1D4ED8] hover:bg-[#3B82F6]/15",
    muted: "border-border bg-background/60 text-muted-foreground hover:bg-accent/50",
  };
  return (
    <button
      type="button"
      disabled={!onClick}
      className={`flex items-center justify-between rounded-xl border px-3 py-2 transition-colors ${
        tones[tone]
      } ${onClick ? "cursor-pointer text-left" : "cursor-default"}`}
      onClick={onClick}
    >
      <span className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className={tone === "muted" ? "font-semibold text-foreground" : "font-semibold"}>{value}</span>
    </button>
  );
}

function MiniMetric({
  label,
  value,
  icon: Icon,
  tone = "muted",
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "success" | "danger" | "muted";
  onClick?: () => void;
}) {
  const toneClass = {
    success: "border-[#22C55E]/25 bg-[#22C55E]/10 text-[#16A34A]",
    danger: "border-[#EF4444]/25 bg-[#EF4444]/10 text-[#DC2626]",
    muted: "border-border bg-background/60 text-muted-foreground",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border p-3 text-left transition-colors hover:bg-accent/40 ${toneClass}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
    </button>
  );
}

function FinancialTile({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: string;
  count: string;
  tone: "amber" | "emerald" | "rose";
}) {
  const dot = {
    amber: "bg-[#F59E0B]",
    emerald: "bg-[#22C55E]",
    rose: "bg-[#EF4444]",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{count}</p>
    </div>
  );
}

function LoadingBlock({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex ${compact ? "h-20" : "h-32"} items-center justify-center text-muted-foreground`}>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Carregando...
    </div>
  );
}

function EmptyBlock({ message, compact }: { message: string; compact?: boolean }) {
  return (
    <div className={`flex ${compact ? "h-20" : "h-32"} flex-col items-center justify-center text-center text-sm text-muted-foreground`}>
      <TrendingUp className={`${compact ? "mb-1 h-5 w-5" : "mb-2 h-8 w-8"} opacity-40`} />
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

function ErrorBanner({ message, title }: { message: string; title?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        {title && <p className="font-semibold">{title}</p>}
        <p>{message}</p>
      </div>
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
  const onlineOrdersInScope = orders;
  const statusOf = (o: { status?: unknown }) =>
    String(o.status ?? "").toUpperCase();
  const countByStatus = (s: string) =>
    onlineOrdersInScope.filter((o) => statusOf(o) === s).length;

  const billableOrders = onlineOrdersInScope.filter((o) => statusOf(o) !== "CANCELLED");
  const scopedRevenue = billableOrders.reduce((sum, order) => {
    return sum + (resolveUnifiedOrderTotalCents(order) ?? 0);
  }, 0);
  const scopedOrders = onlineOrdersInScope.length;
  const avgTicket = billableOrders.length > 0 ? scopedRevenue / billableOrders.length : 0;

  if (q.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <LoadingBlock />
      </div>
    );
  }

  if (q.isError) {
    return (
      <ErrorBanner
        title="Não foi possível carregar os pedidos online"
        message={handleApiError(q.error, "Tente novamente em instantes.")}
      />
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
    <div className="space-y-5">
      <SectionHeader
        title="Pedidos Online"
        description="Indicadores da loja online na base carregada."
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Receita carregada"
          value={formatCurrency(scopedRevenue)}
          hint={`${billableOrders.length} pedidos não cancelados`}
          icon={DollarSign}
          tone="cyan"
        />
        <KpiCard
          label="Pedidos carregados"
          value={String(scopedOrders)}
          hint="Mesmo escopo do fluxo"
          icon={ShoppingCart}
          tone="blue"
        />
        <KpiCard
          label="Ticket médio"
          value={formatCurrency(avgTicket)}
          hint="Receita / pedidos não cancelados"
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Cancelados"
          value={String(countByStatus("CANCELLED"))}
          hint="Mesmo escopo do fluxo"
          icon={Receipt}
          tone="muted"
        />
      </div>

      <Panel className="p-5">
        <PanelTitle
          icon={ShoppingCart}
          title="Fluxo da loja online"
          description="Status dos mesmos pedidos considerados nos cards acima."
          badge="Atualiza automaticamente"
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatusPill label="Novos" value={countByStatus("NEW") + countByStatus("PENDING") + countByStatus("CONFIRMED")} tone="blue" />
          <StatusPill label="Em preparo" value={countByStatus("PREPARING")} tone="amber" />
          <StatusPill label="Em entrega" value={countByStatus("OUT_FOR_DELIVERY")} tone="cyan" />
          <StatusPill label="Concluídos" value={countByStatus("COMPLETED")} tone="emerald" />
          <StatusPill label="Cancelados" value={countByStatus("CANCELLED")} tone="rose" />
        </div>
      </Panel>
    </div>
  );
}
