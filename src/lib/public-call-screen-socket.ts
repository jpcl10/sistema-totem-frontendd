import { io, type Socket } from "socket.io-client";
import { SOCKET_URL } from "./auth";
import type { CallScreenContextType } from "./call-screen-api";

let socket: Socket | null = null;

function eventName(type: CallScreenContextType) {
  return type === "STORE" ? "join-call-screen-store" : "join-call-screen-event";
}

export function getPublicCallScreenSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"],
    autoConnect: true,
    reconnection: true,
    withCredentials: false,
  });

  return socket;
}

export function joinPublicCallScreen(type: CallScreenContextType, slug: string) {
  const client = getPublicCallScreenSocket();
  client.emit(eventName(type), slug);
  return client;
}

export function disconnectPublicCallScreenSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

