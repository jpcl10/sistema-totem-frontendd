import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import {
  Plus,
  Loader2,
  AlertCircle,
  CreditCard,
  Search,
  Ban,
  Pencil,
  Eye,
  ScanLine,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Users,
  Star,
  Wrench,
  ClipboardList,
  Radio,
  Wallet,
  Clock,
  Sparkles,
  Tag,
  TrendingUp,
  TrendingDown,
  Receipt,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  Undo2,
  Sliders,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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

import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import { listEvents, type EventItem } from "@/lib/events-api";
import {
  listNfcCards,
  createNfcCard,
  readNfcCard,
  updateNfcCard,
  blockNfcCard,
  unblockNfcCard,
  loadCardAggregates,
  listNfcTransactions,
  aggregateTransactions,
  NFC_TYPE_LABEL,
  NFC_TX_TYPE_LABEL,
  NFC_STATUS_LABEL,
  formatBRL,
  type NfcCard,
  type NfcCardType,
  type NfcCardStatus,
  type NfcTransaction,
  type NfcTransactionType,
  type CardAggregate,
} from "@/lib/nfc-cards-api";
import { NfcCashlessDrawer } from "@/components/nfc/nfc-cashless-drawer";
import { useRequireModule } from "@/lib/require-module";



export const Route = createFileRoute("/admin/nfc-cards")({
  component: NfcCardsPage,
});

type TypeFilter = "ALL" | NfcCardType;
type StatusFilter = "ALL" | NfcCardStatus;

const TYPES: NfcCardType[] = ["CUSTOMER", "VIP", "STAFF", "COMANDA"];
const STATUSES: NfcCardStatus[] = ["ACTIVE", "BLOCKED", "LOST"];

function StatusBadge({ status }: { status: NfcCardStatus }) {
  const map: Record<NfcCardStatus, { cls: string; icon: typeof CheckCircle2 }> = {
    ACTIVE: {
      cls: "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-500",
      icon: CheckCircle2,
    },
    BLOCKED: {
      cls: "bg-red-500 text-white border-red-600 hover:bg-red-500",
      icon: XCircle,
    },
    LOST: {
      cls: "bg-orange-500 text-white border-orange-600 hover:bg-orange-500",
      icon: AlertTriangle,
    },
  };
  const { cls, icon: Icon } = map[status];
  return (
    <Badge variant="outline" className={`gap-1 font-semibold ${cls}`}>
      <Icon className="h-3 w-3" />
      {NFC_STATUS_LABEL[status]}
    </Badge>
  );
}

function formatRelativeTime(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora mesmo";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH} h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD} d`;
  return d.toLocaleDateString("pt-BR");
}

function formatLastRead(value?: string | null): string {
  return formatRelativeTime(value, "Nunca lido");
}

const TX_SIGN: Record<NfcTransactionType, 1 | -1 | 0> = {
  TOPUP: 1,
  BONUS: 1,
  REFUND: 1,
  PURCHASE: -1,
  ADJUSTMENT: 0,
  REVERSAL: 0,
};

function isToday(iso?: string): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}


function TypeBadge({ type }: { type: NfcCardType }) {
  const map: Record<NfcCardType, string> = {
    CUSTOMER: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    VIP: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    STAFF: "bg-purple-500/10 text-purple-700 border-purple-500/30",
    COMANDA: "bg-teal-500/10 text-teal-700 border-teal-500/30",
  };
  return (
    <Badge variant="outline" className={map[type]}>
      {NFC_TYPE_LABEL[type]}
    </Badge>
  );
}


function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  loading = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof CreditCard;
  tone?: "default" | "primary" | "success" | "danger" | "info" | "warning";
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground bg-muted",
    primary: "text-primary bg-primary/10",
    success: "text-emerald-700 bg-emerald-500/10",
    danger: "text-red-700 bg-red-500/10",
    info: "text-blue-700 bg-blue-500/10",
    warning: "text-orange-700 bg-orange-500/10",
  };
  return (
    <Card className="border-border/60 transition-colors hover:border-border">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${tones[tone]}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
        )}
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function CountChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CreditCard;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card px-2.5 py-1.5">
      <Icon className={`h-3.5 w-3.5 ${tone}`} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function NfcCardsPage() {
  useRequireModule(["NFC_CASHLESS"]);
  const { token } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [cards, setCards] = useState<NfcCard[]>([]);
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const [createOpen, setCreateOpen] = useState(false);
  const [readOpen, setReadOpen] = useState(false);
  const [detailsCard, setDetailsCard] = useState<NfcCard | null>(null);
  const [editCard, setEditCard] = useState<NfcCard | null>(null);
  const [blockCard, setBlockCard] = useState<NfcCard | null>(null);

  const [aggregates, setAggregates] = useState<Record<string, CardAggregate>>({});
  const [aggLoading, setAggLoading] = useState(false);

  // Load events via React Query
  const { data: eventsData } = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId,
  });
  useEffect(() => {
    if (eventsData) setEvents(eventsData);
    if (eventsData && eventsData.length && !eventId) setEventId(eventsData[0].id);
  }, [eventsData, eventId]);

  const {
    data: cardsData,
    isLoading: cardsLoading,
    error: cardsError,
    refetch: refetchCardsQuery,
  } = useQuery({
    queryKey: qk.nfcCards.list(orgId, eventId || null),
    queryFn: () => listNfcCards(token!, eventId),
    enabled: !!token && !!orgId && !!eventId,
  });
  useEffect(() => {
    if (cardsData) setCards(cardsData);
    if (!eventId) setCards([]);
  }, [cardsData, eventId]);
  const loading = !!token && !!eventId ? cardsLoading : false;
  const error = cardsError ? handleApiError(cardsError, "Erro ao carregar cartões") : null;
  const refetchCards = () => {
    if (eventId) refetchCardsQuery();
  };
  void queryClient;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (q) {
        const hay = [c.holderName, c.code, c.uid].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [cards, search, typeFilter, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: cards.length,
      active: cards.filter((c) => c.status === "ACTIVE").length,
      blocked: cards.filter((c) => c.status === "BLOCKED").length,
      lost: cards.filter((c) => c.status === "LOST").length,
      customer: cards.filter((c) => c.type === "CUSTOMER").length,
      vip: cards.filter((c) => c.type === "VIP").length,
      staff: cards.filter((c) => c.type === "STAFF").length,
      comanda: cards.filter((c) => c.type === "COMANDA").length,
      totalBalanceCents: cards.reduce((s, c) => s + (c.balanceInCents ?? 0), 0),
    };
  }, [cards]);

  // Load per-card transaction aggregates (capped to avoid spamming the API)
  const AGG_LIMIT = 80;
  useEffect(() => {
    if (!token || !eventId || cards.length === 0) {
      setAggregates({});
      return;
    }
    if (cards.length > AGG_LIMIT) {
      setAggregates({});
      return;
    }
    let cancelled = false;
    setAggLoading(true);
    loadCardAggregates(token, eventId, cards.map((c) => c.id))
      .then((agg) => {
        if (!cancelled) setAggregates(agg);
      })
      .finally(() => {
        if (!cancelled) setAggLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, eventId, cards.map((c) => c.id).join(",")]);

  const todayStats = useMemo(() => {
    let topupCents = 0;
    let topupCount = 0;
    let purchaseCents = 0;
    let purchaseCount = 0;
    let txCount = 0;
    for (const agg of Object.values(aggregates)) {
      for (const tx of agg.txs) {
        if (!isToday(tx.createdAt)) continue;
        txCount++;
        const amt = Math.abs(tx.amountInCents ?? 0);
        if (tx.type === "TOPUP" || tx.type === "BONUS") {
          topupCents += amt;
          topupCount++;
        } else if (tx.type === "PURCHASE") {
          purchaseCents += amt;
          purchaseCount++;
        }
      }
    }
    return {
      topupCents,
      topupCount,
      purchaseCents,
      purchaseCount,
      txCount,
      loadingHint: aggLoading,
      capped: cards.length > AGG_LIMIT,
    };
  }, [aggregates, aggLoading, cards.length]);




  const onCreated = (card: NfcCard) => {
    setCards((prev) => [card, ...prev.filter((c) => c.id !== card.id)]);
    setCreateOpen(false);
    toast.success("Cartão NFC cadastrado com sucesso.");
  };

  const onUpdated = (card: NfcCard) => {
    setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));
    setEditCard(null);
    toast.success("Cartão atualizado.");
  };

  const doBlockToggle = async () => {
    if (!token || !eventId || !blockCard) return;
    const wasBlocked = blockCard.status === "BLOCKED";
    try {
      const updated = wasBlocked
        ? await unblockNfcCard(token, eventId, blockCard.id)
        : await blockNfcCard(token, eventId, blockCard.id);
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      toast.success(wasBlocked ? "Cartão desbloqueado." : "Cartão bloqueado.");
      setBlockCard(null);
    } catch (e) {
      handleApiError(e);
    }
  };

  return (
    <AdminLayout
      title="Cartões NFC"
      subtitle="Gerencie cartões, pulseiras NFC, comandas e identificação de clientes, equipe e VIPs."
      actions={
        <div className="flex gap-2">
          <Button
            variant="default"
            onClick={() => setReadOpen(true)}
            className="bg-primary shadow-sm"
          >
            <Radio className="mr-2 h-4 w-4" />
            Ler Cartão NFC
          </Button>
          <Button variant="outline" onClick={() => setCreateOpen(true)} disabled={!eventId}>
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar Cartão
          </Button>
        </div>
      }
    >
      {/* Event selector */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <Label className="text-xs text-muted-foreground sm:w-24">Evento</Label>
          <Select value={eventId} onValueChange={setEventId}>
            <SelectTrigger className="sm:max-w-sm">
              <SelectValue placeholder="Selecione um evento" />
            </SelectTrigger>
            <SelectContent>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Executive financial dashboard */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 text-white shadow-md">
        <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-300">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-cyan-300/80">
                Saldo total circulando
              </p>
              <p className="text-3xl font-bold tabular-nums">
                {formatBRL(counts.totalBalanceCents)}
              </p>
              <p className="text-[11px] text-white/60">
                {counts.active} ativo{counts.active === 1 ? "" : "s"} · {counts.total} cartões
              </p>
            </div>
          </div>
          {todayStats.loadingHint && (
            <div className="flex items-center gap-2 text-[11px] text-white/60">
              <Loader2 className="h-3 w-3 animate-spin" />
              Carregando métricas do dia…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stripe-style KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Recargas hoje"
          value={formatBRL(todayStats.topupCents)}
          hint={`${todayStats.topupCount} operações`}
          icon={TrendingUp}
          tone="success"
          loading={aggLoading}
        />
        <MetricCard
          label="Consumos hoje"
          value={formatBRL(todayStats.purchaseCents)}
          hint={`${todayStats.purchaseCount} operações`}
          icon={TrendingDown}
          tone="danger"
          loading={aggLoading}
        />
        <MetricCard
          label="Transações hoje"
          value={String(todayStats.txCount)}
          hint="Todas as operações"
          icon={Activity}
          tone="info"
          loading={aggLoading}
        />
        <MetricCard
          label="Ticket médio"
          value={
            todayStats.purchaseCount > 0
              ? formatBRL(Math.round(todayStats.purchaseCents / todayStats.purchaseCount))
              : "—"
          }
          hint="Cashless (consumos)"
          icon={Receipt}
          tone="primary"
          loading={aggLoading}
        />
        <MetricCard
          label="Saldo médio"
          value={
            counts.active > 0
              ? formatBRL(Math.round(counts.totalBalanceCents / counts.active))
              : "—"
          }
          hint={`${counts.active} cartões ativos`}
          icon={Wallet}
          tone="default"
        />
      </div>

      {/* Secondary breakdown */}
      <div className="flex flex-wrap items-center gap-2">
        <CountChip icon={CheckCircle2} label="Ativos" value={counts.active} tone="text-emerald-600" />
        <CountChip icon={XCircle} label="Bloqueados" value={counts.blocked} tone="text-red-600" />
        <CountChip icon={AlertTriangle} label="Perdidos" value={counts.lost} tone="text-orange-600" />
        <span className="mx-1 h-4 w-px bg-border" />
        <CountChip icon={Users} label="Clientes" value={counts.customer} tone="text-blue-600" />
        <CountChip icon={Star} label="VIP" value={counts.vip} tone="text-amber-600" />
        <CountChip icon={Wrench} label="Equipe" value={counts.staff} tone="text-purple-600" />
        <CountChip icon={ClipboardList} label="Comandas" value={counts.comanda} tone="text-teal-600" />
      </div>



      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, código ou UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
            <SelectTrigger className="md:w-44">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os tipos</SelectItem>
              {TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {NFC_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="md:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {NFC_STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="flex items-center gap-3 p-6 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={refetchCards} className="ml-auto">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CreditCard className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold">
              {cards.length === 0
                ? "Nenhum cartão NFC cadastrado ainda."
                : "Nenhum cartão corresponde aos filtros."}
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {cards.length === 0
                ? "Cadastre o primeiro cartão para começar a identificar clientes, influenciadores, equipe ou comandas."
                : "Ajuste a busca ou os filtros para ver mais resultados."}
            </p>
            {cards.length === 0 && (
              <Button onClick={() => setCreateOpen(true)} disabled={!eventId} className="mt-2">
                <Plus className="mr-2 h-4 w-4" />
                Cadastrar Cartão
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((card) => {
            const balance = card.balanceInCents ?? 0;
            const balanceTone =
              balance > 0
                ? "text-emerald-700 border-emerald-500/30 bg-emerald-500/10"
                : "text-muted-foreground border-border/60 bg-muted/40";
            const agg = aggregates[card.id];
            const lastTx = agg?.lastTx;
            const lastTxSign = lastTx ? TX_SIGN[lastTx.type] : 0;
            const lastTxAmt = lastTx ? Math.abs(lastTx.amountInCents ?? 0) : 0;
            const lastTxColor =
              lastTxSign > 0
                ? "text-emerald-600"
                : lastTxSign < 0
                ? "text-red-600"
                : "text-muted-foreground";
            const lastReadAt = (card as { lastReadAt?: string }).lastReadAt;
            return (
              <Card key={card.id} className="border-border/60 transition-shadow hover:shadow-sm">
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold">
                        {card.holderName || "Sem titular"}
                      </p>
                      {card.code && (
                        <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-primary">
                          {card.code}
                        </span>
                      )}
                      <TypeBadge type={card.type} />
                      <StatusBadge status={card.status} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                      <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-2 py-1">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          UID
                        </span>
                        <span className="font-mono text-xs font-semibold tracking-wide text-foreground">
                          {card.uid}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Radio className="h-3 w-3" />
                        <span>
                          {lastReadAt
                            ? `Lido ${formatRelativeTime(lastReadAt)}`
                            : "Nunca lido"}
                        </span>
                      </div>
                      {lastTx ? (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-muted-foreground">Última mov.:</span>
                          <span className={`font-semibold tabular-nums ${lastTxColor}`}>
                            {lastTxSign === 0
                              ? formatBRL(lastTxAmt)
                              : `${lastTxSign > 0 ? "+" : "−"} ${formatBRL(lastTxAmt)}`}
                          </span>
                          <span className="text-muted-foreground">
                            · {formatRelativeTime(lastTx.createdAt)}
                          </span>
                        </div>
                      ) : (
                        !aggLoading &&
                        Object.keys(aggregates).length > 0 && (
                          <span className="text-muted-foreground">Sem movimentações</span>
                        )
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 md:ml-auto">
                    <div
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${balanceTone}`}
                    >
                      <Wallet className="h-4 w-4" />
                      <div className="text-right leading-tight">
                        <p className="text-[10px] uppercase tracking-wider opacity-70">
                          Saldo
                        </p>
                        <p className="text-base font-bold tabular-nums">
                          {formatBRL(balance)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setDetailsCard(card)} aria-label="Detalhes">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditCard(card)} aria-label="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setBlockCard(card)}
                        aria-label={card.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                        title={card.status === "BLOCKED" ? "Desbloquear" : "Bloquear"}
                        className={card.status === "BLOCKED" ? "text-emerald-600 hover:text-emerald-700" : ""}
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}


      {/* Roadmap / Próximas funcionalidades */}
      <Card className="border-dashed border-border/60 bg-muted/20">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Próximas funcionalidades</h3>
            <Badge variant="outline" className="text-[10px]">
              Em breve
            </Badge>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { icon: Wallet, label: "Pagamento via saldo NFC" },
              { icon: TrendingUp, label: "Recarga via PIX" },
              { icon: CreditCard, label: "Recarga via Stone" },
              { icon: ClipboardList, label: "Comandas NFC" },
              { icon: ScanLine, label: "Controle de acesso" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-3 py-2 text-xs text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>


      {createOpen && eventId && (
        <CreateCardDialog
          eventId={eventId}
          token={token!}
          onClose={() => setCreateOpen(false)}
          onCreated={onCreated}
        />
      )}

      {readOpen && eventId && (
        <ReadCardDialog
          eventId={eventId}
          token={token!}
          onClose={() => setReadOpen(false)}
          onWantRegister={(uid) => {
            setReadOpen(false);
            setCreateOpen(true);
            // pass uid via session — simplest: stash on window
            (window as unknown as { __prefillUid?: string }).__prefillUid = uid;
          }}
        />
      )}

      {detailsCard && eventId && (
        <NfcCashlessDrawer
          eventId={eventId}
          token={token!}
          card={detailsCard}
          onClose={() => setDetailsCard(null)}
          onUpdated={(c) => {
            setCards((prev) => prev.map((x) => (x.id === c.id ? c : x)));
            setDetailsCard(c);
            listNfcTransactions(token!, eventId, c.id)
              .then((txs) =>
                setAggregates((prev) => ({ ...prev, [c.id]: aggregateTransactions(txs) })),
              )
              .catch(() => {});
          }}
        />
      )}


      {editCard && eventId && (
        <EditCardDialog
          eventId={eventId}
          token={token!}
          card={editCard}
          onClose={() => setEditCard(null)}
          onUpdated={onUpdated}
        />
      )}

      <AlertDialog open={!!blockCard} onOpenChange={(o) => !o && setBlockCard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockCard?.status === "BLOCKED" ? "Desbloquear cartão?" : "Bloquear cartão?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockCard?.status === "BLOCKED"
                ? "O cartão voltará a ficar ativo e poderá ser usado normalmente para identificação, comanda e cashless."
                : "Tem certeza que deseja bloquear este cartão? Ele não poderá ser usado para identificação, comanda ou cashless."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doBlockToggle}
              className={
                blockCard?.status === "BLOCKED"
                  ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                  : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              }
            >
              {blockCard?.status === "BLOCKED" ? "Desbloquear cartão" : "Bloquear cartão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}

/* -------------------- Create Dialog -------------------- */
function CreateCardDialog({
  eventId,
  token,
  onClose,
  onCreated,
}: {
  eventId: string;
  token: string;
  onClose: () => void;
  onCreated: (c: NfcCard) => void;
}) {
  const prefill = (window as unknown as { __prefillUid?: string }).__prefillUid;
  const [uid, setUid] = useState(prefill ?? "");
  const [code, setCode] = useState("");
  const [holderName, setHolderName] = useState("");
  const [type, setType] = useState<NfcCardType>("CUSTOMER");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      (window as unknown as { __prefillUid?: string }).__prefillUid = undefined;
    };
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid.trim()) {
      toast.error("UID é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      const card = await createNfcCard(token, eventId, {
        uid: uid.trim(),
        code: code.trim() || undefined,
        holderName: holderName.trim() || undefined,
        type,
        notes: notes.trim() || undefined,
      });
      onCreated(card);
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 409) {
        toast.error("Cartão NFC já cadastrado.");
      } else {
        handleApiError(e);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Cartão NFC</DialogTitle>
          <DialogDescription>
            Vincule um UID a um titular, tipo e código interno.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="uid">UID *</Label>
            <Input
              id="uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="04:43:A2:6E:21:02:89"
              className="font-mono"
              autoFocus
              required
            />
            <p className="text-xs text-muted-foreground">
              Aceita formato com ou sem separadores. O servidor normaliza automaticamente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="code">Código interno</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ex: 001" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as NfcCardType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {NFC_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="holder">Nome do titular</Label>
            <Input
              id="holder"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Opcional"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Read Dialog -------------------- */
function ReadCardDialog({
  eventId,
  token,
  onClose,
  onWantRegister,
}: {
  eventId: string;
  token: string;
  onClose: () => void;
  onWantRegister: (uid: string) => void;
}) {
  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NfcCard | null>(null);
  const [notFound, setNotFound] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid.trim()) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);
    try {
      const card = await readNfcCard(token, eventId, uid.trim());
      if (!card) {
        setNotFound(true);
      } else {
        setResult(card);
      }
    } catch (e) {
      const err = e as { status?: number };
      if (err.status === 404) {
        setNotFound(true);
      } else {
        handleApiError(e);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ler Cartão NFC</DialogTitle>
          <DialogDescription>
            Aproxime o cartão do leitor ou digite/cole o UID manualmente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="read-uid">UID lido</Label>
            <Input
              id="read-uid"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              placeholder="0443A26E210289"
              className="font-mono"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !uid.trim()}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Consultar cartão
          </Button>
        </form>

        {result && (
          <div className="mt-2 space-y-3 rounded-lg border bg-card p-4">
            {result.status === "BLOCKED" && (
              <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4" />
                Cartão bloqueado.
              </div>
            )}
            <div className="flex items-center gap-2">
              <TypeBadge type={result.type} />
              <StatusBadge status={result.status} />
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Titular</dt>
              <dd>{result.holderName || "—"}</dd>
              <dt className="text-muted-foreground">Código</dt>
              <dd>{result.code || "—"}</dd>
              <dt className="text-muted-foreground">UID</dt>
              <dd className="font-mono text-xs">{result.uid}</dd>
              <dt className="text-muted-foreground">Saldo</dt>
              <dd className="font-semibold">{formatBRL(result.balanceInCents)}</dd>
            </dl>
          </div>
        )}

        {notFound && (
          <div className="mt-2 space-y-3 rounded-lg border border-dashed p-4 text-center">
            <p className="text-sm text-muted-foreground">Cartão não cadastrado.</p>
            <Button onClick={() => onWantRegister(uid.trim())} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar este UID
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




/* -------------------- Edit Dialog -------------------- */
function EditCardDialog({
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
  const [code, setCode] = useState(card.code ?? "");
  const [holderName, setHolderName] = useState(card.holderName ?? "");
  const [type, setType] = useState<NfcCardType>(card.type);
  const [status, setStatus] = useState<NfcCardStatus>(card.status);
  const [notes, setNotes] = useState(card.notes ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateNfcCard(token, eventId, card.id, {
        code: code.trim() || "",
        holderName: holderName.trim() || "",
        type,
        status,
        notes: notes.trim() || "",
      });
      onUpdated(updated);
    } catch (e) {
      handleApiError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar cartão</DialogTitle>
          <DialogDescription className="font-mono text-xs">UID: {card.uid}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Código interno</Label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as NfcCardType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{NFC_TYPE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Nome do titular</Label>
            <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as NfcCardStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{NFC_STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
