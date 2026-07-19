import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import {
  Plus,
  Loader2,
  AlertCircle,
  Monitor,
  Tv,
  Printer,
  Cpu,
  Copy,
  KeyRound,
  Pencil,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  WifiOff,
  Search,
  Filter,
  ExternalLink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


import { useAuth } from "@/lib/auth-context";
import { AdminLayout } from "@/components/admin-layout";
import { handleApiError } from "@/lib/api-error";
import { listEvents, type EventItem } from "@/lib/events-api";
import { listOnlineStores, type OnlineStore } from "@/lib/online-store-api";
import {
  listPrinters,
  updatePrinter,
  type PrinterItem,
  type PrinterSector,
  type PrinterPaper,
  type PrinterConnectionType,
} from "@/lib/printers-api";
import {
  listDevices,
  createDevice,
  updateDevice,
  regenerateDeviceCredentials,
  type Device,
  type DeviceType,
  type DeviceStatus,
  type DeviceCredentials,
} from "@/lib/devices-api";
import { useRequireModule } from "@/lib/require-module";

type UnifiedDevice = Device & {
  source?: "device" | "legacy_printer";
  legacyEventId?: string;
  legacyPrinterId?: string;
};

function mapLegacyPrinterToDevice(p: PrinterItem, ev?: EventItem): UnifiedDevice {
  const sectorLabel: Record<string, string> = {
    BAR: "Bar",
    KITCHEN: "Cozinha",
    ALL: "Pedido completo",
    FULL_ORDER: "Pedido completo",
  };
  const loc =
    sectorLabel[String(p.sector ?? "").toUpperCase()] ?? "Impressora do evento";
  return {
    id: `legacy:${p.id}`,
    organizationId: "",
    name: p.name,
    code: String(p.id).slice(0, 8),
    type: "PRINTER",
    status: p.active ? "ACTIVE" : "OFFLINE",
    authStatus: "ACTIVE",
    eventId: ev?.id ?? p.eventId ?? null,
    storeId: null,
    event: ev ? { id: ev.id, name: ev.name } : null,
    locationName: loc,
    lastSeenAt: null,
    lastHeartbeatAt: null,
    metadata: {
      printerSector:
        String(p.sector ?? "").toUpperCase() === "FULL_ORDER" ? "FULL_ORDER" : p.sector,
      connectionType: p.connectionType,
      ipAddress: p.ipAddress,
      port: p.port,
      paperSize: p.paperSize,
    },
    source: "legacy_printer",
    legacyEventId: ev?.id ?? p.eventId,
    legacyPrinterId: p.id,
  };
}


export const Route = createFileRoute("/admin/devices")({
  component: DevicesPage,
});

const TYPE_LABEL: Record<DeviceType, string> = {
  TOTEM: "Totem",
  SK210: "SK210",
  CALL_SCREEN: "Tela de Chamada",
  PRINTER: "Impressora",
};

const TYPE_ICON: Record<DeviceType, typeof Monitor> = {
  TOTEM: Monitor,
  SK210: Cpu,
  CALL_SCREEN: Tv,
  PRINTER: Printer,
};

const STATUS_LABEL: Record<DeviceStatus, string> = {
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  OFFLINE: "Offline",
  MAINTENANCE: "Manutenção",
};

const PRINT_SECTORS = ["FULL_ORDER", "BAR", "KITCHEN"] as const;
const PRINT_SECTOR_LABEL: Record<(typeof PRINT_SECTORS)[number], string> = {
  FULL_ORDER: "Pedido completo",
  BAR: "Bar",
  KITCHEN: "Cozinha",
};

const CONNECTION_TYPES = ["SK210_LOCAL", "TCP_IP"] as const;
const CONNECTION_LABEL: Record<(typeof CONNECTION_TYPES)[number], string> = {
  SK210_LOCAL: "SK210 local",
  TCP_IP: "TCP/IP",
};

interface PrinterMeta {
  printerSector?: string;
  connectionType?: string;
  ipAddress?: string;
  port?: string | number;
  paperSize?: string;
}

function getPrinterMeta(d: Device): PrinterMeta {
  // metadata can come as object, JSON string, or be split between
  // top-level fields and nested `config`. Normalize all variants.
  let raw: Record<string, unknown> = {};
  const rawMeta = d.metadata as unknown;
  if (rawMeta && typeof rawMeta === "object") {
    raw = rawMeta as Record<string, unknown>;
  } else if (typeof rawMeta === "string") {
    try {
      const parsed = JSON.parse(rawMeta);
      if (parsed && typeof parsed === "object") raw = parsed as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  const nestedConfig =
    raw.config && typeof raw.config === "object"
      ? (raw.config as Record<string, unknown>)
      : {};
  const top = d as unknown as Record<string, unknown>;
  // Merge order: device top-level < nested config < flat metadata (latter wins).
  const m: Record<string, unknown> = { ...top, ...nestedConfig, ...raw };

  const pickStr = (...keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = m[k];
      if (typeof v === "string" && v.trim()) return v;
    }
    return undefined;
  };
  const pickNumOrStr = (...keys: string[]): string | number | undefined => {
    for (const k of keys) {
      const v = m[k];
      if (typeof v === "number" || (typeof v === "string" && v !== "")) return v;
    }
    return undefined;
  };

  return {
    printerSector: pickStr("printerSector", "printSector", "sector"),
    connectionType: pickStr("connectionType", "connection_type"),
    ipAddress: pickStr("ipAddress", "ip_address", "ip"),
    port: pickNumOrStr("port"),
    paperSize: pickStr("paperSize", "paper_size"),
  };
}

function StatusBadge({ status }: { status: DeviceStatus }) {
  const map: Record<DeviceStatus, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-600",
    PAUSED: "bg-amber-500/10 text-amber-600",
    OFFLINE: "bg-red-500/10 text-red-600",
    MAINTENANCE: "bg-slate-500/10 text-slate-600",
  };
  return (
    <Badge className={`border-none ${map[status]}`}>{STATUS_LABEL[status]}</Badge>
  );
}


type Health = "online" | "warning" | "offline" | "none";

function getHealth(lastHeartbeatAt?: string | null): Health {
  if (!lastHeartbeatAt) return "none";
  const ts = new Date(lastHeartbeatAt).getTime();
  if (Number.isNaN(ts)) return "none";
  const diff = Date.now() - ts;
  if (diff <= 60_000) return "online";
  if (diff <= 5 * 60_000) return "warning";
  return "offline";
}

function formatRelative(iso?: string | null): string {
  if (!iso) return "—";
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "—";
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `há ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function HealthDot({ health }: { health: Health }) {
  const map = {
    online: { color: "bg-emerald-500", label: "Online" },
    warning: { color: "bg-amber-500", label: "Atenção" },
    offline: { color: "bg-red-500", label: "Offline" },
    none: { color: "bg-muted-foreground/40", label: "Sem heartbeat" },
  } as const;
  const item = map[health];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${item.color}`}>
        {health === "online" && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        )}
      </span>
      {item.label}
    </span>
  );
}

function AuthBadge({ status }: { status: Device["authStatus"] }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="border-none bg-emerald-500/10 text-emerald-600">
        <CheckCircle2 className="mr-1 h-3 w-3" /> Ativo
      </Badge>
    );
  }
  if (status === "PENDING") {
    return (
      <Badge className="border-none bg-amber-500/10 text-amber-600">
        <Clock className="mr-1 h-3 w-3" /> Pendente
      </Badge>
    );
  }
  return (
    <Badge className="border-none bg-red-500/10 text-red-600">
      <XCircle className="mr-1 h-3 w-3" /> Revogado
    </Badge>
  );
}

function DevicesPage() {
  useRequireModule(["DEVICES", "TOTEM"]);
  const navigate = useNavigate();
  const { token, loading: authLoading } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<UnifiedDevice | null>(null);
  const [credsDevice, setCredsDevice] = useState<UnifiedDevice | null>(null);
  const [credentials, setCredentials] = useState<DeviceCredentials | null>(null);
  const [editLegacy, setEditLegacy] = useState<UnifiedDevice | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [filterContext, setFilterContext] = useState<"" | "STORE" | "EVENT" | "NONE">("");
  const [filterStore, setFilterStore] = useState<string>("");
  const [filterEvent, setFilterEvent] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");


  // tick to refresh "online" badge based on heartbeat age
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!authLoading && !token) navigate({ to: "/admin/login" });
  }, [authLoading, token, navigate]);

  const {
    data: composite,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: qk.devices.list(orgId),
    enabled: !!token && !!orgId,
    queryFn: async () => {
      const t = token!;
      const [d, ev, stores] = await Promise.all([
        listDevices(t),
        listEvents(t).catch(() => []),
        listOnlineStores(t).catch(() => [] as OnlineStore[]),
      ]);

      const legacyResults = await Promise.all(
        ev.map((e) =>
          listPrinters(t, e.id)
            .then((list) => list.map((p) => mapLegacyPrinterToDevice(p, e)))
            .catch(() => [] as UnifiedDevice[]),
        ),
      );
      const legacy = legacyResults.flat();

      const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
      const deviceKeys = new Set<string>();
      const ipKeys = new Set<string>();
      for (const dv of d) {
        const evId = dv.eventId ?? "";
        deviceKeys.add(`${evId}|${norm(dv.name)}`);
        const m = (dv.metadata ?? {}) as Record<string, unknown>;
        const ip = typeof m.ip === "string" ? m.ip : "";
        const port = m.port !== undefined ? String(m.port) : "";
        if (ip) ipKeys.add(`${evId}|${ip}|${port}`);
      }
      const filteredLegacy = legacy.filter((lp) => {
        const evId = lp.eventId ?? "";
        if (deviceKeys.has(`${evId}|${norm(lp.name)}`)) return false;
        const m = (lp.metadata ?? {}) as Record<string, unknown>;
        const ip = typeof m.ip === "string" ? m.ip : "";
        const port = m.port !== undefined ? String(m.port) : "";
        if (ip && ipKeys.has(`${evId}|${ip}|${port}`)) return false;
        return true;
      });

      return {
        devices: [...(d as UnifiedDevice[]), ...filteredLegacy] as UnifiedDevice[],
        events: ev,
        stores,
      };
    },
  });

  const devices = composite?.devices ?? [];
  const events = composite?.events ?? [];
  const stores = composite?.stores ?? [];
  const error = queryError ? handleApiError(queryError, "Não foi possível carregar os dispositivos.") : null;

  const refreshDevices = () => {
    queryClient.invalidateQueries({ queryKey: qk.devices.list(orgId) });
  };

  const updateCachedDevices = (fn: (prev: UnifiedDevice[]) => UnifiedDevice[]) => {
    queryClient.setQueryData<{ devices: UnifiedDevice[]; events: EventItem[]; stores: OnlineStore[] }>(
      qk.devices.list(orgId),
      (prev) => (prev ? { ...prev, devices: fn(prev.devices) } : prev),
    );
  };

  const getDeviceContext = (dv: UnifiedDevice): "STORE" | "EVENT" | "NONE" => {
    if (dv.storeId) return "STORE";
    if (dv.eventId) return "EVENT";
    return "NONE";
  };



  const summary = useMemo(() => {
    let online = 0;
    let offline = 0;
    let pending = 0;
    let maintenance = 0;
    for (const dv of devices) {
      const h = getHealth(dv.lastHeartbeatAt);
      if (h === "online") online++;
      if (h === "offline" || h === "none") offline++;
      if (dv.authStatus === "PENDING") pending++;
      if (dv.status === "MAINTENANCE") maintenance++;
    }
    return { total: devices.length, online, offline, pending, maintenance };
  }, [devices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return devices.filter((dv) => {
      if (q && !`${dv.name} ${dv.code}`.toLowerCase().includes(q)) return false;
      const ctx = getDeviceContext(dv);
      if (filterContext && ctx !== filterContext) return false;
      if (filterStore && (dv.storeId ?? "") !== filterStore) return false;
      if (filterEvent && (dv.eventId ?? "") !== filterEvent) return false;
      if (filterType && dv.type !== filterType) return false;
      if (filterStatus && dv.status !== filterStatus) return false;
      return true;
    });
  }, [devices, search, filterContext, filterStore, filterEvent, filterType, filterStatus]);


  const upsertDevice = (dv: Device) => {
    updateCachedDevices((prev) => {
      const idx = prev.findIndex((d) => d.id === dv.id);
      if (idx === -1) return [dv as UnifiedDevice, ...prev];
      const next = [...prev];
      next[idx] = { ...next[idx], ...(dv as UnifiedDevice) };
      return next;
    });
    if (dv.type === "PRINTER" || dv.type === "SK210") {
      queryClient.invalidateQueries({ queryKey: qk.settings.printing(orgId) });
    }
  };

  const handleCopy = async (text: string, label = "Texto") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado!`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const handleRegenerate = async (dv: UnifiedDevice) => {
    if (!token) return;
    if (dv.source === "legacy_printer") {
      toast.error("Impressora legada não suporta geração de credenciais.");
      return;
    }
    try {
      const creds = await regenerateDeviceCredentials(token, dv.id);
      setCredentials(creds);
      setCredsDevice(dv);
      toast.success("Credenciais geradas com sucesso.");
    } catch (err) {
      handleApiError(err, "Não foi possível gerar credenciais.");
    }
  };

  const goToLegacyPrinter = (dv: UnifiedDevice) => {
    const evId = dv.legacyEventId ?? dv.eventId ?? "";
    if (!evId) {
      toast.error("Evento desta impressora não encontrado.");
      return;
    }
    navigate({ to: "/admin/events/$id", params: { id: evId } });
  };


  return (
    <AdminLayout
      title="Dispositivos"
      subtitle="Gerencie totens, SK210, telas de chamada e impressoras da organização."
      actions={
        <Button
          onClick={() => setCreateOpen(true)}
          className="text-primary-foreground shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Plus className="h-4 w-4" />
          Novo dispositivo
        </Button>
      }
    >
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard label="Total de dispositivos" value={summary.total} icon={Monitor} tone="default" />
        <SummaryCard label="Online" value={summary.online} icon={CheckCircle2} tone="success" />
        <SummaryCard label="Offline" value={summary.offline} icon={WifiOff} tone="danger" />
        <SummaryCard label="Em manutenção" value={summary.maintenance} icon={AlertTriangle} tone="muted" />
        <SummaryCard label="Pendentes de ativação" value={summary.pending} icon={Clock} tone="warning" />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou código…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>
          <select
            value={filterContext}
            onChange={(e) => {
              const v = e.target.value as "" | "STORE" | "EVENT" | "NONE";
              setFilterContext(v);
              if (v !== "STORE") setFilterStore("");
              if (v !== "EVENT") setFilterEvent("");
            }}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os contextos</option>
            <option value="STORE">Loja</option>
            <option value="EVENT">Evento</option>
            <option value="NONE">Sem vínculo</option>
          </select>
          {(filterContext === "" || filterContext === "STORE") && (
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todas as lojas</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {(filterContext === "" || filterContext === "EVENT") && (
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Todos os eventos</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os tipos</option>
            <option value="TOTEM">Totem</option>
            <option value="SK210">SK210</option>
            <option value="CALL_SCREEN">Tela de Chamada</option>
            <option value="PRINTER">Impressora</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos os status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="PAUSED">Pausado</option>
            <option value="OFFLINE">Offline</option>
            <option value="MAINTENANCE">Manutenção</option>
          </select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-border bg-card/60" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-2xl text-primary-foreground"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Monitor className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              Nenhum dispositivo cadastrado ainda.
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              Cadastre totens, telas de chamada, impressoras ou SK210 para começar a operar.
            </p>
            <Button onClick={() => setCreateOpen(true)} className="mt-2">
              <Plus className="h-4 w-4" /> Cadastrar primeiro dispositivo
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum dispositivo encontrado com os filtros atuais.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((dv) => (
            <DeviceCard
              key={dv.id}
              device={dv}
              contextType={getDeviceContext(dv)}
              storeName={stores.find((s) => s.id === dv.storeId)?.name ?? dv.store?.name ?? null}
              onEdit={() => (dv.source === "legacy_printer" ? setEditLegacy(dv) : setEditDevice(dv))}
              onRegenerate={() => handleRegenerate(dv)}
              onCopyCode={() => handleCopy(dv.code, "Código")}
              onOpenLegacy={() => goToLegacyPrinter(dv)}
              onViewDetails={() => {
                if (dv.source !== "legacy_printer") {
                  navigate({ to: "/admin/devices/$id", params: { id: dv.id } });
                }
              }}
            />
          ))}

        </div>
      )}


      <CreateDeviceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        events={events}
        stores={stores}
        token={token}
        onCreated={(dv) => {
          upsertDevice(dv);
          setCreateOpen(false);
        }}
      />

      {editDevice && (
        <EditDeviceDialog
          key={editDevice.id}
          device={editDevice}
          onOpenChange={(o) => !o && setEditDevice(null)}
          events={events}
          stores={stores}
          token={token}
          onUpdated={(dv) => {
            upsertDevice(dv);
            setEditDevice(null);
          }}
        />
      )}

      <LegacyPrinterEditDialog
        device={editLegacy}
        token={token}
        onOpenChange={(o) => !o && setEditLegacy(null)}
        onUpdated={(updated) => {
          updateCachedDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
          setEditLegacy(null);
        }}
      />

      <CredentialsDialog
        device={credsDevice}
        credentials={credentials}
        onOpenChange={(o) => {
          if (!o) {
            setCredsDevice(null);
            setCredentials(null);
          }
        }}
        onCopy={handleCopy}
      />
    </AdminLayout>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Monitor;
  tone: "default" | "success" | "danger" | "warning" | "muted";
}) {
  const toneCls: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600",
    danger: "bg-red-500/10 text-red-600",
    warning: "bg-amber-500/10 text-amber-600",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneCls[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceCard({
  device,
  contextType,
  storeName,
  onEdit,
  onRegenerate,
  onCopyCode,
  onOpenLegacy,
  onViewDetails,
}: {
  device: UnifiedDevice;
  contextType: "STORE" | "EVENT" | "NONE";
  storeName: string | null;
  onEdit: () => void;
  onRegenerate: () => void;
  onCopyCode: () => void;
  onOpenLegacy: () => void;
  onViewDetails: () => void;
}) {
  const Icon = TYPE_ICON[device.type] ?? Monitor;
  const health = getHealth(device.lastHeartbeatAt);
  const isPrinterish = device.type === "PRINTER" || device.type === "SK210";
  const pm = isPrinterish ? getPrinterMeta(device) : null;
  const isLegacy = device.source === "legacy_printer";

  return (
    <Card className="overflow-hidden shadow-sm transition-all hover:shadow-md">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="truncate text-base font-semibold text-foreground" title={device.name}>
                  {device.name}
                </h3>
                {isLegacy && (
                  <Badge
                    className="border-none bg-amber-500/10 text-amber-700 shrink-0"
                    title="Impressora cadastrada no módulo de Impressão do evento (modelo anterior)"
                  >
                    Impressora antiga
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wide text-foreground/80">
                  {TYPE_LABEL[device.type] ?? device.type}
                </span>{" "}
                · {device.code}
              </p>
            </div>
          </div>
          {!isLegacy && <HealthDot health={health} />}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Contexto:
          </span>
          <Badge className="border-none bg-primary/10 text-primary">
            {contextType === "STORE" ? "Loja" : contextType === "EVENT" ? "Evento" : "Sem vínculo"}
          </Badge>
          <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Operacional:
          </span>
          <StatusBadge status={device.status} />
          {!isLegacy && (
            <>
              <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Autenticação:
              </span>
              <AuthBadge status={device.authStatus} />
            </>
          )}
        </div>


        <div className="grid grid-cols-2 gap-3 text-xs">
          <Info
            label="Vinculado a"
            value={
              contextType === "STORE"
                ? storeName ?? "Loja"
                : contextType === "EVENT"
                  ? device.event?.name ?? "Evento"
                  : "—"
            }
          />
          <Info label="Localização" value={device.locationName ?? "—"} />
          {!isLegacy && (
            <>
              <Info label="Último heartbeat" value={formatRelative(device.lastHeartbeatAt)} />
              <Info label="Última ativação" value={formatDateTime(device.lastActivatedAt)} />
              <Info label="Versão do app" value={device.appVersion ?? "—"} />
              <Info label="IP" value={device.lastIpAddress ?? "—"} />
            </>
          )}
        </div>

        {pm && (pm.printerSector || pm.connectionType || pm.ipAddress || pm.port || pm.paperSize) && (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Impressora
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {pm.printerSector && (
                <Info
                  label="Setor"
                  value={
                    PRINT_SECTOR_LABEL[pm.printerSector as keyof typeof PRINT_SECTOR_LABEL] ??
                    pm.printerSector
                  }
                />
              )}
              {pm.connectionType && (
                <Info
                  label="Conexão"
                  value={
                    CONNECTION_LABEL[pm.connectionType as keyof typeof CONNECTION_LABEL] ??
                    pm.connectionType
                  }
                />
              )}
              {pm.ipAddress && <Info label="IP da impressora" value={pm.ipAddress} />}
              {pm.port !== undefined && <Info label="Porta" value={String(pm.port)} />}
              {pm.paperSize && <Info label="Papel" value={pm.paperSize} />}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-1 border-t border-border pt-3">
          {isLegacy ? (
            <>
              <Button variant="ghost" size="sm" onClick={onOpenLegacy}>
                <ExternalLink className="h-3.5 w-3.5" /> Ir para evento
              </Button>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={onCopyCode}>
                <Copy className="h-3.5 w-3.5" /> Copiar código
              </Button>
              <Button variant="ghost" size="sm" onClick={onRegenerate}>
                <KeyRound className="h-3.5 w-3.5" /> Gerar credenciais
              </Button>
              <Button variant="outline" size="sm" onClick={onViewDetails}>
                <Monitor className="h-3.5 w-3.5" /> Ver detalhes
              </Button>
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );


}

function Info({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {valueNode ? (
        <div className="mt-0.5">{valueNode}</div>
      ) : (
        <p className="truncate text-sm font-medium text-foreground" title={value}>
          {value}
        </p>
      )}
    </div>
  );
}

function CreateDeviceDialog({
  open,
  onOpenChange,
  events,
  stores,
  token,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  events: EventItem[];
  stores: OnlineStore[];
  token: string | null;
  onCreated: (dv: Device) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<DeviceType>("TOTEM");
  const [contextType, setContextType] = useState<"STORE" | "EVENT" | "NONE">("EVENT");
  const [eventId, setEventId] = useState<string>("");
  const [storeId, setStoreId] = useState<string>("");
  const [locationName, setLocationName] = useState("");
  const [printSector, setPrintSector] = useState<string>("FULL_ORDER");
  const [connectionType, setConnectionType] = useState<string>("TCP_IP");
  const [printerIp, setPrinterIp] = useState("");
  const [printerPort, setPrinterPort] = useState("");
  const [paperSize, setPaperSize] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setCode("");
      setType("TOTEM");
      setContextType("EVENT");
      setEventId("");
      setStoreId("");
      setLocationName("");
      setPrintSector("FULL_ORDER");
      setConnectionType("TCP_IP");
      setPrinterIp("");
      setPrinterPort("");
      setPaperSize("");
    }
  }, [open]);

  const isPrinterish = type === "PRINTER" || type === "SK210";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!name.trim() || !code.trim()) {
      toast.error("Preencha nome e código.");
      return;
    }
    if (contextType === "STORE" && !storeId) {
      toast.error("Selecione a loja.");
      return;
    }
    if (contextType === "EVENT" && !eventId) {
      toast.error("Selecione o evento.");
      return;
    }
    setSaving(true);
    try {
      const portNum = printerPort.trim() ? Number(printerPort.trim()) : undefined;
      const metadata: Record<string, unknown> | undefined = isPrinterish
        ? {
            printerSector: printSector,
            connectionType,
            ipAddress: printerIp.trim() || undefined,
            port: Number.isFinite(portNum) ? portNum : undefined,
            paperSize: paperSize.trim() || undefined,
          }
        : undefined;
      const dv = await createDevice(token, {
        name: name.trim(),
        code: code.trim(),
        type,
        eventId: contextType === "EVENT" ? eventId : null,
        storeId: contextType === "STORE" ? storeId : null,
        locationName: locationName.trim() || null,
        ...(metadata ? { metadata } : {}),
      });
      toast.success("Dispositivo criado com sucesso.");
      onCreated(dv);
    } catch (err) {
      handleApiError(err, "Não foi possível criar o dispositivo.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo dispositivo</DialogTitle>
          <DialogDescription>
            Cadastre um totem, SK210, tela de chamada ou impressora.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dv-name">Nome</Label>
            <Input id="dv-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dv-code">Código</Label>
            <Input id="dv-code" value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dv-type">Tipo</Label>
            <select
              id="dv-type"
              value={type}
              onChange={(e) => setType(e.target.value as DeviceType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="TOTEM">Totem</option>
              <option value="SK210">SK210</option>
              <option value="CALL_SCREEN">Tela de Chamada</option>
              <option value="PRINTER">Impressora</option>
            </select>
          </div>
          <ContextSelector
            prefix="dv"
            contextType={contextType}
            setContextType={(v) => {
              setContextType(v);
              if (v !== "STORE") setStoreId("");
              if (v !== "EVENT") setEventId("");
            }}
            storeId={storeId}
            setStoreId={setStoreId}
            eventId={eventId}
            setEventId={setEventId}
            stores={stores}
            events={events}
          />
          <div className="space-y-1.5">
            <Label htmlFor="dv-loc">Localização</Label>
            <Input
              id="dv-loc"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="Ex.: Entrada principal"
            />
          </div>
          {isPrinterish && (
            <PrinterFields
              prefix="dv"
              printSector={printSector}
              setPrintSector={setPrintSector}
              connectionType={connectionType}
              setConnectionType={setConnectionType}
              ip={printerIp}
              setIp={setPrinterIp}
              port={printerPort}
              setPort={setPrinterPort}
              paperSize={paperSize}
              setPaperSize={setPaperSize}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar dispositivo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDeviceDialog({
  device,
  onOpenChange,
  events,
  stores,
  token,
  onUpdated,
}: {
  device: Device | null;
  onOpenChange: (o: boolean) => void;
  events: EventItem[];
  stores: OnlineStore[];
  token: string | null;
  onUpdated: (dv: Device) => void;
}) {
  // Initialize state lazily from the device so values from metadata
  // are present on the very first render (no flicker / no defaults).
  const initialMeta = device ? getPrinterMeta(device) : null;
  const initialCtx: "STORE" | "EVENT" | "NONE" = device?.storeId
    ? "STORE"
    : device?.eventId
      ? "EVENT"
      : "NONE";
  const [name, setName] = useState(device?.name ?? "");
  const [type, setType] = useState<DeviceType>(device?.type ?? "TOTEM");
  const [status, setStatus] = useState<DeviceStatus>(device?.status ?? "ACTIVE");
  const [contextType, setContextType] = useState<"STORE" | "EVENT" | "NONE">(initialCtx);
  const [eventId, setEventId] = useState<string>(device?.eventId ?? "");
  const [storeId, setStoreId] = useState<string>(device?.storeId ?? "");
  const [locationName, setLocationName] = useState(device?.locationName ?? "");
  const [printSector, setPrintSector] = useState<string>(
    initialMeta?.printerSector ?? "FULL_ORDER",
  );
  const [connectionType, setConnectionType] = useState<string>(
    initialMeta?.connectionType ?? "TCP_IP",
  );
  const [printerIp, setPrinterIp] = useState(initialMeta?.ipAddress ?? "");
  const [printerPort, setPrinterPort] = useState(
    initialMeta?.port !== undefined ? String(initialMeta.port) : "",
  );
  const [paperSize, setPaperSize] = useState(initialMeta?.paperSize ?? "");
  const [saving, setSaving] = useState(false);

  if (!device) return null;


  const isPrinterish = type === "PRINTER" || type === "SK210";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (contextType === "STORE" && !storeId) {
      toast.error("Selecione a loja.");
      return;
    }
    if (contextType === "EVENT" && !eventId) {
      toast.error("Selecione o evento.");
      return;
    }
    setSaving(true);
    try {
      const portNum = printerPort.trim() ? Number(printerPort.trim()) : undefined;
      const existing = { ...(device.metadata ?? {}) } as Record<string, unknown>;
      // Strip heartbeat / runtime fields so they don't pollute config
      delete existing.network;
      delete existing.printerStatus;
      delete existing.pendingPrintJobs;
      delete existing.printSector;
      delete existing.ip;
      const metadata: Record<string, unknown> | undefined = isPrinterish
        ? {
            ...existing,
            printerSector: printSector,
            connectionType,
            ipAddress: printerIp.trim() || undefined,
            port: Number.isFinite(portNum) ? portNum : undefined,
            paperSize: paperSize.trim() || undefined,
          }
        : undefined;
      const dv = await updateDevice(token, device.id, {
        name: name.trim(),
        type,
        status,
        eventId: contextType === "EVENT" ? eventId : null,
        storeId: contextType === "STORE" ? storeId : null,
        locationName: locationName.trim() || null,
        ...(metadata ? { metadata } : {}),
      });
      toast.success("Dispositivo atualizado.");
      onUpdated(dv);
    } catch (err) {
      handleApiError(err, "Não foi possível atualizar o dispositivo.");
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={!!device} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar dispositivo</DialogTitle>
          <DialogDescription>Atualize as informações deste dispositivo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ed-name">Nome</Label>
            <Input id="ed-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-type">Tipo</Label>
            <select
              id="ed-type"
              value={type}
              onChange={(e) => setType(e.target.value as DeviceType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="TOTEM">Totem</option>
              <option value="SK210">SK210</option>
              <option value="CALL_SCREEN">Tela de Chamada</option>
              <option value="PRINTER">Impressora</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ed-status">Status operacional</Label>
            <select
              id="ed-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as DeviceStatus)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ACTIVE">Ativo</option>
              <option value="PAUSED">Pausado</option>
              <option value="OFFLINE">Offline</option>
              <option value="MAINTENANCE">Manutenção</option>
            </select>
          </div>
          <ContextSelector
            prefix="ed"
            contextType={contextType}
            setContextType={(v) => {
              setContextType(v);
              if (v !== "STORE") setStoreId("");
              if (v !== "EVENT") setEventId("");
            }}
            storeId={storeId}
            setStoreId={setStoreId}
            eventId={eventId}
            setEventId={setEventId}
            stores={stores}
            events={events}
          />
          <div className="space-y-1.5">
            <Label htmlFor="ed-loc">Localização</Label>
            <Input
              id="ed-loc"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
            />
          </div>
          {isPrinterish && (
            <PrinterFields
              prefix="ed"
              printSector={printSector}
              setPrintSector={setPrintSector}
              connectionType={connectionType}
              setConnectionType={setConnectionType}
              ip={printerIp}
              setIp={setPrinterIp}
              port={printerPort}
              setPort={setPrinterPort}
              paperSize={paperSize}
              setPaperSize={setPaperSize}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CredentialsDialog({
  device,
  credentials,
  onOpenChange,
  onCopy,
}: {
  device: Device | null;
  credentials: DeviceCredentials | null;
  onOpenChange: (o: boolean) => void;
  onCopy: (text: string, label?: string) => void;
}) {
  const open = !!device && !!credentials;
  const deviceCode = credentials?.deviceCode || device?.code || "";

  const copyAll = () => {
    if (!credentials) return;
    const text = `Device Code: ${deviceCode}\nDevice Secret: ${credentials.deviceSecret}`;
    onCopy(text, "Credenciais");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary" /> Credenciais geradas
          </DialogTitle>
          <DialogDescription>
            {device ? `${device.name} (${device.code})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
          <strong className="block">Copie agora.</strong>
          Este segredo não será exibido novamente.
        </div>

        <div className="space-y-3">
          <CredField
            label="Device Code"
            value={deviceCode}
            onCopy={() => onCopy(deviceCode, "Device Code")}
          />
          <CredField
            label="Device Secret"
            value={credentials?.deviceSecret ?? ""}
            onCopy={() => credentials && onCopy(credentials.deviceSecret, "Device Secret")}
            mono
          />
        </div>


        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={copyAll}>
            <Copy className="h-4 w-4" /> Copiar credenciais
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CredField({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          readOnly
          value={value}
          className={mono ? "font-mono text-xs" : "font-mono text-xs"}
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button type="button" variant="outline" size="icon" onClick={onCopy}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ContextSelector({
  prefix,
  contextType,
  setContextType,
  storeId,
  setStoreId,
  eventId,
  setEventId,
  stores,
  events,
}: {
  prefix: string;
  contextType: "STORE" | "EVENT" | "NONE";
  setContextType: (v: "STORE" | "EVENT" | "NONE") => void;
  storeId: string;
  setStoreId: (v: string) => void;
  eventId: string;
  setEventId: (v: string) => void;
  stores: OnlineStore[];
  events: EventItem[];
}) {
  const btn = (v: "STORE" | "EVENT" | "NONE", label: string) => {
    const active = contextType === v;
    return (
      <button
        type="button"
        key={v}
        onClick={() => setContextType(v)}
        className={`h-10 flex-1 rounded-md border px-3 text-sm transition-colors ${
          active
            ? "border-primary bg-primary/10 text-primary"
            : "border-input bg-background text-foreground hover:bg-muted/40"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        <Label>Contexto</Label>
        <div className="flex gap-2">
          {btn("STORE", "Loja")}
          {btn("EVENT", "Evento")}
          {btn("NONE", "Sem vínculo")}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Selecione onde este dispositivo irá operar.
        </p>
      </div>
      {contextType === "STORE" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-store`}>Loja</Label>
          <select
            id={`${prefix}-store`}
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Selecione a loja —</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {contextType === "EVENT" && (
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-event`}>Evento</Label>
          <select
            id={`${prefix}-event`}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Selecione o evento —</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function PrinterFields({
  prefix,
  printSector,
  setPrintSector,
  connectionType,
  setConnectionType,
  ip,
  setIp,
  port,
  setPort,
  paperSize,
  setPaperSize,
}: {
  prefix: string;
  printSector: string;
  setPrintSector: (v: string) => void;
  connectionType: string;
  setConnectionType: (v: string) => void;
  ip: string;
  setIp: (v: string) => void;
  port: string;
  setPort: (v: string) => void;
  paperSize: string;
  setPaperSize: (v: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Configuração da impressora
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-sector`}>Setor</Label>
          <select
            id={`${prefix}-sector`}
            value={printSector}
            onChange={(e) => setPrintSector(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="FULL_ORDER">Pedido completo</option>
            <option value="BAR">Bar</option>
            <option value="KITCHEN">Cozinha</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-conn`}>Conexão</Label>
          <select
            id={`${prefix}-conn`}
            value={connectionType}
            onChange={(e) => setConnectionType(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="TCP_IP">TCP/IP</option>
            <option value="SK210_LOCAL">SK210 local</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-ip`}>IP</Label>
          <Input
            id={`${prefix}-ip`}
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.0.10"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${prefix}-port`}>Porta</Label>
          <Input
            id={`${prefix}-port`}
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="9100"
          />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label htmlFor={`${prefix}-paper`}>Tamanho do papel</Label>
          <Input
            id={`${prefix}-paper`}
            value={paperSize}
            onChange={(e) => setPaperSize(e.target.value)}
            placeholder="80mm"
          />
        </div>
      </div>
    </div>
  );
}

function LegacyPrinterEditDialog({
  device,
  token,
  onOpenChange,
  onUpdated,
}: {
  device: UnifiedDevice | null;
  token: string | null;
  onOpenChange: (o: boolean) => void;
  onUpdated: (dv: UnifiedDevice) => void;
}) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState<PrinterSector>("FULL_ORDER");
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>("TCP_IP");
  const [ip, setIp] = useState("");
  const [port, setPort] = useState("");
  const [paperSize, setPaperSize] = useState<PrinterPaper>("80mm");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!device) return;
    const m = (device.metadata ?? {}) as Record<string, unknown>;
    setName(device.name ?? "");
    const rawSector = String(m.printSector ?? "").toUpperCase();
    setSector(
      rawSector === "BAR" || rawSector === "KITCHEN"
        ? (rawSector as PrinterSector)
        : "FULL_ORDER",
    );
    setConnectionType(
      (m.connectionType as PrinterConnectionType) ?? "TCP_IP",
    );
    setIp(typeof m.ip === "string" ? m.ip : "");
    setPort(m.port !== undefined ? String(m.port) : "");
    setPaperSize(((m.paperSize as PrinterPaper) ?? "80mm"));
    setActive(device.status === "ACTIVE");
  }, [device]);

  if (!device) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !device.legacyPrinterId) return;
    if (!name.trim()) {
      toast.error("Informe o nome da impressora.");
      return;
    }
    setSaving(true);
    try {
      const updated = await updatePrinter(token, device.legacyPrinterId, {
        name: name.trim(),
        sector,
        connectionType,
        ipAddress: ip.trim(),
        port: Number(port) || 9100,
        paperSize,
        active,
      });
      const mapped: UnifiedDevice = {
        ...device,
        name: updated.name,
        status: updated.active ? "ACTIVE" : "OFFLINE",
        metadata: {
          ...(device.metadata ?? {}),
          printSector:
            String(updated.sector).toUpperCase() === "FULL_ORDER"
              ? "FULL_ORDER"
              : updated.sector,
          connectionType: updated.connectionType,
          ip: updated.ipAddress,
          port: updated.port,
          paperSize: updated.paperSize,
        },
      };
      toast.success("Impressora atualizada.");
      onUpdated(mapped);
    } catch (err) {
      handleApiError(err, "Não foi possível atualizar a impressora.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!device} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar impressora</DialogTitle>
          <DialogDescription>
            Impressora cadastrada no módulo de Impressão do evento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lp-name">Nome</Label>
            <Input id="lp-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lp-sector">Setor</Label>
              <select
                id="lp-sector"
                value={sector}
                onChange={(e) => setSector(e.target.value as PrinterSector)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="FULL_ORDER">Pedido completo</option>
                <option value="BAR">Bar</option>
                <option value="KITCHEN">Cozinha</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-conn">Conexão</Label>
              <select
                id="lp-conn"
                value={connectionType}
                onChange={(e) => setConnectionType(e.target.value as PrinterConnectionType)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="TCP_IP">TCP/IP</option>
                <option value="SK210_LOCAL">SK210 local</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-ip">IP</Label>
              <Input id="lp-ip" value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.0.10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-port">Porta</Label>
              <Input id="lp-port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="9100" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-paper">Papel</Label>
              <select
                id="lp-paper"
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PrinterPaper)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="80mm">80mm</option>
                <option value="58mm">58mm</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lp-active">Ativa</Label>
              <select
                id="lp-active"
                value={active ? "1" : "0"}
                onChange={(e) => setActive(e.target.value === "1")}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="1">Sim</option>
                <option value="0">Não</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
