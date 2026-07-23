import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { VisaoGeralTab } from "@/components/admin/financeiro/visao-geral-tab";
import { PageLoading } from "@/components/admin/page";
import {
  CalendarDays,
  TrendingUp,
  Activity,
  DollarSign,
  Loader2,
  AlertCircle,
  Receipt,
  CheckCircle2,
  Clock,
  Ban,
  Undo2,
  Wallet,
  ShoppingCart,
  Printer,
  FileText,
  History,
  AlertTriangle,
  RotateCcw,
  Users,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { AdminLayout } from "@/components/admin-layout";
import {
  listEvents,
  getFinancialSummary,
  getClosingPreview,
  getClosingData,
  closeEvent,
  reopenEvent,
  type EventItem,
  type FinancialSummary,
  type ClosingPreview,
  type ClosingData,
} from "@/lib/events-api";
import { handleApiError } from "@/lib/api-error";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRequireModule } from "@/lib/require-module";

export const Route = createFileRoute("/admin/financeiro")({
  component: FinancialPage,
});

function formatCurrency(cents?: number) {
  if (cents == null || Number.isNaN(cents)) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FinancialPage() {
  useRequireModule(["FINANCIAL", "PAYMENTS", "ONLINE_ORDERS"]);
  const navigate = useNavigate();
  const { token, loading, user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("visao-geral");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !token) navigate({ to: "/admin/login" });
  }, [loading, token, navigate]);

  useEffect(() => {
    if (!token) return;
    setEventsLoading(true);
    listEvents(token)
      .then((list) => {
        setEvents(list);
        if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
      })
      .catch((err) => setError(handleApiError(err, "Não foi possível carregar os eventos.")))
      .finally(() => setEventsLoading(false));
  }, [token]);

  const selectedEvent = events.find((e) => e.id === selectedId);

  return (
    <AdminLayout 
      title="Financeiro" 
      subtitle="Controle e análise financeira do evento"
      actions={
        <div className="w-64">
          <Select
            value={selectedId ?? undefined}
            onValueChange={setSelectedId}
            disabled={eventsLoading || events.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      }
    >
      {error && <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive mb-6">{error}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="fechamento">Fechamento do evento</TabsTrigger>
        </TabsList>
        
        <TabsContent value="visao-geral">
          <VisaoGeralTab token={token || ""} events={events} />
        </TabsContent>


        <TabsContent value="fechamento">
          {selectedId ? (
            <FechamentoTab eventId={selectedId} token={token || ""} userRole={user?.role} />
          ) : (
            <div className="text-center py-12 text-muted-foreground">Selecione um evento para realizar o fechamento.</div>
          )}
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}


function FechamentoTab({ eventId, token, userRole }: { eventId: string; token: string; userRole?: string }) {
  const [preview, setPreview] = useState<ClosingPreview | null>(null);
  const [closing, setClosing] = useState<ClosingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [acceptedPendingOrders, setAcceptedPendingOrders] = useState(false);
  const [acceptedPrintErrors, setAcceptedPrintErrors] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReopenOpen, setIsReopenOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getClosingPreview(token, eventId);
      // [redacted log]
      setPreview(p);
      
      if (p.event.closed) {
        const c = await getClosingData(token, eventId);
        // [redacted log]
        setClosing(c);
      } else {
        setClosing(null);
      }
    } catch (err) {
      handleApiError(err, "Não foi possível carregar os dados de fechamento.");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCloseEvent = async () => {
    setSubmitting(true);
    try {
      const response = await closeEvent(token, eventId, {
        notes: notes || null,
        allowPendingOrders: acceptedPendingOrders,
        allowPrintErrors: acceptedPrintErrors,
      });
      toast.success("Evento finalizado com sucesso.");
      setIsConfirmOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err, "Não foi possível finalizar o evento.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReopenEvent = async () => {
    setSubmitting(true);
    try {
      const response = await reopenEvent(token, eventId);
      toast.success("Evento reaberto com sucesso.");
      setIsReopenOpen(false);
      fetchData();
    } catch (err) {
      handleApiError(err, "Não foi possível reabrir o evento.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoading label="Carregando fechamento…" variant="spinner" />;
  }


  if (!preview) return null;

  const paymentMethods = preview?.byPaymentMethod ?? {
    PIX_MANUAL: 0,
    PIX_AUTOMATIC: 0,
    CASH: 0,
    CREDIT_CARD: 0,
    DEBIT_CARD: 0,
    COURTESY: 0,
    OTHER: 0
  };

  const summary = preview?.summary ?? {
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    paidTotalInCents: 0,
    pendingTotalInCents: 0,
    cancelledTotalInCents: 0,
    averageTicketInCents: 0
  };

  const printSummary = preview?.printSummary ?? {
    PENDING: 0,
    PRINTED: 0,
    ERROR: 0,
    CANCELLED: 0
  };

  const warnings = Array.isArray(preview?.warnings) ? preview.warnings : [];

  const normalizedClosing = preview.event.closed && closing?.closing ? {
    summary: {
      totalOrders: closing.closing.totalOrders ?? 0,
      paidOrders: closing.closing.paidOrders ?? 0,
      pendingOrders: closing.closing.pendingOrders ?? 0,
      cancelledOrders: closing.closing.cancelledOrders ?? 0,
      receivedInCents: closing.closing.receivedInCents ?? 0,
      pendingInCents: closing.closing.pendingInCents ?? 0,
      cancelledInCents: closing.closing.cancelledInCents ?? 0,
      averageTicketInCents: closing.closing.averageTicketInCents ?? 0
    },
    byPaymentMethod: {
      PIX_MANUAL: closing.closing.pixManualInCents ?? 0,
      PIX_AUTOMATIC: closing.closing.pixAutomaticInCents ?? 0,
      CASH: closing.closing.cashInCents ?? 0,
      CREDIT_CARD: closing.closing.creditCardInCents ?? 0,
      DEBIT_CARD: closing.closing.debitCardInCents ?? 0,
      COURTESY: closing.closing.courtesyInCents ?? 0,
      OTHER: closing.closing.otherInCents ?? 0
    },
    printSummary: {
      PENDING: closing.closing.printPendingCount ?? 0,
      PRINTED: closing.closing.printPrintedCount ?? 0,
      ERROR: closing.closing.printErrorCount ?? 0,
      CANCELLED: closing.closing.printCancelledCount ?? 0
    }
  } : null;

  // [redacted log]
  // [redacted log]
  if (normalizedClosing) {
    // [redacted log]
  }

  const finalSummary = normalizedClosing ? {
    ...normalizedClosing.summary,
    paidTotalInCents: normalizedClosing.summary.receivedInCents,
    pendingTotalInCents: normalizedClosing.summary.pendingInCents,
    cancelledTotalInCents: normalizedClosing.summary.cancelledInCents,
  } : summary;

  const finalPrintSummary = normalizedClosing ? normalizedClosing.printSummary : printSummary;
  const finalPaymentMethods = normalizedClosing ? normalizedClosing.byPaymentMethod : paymentMethods;

  const hasPendingOrdersWarning = warnings.some(w => w.type === 'PENDING_ORDERS');
  const hasPrintErrorsWarning = warnings.some(w => w.type === 'PRINT_ERRORS');
  
  const canClose = (!hasPendingOrdersWarning || acceptedPendingOrders) && 
                   (!hasPrintErrorsWarning || acceptedPrintErrors);

  const canReopen = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-full ${preview.event.closed ? 'bg-zinc-100 text-zinc-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <CalendarDays className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{preview.event.name}</h2>
              {preview.event.closed ? (
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-700 border-zinc-200">Evento fechado</Badge>
              ) : (
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200">Evento aberto</Badge>
              )}
            </div>
            {preview.event.closed && closing?.event.closedAt && (
              <p className="text-sm text-muted-foreground mt-1">
                Fechado em {new Date(closing.event.closedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
        </div>
        {preview.event.closed && canReopen && (
          <Button variant="outline" onClick={() => setIsReopenOpen(true)} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reabrir evento
          </Button>
        )}
      </div>

      {preview.event.closed && closing?.closedBy && (
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground">Responsável pelo fechamento</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Nome</p>
              <p className="text-sm font-medium">{closing.closedBy.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">E-mail</p>
              <p className="text-sm font-medium">{closing.closedBy.email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Função</p>
              <p className="text-sm font-medium">{closing.closedBy.role}</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Resumo do fechamento</h3>
            </div>
            <div className="space-y-4">
              <DataRow label="Total de pedidos" value={finalSummary.totalOrders} />
              <DataRow label="Pedidos pagos" value={finalSummary.paidOrders} />
              <DataRow label="Pedidos pendentes" value={finalSummary.pendingOrders} />
              <DataRow label="Pedidos cancelados" value={finalSummary.cancelledOrders} />
              <DataRow label="Receita recebida" value={formatCurrency(finalSummary.paidTotalInCents)} highlight />
              <DataRow label="Receita pendente" value={formatCurrency(finalSummary.pendingTotalInCents)} />
              <DataRow label="Receita cancelada" value={formatCurrency(finalSummary.cancelledTotalInCents)} />
              <DataRow label="Ticket médio" value={formatCurrency(finalSummary.averageTicketInCents)} />
            </div>
          </div>

          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Printer className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Resumo de impressão</h3>
            </div>
            <div className="space-y-4">
              <DataRow label="Pendentes" value={finalPrintSummary.PENDING} />
              <DataRow label="Concluídas" value={finalPrintSummary.PRINTED} />
              <DataRow label="Com erro" value={finalPrintSummary.ERROR} color={finalPrintSummary.ERROR > 0 ? "text-red-600" : undefined} />
              <DataRow label="Canceladas" value={finalPrintSummary.CANCELLED} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Formas de pagamento</h3>
            </div>
            <div className="space-y-4">
              <DataRow label="PIX manual" value={formatCurrency(finalPaymentMethods.PIX_MANUAL)} />
              <DataRow label="PIX automático" value={formatCurrency(finalPaymentMethods.PIX_AUTOMATIC)} />
              <DataRow label="Dinheiro" value={formatCurrency(finalPaymentMethods.CASH)} />
              <DataRow label="Crédito" value={formatCurrency(finalPaymentMethods.CREDIT_CARD)} />
              <DataRow label="Débito" value={formatCurrency(finalPaymentMethods.DEBIT_CARD)} />
              <DataRow label="Cortesia" value={formatCurrency(finalPaymentMethods.COURTESY)} />
              <DataRow label="Outros" value={formatCurrency(finalPaymentMethods.OTHER)} />
            </div>
          </div>

          {preview.event.closed && closing?.notes && (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">Observações</h3>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{closing.notes}</p>
            </div>
          )}

          {!preview.event.closed && (
            <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
              {preview.warnings.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertTriangle className="h-5 w-5" />
                    <h3 className="font-semibold">Alertas de segurança</h3>
                  </div>
                  {preview.warnings.map((warning, idx) => (
                    <div key={idx} className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-sm text-amber-800">
                      {warning.message}
                    </div>
                  ))}

                  <div className="space-y-3 pt-2">
                    {hasPendingOrdersWarning && (
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          id="pending-orders-check" 
                          checked={acceptedPendingOrders}
                          onCheckedChange={(val) => setAcceptedPendingOrders(!!val)}
                          className="mt-1"
                        />
                        <label htmlFor="pending-orders-check" className="text-sm font-medium leading-none cursor-pointer">
                          Estou ciente de que existem pedidos com pagamento pendente.
                        </label>
                      </div>
                    )}
                    {hasPrintErrorsWarning && (
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          id="print-errors-check" 
                          checked={acceptedPrintErrors}
                          onCheckedChange={(val) => setAcceptedPrintErrors(!!val)}
                          className="mt-1"
                        />
                        <label htmlFor="print-errors-check" className="text-sm font-medium leading-none cursor-pointer">
                          Estou ciente de que existem impressões com erro.
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-semibold text-foreground">Observações de fechamento</label>
                <Textarea 
                  placeholder="Digite aqui observações importantes sobre este fechamento..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
                  className="min-h-[120px] resize-none"
                />
                <p className="text-[10px] text-right text-muted-foreground">{notes.length}/1000</p>
              </div>

              <Button 
                className="w-full h-12 text-lg font-bold shadow-lg"
                disabled={!canClose}
                onClick={() => setIsConfirmOpen(true)}
              >
                Finalizar evento
              </Button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar fechamento do evento?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-2">
              <p>Ao finalizar este evento:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>O evento será marcado como fechado;</li>
                <li>Ficará inativo no sistema;</li>
                <li>Novos pedidos poderão ser bloqueados;</li>
                <li>Os números financeiros serão salvos como um snapshot imutável.</li>
              </ul>
              <p className="font-semibold text-foreground pt-2">Deseja prosseguir com o fechamento?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleCloseEvent();
              }}
              disabled={submitting}
              className="bg-primary hover:bg-primary/90"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, finalizar evento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isReopenOpen} onOpenChange={setIsReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reabrir este evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso permitirá novos pedidos e alterações financeiras. O snapshot de fechamento anterior será descartado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleReopenEvent();
              }}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sim, reabrir evento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, hint }: any) {
  const colors: any = {
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    primary: "bg-primary/10 text-primary border-primary/20",
    default: "bg-muted text-muted-foreground border-border",
  };
  const cls = colors[color] || colors.default;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-xl border ${cls}`}>
          <Icon className="h-5 w-5" />
        </div>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      <div>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <h3 className="text-2xl font-bold tracking-tight text-foreground mt-1">{value}</h3>
      </div>
    </div>
  );
}

function PaymentRow({ label, value }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-foreground">{formatCurrency(value)}</span>
    </div>
  );
}

function StatusRow({ label, count, color = "text-foreground", icon: Icon }: any) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={`h-4 w-4 ${color}`} />}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className={`text-sm font-bold ${color}`}>{count ?? 0}</span>
    </div>
  );
}

function DataRow({ label, value, highlight, color }: { label: string; value: string | number; highlight?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-primary' : color || 'text-foreground'}`}>{value}</span>
    </div>
  );
}
