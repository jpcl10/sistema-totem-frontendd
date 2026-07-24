import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Clock,
  Eye,
  Printer,
  RefreshCw,
  RotateCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { ThermalReceipt } from "@/components/ThermalReceipt";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEventSocket } from "@/hooks/use-event-socket";
import { useOrgId } from "@/hooks/use-org-id";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import { listDevices, type Device } from "@/lib/devices-api";
import { getTotemReadiness, listEvents, type EventItem, type TotemReadiness } from "@/lib/events-api";
import { getMercadoPagoStatus } from "@/lib/payment-settings-api";
import {
  cancelPrintJobRequest,
  createTestPrintJobRequest,
  listEventPrintJobs,
  retryPrintJobRequest,
  type PrintJob,
} from "@/lib/print-queue";
import { qk } from "@/lib/query-keys";
import { getPrintingSettings, type EffectivePrintingSettings } from "@/lib/settings-api";
import { useRequireModule } from "@/lib/require-module";

export const Route = createFileRoute("/admin/print-queue")({
  component: PrintQueuePage,
  validateSearch: (search: Record<string, unknown>) => {
    const status = (search.status as string)?.toUpperCase();
    const validStatuses = ["PENDING", "PRINTED", "ERROR", "CANCELLED", "ALL"];
    return {
      status: (validStatuses.includes(status) ? status : "PENDING") as StatusTab,
    };
  },
});

type StatusTab = "PENDING" | "PRINTED" | "ERROR" | "CANCELLED" | "ALL";
type SectorFilter = "ALL" | "GENERAL" | "BAR" | "KITCHEN";
type TestSector = "GENERAL" | "BAR" | "KITCHEN";

const NONE = "__none__";

function shortId(id?: string | null) {
  if (!id) return "-";
  return id.length <= 10 ? id : `${id.slice(0, 6)}...${id.slice(-4)}`;
}

function dateTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function payloadOf(job: PrintJob): Record<string, any> {
  return ((job as any).payload && typeof (job as any).payload === "object" ? (job as any).payload : {}) as Record<string, any>;
}

function jobSector(job: PrintJob) {
  const payload = payloadOf(job);
  const raw =
    payload.printerSector ||
    payload.sector ||
    (job as any).sector ||
    payload.type ||
    "GENERAL";
  const value = String(raw).toUpperCase();
  if (value.includes("BAR")) return "BAR";
  if (value.includes("KITCHEN") || value.includes("COZINHA")) return "KITCHEN";
  return "GENERAL";
}

function jobSource(job: PrintJob) {
  const payload = payloadOf(job);
  return String(payload.source || (job as any).order?.source || "EVENT");
}

function jobOrder(job: PrintJob) {
  const payload = payloadOf(job);
  return (
    (job as any).order?.orderNumber ||
    payload.orderNumber ||
    payload.orderId ||
    (job as any).orderId ||
    "TEST"
  );
}

function statusBadge(status: string) {
  if (status === "PRINTED" || status === "COMPLETED") {
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> Impresso</Badge>;
  }
  if (status === "PENDING") {
    return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
  }
  if (status === "PROCESSING" || status === "RETRY") {
    return <Badge variant="outline" className="gap-1"><RotateCw className="h-3 w-3" /> {status}</Badge>;
  }
  if (status === "CANCELLED") {
    return <Badge variant="outline" className="gap-1"><Ban className="h-3 w-3" /> Cancelado</Badge>;
  }
  return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Erro</Badge>;
}

function deviceOnline(device: Device) {
  if (device.status !== "ACTIVE" || !device.lastHeartbeatAt) return false;
  return Date.now() - new Date(device.lastHeartbeatAt).getTime() <= 2 * 60 * 1000;
}

function deviceLabel(deviceId: string | null | undefined, devices: Device[]) {
  if (!deviceId) return "Nao configurado";
  const device = devices.find((item) => item.id === deviceId);
  return device ? `${device.name} (${shortId(device.id)})` : shortId(deviceId);
}

function PrintQueuePage() {
  useRequireModule(["PRINTING"]);
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/admin/print-queue" });

  const [eventId, setEventId] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>(search.status ?? "PENDING");
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>("ALL");
  const [preview, setPreview] = useState<PrintJob | null>(null);
  const [cancelDialog, setCancelDialog] = useState<PrintJob | null>(null);
  const [testDeviceId, setTestDeviceId] = useState("");
  const [testSector, setTestSector] = useState<TestSector>("GENERAL");
  const [receiptWidth, setReceiptWidth] = useState<"58mm" | "80mm">("80mm");

  useEffect(() => {
    setStatusTab(search.status ?? "PENDING");
  }, [search.status]);

  const eventsQuery = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId,
  });

  const events = eventsQuery.data ?? [];
  useEffect(() => {
    if (!eventId && events.length > 0) setEventId(events[0].id);
  }, [eventId, events]);

  const selectedEvent = events.find((event) => event.id === eventId) ?? null;

  const jobsQuery = useQuery({
    queryKey: qk.printQueue.list(orgId, { eventId }),
    queryFn: () => listEventPrintJobs(token!, eventId),
    enabled: !!token && !!orgId && !!eventId,
    refetchInterval: 8000,
  });

  const devicesQuery = useQuery({
    queryKey: qk.devices.list(orgId, { printingPanel: true }),
    queryFn: () => listDevices(token!),
    enabled: !!token && !!orgId,
    staleTime: 15_000,
  });

  const printingQuery = useQuery({
    queryKey: qk.settings.printing(orgId),
    queryFn: () => getPrintingSettings(token!),
    enabled: !!token && !!orgId,
  });

  const mercadoPagoQuery = useQuery({
    queryKey: ["mercado-pago-status", orgId],
    queryFn: () => getMercadoPagoStatus(token!),
    enabled: !!token && !!orgId,
  });

  const readinessQuery = useQuery({
    queryKey: ["totem-readiness", orgId, eventId],
    queryFn: () => getTotemReadiness(token!, eventId),
    enabled: !!token && !!orgId && !!eventId,
    refetchInterval: 10000,
  });

  const invalidateOperationalData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.printQueue.list(orgId, { eventId }) }),
      queryClient.invalidateQueries({ queryKey: ["totem-readiness", orgId, eventId] }),
      queryClient.invalidateQueries({ queryKey: ["mercado-pago-status", orgId] }),
      queryClient.invalidateQueries({ queryKey: qk.devices.list(orgId, { printingPanel: true }) }),
    ]);
  };

  useEventSocket({
    eventId,
    token,
    onOrderCreated: () => void invalidateOperationalData(),
    onOrderUpdated: () => void invalidateOperationalData(),
  });

  const testMutation = useMutation({
    mutationFn: () => {
      if (!token || !eventId || !testDeviceId) throw new Error("Selecione evento e dispositivo.");
      return createTestPrintJobRequest(token, eventId, {
        deviceId: testDeviceId,
        sector: testSector,
      });
    },
    onSuccess: async () => {
      toast.success("Job de teste criado. Aguarde o TotemBridge buscar e confirmar.");
      await invalidateOperationalData();
    },
    onError: (error) => handleApiError(error, "Nao foi possivel criar o teste de impressao."),
  });

  const jobs = jobsQuery.data ?? [];
  const devices = devicesQuery.data ?? [];
  const printing = printingQuery.data?.effective ?? null;
  const readiness = readinessQuery.data ?? null;

  const printerDevices = devices.filter(
    (device) =>
      device.type === "PRINTER" ||
      device.type === "PRINT_AGENT" ||
      device.type === "SK210"
  );
  const totemDevices = devices.filter((device) => device.type === "TOTEM");
  const onlineDevices = devices.filter(deviceOnline);

  useEffect(() => {
    if (!testDeviceId) {
      const preferred =
        totemDevices.find((device) => device.eventId === eventId && deviceOnline(device)) ??
        totemDevices.find((device) => device.eventId === eventId) ??
        printerDevices.find(deviceOnline) ??
        printerDevices[0];
      if (preferred) setTestDeviceId(preferred.id);
    }
  }, [eventId, printerDevices, testDeviceId, totemDevices]);

  const counts = useMemo(() => {
    const printed = jobs.filter((job: any) => job.status === "PRINTED" || job.status === "COMPLETED");
    return {
      PENDING: jobs.filter((job: any) => job.status === "PENDING").length,
      PRINTED: printed.length,
      ERROR: jobs.filter((job: any) => job.status === "ERROR").length,
      CANCELLED: jobs.filter((job: any) => job.status === "CANCELLED").length,
      ALL: jobs.length,
      lastPrintedAt: printed
        .map((job: any) => job.printedAt || job.completedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
    };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job: any) => {
      const status = job.status === "COMPLETED" ? "PRINTED" : job.status;
      if (statusTab !== "ALL" && status !== statusTab) return false;
      if (sectorFilter !== "ALL" && jobSector(job) !== sectorFilter) return false;
      return true;
    });
  }, [jobs, sectorFilter, statusTab]);

  const cancelJob = async (job: PrintJob) => {
    if (!token) return;
    try {
      await cancelPrintJobRequest(token, job.id);
      setCancelDialog(null);
      toast.success("Job cancelado.");
      await invalidateOperationalData();
    } catch (error) {
      handleApiError(error, "Nao foi possivel cancelar o job.");
    }
  };

  const retryJob = async (job: PrintJob) => {
    if (!token) return;
    try {
      await retryPrintJobRequest(token, job.id);
      toast.success("Job reenviado para a fila.");
      await invalidateOperationalData();
    } catch (error) {
      handleApiError(error, "Nao foi possivel reenviar o job.");
    }
  };

  return (
    <AdminLayout
      title="Impressao"
      subtitle="Painel operacional para PIX no TOTEM, fila oficial e prontidao de impressao."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={eventId} onValueChange={(value) => { setEventId(value); setTestDeviceId(""); }}>
            <SelectTrigger className="h-9 w-[240px]">
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" disabled={!eventId || jobsQuery.isFetching} onClick={() => void invalidateOperationalData()}>
            <RotateCw className={`h-4 w-4 ${jobsQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <StatusOverview
          printing={printing}
          devicesOnline={onlineDevices.length}
          printersConfigured={printerDevices.length}
          pendingJobs={counts.PENDING}
          errorJobs={counts.ERROR}
          lastPrintedAt={counts.lastPrintedAt}
        />

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <ReadinessCard readiness={readiness} loading={readinessQuery.isLoading} />
          <MercadoPagoCard status={mercadoPagoQuery.data ?? readiness?.mercadoPago ?? null} />
        </div>

        <ConfigurationCard
          event={selectedEvent}
          printing={printing}
          devices={devices}
          readiness={readiness}
          onRefresh={() => void invalidateOperationalData()}
        />

        <TestPrintCard
          devices={[...totemDevices, ...printerDevices]}
          selectedDeviceId={testDeviceId}
          setSelectedDeviceId={setTestDeviceId}
          sector={testSector}
          setSector={setTestSector}
          onTest={() => testMutation.mutate()}
          loading={testMutation.isPending}
        />

        <DevicesCard devices={devices} eventId={eventId} />

        <QueueCard
          jobs={filteredJobs}
          counts={counts}
          statusTab={statusTab}
          setStatusTab={setStatusTab}
          sectorFilter={sectorFilter}
          setSectorFilter={setSectorFilter}
          devices={devices}
          loading={jobsQuery.isFetching}
          onPreview={setPreview}
          onCancel={setCancelDialog}
          onRetry={retryJob}
        />
      </div>

      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payload seguro do job</DialogTitle>
            <DialogDescription>
              Dados operacionais enviados pela fila oficial. Segredos e tokens nao fazem parte deste payload.
            </DialogDescription>
          </DialogHeader>
          {preview && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3 text-sm">
                <InfoLine label="Job" value={preview.id} mono />
                <InfoLine label="Status" value={(preview as any).status} />
                <InfoLine label="Origem" value={jobSource(preview)} />
                <InfoLine label="Setor" value={jobSector(preview)} />
                <InfoLine label="Pedido" value={String(jobOrder(preview))} />
                <InfoLine label="Dispositivo" value={deviceLabel((preview as any).deviceId, devices)} />
                <InfoLine label="Impressora" value={payloadOf(preview).printer?.name ?? shortId((preview as any).printerId)} />
                <InfoLine label="Tentativas" value={String((preview as any).attempts ?? 0)} />
                <InfoLine label="Erro" value={(preview as any).errorMessage ?? (preview as any).lastError ?? "-"} />
                <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(payloadOf(preview), null, 2)}
                </pre>
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button variant={receiptWidth === "58mm" ? "default" : "outline"} size="sm" onClick={() => setReceiptWidth("58mm")}>58mm</Button>
                  <Button variant={receiptWidth === "80mm" ? "default" : "outline"} size="sm" onClick={() => setReceiptWidth("80mm")}>80mm</Button>
                </div>
                <div className="overflow-hidden rounded-lg border bg-white p-4">
                  <ThermalReceipt payload={payloadOf(preview) as any} width={receiptWidth} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelDialog} onOpenChange={(open) => !open && setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar job pendente?</DialogTitle>
            <DialogDescription>
              O job deixara de ser entregue ao TotemBridge. Use apenas para limpar jobs antigos ou configurados incorretamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => cancelDialog && void cancelJob(cancelDialog)}>Cancelar job</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function StatusOverview({
  printing,
  devicesOnline,
  printersConfigured,
  pendingJobs,
  errorJobs,
  lastPrintedAt,
}: {
  printing: EffectivePrintingSettings | null;
  devicesOnline: number;
  printersConfigured: number;
  pendingJobs: number;
  errorJobs: number;
  lastPrintedAt: string | null;
}) {
  const cards = [
    { label: "Impressao automatica", value: printing?.autoPrintEnabled && printing?.printingEnabled ? "Ativa" : "Inativa", ok: Boolean(printing?.autoPrintEnabled && printing?.printingEnabled) },
    { label: "Dispositivos online", value: String(devicesOnline), ok: devicesOnline > 0 },
    { label: "Impressoras configuradas", value: String(printersConfigured), ok: printersConfigured > 0 },
    { label: "Jobs pendentes", value: String(pendingJobs), ok: pendingJobs === 0 },
    { label: "Jobs com erro", value: String(errorJobs), ok: errorJobs === 0 },
    { label: "Ultima impressao", value: lastPrintedAt ? dateTime(lastPrintedAt) : "-", ok: Boolean(lastPrintedAt) },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-lg font-black">{card.value}</p>
              {card.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <AlertCircle className="h-5 w-5 text-amber-600" />}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ReadinessCard({ readiness, loading }: { readiness: TotemReadiness | null; loading: boolean }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          Prontidao PIX + impressao
          {readiness ? statusBadge(readiness.ready ? "PRINTED" : "ERROR") : loading ? statusBadge("PENDING") : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!readiness ? (
          <p className="text-sm text-muted-foreground">Selecione um evento para carregar os diagnosticos.</p>
        ) : (
          <>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.entries(readiness.checks).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{key}</span>
                  {value ? <Badge className="bg-emerald-600 hover:bg-emerald-600">OK</Badge> : <Badge variant="destructive">Falha</Badge>}
                </div>
              ))}
            </div>
            {readiness.blockers.length > 0 && (
              <IssueList title="Bloqueadores" issues={readiness.blockers} tone="danger" />
            )}
            {readiness.warnings.length > 0 && (
              <IssueList title="Avisos" issues={readiness.warnings} tone="warning" />
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MercadoPagoCard({ status }: { status: any | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mercado Pago seguro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <InfoLine label="Credencial" value={status?.configured ? "Configurada" : "Nao configurada"} />
        <InfoLine label="Leitura segura" value={status?.credentialReadable === false ? "Falhou" : "OK"} />
        <InfoLine label="PIX" value={status?.pixEnabled ? "Habilitado" : "Inativo"} />
        <InfoLine label="Webhook" value={status?.webhookReady ? "Pronto" : "Nao configurado"} />
        <InfoLine label="Ambiente" value={status?.environment ?? "-"} />
        <InfoLine label="Conta" value={status?.accountReference ?? "-"} />
        <InfoLine label="Atualizado" value={dateTime(status?.updatedAt)} />
        <p className="pt-2 text-xs text-muted-foreground">Access token, webhook secret e Authorization header nunca sao exibidos nesta tela.</p>
      </CardContent>
    </Card>
  );
}

function ConfigurationCard({
  event,
  printing,
  devices,
  readiness,
  onRefresh,
}: {
  event: EventItem | null;
  printing: EffectivePrintingSettings | null;
  devices: Device[];
  readiness: TotemReadiness | null;
  onRefresh: () => void;
}) {
  const source = printing?.sources?.TOTEM;
  const rows = [
    { origin: "TOTEM", sector: "GENERAL", target: printing?.defaultPrinterDeviceId },
    { origin: "TOTEM", sector: "KITCHEN", target: printing?.kitchenPrinterDeviceId },
    { origin: "TOTEM", sector: "BAR", target: printing?.barPrinterDeviceId },
    { origin: "EVENT", sector: "GENERAL", target: printing?.defaultPrinterDeviceId },
    { origin: "POS", sector: "GENERAL", target: printing?.defaultPrinterDeviceId },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3">
          Configuracao e roteamento
          <Button size="sm" variant="outline" onClick={onRefresh}>Confirmar configuracao</Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-4">
          <InfoBox label="Contexto" value={event ? event.name : "-"} />
          <InfoBox label="Modo TOTEM" value={source?.printMode ?? "-"} />
          <InfoBox label="Auto print TOTEM" value={source?.autoPrint ? "Ativo" : "Inativo"} />
          <InfoBox label="Papel" value={printing?.paperSize ?? "-"} />
          <InfoBox label="Recibo geral" value={source?.printMode === "FULL_ORDER" || source?.printMode === "BOTH" ? "Sim" : "Nao"} />
          <InfoBox label="Producao" value={source?.printMode === "BY_SECTOR" || source?.printMode === "BOTH" ? "Sim" : "Nao"} />
          <InfoBox label="Retry automatico" value="Fila/TotemBridge" />
          <InfoBox label="Limite de tentativas" value="Configurado no worker/app" />
        </div>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Origem</th>
                <th className="px-3 py-2">Setor</th>
                <th className="px-3 py-2">Dispositivo/impressora</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const device = devices.find((item) => item.id === row.target);
                return (
                  <tr key={`${row.origin}-${row.sector}`} className="border-t">
                    <td className="px-3 py-2 font-medium">{row.origin}</td>
                    <td className="px-3 py-2">{row.sector}</td>
                    <td className="px-3 py-2">{deviceLabel(row.target, devices)}</td>
                    <td className="px-3 py-2">
                      {device ? (deviceOnline(device) ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Online</Badge> : <Badge variant="outline">{device.status}</Badge>) : <Badge variant="destructive">Sem target</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {readiness?.blockers.some((issue) => issue.code === "TOTEM_PRINT_TARGET_NOT_CONFIGURED") && (
          <p className="text-sm text-destructive">Configure os targets em Configuracoes &gt; Impressao antes do teste PIX real.</p>
        )}
      </CardContent>
    </Card>
  );
}

function TestPrintCard({
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  sector,
  setSector,
  onTest,
  loading,
}: {
  devices: Device[];
  selectedDeviceId: string;
  setSelectedDeviceId: (value: string) => void;
  sector: TestSector;
  setSector: (value: TestSector) => void;
  onTest: () => void;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Imprimir teste</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
        <Select value={selectedDeviceId || NONE} onValueChange={(value) => setSelectedDeviceId(value === NONE ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Dispositivo que recebera o job" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Selecione um dispositivo</SelectItem>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name} - {device.type} - {deviceOnline(device) ? "online" : device.status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sector} onValueChange={(value) => setSector(value as TestSector)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="GENERAL">Recibo geral</SelectItem>
            <SelectItem value="BAR">Bar</SelectItem>
            <SelectItem value="KITCHEN">Cozinha</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onTest} disabled={!selectedDeviceId || loading}>
          <Printer className="mr-2 h-4 w-4" />
          {loading ? "Criando..." : "Imprimir teste"}
        </Button>
        <p className="md:col-span-3 text-xs text-muted-foreground">
          O navegador nao chama SDK de impressora. Esta acao cria um EventPrintJob TEST e valida o caminho Backend -&gt; /devices/print-jobs/pending -&gt; TotemBridge -&gt; PATCH printed/error.
        </p>
      </CardContent>
    </Card>
  );
}

function DevicesCard({ devices, eventId }: { devices: Device[]; eventId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dispositivos e impressoras</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {devices
          .filter((device) => !eventId || device.eventId === eventId || device.eventId === null)
          .map((device) => (
            <div key={device.id} className="rounded-lg border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{device.name}</p>
                  <p className="text-xs text-muted-foreground">{device.type} - {shortId(device.id)}</p>
                </div>
                {deviceOnline(device) ? <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><Wifi className="h-3 w-3" /> Online</Badge> : <Badge variant="outline" className="gap-1"><WifiOff className="h-3 w-3" /> Offline</Badge>}
              </div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>Codigo: {shortId(device.code)}</p>
                <p>Evento vinculado: {device.event?.name ?? (device.eventId ? shortId(device.eventId) : "Global da organizacao")}</p>
                <p>Ultima comunicacao: {dateTime(device.lastHeartbeatAt ?? device.lastSeenAt)}</p>
                <p>Papel/largura: {String(device.metadata?.paperSize ?? device.metadata?.width ?? "-")}</p>
                <p>Ultimo erro: {String(device.metadata?.lastError ?? "-")}</p>
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

function QueueCard({
  jobs,
  counts,
  statusTab,
  setStatusTab,
  sectorFilter,
  setSectorFilter,
  devices,
  loading,
  onPreview,
  onCancel,
  onRetry,
}: {
  jobs: PrintJob[];
  counts: Record<string, any>;
  statusTab: StatusTab;
  setStatusTab: (value: StatusTab) => void;
  sectorFilter: SectorFilter;
  setSectorFilter: (value: SectorFilter) => void;
  devices: Device[];
  loading: boolean;
  onPreview: (job: PrintJob) => void;
  onCancel: (job: PrintJob) => void;
  onRetry: (job: PrintJob) => void;
}) {
  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center justify-between gap-3">
          Fila de impressao
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {(["ALL", "GENERAL", "BAR", "KITCHEN"] as SectorFilter[]).map((sector) => (
            <Button key={sector} size="sm" variant={sectorFilter === sector ? "default" : "outline"} onClick={() => setSectorFilter(sector)}>
              {sector}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={statusTab} onValueChange={(value) => setStatusTab(value as StatusTab)}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="PENDING">Pendentes ({counts.PENDING})</TabsTrigger>
            <TabsTrigger value="ERROR">Erro ({counts.ERROR})</TabsTrigger>
            <TabsTrigger value="PRINTED">Impressos ({counts.PRINTED})</TabsTrigger>
            <TabsTrigger value="CANCELLED">Cancelados ({counts.CANCELLED})</TabsTrigger>
            <TabsTrigger value="ALL">Todos ({counts.ALL})</TabsTrigger>
          </TabsList>
          <TabsContent value={statusTab} className="mt-4">
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Horario</th>
                    <th className="px-3 py-2">Pedido</th>
                    <th className="px-3 py-2">Origem</th>
                    <th className="px-3 py-2">Setor</th>
                    <th className="px-3 py-2">Dispositivo</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Tentativas</th>
                    <th className="px-3 py-2">Erro</th>
                    <th className="px-3 py-2 text-right">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">
                        Nenhum job encontrado para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job: any) => (
                      <tr key={job.id} className="border-t align-top">
                        <td className="px-3 py-2 whitespace-nowrap">{dateTime(job.createdAt)}</td>
                        <td className="px-3 py-2 font-medium">#{jobOrder(job)}</td>
                        <td className="px-3 py-2">{jobSource(job)}</td>
                        <td className="px-3 py-2">{jobSector(job)}</td>
                        <td className="px-3 py-2">{deviceLabel(job.deviceId, devices)}</td>
                        <td className="px-3 py-2">{statusBadge(job.status)}</td>
                        <td className="px-3 py-2">{job.attempts ?? 0}</td>
                        <td className="max-w-[220px] px-3 py-2 text-xs text-destructive">{job.errorMessage ?? job.lastError ?? "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" onClick={() => onPreview(job)} title="Visualizar payload seguro">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {(job.status === "ERROR" || job.status === "CANCELLED") && (
                              <Button size="sm" variant="outline" onClick={() => onRetry(job)}>Retry</Button>
                            )}
                            {job.status === "PENDING" && (
                              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => onCancel(job)} title="Cancelar job pendente">
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Esta tela nao marca jobs como PRINTED. A confirmacao de sucesso deve vir do TotemBridge apos impressao real.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function InfoLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b py-1 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function IssueList({
  title,
  issues,
  tone,
}: {
  title: string;
  issues: { code: string; message: string }[];
  tone: "danger" | "warning";
}) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "danger" ? "border-destructive/30 bg-destructive/5" : "border-amber-500/30 bg-amber-500/5"}`}>
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <div className="space-y-2">
        {issues.map((issue) => (
          <div key={issue.code} className="text-sm">
            <p className="font-mono text-xs text-muted-foreground">{issue.code}</p>
            <p>{issue.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
