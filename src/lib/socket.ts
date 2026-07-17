import { io, Socket } from "socket.io-client";
import { API_HEADERS, SOCKET_URL } from "./auth";
import { getImpersonation } from "./org-context";

const isDev = import.meta.env.DEV;

let socket: Socket | null = null;
let currentToken: string | null | undefined = undefined;
let currentOrgId: string | null | undefined = undefined;

function resolveOrgIdForHandshake(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("admin_user");
    if (raw) {
      const u = JSON.parse(raw) as { role?: string; organizationId?: string };
      if ((u.role || "").toUpperCase() === "SUPER_ADMIN") {
        return getImpersonation()?.organizationId ?? null;
      }
      if (u.organizationId) return u.organizationId;
    }
    return getImpersonation()?.organizationId ?? null;
  } catch {
    return null;
  }
}


/**
 * Returns a singleton socket.io-client connection.
 * Recreates the socket if the token or the SUPER_ADMIN's impersonated
 * organizationId changes, so rooms from a previous tenant are dropped.
 */
export function getSocket(token?: string | null): Socket {
  const orgId = resolveOrgIdForHandshake();

  if (socket && currentToken === token && currentOrgId === orgId) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  if (socket) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* ignore */
    }
    socket = null;
  }

  currentToken = token;
  currentOrgId = orgId;

  const auth: Record<string, string> = {};
  if (token) auth.token = token;
  if (orgId) auth.organizationId = orgId;

  socket = io(SOCKET_URL, {
    transports: ["polling", "websocket"],
    reconnection: true,
    autoConnect: true,
    secure: true,
    withCredentials: false,
    auth: Object.keys(auth).length ? auth : undefined,
    extraHeaders: { ...API_HEADERS },
  });

  if (isDev) {
    socket.on("connect_error", (err) => console.warn("[socket] connect_error:", err.message));
  }


  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    currentToken = undefined;
    currentOrgId = undefined;
  }
}
