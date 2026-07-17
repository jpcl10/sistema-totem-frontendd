import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import {
  Printer,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Archive,
  Eraser,
  Ban,
  Lock,
  RefreshCw,
  LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThermalReceipt } from "@/components/ThermalReceipt";
import { useEventSocket } from "@/hooks/use-event-socket";
import { useAuth } from "@/lib/auth-context";
import { listEvents, type EventItem } from "@/lib/events-api";
import { handleApiError } from "@/lib/api-error";
import {
  listJobs,
  subscribePrintQueue,
  cancelPrintJobRequest,
  markAsPrintedRequest,
  retryPrintJobRequest,
  listEventPrintJobs,
  type PrintJob,
  type PrintJobStatus,
  type PrintSector,
} from "@/lib/print-queue";
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
type SectorFilter = "ALL" | "FULL" | "BAR" | "KITCHEN";

function getJobOrderId(job: any) {
  return (
    job.orderId ||
    job.order?.id ||
    job.order_id ||
    job.metadata?.orderId ||
    `order-${job.orderNumber || job.order?.orderNumber || job.id}`
  );
}

function getJobOrderNumber(job: any) {
  return (
    job.orderNumber ||
    job.order?.orderNumber ||
    job.metadata?.orderNumber ||
    "-"
  );
}

function getJobSector(job: any) {
  const sector =
    job.sector ||
    job.sectorName ||
    job.printerSector ||
    job.targetSector ||
    job.categorySector ||
    job.printer?.sector ||
    job.metadata?.sector ||
    job.metadata?.sectorName ||
    job.metadata?.printSector;

  const mode =
    job.type ||
    job.mode ||
    job.printMode ||
    job.printType ||
    job.jobType ||
    job.metadata?.type ||
    job.metadata?.mode ||
    job.metadata?.printMode;

  const value = String(sector || mode || "").toLowerCase();

  if (value.includes("bar")) return "Bar";
  if (value.includes("cozinha") || value.includes("kitchen")) return "Cozinha";

  return "Pedido completo";
}

function groupPrintJobsByOrder(printJobs: any[]) {
  const map = new Map<string, any>();

  for (const job of printJobs) {
    const orderId = getJobOrderId(job);

    if (!map.has(orderId)) {
      map.set(orderId, {
        orderId,
        orderNumber: getJobOrderNumber(job),
        customerName: job.customerName || job.order?.customerName || job.payload?.customerName || job.metadata?.customerName || "",
        totalInCents: job.totalInCents || job.order?.totalInCents || job.payload?.totalInCents || 0,
        status: job.status,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        jobs: [],
        sectors: new Set<string>(),
        items: []
      });
    }

    const group = map.get(orderId);
    group.jobs.push(job);
    group.sectors.add(getJobSector(job));

    // Combine items for the full order view
    if (Array.isArray(job.items)) {
      group.items.push(...job.items);
    } else if (Array.isArray(job.payload?.items)) {
      group.items.push(...job.payload.items);
    }

    if (Array.isArray(job.order?.items)) {
      group.items.push(...job.order.items);
    }
    
    // Status management for group: if any is ERROR, show as ERROR? 
    // Or just use the status of the first job or the most "critical" status
    if (job.status === "ERROR") group.status = "ERROR";
    else if (group.status !== "ERROR" && job.status === "PENDING") group.status = "PENDING";
    else if (group.status !== "ERROR" && group.status !== "PENDING" && job.status === "PRINTED") group.status = "PRINTED";
  }

  return Array.from(map.values()).map(group => ({
    ...group,
    sectors: Array.from(group.sectors)
  }));
}

function statusBadge(s: PrintJobStatus | "CANCELLED") {
  if (s === "PENDING")
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3" /> Pendente
      </Badge>
    );
  if (s === "PRINTED")
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Impressa
      </Badge>
    );
  if (s === "CANCELLED")
    return (
      <Badge variant="outline" className="gap-1 bg-muted">
        <Ban className="h-3 w-3" /> Cancelado
      </Badge>
    );
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" /> Erro
    </Badge>
  );
}

function sectorLabel(s: PrintSector, job?: any) {
  if (!job) return "PEDIDO COMPLETO";
  const sector = getJobSector(job);
  return sector.toUpperCase();
}

function PrintQueuePage() {
  useRequireModule(["PRINTING"]);
  const { token } = useAuth();
  const search = useSearch({ from: "/admin/print-queue" });
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const [eventId, setEventId] = useState<string>("");
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [statusTab, setStatusTab] = useState<StatusTab>("PENDING");
  const [sectorFilter, setSectorFilter] = useState<SectorFilter>("ALL");
  const [preview, setPreview] = useState<PrintJob | null>(null);
  const [width, setWidth] = useState<"58mm" | "80mm">("58mm");
  const [cancelDialog, setCancelDialog] = useState<PrintJob | null>(null);

  useEffect(() => {
    if (search.status) {
      setStatusTab(search.status);
    }
  }, [search.status]);

  useEffect(() => {
    const unsub = subscribePrintQueue(() => setJobs(listJobs()));
    const onStorage = () => setJobs(listJobs());
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const eventsQuery = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId,
  });
  const events: EventItem[] = eventsQuery.data ?? [];
  const eventsLoading = eventsQuery.isLoading;

  useEffect(() => {
    if (eventsQuery.error) {
      handleApiError(eventsQuery.error, "Não foi possível carregar os eventos.");
    }
  }, [eventsQuery.error]);

  useEffect(() => {
    if (!eventId && events.length > 0) setEventId(events[0].id);
  }, [events, eventId]);

  const jobsQuery = useQuery({
    queryKey: qk.printQueue.list(orgId, { eventId }),
    queryFn: () => listEventPrintJobs(token!, eventId),
    enabled: !!token && !!orgId && !!eventId,
  });

  useEffect(() => {
    if (jobsQuery.data) setJobs(jobsQuery.data);
  }, [jobsQuery.data]);

  useEffect(() => {
    if (jobsQuery.error) {
      handleApiError(jobsQuery.error, "Não foi possível carregar a fila de impressão.", { silent: true });
    }
  }, [jobsQuery.error]);

  const jobsLoading = jobsQuery.isFetching;
  const loadJobs = (_evId?: string) =>
    queryClient.invalidateQueries({ queryKey: qk.printQueue.list(orgId, { eventId }) });

  useEventSocket({
    eventId,
    token,
    onOrderCreated: () => loadJobs(),
    onOrderUpdated: () => loadJobs(),
  });

  const eventJobs = useMemo(() => {
    return jobs;
  }, [jobs]);

  const counts = useMemo(
    () => ({
      PENDING: eventJobs.filter((j) => j.status === "PENDING").length,
      PRINTED: eventJobs.filter((j) => j.status === "PRINTED").length,
      ERROR: eventJobs.filter((j) => j.status === "ERROR").length,
      CANCELLED: eventJobs.filter((j) => j.status === "CANCELLED").length,
      ALL: eventJobs.length,
    }),
    [eventJobs],
  );

  const filtered = useMemo(() => {
    let list = eventJobs;
    if (statusTab !== "ALL") list = list.filter((j) => j.status === statusTab);

    if (sectorFilter === "FULL") {
      const fullOrderGroups = groupPrintJobsByOrder(list);
      return fullOrderGroups;
    }

    const filteredList = list.filter((job) => {
      const sector = getJobSector(job);
      if (sectorFilter === "ALL") return true;
      if (sectorFilter === "BAR") return sector === "Bar";
      if (sectorFilter === "KITCHEN") return sector === "Cozinha";
      return true;
    });

    return filteredList;
  }, [eventJobs, statusTab, sectorFilter]);

  const groups = useMemo(() => {
    // If it's already grouped (FULL), just return as is but wrapped in the structure the UI expects
    // Wait, the UI expects groups of orders. 
    // If sectorFilter is NOT FULL, we should still group by order for consistent display?
    // Looking at the original code, it was grouping by order for ALL views.
    
    if (sectorFilter === "FULL") {
      return (filtered as any[]).map(g => ({
        ...g,
        isGrouped: true
      })).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    }

    const map = new Map<string, { orderNumber: string; customerName: string; createdAt: string; jobs: any[] }>();
    for (const j of filtered as any[]) {
      const displayId = j.id; 
      const jobWithMeta = {
        ...j,
        displayId,
        printJobId: j.id,
        originalJob: j
      };

      const orderId = getJobOrderId(j);

      if (map.has(orderId)) {
        const g = map.get(orderId)!;
        g.jobs.push(jobWithMeta);
        if (j.createdAt > g.createdAt) g.createdAt = j.createdAt;
      } else {
        map.set(orderId, {
          orderNumber: getJobOrderNumber(j),
          customerName: j.customerName || j.order?.customerName || j.payload?.customerName || "",
          createdAt: j.createdAt,
          jobs: [jobWithMeta],
        });
      }
    }
    return [...map.entries()]
      .map(([orderId, g]) => ({ orderId, ...g }))
      .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  }, [filtered, sectorFilter]);

  const handleAction = async (j: any, type: "cancel" | "printed" | "retry") => {
    if (!token) return;
    
    const idToUse = j.id; // Directly use the real ID
    




    try {
      if (type === "cancel") {
        await cancelPrintJobRequest(token, idToUse);
        toast.success("Impressão cancelada com sucesso.");
      } else if (type === "printed") {
        await markAsPrintedRequest(token, idToUse);
        toast.success("Impressão marcada como impressa.");
      } else if (type === "retry") {
        await retryPrintJobRequest(token, idToUse);
        toast.success("Impressão reenviada para a fila.");
      }
    } catch (err: any) {
      if (err?.message?.includes("not found") || err?.message?.includes("não encontrada")) {
        toast.error("Comanda não encontrada. Atualize a fila e tente novamente.");
        if (eventId) loadJobs(eventId);
      } else {
        handleApiError(err, "Não foi possível atualizar a impressão.");
      }
    }
  };

  const handleCancelOldPending = async () => {
    if (!token || !eventId) return;
    
    // Consider items older than 30 minutes as "old"
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oldPendingJobs = jobs.filter(
      (j) => j.status === "PENDING" && new Date(j.createdAt) < thirtyMinutesAgo
    );

    if (oldPendingJobs.length === 0) {
      toast.info("Nenhuma comanda pendente antiga encontrada.");
      return;
    }

    if (!confirm(`Deseja cancelar ${oldPendingJobs.length} comandas pendentes há mais de 30 minutos?`)) {
      return;
    }

    let successCount = 0;
    let failCount = 0;

    try {
      // Process in sequence or small batches to avoid hitting rate limits or overwhelming the backend
      for (const job of oldPendingJobs) {
        try {
          await cancelPrintJobRequest(token, job.id);
          successCount++;
        } catch (err) {
          console.error(`Failed to cancel job ${job.id}:`, err);
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} comandas canceladas com sucesso.`);
        await loadJobs(eventId); // Refresh list
      }

      if (failCount > 0) {
        toast.error(`${failCount} comandas não puderam ser canceladas.`);
      }
    } catch (err) {
      handleApiError(err, "Erro ao processar cancelamento em lote.");
    }
  };

  const handleArchiveOld = () => toast.info("Em breve.");
  const handleClearOld = () => toast.info("Em breve.");

  return (
    <AdminLayout
      title="Fila de impressão"
      subtitle="Controle operacional de comandas"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={eventId} onValueChange={setEventId} disabled={eventsLoading || events.length === 0}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder={eventsLoading ? "Carregando..." : "Selecione um evento"} />
            </SelectTrigger>
            <SelectContent>
              {events.map((ev) => <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon" 
            className="h-9 w-9" 
            onClick={() => eventId && loadJobs(eventId)}
            disabled={jobsLoading || !eventId}
          >
            <RotateCw className={`h-4 w-4 ${jobsLoading ? 'animate-spin' : ''}`} />
          </Button>
          <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
            <Button variant={width === "58mm" ? "default" : "ghost"} size="sm" className="h-8" onClick={() => setWidth("58mm")}>58mm</Button>
            <Button variant={width === "80mm" ? "default" : "ghost"} size="sm" className="h-8" onClick={() => setWidth("80mm")}>80mm</Button>
          </div>
        </div>
      }
    >
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
              {[
                { key: "ALL", label: "Todos" },
                { key: "FULL", label: "Pedido completo" },
                { key: "BAR", label: "Bar" },
                { key: "KITCHEN", label: "Cozinha" },
              ].map((opt) => (
                <Button key={opt.key} variant={sectorFilter === opt.key ? "default" : "ghost"} size="sm" className="h-8" onClick={() => setSectorFilter(opt.key as SectorFilter)}>{opt.label}</Button>
              ))}
            </div>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleCancelOldPending}
              disabled={jobsLoading || counts.PENDING === 0}
            >
              Cancelar pendentes antigas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)}>
            <TabsList>
              <TabsTrigger value="PENDING">Pendentes ({counts.PENDING})</TabsTrigger>
              <TabsTrigger value="PRINTED">Impressas ({counts.PRINTED})</TabsTrigger>
              <TabsTrigger value="ERROR">Erro ({counts.ERROR})</TabsTrigger>
              <TabsTrigger value="CANCELLED">Canceladas ({counts.CANCELLED})</TabsTrigger>
              <TabsTrigger value="ALL">Todas ({counts.ALL})</TabsTrigger>
            </TabsList>
            <TabsContent value={statusTab} className="mt-4 space-y-3">
              {groups.map((g: any) => (
                <div key={g.orderId} className="rounded-lg border border-border bg-card overflow-hidden">
                  <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Pedido #{g.orderNumber}</span>
                      {g.customerName && (
                        <span className="text-sm text-muted-foreground">({g.customerName})</span>
                      )}
                      {g.isGrouped && (
                        <div className="flex gap-1 ml-2">
                          {g.sectors.map((s: string) => (
                            <Badge key={s} variant="outline" className="text-[10px] uppercase">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      {g.isGrouped && (
                        <div className="flex items-center gap-2">
                          {g.status === "ERROR" && (
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="h-7 text-[10px]"
                              onClick={() => {
                                g.jobs.filter((j: any) => j.status === "ERROR").forEach((j: any) => handleAction(j, "retry"));
                              }}
                            >
                              Reenviar erros
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-7 text-[10px] gap-1"
                            onClick={() => {
                              g.jobs.forEach((j: any) => handleAction(j, "retry"));
                            }}
                          >
                            <RefreshCw className="h-3 w-3" /> Reimprimir tudo
                          </Button>
                        </div>
                      )}
                      <span className="text-xs text-muted-foreground">{new Date(g.createdAt).toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                    <div className="divide-y">
                      {g.jobs.map((j: any) => (
                        <div key={j.displayId || j.id} className="flex flex-col gap-3 px-4 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{sectorLabel(j.sector, j)}</Badge>
                              {j.status === "PENDING" &&
                                new Date().getTime() - new Date(j.createdAt).getTime() > 1800000 && (
                                  <Badge variant="destructive" className="text-[10px] animate-pulse">
                                    Pendente antigo
                                  </Badge>
                                )}
                              {statusBadge(j.status)}
                              <div className="flex flex-col">
                                <span className="text-[10px] font-medium uppercase text-muted-foreground leading-none">
                                  {j.payload?.printer?.connectionType === "SK210_LOCAL"
                                    ? "Totem SK210"
                                    : "Rede TCP/IP"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {j.payload?.printer?.name || "Impressora não identificada"}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPreview(j)}
                                title="Visualizar"
                              >
                                Visualizar
                              </Button>
                              {j.status === "PENDING" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAction(j, "printed")}
                                    title="Marcar como impresso"
                                  >
                                    Impresso
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive h-8 w-8 p-0"
                                    onClick={() => setCancelDialog(j)}
                                    title="Cancelar impressão"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {j.status === "ERROR" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleAction(j, "retry")}
                                    title="Tentar novamente"
                                  >
                                    Tentar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive h-8 w-8 p-0"
                                    onClick={() => setCancelDialog(j)}
                                    title="Cancelar impressão"
                                  >
                                    <Ban className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {j.status === "CANCELLED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleAction(j, "retry")}
                                  title="Tentar novamente"
                                >
                                  Tentar novamente
                                </Button>
                              )}
                              {j.status === "PRINTED" && j.printedAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  Impresso às {new Date(j.printedAt).toLocaleTimeString("pt-BR")}
                                </span>
                              )}
                            </div>
                          </div>
                          {j.status === "ERROR" && j.lastError && (
                            <div className="rounded bg-destructive/5 px-2 py-1 text-[10px] text-destructive border border-destructive/10">
                              Erro: {j.lastError}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Detalhes da Impressão</DialogTitle>
          </DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <p className="text-muted-foreground text-[10px] uppercase">ID do Job (Backend)</p>
                  <p className="font-mono text-[10px] break-all bg-muted p-1 rounded">{(preview as any).printJobId || preview.id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pedido</p>
                  <p className="font-medium">#{preview.orderNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{preview.payload.customerName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <div>{statusBadge(preview.status)}</div>
                </div>
                <div>
                  <p className="text-muted-foreground">Setor</p>
                  <p className="font-medium">{sectorLabel(preview.sector, preview)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Impressora</p>
                  <p className="font-medium">{preview.payload.printer?.name || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Conexão</p>
                  <p className="font-medium">
                    {preview.payload.printer?.connectionType === "SK210_LOCAL"
                      ? "Totem SK210"
                      : "Rede TCP/IP"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Criado em</p>
                  <p className="font-medium text-[11px]">{new Date(preview.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                {preview.printedAt && (
                  <div>
                    <p className="text-muted-foreground">Impresso em</p>
                    <p className="font-medium text-[11px]">{new Date(preview.printedAt).toLocaleString("pt-BR")}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-1">Itens</p>
                <div className="rounded-md border bg-muted/20 p-2 text-xs space-y-1">
                  {preview.payload.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>{it.quantity}x {it.name}</span>
                      <span>{(it.priceInCents * it.quantity / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 mt-1 font-bold flex justify-between">
                    <span>Total Setor</span>
                    <span>{(preview.payload.totalInCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              </div>

              {preview.status === "ERROR" && preview.lastError && (
                <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive border border-destructive/20">
                  <p className="font-bold mb-1">Erro de impressão:</p>
                  <p>{preview.lastError}</p>
                </div>
              )}
              
              <div className="flex justify-center border rounded-lg p-4 bg-white overflow-hidden">
                <ThermalReceipt payload={preview.payload} width={width} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelDialog} onOpenChange={(o) => !o && setCancelDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar impressão?</DialogTitle>
            <DialogDescription>
              Essa comanda não será mais impressa automaticamente. Use esta opção para evitar que impressões antigas sejam enviadas quando a impressora ou o app do totem voltar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialog(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => { if(cancelDialog) handleAction(cancelDialog, "cancel"); setCancelDialog(null); }}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
