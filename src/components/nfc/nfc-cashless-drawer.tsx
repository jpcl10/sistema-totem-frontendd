import { useEffect, useState, type FormEvent } from "react";
import {
  Loader2,
  Wallet,
  Plus,
  Minus,
  Sliders,
  Undo2,
  Copy,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Gift,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import { handleApiError } from "@/lib/api-error";
import {
  listNfcTransactions,
  topupNfcCard,
  debitNfcCard,
  adjustNfcCard,
  refundNfcCard,
  formatBRL,
  NFC_TX_TYPE_LABEL,
  NFC_TYPE_LABEL,
  NFC_STATUS_LABEL,
  type NfcCard,
  type NfcTransaction,
  type NfcTransactionType,
} from "@/lib/nfc-cards-api";

type FinancialAction = "topup" | "debit" | "adjust" | "refund";

const ACTION_META: Record<
  FinancialAction,
  { title: string; description: string; cta: string; tone: string; icon: typeof Plus }
> = {
  topup: {
    title: "Adicionar saldo",
    description: "Recarga de valor no cartão. O valor será creditado imediatamente.",
    cta: "Confirmar recarga",
    tone: "text-emerald-600",
    icon: Plus,
  },
  debit: {
    title: "Debitar saldo",
    description: "Debita um valor do cartão. Use quando o consumo não passou pelo PDV.",
    cta: "Confirmar débito",
    tone: "text-red-600",
    icon: Minus,
  },
  adjust: {
    title: "Ajustar saldo",
    description: "Define um novo saldo total para o cartão. Use somente em correções operacionais.",
    cta: "Aplicar ajuste",
    tone: "text-orange-600",
    icon: Sliders,
  },
  refund: {
    title: "Estornar valor",
    description: "Devolve um valor ao cartão. Geralmente vinculado a um cancelamento.",
    cta: "Confirmar estorno",
    tone: "text-blue-600",
    icon: Undo2,
  },
};

const TX_STYLE: Record<NfcTransactionType, { color: string; bg: string; icon: typeof Plus; sign: 1 | -1 | 0 }> = {
  TOPUP: { color: "text-emerald-600", bg: "bg-emerald-500/10", icon: ArrowDownCircle, sign: 1 },
  PURCHASE: { color: "text-red-600", bg: "bg-red-500/10", icon: ArrowUpCircle, sign: -1 },
  REFUND: { color: "text-blue-600", bg: "bg-blue-500/10", icon: Undo2, sign: 1 },
  ADJUSTMENT: { color: "text-orange-600", bg: "bg-orange-500/10", icon: Sliders, sign: 0 },
  BONUS: { color: "text-fuchsia-600", bg: "bg-fuchsia-500/10", icon: Gift, sign: 1 },
  REVERSAL: { color: "text-amber-600", bg: "bg-amber-500/10", icon: RefreshCw, sign: 0 },
};

function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/\s/g, "").replace(/R\$/i, "").replace(/\./g, "").replace(",", ".");
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function NfcCashlessDrawer({
  eventId,
  token,
  card,
  onClose,
  onUpdated,
}: {
  eventId: string;
  token: string;
  card: NfcCard;
  onClose: () => void;
  onUpdated: (c: NfcCard) => void;
}) {
  const [current, setCurrent] = useState<NfcCard>(card);
  const [tab, setTab] = useState<"info" | "history">("history");
  const [txs, setTxs] = useState<NfcTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);
  const [errorTx, setErrorTx] = useState<string | null>(null);
  const [action, setAction] = useState<FinancialAction | null>(null);
  const [txFilter, setTxFilter] = useState<"ALL" | NfcTransactionType>("ALL");

  const stats = (() => {
    let topup = 0;
    let purchase = 0;
    let refund = 0;
    for (const t of txs) {
      const amt = Math.abs(t.amountInCents ?? 0);
      if (t.type === "TOPUP" || t.type === "BONUS") topup += amt;
      else if (t.type === "PURCHASE") purchase += amt;
      else if (t.type === "REFUND") refund += amt;
    }
    return { topup, purchase, refund, count: txs.length };
  })();

  const filteredTxs = txFilter === "ALL" ? txs : txs.filter((t) => t.type === txFilter);


  useEffect(() => {
    setCurrent(card);
  }, [card]);

  const refetchTx = async () => {
    setLoadingTx(true);
    setErrorTx(null);
    try {
      const list = await listNfcTransactions(token, eventId, current.id);
      // newest first
      list.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setTxs(list);
    } catch (e) {
      setErrorTx(handleApiError(e, "Não foi possível carregar o histórico.", { silent: true }));
    } finally {
      setLoadingTx(false);
    }
  };

  useEffect(() => {
    refetchTx();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  const handleSuccess = (updated: NfcCard) => {
    setCurrent(updated);
    onUpdated(updated);
    refetchTx();
    setAction(null);
  };

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(current.uid);
      toast.success("UID copiado.");
    } catch {
      toast.error("Falha ao copiar.");
    }
  };

  const isBlocked = current.status === "BLOCKED";

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-xl"
      >
        {/* Hero header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 px-6 pb-6 pt-8 text-white">
          <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-cyan-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-8 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
          <SheetHeader className="relative z-10 space-y-3 text-left">
            <div className="flex items-center gap-2">
              <Badge className="bg-white/10 text-white hover:bg-white/10">{NFC_TYPE_LABEL[current.type]}</Badge>
              <Badge
                className={
                  current.status === "ACTIVE"
                    ? "bg-emerald-500/90 text-white hover:bg-emerald-500/90"
                    : current.status === "BLOCKED"
                    ? "bg-red-500/90 text-white hover:bg-red-500/90"
                    : "bg-orange-500/90 text-white hover:bg-orange-500/90"
                }
              >
                {current.status === "ACTIVE" ? (
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                ) : current.status === "BLOCKED" ? (
                  <XCircle className="mr-1 h-3 w-3" />
                ) : (
                  <AlertTriangle className="mr-1 h-3 w-3" />
                )}
                {NFC_STATUS_LABEL[current.status]}
              </Badge>
              {current.code && (
                <span className="rounded-md border border-white/20 bg-white/5 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider">
                  {current.code}
                </span>
              )}
            </div>
            <SheetTitle className="text-2xl font-semibold text-white">
              {current.holderName || "Sem titular"}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2 font-mono text-xs text-white/70">
              {current.uid}
              <button
                onClick={copyUid}
                className="rounded p-1 hover:bg-white/10"
                aria-label="Copiar UID"
              >
                <Copy className="h-3 w-3" />
              </button>
            </SheetDescription>
          </SheetHeader>

          <div className="relative z-10 mt-6 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-300">
              <Wallet className="h-3.5 w-3.5" />
              Saldo atual
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums text-white">
              {formatBRL(current.balanceInCents)}
            </div>
          </div>

          {/* Action buttons */}
          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Button
              size="sm"
              onClick={() => setAction("topup")}
              disabled={isBlocked}
              className="bg-emerald-500 text-white shadow hover:bg-emerald-500/90"
            >
              <Plus className="mr-1 h-4 w-4" />
              Recarregar
            </Button>
            <Button
              size="sm"
              onClick={() => setAction("debit")}
              disabled={isBlocked}
              className="bg-red-500 text-white shadow hover:bg-red-500/90"
            >
              <Minus className="mr-1 h-4 w-4" />
              Debitar
            </Button>
            <Button
              size="sm"
              onClick={() => setAction("adjust")}
              className="bg-orange-500 text-white shadow hover:bg-orange-500/90"
            >
              <Sliders className="mr-1 h-4 w-4" />
              Ajustar
            </Button>
            <Button
              size="sm"
              onClick={() => setAction("refund")}
              className="bg-blue-500 text-white shadow hover:bg-blue-500/90"
            >
              <Undo2 className="mr-1 h-4 w-4" />
              Estornar
            </Button>
          </div>

          {isBlocked && (
            <div className="relative z-10 mt-3 flex items-center gap-2 rounded-md border border-red-400/30 bg-red-500/15 p-2 text-xs text-red-100">
              <AlertTriangle className="h-3.5 w-3.5" />
              Cartão bloqueado — recarga e débito desativados.
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 py-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "info" | "history")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="info">Detalhes</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="mt-4 space-y-3">
              {/* Filtros */}
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { key: "ALL", label: "Todos" },
                    { key: "TOPUP", label: "Recargas" },
                    { key: "PURCHASE", label: "Compras" },
                    { key: "ADJUSTMENT", label: "Ajustes" },
                    { key: "REFUND", label: "Estornos" },
                  ] as Array<{ key: "ALL" | NfcTransactionType; label: string }>
                ).map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setTxFilter(f.key)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      txFilter === f.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {loadingTx ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : errorTx ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {errorTx}
                  <Button variant="ghost" size="sm" onClick={refetchTx} className="ml-2">
                    Tentar novamente
                  </Button>
                </div>
              ) : filteredTxs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-10 text-center">
                  <Sparkles className="h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {txs.length === 0 ? "Nenhuma transação ainda" : "Nada neste filtro"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Recargas, consumos e ajustes aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="relative space-y-1.5 before:absolute before:left-[18px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
                  {filteredTxs.map((tx) => {
                    const meta = TX_STYLE[tx.type] ?? TX_STYLE.ADJUSTMENT;
                    const Icon = meta.icon;
                    const signed =
                      meta.sign === 0
                        ? formatBRL(tx.amountInCents)
                        : `${meta.sign > 0 ? "+" : "−"} ${formatBRL(Math.abs(tx.amountInCents))}`;
                    return (
                      <div
                        key={tx.id}
                        className="relative flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3"
                      >
                        <div className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-background ${meta.bg}`}>
                          <Icon className={`h-4 w-4 ${meta.color}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{NFC_TX_TYPE_LABEL[tx.type]}</span>
                            {tx.description && (
                              <span className="truncate text-xs text-muted-foreground">
                                · {tx.description}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                            {tx.createdAt && (
                              <span>
                                {new Date(tx.createdAt).toLocaleString("pt-BR", {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </span>
                            )}
                            {typeof tx.balanceBeforeInCents === "number" &&
                              typeof tx.balanceAfterInCents === "number" && (
                                <span className="tabular-nums">
                                  {formatBRL(tx.balanceBeforeInCents)} → {formatBRL(tx.balanceAfterInCents)}
                                </span>
                              )}
                          </div>
                        </div>
                        <div className={`text-sm font-bold tabular-nums ${meta.color}`}>{signed}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            <TabsContent value="info" className="mt-4 space-y-4">
              {/* Estatísticas */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Total recargas
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-emerald-700">
                    {formatBRL(stats.topup)}
                  </p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Total consumido
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-red-700">
                    {formatBRL(stats.purchase)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Transações
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums">{stats.count}</p>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-y-3 text-sm">
                <dt className="text-muted-foreground">ID</dt>
                <dd className="col-span-2 truncate font-mono text-xs">{current.id}</dd>
                <dt className="text-muted-foreground">UID</dt>
                <dd className="col-span-2 font-mono text-xs">{current.uid}</dd>
                <dt className="text-muted-foreground">Código</dt>
                <dd className="col-span-2">{current.code || "—"}</dd>
                <dt className="text-muted-foreground">Titular</dt>
                <dd className="col-span-2">{current.holderName || "—"}</dd>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd className="col-span-2">{NFC_TYPE_LABEL[current.type]}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="col-span-2">{NFC_STATUS_LABEL[current.status]}</dd>
                <dt className="text-muted-foreground">Saldo</dt>
                <dd className="col-span-2 font-semibold">{formatBRL(current.balanceInCents)}</dd>
                {current.createdAt && (
                  <>
                    <dt className="text-muted-foreground">Criado em</dt>
                    <dd className="col-span-2">
                      {new Date(current.createdAt).toLocaleString("pt-BR")}
                    </dd>
                  </>
                )}
                {current.updatedAt && (
                  <>
                    <dt className="text-muted-foreground">Atualizado em</dt>
                    <dd className="col-span-2">
                      {new Date(current.updatedAt).toLocaleString("pt-BR")}
                    </dd>
                  </>
                )}
                {current.notes ? (
                  <>
                    <dt className="text-muted-foreground">Observações</dt>
                    <dd className="col-span-2 whitespace-pre-wrap">{String(current.notes)}</dd>
                  </>
                ) : null}
              </dl>
            </TabsContent>
          </Tabs>
        </div>

        {action && (
          <FinancialActionDialog
            eventId={eventId}
            token={token}
            card={current}
            action={action}
            onClose={() => setAction(null)}
            onSuccess={handleSuccess}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function FinancialActionDialog({
  eventId,
  token,
  card,
  action,
  onClose,
  onSuccess,
}: {
  eventId: string;
  token: string;
  card: NfcCard;
  action: FinancialAction;
  onClose: () => void;
  onSuccess: (c: NfcCard) => void;
}) {
  const meta = ACTION_META[action];
  const Icon = meta.icon;
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDebit, setConfirmDebit] = useState(false);

  const balance = card.balanceInCents ?? 0;
  const cents = parseBRLToCents(amount);
  const isAdjust = action === "adjust";
  const isDebit = action === "debit";

  const run = async () => {
    if (cents == null) {
      toast.error("Valor inválido.");
      return;
    }
    if (!isAdjust && cents <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }
    setSaving(true);
    try {
      let updated: NfcCard;
      if (action === "topup") updated = await topupNfcCard(token, eventId, card.id, cents, description || undefined);
      else if (action === "debit") updated = await debitNfcCard(token, eventId, card.id, cents, description || undefined);
      else if (action === "refund") updated = await refundNfcCard(token, eventId, card.id, cents, description || undefined);
      else updated = await adjustNfcCard(token, eventId, card.id, cents, description || undefined);
      const successMsg =
        action === "topup"
          ? "Saldo adicionado"
          : action === "debit"
          ? "Débito realizado"
          : action === "refund"
          ? "Estorno realizado"
          : "Ajuste concluído";
      const detail =
        cents != null
          ? action === "adjust"
            ? `Novo saldo: ${formatBRL(cents)}`
            : `${formatBRL(cents)} · Novo saldo: ${formatBRL(updated.balanceInCents ?? 0)}`
          : undefined;
      toast.success(successMsg, { description: detail });
      onSuccess(updated);
    } catch (e) {
      handleApiError(e);
    } finally {
      setSaving(false);
      setConfirmDebit(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (isDebit) {
      setConfirmDebit(true);
      return;
    }
    run();
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${meta.tone}`} />
              {meta.title}
            </DialogTitle>
            <DialogDescription>{meta.description}</DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Saldo atual</span>
              <span className="font-semibold tabular-nums">{formatBRL(balance)}</span>
            </div>
            {cents != null && !isAdjust && (
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Saldo após operação</span>
                <span className="tabular-nums">
                  {formatBRL(
                    action === "topup" || action === "refund" ? balance + cents : balance - cents,
                  )}
                </span>
              </div>
            )}
            {cents != null && isAdjust && (
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Novo saldo</span>
                <span className="tabular-nums">{formatBRL(cents)}</span>
              </div>
            )}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount">{isAdjust ? "Novo saldo (R$)" : "Valor (R$)"}</Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Descrição</Label>
              <Textarea
                id="desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Opcional — motivo/observação"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || cents == null}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {meta.cta}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDebit} onOpenChange={(o) => !o && setConfirmDebit(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar débito de {formatBRL(cents ?? 0)}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta operação reduz o saldo do cartão imediatamente. Não pode ser desfeita
              automaticamente — use Estornar caso precise reverter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={run}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Debitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
