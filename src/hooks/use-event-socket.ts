import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

const isDev = import.meta.env.DEV;

export type EventSocketHandler = (payload: any) => void;

export interface UseEventSocketOptions {
  eventId?: string | null;
  token?: string | null;
  /** Called when "order-created" is received and matches the event. */
  onOrderCreated?: EventSocketHandler;
  /** Called when "order-updated" is received and matches the event. */
  onOrderUpdated?: EventSocketHandler;
  /** Called when "payment-transaction-updated" is received and matches the event. */
  onPaymentUpdated?: EventSocketHandler;
  /** Query keys to invalidate on any order/payment event. */
  invalidateKeys?: QueryKey[];
  /** Disable the hook (e.g. while auth loading). */
  enabled?: boolean;
}

/**
 * Subscribe to backend Socket.IO events for a specific event room.
 * Joins `event:{eventId}` via `join-event-room`, listens to order/payment
 * events, and optionally invalidates TanStack Query keys.
 */
export function useEventSocket({
  eventId,
  token,
  onOrderCreated,
  onOrderUpdated,
  onPaymentUpdated,
  invalidateKeys,
  enabled = true,
}: UseEventSocketOptions) {
  const queryClient = useQueryClient();

  // Latest refs so listeners are stable across renders.
  const createdRef = useRef(onOrderCreated);
  const updatedRef = useRef(onOrderUpdated);
  const paymentRef = useRef(onPaymentUpdated);
  const keysRef = useRef(invalidateKeys);
  createdRef.current = onOrderCreated;
  updatedRef.current = onOrderUpdated;
  paymentRef.current = onPaymentUpdated;
  keysRef.current = invalidateKeys;

  useEffect(() => {
    if (!enabled || !eventId) return;

    const socket = getSocket(token ?? null);

    const join = () => {
      socket.emit("join-event-room", eventId);
    };

    if (socket.connected) join();
    socket.on("connect", join);

    const matchesEvent = (payload: any): boolean => {
      const order = payload?.order ?? payload;
      const evId = order?.eventId ?? payload?.eventId;
      return !evId || evId === eventId;
    };

    const invalidateAll = () => {
      const keys = keysRef.current;
      if (!keys?.length) return;
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const handleCreated = (payload: any) => {
      if (!matchesEvent(payload)) return;
      createdRef.current?.(payload);
      invalidateAll();
    };
    const handleUpdated = (payload: any) => {
      if (!matchesEvent(payload)) return;
      updatedRef.current?.(payload);
      invalidateAll();
    };
    const handlePayment = (payload: any) => {
      if (!matchesEvent(payload)) return;
      paymentRef.current?.(payload);
      invalidateAll();
    };

    socket.on("order-created", handleCreated);
    socket.on("order-updated", handleUpdated);
    socket.on("payment-transaction-updated", handlePayment);

    return () => {
      socket.off("connect", join);
      socket.off("order-created", handleCreated);
      socket.off("order-updated", handleUpdated);
      socket.off("payment-transaction-updated", handlePayment);
    };
  }, [eventId, token, enabled, queryClient]);
}
