import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Printer,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  Info,
  ExternalLink,
  ListChecks,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import {
  listPrinters,
  type PrinterItem,
  type PrinterPaper,
} from "@/lib/printers-api";
import {
  listEventPrintJobs,
  retryPrintJobRequest,
  markAsPrintedRequest,
  type PrintJob,
} from "@/lib/print-queue";

interface Props {
  eventId: string;
}

const SECTOR_LABEL: Record<string, string> = {
  BAR: "Bar",
  KITCHEN: "Cozinha",
  ALL: "Geral",
  GENERAL: "Geral",
  FULL: "Geral",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  PRINTED: "Impresso",
  ERROR: "Erro",
  CANCELLED: "Cancelado",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-500",
  PRINTED: "bg-emerald-500",
  ERROR: "bg-rose-500",
  CANCELLED: "bg-slate-400",
};

interface PrintRules {
  enabled: boolean;
  autoPrint: boolean;
  printMode: "sector" | "full" | "both";
  paperSize: PrinterPaper;
  allowReprint: boolean;
}

const DEFAULT_RULES: PrintRules = {
  enabled: true,
  autoPrint: true,
  printMode: "sector",
  paperSize: "80mm",
  allowReprint: true,
};

const RULES_KEY = (id: string) => `admin.event.printing.rules.${id}`;

export function EventPrintingSettings({ eventId }: Props) {
  const { token } = useAuth();
  const [printers, setPrinters] = useState<PrinterItem[]>([]);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<PrintRules>(DEFAULT_RULES);
  const [rulesDirty, setRulesDirty] = useState(false);
  const [errorJob, setErrorJob] = useState<PrintJob | null>(null);

  const reload = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    try {
      const [p, j] = await Promise.all([
        listPrinters(token, eventId).catch(() => []),
        listEventPrintJobs(token, eventId).catch(() => []),
      ]);
      setPrinters(p);
      setJobs(j);
    } catch (err) {
      handleApiError(err, "Falha ao carregar dados de impressão");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(RULES_KEY(eventId));
      setRules(raw ? { ...DEFAULT_RULES, ...JSON.parse(raw) } : DEFAULT_RULES);
      setRulesDirty(false);
    } catch {
      setRules(DEFAULT_RULES);
    }
  }, [eventId]);

  const stats = useMemo(() => {
    const counts: Record<"PENDING" | "PRINTED" | "ERROR" | "CANCELLED", number> = {
      PENDING: 0,
      PRINTED: 0,
      ERROR: 0,
      CANCELLED: 0,
    };
    let lastAt: number | null = null;
    for (const j of jobs) {
      counts[j.status] = (counts[j.status] ?? 0) + 1;
      const ts = j.createdAt ? new Date(j.createdAt).getTime() : NaN;
      if (!Number.isNaN(ts)) lastAt = lastAt === null ? ts : Math.max(lastAt, ts);
    }
    return { ...counts, total: jobs.length, lastAt };
  }, [jobs]);

  const formatLast = (ts: number | null) => {
    if (!ts) return "—";
    const diff = Date.now() - ts;
    if (diff < 60_000) return `há ${Math.max(1, Math.floor(diff / 1000))}s`;
    if (diff < 3_600_000) return `há ${Math.floor(diff / 60_000)}min`;
    if (diff < 86_400_000) return `há ${Math.floor(diff / 3_600_000)}h`;
    return new Date(ts).toLocaleString("pt-BR");
  };

  const updateRule = <K extends keyof PrintRules>(k: K, v: PrintRules[K]) => {
    setRules((p) => ({ ...p, [k]: v }));
    setRulesDirty(true);
  };

  const saveRules = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(RULES_KEY(eventId), JSON.stringify(rules));
      setRulesDirty(false);
      toast.success("Configurações de impressão salvas");
    } catch {
      toast.error("Falha ao salvar configurações");
    }
  };

  const onRetry = async (job: PrintJob) => {
    if (!token) return;
    try {
      await retryPrintJobRequest(token, job.id);
      toast.success("Reimpressão solicitada");
      reload();
    } catch (err) {
      handleApiError(err, "Falha ao reimprimir");
    }
  };

  const onMarkPrinted = async (job: PrintJob) => {
    if (!token) return;
    try {
      await markAsPrintedRequest(token, job.id);
      toast.success("Marcado como impresso");
      reload();
    } catch (err) {
      handleApiError(err, "Falha ao marcar como impresso");
    }
  };

  return (
    <div className="space-y-6">
      {/* Status geral */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-primary" />
                Status da impressão
              </CardTitle>
              <CardDescription>Visão geral dos jobs de impressão deste evento.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={rules.enabled ? "bg-emerald-500" : "bg-slate-400"}>
                {rules.enabled ? "Impressão ativada" : "Impressão desativada"}
              </Badge>
              <Button size="sm" variant="outline" onClick={reload}>
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatBox icon={Clock} label="Pendentes" value={stats.PENDING} />
            <StatBox icon={CheckCircle2} label="Concluídas" value={stats.PRINTED} />
            <StatBox
              icon={AlertCircle}
              label="Com erro"
              value={stats.ERROR}
              warning={stats.ERROR > 0}
            />
            <StatBox icon={ListChecks} label="Total de jobs" value={stats.total} />
            <StatBox icon={Clock} label="Última impressão" value={formatLast(stats.lastAt)} />
          </div>
        </CardContent>
      </Card>

      {/* Info: equipamentos agora em Dispositivos */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Info className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Os equipamentos de impressão agora são gerenciados em Dispositivos.
              </p>
              <p className="text-xs text-muted-foreground">
                Cadastre, edite e teste impressoras na nova central de dispositivos.
              </p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link to="/admin/devices">
              <ExternalLink className="mr-2 h-4 w-4" /> Gerenciar dispositivos
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Configurações de Impressão */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de impressão</CardTitle>
          <CardDescription>
            Defina como as comandas serão impressas para este evento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Ativar impressão</div>
                <div className="text-xs text-muted-foreground">
                  Habilita o sistema de impressão de comandas neste evento.
                </div>
              </div>
              <Switch
                checked={rules.enabled}
                onCheckedChange={(v) => updateRule("enabled", v)}
              />
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Impressão automática</div>
                <div className="text-xs text-muted-foreground">
                  Envia automaticamente para a impressora quando o pedido é confirmado.
                </div>
              </div>
              <Switch
                checked={rules.autoPrint}
                onCheckedChange={(v) => updateRule("autoPrint", v)}
                disabled={!rules.enabled}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Modo de impressão</Label>
                <Select
                  value={rules.printMode}
                  onValueChange={(v) => updateRule("printMode", v as PrintRules["printMode"])}
                  disabled={!rules.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sector">Separado por setor</SelectItem>
                    <SelectItem value="full">Pedido completo</SelectItem>
                    <SelectItem value="both">Setor + pedido completo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tamanho padrão do papel</Label>
                <Select
                  value={rules.paperSize}
                  onValueChange={(v) => updateRule("paperSize", v as PrinterPaper)}
                  disabled={!rules.enabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58 mm</SelectItem>
                    <SelectItem value="80mm">80 mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">Permitir reimpressão</div>
                <div className="text-xs text-muted-foreground">
                  Habilita a ação de reimprimir jobs concluídos ou com erro.
                </div>
              </div>
              <Switch
                checked={rules.allowReprint}
                onCheckedChange={(v) => updateRule("allowReprint", v)}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={saveRules} disabled={!rulesDirty}>
              <Save className="mr-2 h-4 w-4" /> Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fila recente */}
      <Card>
        <CardHeader>
          <CardTitle>Fila recente de impressão</CardTitle>
          <CardDescription>Últimos jobs gerados para este evento.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
            </div>
          ) : jobs.length === 0 ? (
            <EmptyMessage text="Nenhuma impressão gerada ainda." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Pedido</th>
                    <th className="px-2 py-2">Setor</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Horário</th>
                    <th className="px-2 py-2">Erro</th>
                    <th className="px-2 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.slice(0, 50).map((j) => (
                    <tr key={j.id} className="border-t border-border align-top">
                      <td className="px-2 py-2 font-medium">#{j.orderNumber ?? "-"}</td>
                      <td className="px-2 py-2">{SECTOR_LABEL[j.sector] ?? j.sector}</td>
                      <td className="px-2 py-2">
                        <Badge className={STATUS_COLOR[j.status] ?? ""}>
                          {STATUS_LABEL[j.status] ?? j.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">
                        {j.createdAt ? new Date(j.createdAt).toLocaleString("pt-BR") : "-"}
                      </td>
                      <td className="px-2 py-2 max-w-[220px] truncate text-xs text-rose-600">
                        {j.status === "ERROR" ? j.lastError ?? "—" : ""}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end gap-1">
                          {j.status === "ERROR" && j.lastError && (
                            <Button size="sm" variant="ghost" onClick={() => setErrorJob(j)}>
                              Ver erro
                            </Button>
                          )}
                          {(j.status === "ERROR" || j.status === "PENDING") &&
                            rules.allowReprint && (
                              <Button size="sm" variant="outline" onClick={() => onRetry(j)}>
                                Reimprimir
                              </Button>
                            )}
                          {j.status === "PENDING" && (
                            <Button size="sm" variant="ghost" onClick={() => onMarkPrinted(j)}>
                              Marcar impresso
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legados — só aparece se houver */}
      {printers.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" /> Impressoras legadas vinculadas
            </CardTitle>
            <CardDescription className="text-amber-700/80">
              Estas impressoras ainda usam o modelo antigo. Elas continuarão funcionando, mas novos
              equipamentos devem ser cadastrados em Dispositivos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {printers.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <Printer className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {SECTOR_LABEL[p.sector] ?? p.sector} · {p.connectionType} ·{" "}
                        {p.ipAddress}:{p.port} · {p.paperSize}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.active ? "default" : "secondary"}>
                      {p.active ? "Ativa" : "Inativa"}
                    </Badge>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/admin/devices">
                        <ExternalLink className="mr-1 h-4 w-4" /> Gerenciar
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!errorJob} onOpenChange={(o) => !o && setErrorJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Erro na impressão</DialogTitle>
            <DialogDescription>Detalhes do erro reportado pela impressora.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            {errorJob?.lastError ?? "Sem detalhes."}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setErrorJob(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  warning,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        warning ? "border-rose-500/40 bg-rose-500/5" : "border-border bg-muted/20"
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function EmptyMessage({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
