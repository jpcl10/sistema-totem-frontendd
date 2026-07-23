import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import type { Socket } from "socket.io-client";
import {
  AlertCircle,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShoppingBag,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import { getSocket } from "@/lib/socket";
import { NewOrderButton } from "@/components/admin/orders/new-order-button";
import { OrdersToolbar } from "@/components/admin/orders/orders-toolbar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { audioManager } from "@/lib/audio-manager";
import { useRequireModule } from "@/lib/require-module";
import {
  listUnifiedOrders,
  type Order,
  type OrderStatus,
  type UnifiedOrderDTO,
  type UnifiedOrderFilters,
} from "@/lib/orders-api";
import {
  getFinancialSummary,
  listEvents,
  type EventItem,
  type FinancialSummary,
} from "@/lib/events-api";
import { enqueueJobsForOrder } from "@/lib/print-queue";
import { handleApiError } from "@/lib/api-error";
import {
  advanceUnifiedOrder,
  cancelUnifiedOrder,
  unifiedToKanbanOrder,
  type AdaptedOrder,
} from "@/components/admin/orders/unified-adapter";

import { COLUMNS, STATUS_TO_COLUMN } from "@/components/admin/orders/constants";
import {
  DEFAULT_OPS,
  isOrderLate,
  loadOperationsConfig,
  matchesSector,
  nextStatusFor,
  type OperationsConfig,
  type SectorFilter,
  type ViewFilter,
} from "@/components/admin/orders/helpers";
import { OrderCard } from "@/components/admin/orders/order-card";
import { CancelOrderDialog } from "@/components/admin/orders/cancel-order-dialog";
import { MarkPaymentDialog } from "@/components/admin/orders/mark-payment-dialog";
import { OrderDetailsDrawer } from "@/components/admin/orders/order-details-drawer";


const DEFAULT_LIMIT = 50;

const ordersSearchSchema = z.object({
  origin: fallback(z.string(), "").default(""),
  channel: fallback(z.string(), "").default(""),
  status: fallback(z.string(), "").default(""),
  eventId: fallback(z.string(), "").default(""),
  storeId: fallback(z.string(), "").default(""),
  customerId: fallback(z.string(), "").default(""),
  search: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
  limit: fallback(z.number().int(), DEFAULT_LIMIT).default(DEFAULT_LIMIT),
});

type OrdersSearch = z.infer<typeof ordersSearchSchema>;

function stripDefaults(s: OrdersSearch): Partial<OrdersSearch> {
  const out: Partial<OrdersSearch> = {};
  if (s.origin) out.origin = s.origin;
  if (s.channel) out.channel = s.channel;
  if (s.status) out.status = s.status;
  if (s.eventId) out.eventId = s.eventId;
  if (s.storeId) out.storeId = s.storeId;
  if (s.customerId) out.customerId = s.customerId;
  if (s.search) out.search = s.search;
  if (s.page && s.page > 1) out.page = s.page;
  if (s.limit && s.limit !== DEFAULT_LIMIT) out.limit = s.limit;
  return out;
}


function useDebouncedValue<T>(value: T, ms = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export const Route = createFileRoute("/admin/orders")({
  validateSearch: zodValidator(ordersSearchSchema),
  component: OrdersPage,
});

const playBeep = (
  variant: "default" | "soft" | "alert" | "silent" = "default",
) => audioManager.playBeep(variant);

function OrdersPage() {
  useRequireModule(["EVENTS", "ONLINE_ORDERS"]);
  const { token, loading: authLoading } = useAuth();
  const { organizationModules, loading: orgLoading } = useOrganization();
  const hasEventsModule = organizationModules.includes("EVENTS");
  const hasOnlineModule = organizationModules.includes("ONLINE_ORDERS");
  const onlyOnline = hasOnlineModule && !hasEventsModule;
  const onlyEvents = hasEventsModule && !hasOnlineModule;
  const navigate = useNavigate();
  const orgId = useOrgId();
  const search = Route.useSearch();
  const {
    origin,
    channel,
    status: statusFilter,
    eventId,
    storeId,
    customerId,
    search: searchQuery,
    page,
    limit,
  } = search;


  const updateSearch = (
    patch: Partial<OrdersSearch>,
    opts: { resetPage?: boolean; replace?: boolean } = {},
  ) => {
    const { resetPage = true, replace = true } = opts;
    navigate({
      to: "/admin/orders",
      search: (prev: unknown) => {
        const merged = {
          ...(prev as OrdersSearch),
          ...patch,
        } as OrdersSearch;
        if (resetPage && !("page" in patch)) merged.page = 1;
        return stripDefaults(merged);
      },
      replace,
    });
  };

  

  const [searchInput, setSearchInput] = useState<string>(searchQuery);
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);
  const debouncedSearch = useDebouncedValue(searchInput, 400);
  useEffect(() => {
    if (debouncedSearch !== searchQuery) {
      updateSearch({ search: debouncedSearch });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const hasActiveFilters =
    !!(origin || channel || statusFilter || eventId || storeId || customerId || searchQuery) ||
    page > 1;

  const clearFilters = () => {
    navigate({ to: "/admin/orders", search: {} as OrdersSearch, replace: true });
    setSearchInput("");
  };

  // Defaults por módulo: aplica origin=ONLINE apenas quando a org é
  // exclusivamente online E a URL está sem filtros. Nunca sobrescreve
  // parâmetros vindos da URL.
  const defaultAppliedRef = useRef(false);
  useEffect(() => {
    if (defaultAppliedRef.current) return;
    if (orgLoading) return;
    defaultAppliedRef.current = true;
    if (onlyOnline && !hasActiveFilters) {
      navigate({
        to: "/admin/orders",
        search: { origin: "ONLINE" } as unknown as OrdersSearch,
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading, onlyOnline]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>("ALL");
  const [viewFilter, setViewFilter] = useState<ViewFilter>("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<Order | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);


  const eventsQuery = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId,
  });
  const events: EventItem[] = eventsQuery.data ?? [];
  const eventsLoading = eventsQuery.isLoading;

  const financialSummaryQuery = useQuery({
    queryKey: qk.financeiro.byEvent(orgId, eventId),
    queryFn: () => getFinancialSummary(token!, eventId),
    enabled: !!token && !!orgId && !!eventId,
  });
  const setFinancialSummary = (
    _updater:
      | FinancialSummary
      | ((prev: FinancialSummary | null) => FinancialSummary | null),
  ) => {
    financialSummaryQuery.refetch();
    void _updater;
  };
  const [, setTick] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [hasMounted, setHasMounted] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);
  useEffect(() => {
    setHasMounted(true);
    setSoundEnabled(audioManager.isEnabled());
    return audioManager.subscribe(setSoundEnabled);
  }, []);
  const toggleSound = async () => {
    const next = await audioManager.toggle();
    if (!next && !audioManager.isEnabled() && soundEnabled === false) {
      toast.error("Não foi possível ativar o áudio neste navegador.");
    }
  };
  const [opsConfig, setOpsConfig] = useState<OperationsConfig>(DEFAULT_OPS);
  const lateNotifiedRef = useRef<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const highlightTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const flagAsNew = (id: string) => {
    setHighlightIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    const existing = highlightTimers.current.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      setHighlightIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      highlightTimers.current.delete(id);
    }, 8000);
    highlightTimers.current.set(id, t);
  };

  useEffect(() => {
    return () => {
      highlightTimers.current.forEach((t) => clearTimeout(t));
      highlightTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await (
          containerRef.current ?? document.documentElement
        ).requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!authLoading && !token) navigate({ to: "/admin/login" });
  }, [authLoading, token, navigate]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!eventId) {
      setOpsConfig(DEFAULT_OPS);
      return;
    }
    setOpsConfig(loadOperationsConfig(eventId));
    lateNotifiedRef.current = new Set();
    const onStorage = (e: StorageEvent) => {
      if (e.key === `admin.settings.operations.event.${eventId}`) {
        setOpsConfig(loadOperationsConfig(eventId));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [eventId]);

  useEffect(() => {
    const lateMin = opsConfig.lateOrderAlertMinutes;
    const sound = opsConfig.notificationSound;
    for (const o of orders) {
      if (isOrderLate(o, lateMin) && !lateNotifiedRef.current.has(o.id)) {
        lateNotifiedRef.current.add(o.id);
        if (soundEnabledRef.current && sound !== "silent") playBeep(sound);
      }
    }
  });

  // Não auto-selecionar evento: filtros são conduzidos pela URL e pedidos
  // online devem ser visualizáveis sem evento.

  useEffect(() => {
    if (eventsQuery.error) {
      setError(
        handleApiError(
          eventsQuery.error,
          "Não foi possível carregar os eventos.",
        ),
      );
    }
  }, [eventsQuery.error]);

  useEffect(() => {
    if (financialSummaryQuery.error && import.meta.env.DEV) {
      console.warn(
        "[admin.orders] getFinancialSummary failed:",
        financialSummaryQuery.error,
      );
    }
  }, [financialSummaryQuery.error]);

  const filters = useMemo<UnifiedOrderFilters>(() => {
    const f: UnifiedOrderFilters = {};
    if (origin) f.origin = origin;
    if (channel) f.channel = channel;
    if (statusFilter) f.status = statusFilter;
    if (eventId) f.eventId = eventId;
    if (storeId) f.storeId = storeId;
    if (customerId) f.customerId = customerId;
    if (searchQuery) f.search = searchQuery;
    if (page > 1) f.page = page;
    if (limit && limit !== DEFAULT_LIMIT) f.limit = limit;
    return f;
  }, [origin, channel, statusFilter, eventId, storeId, customerId, searchQuery, page, limit]);


  const ordersQuery = useQuery({
    queryKey: qk.orders.unified(orgId, filters),
    queryFn: () => listUnifiedOrders(token!, filters),
    enabled: !!token && !!orgId,
    // Fallback polling when socket is offline; disabled once socket connects.
    refetchInterval: connected ? false : 15_000,
    refetchIntervalInBackground: false,
  });
  const loading = ordersQuery.isLoading;

  useEffect(() => {
    if (!ordersQuery.data) return;
    const data = ordersQuery.data.data.map(unifiedToKanbanOrder);
    setOrders(data);
    if (!initialLoadDoneRef.current) {
      seenIdsRef.current = new Set(data.map((o) => o.id));
      initialLoadDoneRef.current = true;
    } else {
      for (const o of data) seenIdsRef.current.add(o.id);
    }
  }, [ordersQuery.data]);

  useEffect(() => {
    if (ordersQuery.error) {
      setError(
        handleApiError(ordersQuery.error, "Não foi possível carregar os pedidos.", {
          silent: true,
        }),
      );
    } else {
      setError(null);
    }
  }, [ordersQuery.error]);

  const reload = () => {
    void ordersQuery.refetch();
  };


  useEffect(() => {
    if (!orders.length) return;
    const currentEvent = events.find((e) => e.id === eventId);
    const eventName = currentEvent?.name ?? "Evento";
    for (const o of orders) {
      const status = (o.status ?? "").toUpperCase();
      const payStatus = (o.paymentStatus ?? "").toUpperCase();
      if (status === "CANCELLED") continue;
      if (payStatus === "PENDING") continue;
      try {
        enqueueJobsForOrder(
          o as unknown as Parameters<typeof enqueueJobsForOrder>[0],
          { eventName, eventId },
        );
      } catch {
        /* ignore */
      }
    }
  }, [orders, events, eventId]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);
    socketRef.current = socket;

    const upsert = (raw: unknown, opts?: { fromCreated?: boolean }) => {
      // Accept unified DTO shape, wrapped { order|onlineOrder }, or legacy Order.
      const src =
        raw && typeof raw === "object"
          ? "order" in (raw as object)
            ? ((raw as { order: unknown }).order as Record<string, unknown>)
            : "onlineOrder" in (raw as object)
              ? ((raw as { onlineOrder: unknown }).onlineOrder as Record<string, unknown>)
              : (raw as Record<string, unknown>)
          : null;
      if (!src) return;
      // Coerce into UnifiedOrderDTO-shape for the adapter; missing fields
      // are tolerated (adapter falls back with "—" at render time).
      const dto = {
        sourceType: (src.sourceType as string) ?? (src.storeId ? "ONLINE" : "EVENT"),
        origin: (src.origin as string) ?? (src.storeId ? "DIGITAL_MENU" : "EVENT"),
        status: (src.status as string) ?? "CONFIRMED",
        ...src,
        id: String(src.id ?? ""),
      } as unknown as UnifiedOrderDTO;
      if (!dto.id) return;
      const o = unifiedToKanbanOrder(dto);
      if (eventId && o.eventId && o.eventId !== eventId) return;
      const isNew = !seenIdsRef.current.has(o.id);
      seenIdsRef.current.add(o.id);
      setOrders((prev) => {
        const idx = prev.findIndex((p) => p.id === o.id);
        if (idx === -1) return [o, ...prev];
        const next = prev.slice();
        next[idx] = { ...next[idx], ...o };
        return next;
      });
      if (isNew) {
        flagAsNew(o.id);
        if (soundEnabledRef.current && (opts?.fromCreated ?? true)) playBeep();
      }
    };

    const onCreated = (data: unknown) => {
      upsert(data, { fromCreated: true });
      toast.success("Novo pedido recebido");
    };
    const onUpdated = (data: unknown) => {
      upsert(data, { fromCreated: false });
      if (token && eventId) {
        getFinancialSummary(token, eventId)
          .then(setFinancialSummary)
          .catch((err) => {
            if (import.meta.env.DEV)
              console.warn(
                "[admin.orders] getFinancialSummary (order-updated) failed:",
                err,
              );
          });
      }
    };
    const onPayment = (data: unknown) => {
      upsert(data, { fromCreated: false });
      if (token && eventId) {
        getFinancialSummary(token, eventId)
          .then(setFinancialSummary)
          .catch((err) => {
            if (import.meta.env.DEV)
              console.warn(
                "[admin.orders] getFinancialSummary (payment) failed:",
                err,
              );
          });
      }
    };

    const onConnect = () => {
      setConnected(true);
      toast.dismiss("ws-down");
      if (eventId) socket.emit("join-event-room", eventId);
      if (orgId) {
        socket.emit("join", { organizationId: orgId });
        socket.emit("subscribe", { organizationId: orgId });
      }
    };
    const onDisconnect = () => {
      setConnected(false);
      toast.error("Conexão em tempo real perdida. Tentando reconectar...", {
        id: "ws-down",
      });
    };
    const onConnectError = () => {
      setConnected(false);
      toast.error(
        "Não foi possível conectar ao tempo real. Tentando novamente...",
        { id: "ws-down" },
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("order-created", onCreated);
    socket.on("order-updated", onUpdated);
    socket.on("payment-transaction-updated", onPayment);
    // Unified feed events (Central Operacional).
    socket.on("unified-order-created", onCreated);
    socket.on("unified-order-updated", onUpdated);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("order-created", onCreated);
      socket.off("order-updated", onUpdated);
      socket.off("payment-transaction-updated", onPayment);
      socket.off("unified-order-created", onCreated);
      socket.off("unified-order-updated", onUpdated);
      socketRef.current = null;
    };
  }, [token, orgId, eventId]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const paymentStatus = (o.paymentStatus ?? "").toUpperCase();
      const status = (o.status ?? "").toUpperCase();

      if (sectorFilter !== "ALL") {
        const isPaid =
          paymentStatus === "PAID" || paymentStatus === "NOT_REQUIRED";
        if (!isPaid) return false;
      }

      if (!matchesSector(o, sectorFilter)) return false;

      if (viewFilter === "DELIVERED")
        return status === "COMPLETED" || status === "DELIVERED";
      if (viewFilter === "ALL") return true;

      if (
        status === "CANCELLED" ||
        status === "COMPLETED" ||
        status === "DELIVERED"
      )
        return false;
      const isActive =
        status === "NEW" ||
        status === "RECEIVED" ||
        status === "CONFIRMED" ||
        status === "PENDING" ||
        status === "PREPARING" ||
        status === "READY" ||
        status === "OUT_FOR_DELIVERY";
      return isActive;
    });
  }, [orders, sectorFilter, viewFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, Order[]> = {
      NEW: [],
      CONFIRMED: [],
      PREPARING: [],
      READY: [],
      OUT_FOR_DELIVERY: [],
      COMPLETED: [],
    };
    const sorted = filteredOrders.slice().sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
    for (const o of sorted) {
      const raw = (o.status || "CONFIRMED").toUpperCase();
      const k = STATUS_TO_COLUMN[raw] ?? "CONFIRMED";
      if (k === "CANCELLED") continue;
      if (!map[k]) map[k] = [];
      map[k].push(o);
    }
    return map;
  }, [filteredOrders]);

  const advance = async (o: Order) => {
    if (!token) return;
    const next = nextStatusFor(o);
    if (!next) return;
    setUpdatingId(o.id);
    try {
      const updated = await advanceUnifiedOrder(
        token,
        o as AdaptedOrder,
        next.status as OrderStatus,
      );
      setOrders((prev) =>
        prev.map((p) => (p.id === o.id ? { ...p, ...updated } : p)),
      );
    } catch (e) {
      handleApiError(e, "Não foi possível atualizar o status do pedido.");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmPayment = async (o: Order) => {
    setPaymentTarget(o);
  };

  const onPaymentSuccess = (updatedOrder: Order) => {
    setOrders((prev) =>
      prev.map((p) => (p.id === updatedOrder.id ? { ...p, ...updatedOrder } : p)),
    );
    if (token && eventId) {
      getFinancialSummary(token, eventId)
        .then(setFinancialSummary)
        .catch(() => {});
    }
  };

  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const openCancel = (o: Order) => {
    setCancelTarget(o);
    setCancelReason("");
  };

  const closeCancel = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason("");
  };

  const submitCancel = async () => {
    if (!token || !cancelTarget) return;
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }
    setCancelling(true);
    setUpdatingId(cancelTarget.id);
    try {
      const updated = await cancelUnifiedOrder(token, cancelTarget as AdaptedOrder, reason);
      setOrders((prev) =>
        prev.map((p) =>
          p.id === cancelTarget.id ? { ...p, ...updated } : p,
        ),
      );
      toast.success("Pedido cancelado");
      setCancelTarget(null);
      setCancelReason("");
    } catch (e) {
      handleApiError(e, "Não foi possível cancelar o pedido.");
    } finally {
      setCancelling(false);
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout
      title="Pedidos"
      subtitle="Painel operacional em tempo real"
      actions={
        <div className="flex items-center gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium sm:inline-flex ${
              connected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                : "border-border bg-muted text-muted-foreground"
            }`}
            title={connected ? "Conectado em tempo real" : "Offline — usando polling"}
          >
            {connected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {connected ? "Tempo real" : "Offline"}
          </span>

          {/* Desktop secondary actions */}
          <div className="hidden items-center gap-2 md:inline-flex">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleSound}
              title={
                hasMounted
                  ? soundEnabled
                    ? "Desativar som de novos pedidos"
                    : "Ativar som de novos pedidos"
                  : "Som"
              }
            >
              {hasMounted && soundEnabled ? (
                <Volume2 className="h-4 w-4" />
              ) : (
                <VolumeX className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Mobile overflow */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={toggleSound}>
                  {hasMounted && soundEnabled ? (
                    <Volume2 className="h-4 w-4" />
                  ) : (
                    <VolumeX className="h-4 w-4" />
                  )}
                  {hasMounted && soundEnabled ? "Desativar som" : "Ativar som"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={toggleFullscreen}>
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                  {isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={reload} disabled={loading}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {token && (
            <NewOrderButton
              token={token}
              hasEvents={hasEventsModule}
              hasOnline={hasOnlineModule}
              currentEventId={eventId ?? undefined}
              currentEventName={events.find((e) => e.id === eventId)?.name}
              onCreated={() => {
                reload();
                if (token && eventId) {
                  getFinancialSummary(token, eventId)
                    .then(setFinancialSummary)
                    .catch(() => {});
                }
              }}
            />
          )}
        </div>
      }
    >
      <OrdersToolbar
        view={viewFilter}
        onViewChange={setViewFilter}
        sector={sectorFilter}
        onSectorChange={setSectorFilter}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        filters={{
          origin,
          channel,
          status: statusFilter,
          eventId,
        }}
        onFiltersChange={(patch) => updateSearch(patch)}
        onClearAll={clearFilters}
        showEvents={!onlyOnline}
        showOnlineFilters={!onlyEvents}
        events={events}
        eventsLoading={eventsLoading}
      />
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        ref={containerRef}
        className={
          isFullscreen ? "min-h-screen bg-background p-6 overflow-auto" : ""
        }
      >
        <div className="-mx-4 sm:mx-0">
          <div className="flex gap-3 overflow-x-auto px-4 sm:px-0 pb-3 snap-x snap-mandatory md:snap-none">
            {COLUMNS.map((col) => {
              const list = grouped[col.key] ?? [];
              const Icon = col.icon;
              return (
                <section
                  key={col.key}
                  className="flex w-[300px] md:w-[320px] xl:w-[340px] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card/60 shadow-[var(--shadow-soft)] max-h-[calc(100vh-260px)]"
                >
                  <header
                    className={`sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-border bg-gradient-to-br ${col.accent} px-4 py-3 backdrop-blur`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-foreground shadow-sm">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="truncate text-sm font-semibold text-foreground">
                        {col.label}
                      </h3>
                    </div>
                    <span className="shrink-0 rounded-full bg-card px-2.5 py-0.5 text-xs font-bold text-foreground shadow-sm">
                      {list.length}
                    </span>
                  </header>

                  <div className="flex-1 space-y-2 overflow-y-auto p-2.5">
                    {loading ? (
                      Array.from({ length: 2 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-32 animate-pulse rounded-xl border border-border bg-card/60"
                        />
                      ))
                    ) : list.length === 0 ? (
                      <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                        <ShoppingBag className="mb-2 h-5 w-5" />
                        Nenhum pedido
                      </div>
                    ) : (
                      list.map((o) => (
                        <OrderCard
                          key={o.id}
                          order={o}
                          sectorFilter={sectorFilter}
                          busy={updatingId === o.id}
                          highlight={highlightIds.has(o.id)}
                          lateMinutes={opsConfig.lateOrderAlertMinutes}
                          onAdvance={() => advance(o)}
                          onConfirmPayment={() => confirmPayment(o)}
                          onCancel={() => openCancel(o)}
                          onOpenDetails={() => setDetailsId(o.id)}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>


      <CancelOrderDialog
        order={cancelTarget}
        reason={cancelReason}
        onReasonChange={setCancelReason}
        busy={cancelling}
        onClose={closeCancel}
        onConfirm={submitCancel}
      />

      <MarkPaymentDialog
        order={paymentTarget}
        onClose={() => setPaymentTarget(null)}
        onSuccess={onPaymentSuccess}
      />

      <OrderDetailsDrawer
        open={!!detailsId}
        onOpenChange={(v) => !v && setDetailsId(null)}
        order={orders.find((o) => o.id === detailsId) ?? null}
        busy={updatingId === detailsId}
        onAdvance={() => {
          const o = orders.find((x) => x.id === detailsId);
          if (o) void advance(o);
        }}
        onConfirmPayment={() => {
          const o = orders.find((x) => x.id === detailsId);
          if (o) confirmPayment(o);
        }}
        onCancel={() => {
          const o = orders.find((x) => x.id === detailsId);
          if (o) {
            setDetailsId(null);
            openCancel(o);
          }
        }}
      />


      {/* Manual sale drawers are now rendered by NewOrderButton */}
    </AdminLayout>
  );
}
