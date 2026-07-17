import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCallScreenBootstrap,
  getCallScreenOrders,
  type CallScreenBootstrapPayload,
  type CallScreenContextType,
  type CallScreenOrder,
  type CallScreenOrdersPayload,
} from "@/lib/call-screen-api";
import { qk } from "@/lib/query-keys";
import {
  disconnectPublicCallScreenSocket,
  getPublicCallScreenSocket,
  joinPublicCallScreen,
} from "@/lib/public-call-screen-socket";

const POLL_INTERVAL_MS = 15_000;

type SocketStatus = "connecting" | "connected" | "disconnected";

function mergeOrders(
  bootstrap: CallScreenBootstrapPayload | undefined,
  orders: CallScreenOrdersPayload | undefined,
) {
  if (!bootstrap && !orders) return undefined;
  const source = orders ?? bootstrap;
  if (!source || !bootstrap) return source;
  return {
    ...bootstrap,
    context: source.context ?? bootstrap.context,
    orders: source.orders ?? bootstrap.orders,
    serverTime: source.serverTime ?? bootstrap.serverTime,
  };
}

function orderIds(list: CallScreenOrder[]) {
  return list.map((order) => order.id);
}

export function useCallScreen(type: CallScreenContextType, slug: string) {
  const queryClient = useQueryClient();
  const [socketStatus, setSocketStatus] = useState<SocketStatus>("connecting");
  const [serverNow, setServerNow] = useState<Date | null>(null);
  const clockBaseRef = useRef<{ serverMs: number; localMs: number } | null>(null);

  const bootstrapQuery = useQuery({
    queryKey: qk.callScreen.bootstrap(type, slug),
    enabled: !!slug,
    queryFn: () => getCallScreenBootstrap(type, slug),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const ordersQuery = useQuery({
    queryKey: qk.callScreen.orders(type, slug),
    enabled: !!slug && socketStatus === "disconnected" && !!bootstrapQuery.data,
    queryFn: () => getCallScreenOrders(type, slug),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: socketStatus === "disconnected" ? POLL_INTERVAL_MS : false,
  });

  const screen = useMemo(
    () => mergeOrders(bootstrapQuery.data, ordersQuery.data),
    [bootstrapQuery.data, ordersQuery.data],
  );

  useEffect(() => {
    if (!screen?.serverTime) return;
    const serverMs = new Date(screen.serverTime).getTime();
    if (!Number.isFinite(serverMs)) return;
    clockBaseRef.current = { serverMs, localMs: Date.now() };
    setServerNow(new Date(serverMs));
  }, [screen?.serverTime]);

  useEffect(() => {
    if (!clockBaseRef.current) return undefined;
    const id = window.setInterval(() => {
      const base = clockBaseRef.current;
      if (!base) return;
      setServerNow(new Date(base.serverMs + (Date.now() - base.localMs)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [screen?.serverTime]);

  useEffect(() => {
    const socket = getPublicCallScreenSocket();
    const handleConnect = () => {
      setSocketStatus("connected");
      joinPublicCallScreen(type, slug);
      void queryClient.invalidateQueries({
        queryKey: qk.callScreen.bootstrap(type, slug),
      });
    };
    const handleDisconnect = () => setSocketStatus("disconnected");
    const handleConnecting = () => setSocketStatus("connecting");
    const handleRefresh = () => {
      void queryClient.invalidateQueries({
        queryKey: qk.callScreen.bootstrap(type, slug),
      });
    };

    handleConnecting();
    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);
    socket.on("call-screen-refresh", handleRefresh);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
      socket.off("call-screen-refresh", handleRefresh);
      disconnectPublicCallScreenSocket();
    };
  }, [queryClient, slug, type]);

  const merged = screen;
  const preparing = merged?.orders.preparing ?? bootstrapQuery.data?.orders.preparing ?? [];
  const ready = merged?.orders.ready ?? bootstrapQuery.data?.orders.ready ?? [];

  const isInitialLoading = bootstrapQuery.isLoading && !bootstrapQuery.data;
  const error = bootstrapQuery.error ?? ordersQuery.error ?? null;

  return {
    data: merged
      ? {
          ...merged,
          branding: bootstrapQuery.data!.branding,
          configuration: bootstrapQuery.data!.configuration,
          orders: {
            preparing,
            ready,
          },
        }
      : undefined,
    clock: serverNow,
    error,
    isInitialLoading,
    isRefreshing: bootstrapQuery.isFetching || ordersQuery.isFetching,
    socketStatus,
    refetch: () =>
      queryClient.invalidateQueries({
        queryKey: qk.callScreen.bootstrap(type, slug),
      }),
    soundEnabled: bootstrapQuery.data?.configuration.soundEnabled ?? false,
    maxItemsPerColumn: bootstrapQuery.data?.configuration.maxItemsPerColumn ?? 10,
    readyIds: orderIds(ready),
  };
}
