import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import {
  ArrowLeft,
  Monitor,
  Printer,
  Menu,
  FileText,
  Settings,
  History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import { getDevice, type Device } from "@/lib/devices-api";
import { AdminLayout } from "@/components/admin-layout";

export const Route = createFileRoute("/admin/devices/$id")({
  component: DeviceDetailPage,
});

function DeviceDetailPage() {
  const { id } = Route.useParams();
  const { token, loading: authLoading } = useAuth();
  const orgId = useOrgId();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: device, isLoading, error } = useQuery({
    queryKey: qk.devices.detail(orgId, id),
    enabled: !!token && !!orgId && !!id,
    queryFn: async () => {
      if (!token) throw new Error("No token");
      return getDevice(token, id);
    },
  });

  const apiError = error ? handleApiError(error, "Não foi possível carregar o dispositivo.") : null;

  useEffect(() => {
    if (!authLoading && !token) navigate({ to: "/admin/login" });
  }, [authLoading, token, navigate]);

  if (isLoading) {
    return (
      <AdminLayout title="Dispositivo" subtitle="Carregando…">
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AdminLayout>
    );
  }

  if (apiError || !device) {
    return (
      <AdminLayout title="Dispositivo" subtitle="Erro">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-muted-foreground">
            {apiError || "Dispositivo não encontrado"}
          </p>
          <Button onClick={() => navigate({ to: "/admin/devices" })} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={device.name}
      subtitle={`${device.code} · ${getDeviceTypeLabel(device.type)}`}
      actions={
        <Button variant="outline" onClick={() => navigate({ to: "/admin/devices" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      }
    >
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <Monitor className="mr-2 h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger value="menu">
            <Menu className="mr-2 h-4 w-4" /> Cardápio
          </TabsTrigger>
          <TabsTrigger value="printing">
            <Printer className="mr-2 h-4 w-4" /> Impressão
          </TabsTrigger>
          <TabsTrigger value="queue">
            <FileText className="mr-2 h-4 w-4" /> Fila
          </TabsTrigger>
          <TabsTrigger value="logs">
            <History className="mr-2 h-4 w-4" /> Logs
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="mr-2 h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        <div className="mt-6 space-y-6">
          <TabsContent value="overview">
            <OverviewTab device={device} />
          </TabsContent>

          <TabsContent value="menu">
            <MenuTab device={device} />
          </TabsContent>

          <TabsContent value="printing">
            <PrintingTab device={device} />
          </TabsContent>

          <TabsContent value="queue">
            <QueueTab device={device} />
          </TabsContent>

          <TabsContent value="logs">
            <LogsTab device={device} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab device={device} />
          </TabsContent>
        </div>
      </Tabs>
    </AdminLayout>
  );
}

function getDeviceTypeLabel(type: Device["type"]) {
  const labels: Record<Device["type"], string> = {
    TOTEM: "Totem",
    SK210: "SK210",
    CALL_SCREEN: "Tela de Chamada",
    PRINTER: "Impressora",
  };
  return labels[type] || type;
}

function OverviewTab({ device }: { device: Device }) {
  const health = getHealth(device.lastHeartbeatAt);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Informações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <StatusBadge status={device.status} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Saúde</span>
            <HealthBadge health={health} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Autenticação</span>
            <AuthBadge status={device.authStatus} />
          </div>
          <Separator />
          <InfoRow label="Código" value={device.code} />
          <InfoRow label="Tipo" value={getDeviceTypeLabel(device.type)} />
          <InfoRow label="Localização" value={device.locationName} />
          <InfoRow
            label="Vinculado a"
            value={
              device.store?.name ||
              device.event?.name ||
              "Sem vínculo"
            }
          />
          <InfoRow label="Versão do App" value={device.appVersion} />
          <InfoRow label="Último Heartbeat" value={formatRelative(device.lastHeartbeatAt)} />
          <InfoRow label="Última Ativação" value={formatDateTime(device.lastActivatedAt)} />
          <InfoRow label="IP" value={device.lastIpAddress} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Impressora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const meta = getPrinterMeta(device);
            if (!meta.printerSector && !meta.connectionType && !meta.ipAddress && !meta.port && !meta.paperSize) {
              return <p className="text-sm text-muted-foreground">Nenhuma configuração de impressora definida.</p>;
            }
            return (
              <>
                {meta.printerSector && <InfoRow label="Setor" value={getPrintSectorLabel(meta.printerSector)} />}
                {meta.connectionType && <InfoRow label="Conexão" value={getConnectionLabel(meta.connectionType)} />}
                {meta.ipAddress && <InfoRow label="IP" value={meta.ipAddress} />}
                {meta.port && <InfoRow label="Porta" value={String(meta.port)} />}
                {meta.paperSize && <InfoRow label="Papel" value={meta.paperSize} />}
              </>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

function MenuTab({ device }: { device: Device }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cardápio</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Configurações do cardápio serão exibidas aqui.</p>
      </CardContent>
    </Card>
  );
}

function PrintingTab({ device }: { device: Device }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Impressão</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Configurações de impressão serão exibidas aqui.</p>
      </CardContent>
    </Card>
  );
}

function QueueTab({ device }: { device: Device }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fila de Impressão</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Fila de impressão será exibida aqui.</p>
      </CardContent>
    </Card>
  );
}

function LogsTab({ device }: { device: Device }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Logs do dispositivo serão exibidos aqui.</p>
      </CardContent>
    </Card>
  );
}

function SettingsTab({ device }: { device: Device }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurações</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Configurações adicionais serão exibidas aqui.</p>
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: Device["status"] }) {
  const map: Record<Device["status"], { label: string; className: string }> = {
    ACTIVE: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-600" },
    PAUSED: { label: "Pausado", className: "bg-amber-500/10 text-amber-600" },
    OFFLINE: { label: "Offline", className: "bg-red-500/10 text-red-600" },
    MAINTENANCE: { label: "Manutenção", className: "bg-slate-500/10 text-slate-600" },
  };
  const info = map[status] || { label: status, className: "bg-slate-500/10 text-slate-600" };
  return <Badge className={info.className}>{info.label}</Badge>;
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

function HealthBadge({ health }: { health: Health }) {
  const map: Record<Health, { label: string; className: string }> = {
    online: { label: "Online", className: "bg-emerald-500/10 text-emerald-600" },
    warning: { label: "Aviso", className: "bg-amber-500/10 text-amber-600" },
    offline: { label: "Offline", className: "bg-red-500/10 text-red-600" },
    none: { label: "Sem heartbeat", className: "bg-slate-500/10 text-slate-600" },
  };
  const info = map[health];
  return <Badge className={info.className}>{info.label}</Badge>;
}

function AuthBadge({ status }: { status: Device["authStatus"] }) {
  const map: Record<Device["authStatus"], { label: string; className: string }> = {
    ACTIVE: { label: "Ativo", className: "bg-emerald-500/10 text-emerald-600" },
    PENDING: { label: "Pendente", className: "bg-amber-500/10 text-amber-600" },
    REVOKED: { label: "Revogado", className: "bg-red-500/10 text-red-600" },
  };
  const info = map[status] || { label: status, className: "bg-slate-500/10 text-slate-600" };
  return <Badge className={info.className}>{info.label}</Badge>;
}

function getPrinterMeta(d: Device): {
  printerSector?: string;
  connectionType?: string;
  ipAddress?: string;
  port?: string | number;
  paperSize?: string;
} {
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

function getPrintSectorLabel(sector: string) {
  const labels: Record<string, string> = {
    FULL_ORDER: "Pedido completo",
    BAR: "Bar",
    KITCHEN: "Cozinha",
  };
  return labels[sector] || sector;
}

function getConnectionLabel(type: string) {
  const labels: Record<string, string> = {
    TCP_IP: "TCP/IP",
    SK210_LOCAL: "SK210 local",
  };
  return labels[type] || type;
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
