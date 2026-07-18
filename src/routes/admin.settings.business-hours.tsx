import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Pencil, CalendarClock, CircleDot, Power, RotateCcw } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { StickySaveBar } from "@/components/admin/settings/StickySaveBar";
import { PageLoading } from "@/components/admin/page/PageLoading";
import { PageError } from "@/components/admin/page/PageError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import { useOrgId } from "@/hooks/use-org-id";
import { qk } from "@/lib/query-keys";
import {
  getOnlineStoreAvailability,
  listOnlineStores,
  updateOnlineStoreAvailability,
  type StoreManualOverrideMode,
} from "@/lib/online-store-api";
import { listEvents } from "@/lib/events-api";
import {
  getBusinessHours,
  replaceBusinessHours,
  createBusinessHourException,
  updateBusinessHourException,
  deleteBusinessHourException,
  getEffectiveSettings,
  type BusinessHourDay,
  type BusinessHourException,
  type BusinessHourChannel,
  type BusinessHourContext,
  type BusinessHourPeriod,
} from "@/lib/settings-api";
import { handleApiError } from "@/lib/api-error";

export const Route = createFileRoute("/admin/settings/business-hours")({
  component: BusinessHoursPage,
});

const WEEKDAYS = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
];

const CHANNELS: { value: BusinessHourChannel; label: string }[] = [
  { value: "ALL", label: "Todos os canais" },
  { value: "DIGITAL_MENU", label: "Cardápio digital" },
  { value: "DELIVERY", label: "Delivery" },
  { value: "PICKUP", label: "Retirada" },
  { value: "TOTEM", label: "Totem" },
  { value: "COUNTER", label: "BalcÃ£o" },
];

const CONTEXTS: { value: BusinessHourContext; label: string }[] = [
  { value: "ORGANIZATION", label: "Organização" },
  { value: "ONLINE_STORE", label: "Loja online" },
  { value: "EVENT", label: "Evento" },
];

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function validateDay(day: BusinessHourDay): string | null {
  if (!day.open) return null;
  if (day.is24h) return null;
  if (day.periods.length === 0) return "Adicione ao menos um período.";
  for (const p of day.periods) {
    if (!HH_MM.test(p.open) || !HH_MM.test(p.close)) return "Use o formato HH:mm.";
    if (toMinutes(p.open) >= toMinutes(p.close))
      return "Abertura deve ser antes do fechamento.";
  }
  // no overlap
  const sorted = [...day.periods].sort((a, b) => toMinutes(a.open) - toMinutes(b.open));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].open) < toMinutes(sorted[i - 1].close))
      return "Períodos não podem se sobrepor.";
  }
  return null;
}

function ensureWeek(
  weekly: BusinessHourDay[],
  context: BusinessHourContext,
  channel: BusinessHourChannel,
  contextId: string | null,
): BusinessHourDay[] {
  const byWd = new Map(weekly.map((d) => [d.weekday, d]));
  return Array.from({ length: 7 }, (_, wd) => {
    const existing = byWd.get(wd);
    if (existing) return existing;
    return {
      weekday: wd,
      open: false,
      is24h: false,
      periods: [],
      channel,
      context,
      contextId,
      storeId: context === "ONLINE_STORE" ? contextId : null,
    };
  });
}

function localDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function channelMatches(candidate: BusinessHourChannel, selected: BusinessHourChannel): boolean {
  return candidate === selected || candidate === "ALL";
}

function contextMatches(day: Pick<BusinessHourDay, "context" | "contextId" | "storeId">, context: BusinessHourContext, contextId: string | null): boolean {
  if (day.context !== context) return false;
  const dayContextId = day.contextId ?? day.storeId ?? null;
  return context === "ORGANIZATION" || dayContextId === contextId;
}

function isWithinPeriods(periods: BusinessHourPeriod[], now = new Date()): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  return periods.some((p) => HH_MM.test(p.open) && HH_MM.test(p.close) && current >= toMinutes(p.open) && current < toMinutes(p.close));
}

function calculateOpenNow(
  weekly: BusinessHourDay[],
  exceptions: BusinessHourException[],
  context: BusinessHourContext,
  contextId: string | null,
  channel: BusinessHourChannel,
): boolean {
  const now = new Date();
  const today = localDateKey(now);
  const exception = exceptions.find((ex) => {
    const exContextId = ex.contextId ?? ex.storeId ?? null;
    return (
      ex.date === today &&
      ex.context === context &&
      (context === "ORGANIZATION" || exContextId === contextId) &&
      channelMatches(ex.channel, channel)
    );
  });
  if (exception) {
    if (exception.closed) return false;
    if (exception.is24h) return true;
    return !!exception.open && !!exception.close && isWithinPeriods([{ open: exception.open, close: exception.close }], now);
  }

  const weekday = now.getDay();
  const day = weekly.find(
    (d) => d.weekday === weekday && channelMatches(d.channel, channel) && contextMatches(d, context, contextId),
  );
  if (!day?.open) return false;
  if (day.is24h) return true;
  return isWithinPeriods(day.periods, now);
}

function BusinessHoursPage() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  const [context, setContext] = useState<BusinessHourContext>("ONLINE_STORE");
  const [channel, setChannel] = useState<BusinessHourChannel>("ALL");
  const [storeId, setStoreId] = useState<string>("");
  const [eventId, setEventId] = useState<string>("");
  const [emptyDraftKey, setEmptyDraftKey] = useState<string>("");

  const storesQuery = useQuery({
    queryKey: qk.onlineOrders.stores(orgId),
    queryFn: () => listOnlineStores(token!),
    enabled: !!token && !!orgId,
    staleTime: 60_000,
  });
  const stores = storesQuery.data ?? [];

  const eventsQuery = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId && context === "EVENT",
    staleTime: 60_000,
  });
  const events = eventsQuery.data ?? [];

  // Auto-select the real store scope by default: configured hours usually live on ONLINE_STORE.
  useEffect(() => {
    if (context !== "ONLINE_STORE") {
      if (storeId) setStoreId("");
      return;
    }
    if (!storesQuery.isSuccess) return;
    if (stores.length === 0) {
      setContext("ORGANIZATION");
      if (storeId) setStoreId("");
      return;
    }
    const selectedStoreExists = !!storeId && stores.some((s) => s.id === storeId);
    if (!selectedStoreExists) {
      const preferredStore =
        stores.find((s) => s.slug === "guellos-pizza") ??
        stores.find((s) => s.active !== false && s.status !== "INACTIVE") ??
        stores[0]!;
      setStoreId(preferredStore.id);
    }
  }, [context, storesQuery.isSuccess, stores, storeId]);

  useEffect(() => {
    if (context !== "EVENT") {
      if (eventId) setEventId("");
      return;
    }
    if (!eventId && events.length === 1) setEventId(events[0]!.id);
  }, [context, events, eventId]);

  const contextId =
    context === "ONLINE_STORE" ? storeId || null : context === "EVENT" ? eventId || null : null;

  const filters = useMemo(
    () => ({ contextType: context, context, channel, contextId, storeId: context === "ONLINE_STORE" ? contextId : null }),
    [context, channel, contextId],
  );

  const businessHoursQueryKey = qk.settings.businessHours(orgId, {
    contextType: context,
    contextId,
    channel,
  });
  const effectiveQueryKey = qk.settings.effective(orgId, {
    contextType: context,
    contextId,
    channel,
  });
  const availabilityQueryKey = qk.onlineOrders.availability(
    orgId,
    context === "ONLINE_STORE" ? contextId : null,
  );

  const scopeKey = `${context}:${contextId ?? "root"}:${channel}`;

  const canFetch =
    !!token &&
    !!orgId &&
    (context === "ORGANIZATION" || (context === "ONLINE_STORE" && !!contextId) || (context === "EVENT" && !!contextId));

  const query = useQuery({
    queryKey: businessHoursQueryKey,
    queryFn: () => getBusinessHours(token!, filters),
    enabled: canFetch,
  });

  const effectiveQuery = useQuery({
    queryKey: effectiveQueryKey,
    queryFn: () => getEffectiveSettings(token!, filters),
    enabled: canFetch,
    refetchInterval: 60_000,
  });

  const availabilityQuery = useQuery({
    queryKey: availabilityQueryKey,
    queryFn: () => getOnlineStoreAvailability(token!, contextId!),
    enabled: canFetch && context === "ONLINE_STORE" && !!contextId,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const availabilityMutation = useMutation({
    mutationFn: (mode: StoreManualOverrideMode) => {
      if (
        mode === "FORCE_OPEN" &&
        !window.confirm("Abrir o estabelecimento fora do horÃ¡rio programado?")
      ) {
        throw new Error("cancelled");
      }
      if (
        mode === "FORCE_CLOSED" &&
        !window.confirm("Fechar o estabelecimento agora? Pedidos novos serÃ£o bloqueados.")
      ) {
        throw new Error("cancelled");
      }
      return updateOnlineStoreAvailability(token!, contextId!, {
        mode,
        until: null,
        reason:
          mode === "FORCE_OPEN"
            ? "Abertura manual"
            : mode === "FORCE_CLOSED"
              ? "Fechamento manual"
              : null,
      });
    },
    onSuccess: async () => {
      toast.success("Status da loja atualizado");
      await queryClient.invalidateQueries({ queryKey: availabilityQueryKey });
      await queryClient.invalidateQueries({ queryKey: effectiveQueryKey });
    },
    onError: (err) => {
      if (err instanceof Error && err.message === "cancelled") return;
      handleApiError(err, "NÃ£o foi possÃ­vel alterar o status");
    },
  });

  const [weekly, setWeekly] = useState<BusinessHourDay[]>([]);
  const [snapshot, setSnapshot] = useState<string>("");

  useEffect(() => {
    if (query.data) {
      const filled = ensureWeek(
        query.data.weekly ?? [],
        context,
        channel,
        contextId,
      );
      setWeekly(filled);
      setSnapshot(JSON.stringify(filled));
      setEmptyDraftKey("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const isDirty = JSON.stringify(weekly) !== snapshot;

  const saveWeekly = useMutation({
    mutationFn: () =>
      replaceBusinessHours(token!, {
        weekly,
        context,
        channel,
        contextId,
        storeId: context === "ONLINE_STORE" ? contextId : null,
      }),
    onSuccess: async () => {
      toast.success("Horários salvos");
      await queryClient.invalidateQueries({ queryKey: businessHoursQueryKey });
      await queryClient.invalidateQueries({ queryKey: effectiveQueryKey });
      await query.refetch();
      effectiveQuery.refetch();
    },
    onError: (err) => handleApiError(err, "Não foi possível salvar"),
  });

  const validation = weekly.map(validateDay);
  const hasErrors = validation.some((e) => e !== null);

  function updateDay(idx: number, patch: Partial<BusinessHourDay>) {
    setWeekly((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  }
  function updatePeriod(idx: number, pIdx: number, patch: Partial<BusinessHourPeriod>) {
    setWeekly((prev) =>
      prev.map((d, i) =>
        i === idx
          ? { ...d, periods: d.periods.map((p, j) => (j === pIdx ? { ...p, ...patch } : p)) }
          : d,
      ),
    );
  }
  function addPeriod(idx: number) {
    updateDay(idx, {
      periods: [...weekly[idx].periods, { open: "08:00", close: "18:00" }],
    });
  }
  function removePeriod(idx: number, pIdx: number) {
    updateDay(idx, { periods: weekly[idx].periods.filter((_, j) => j !== pIdx) });
  }

  const effective = effectiveQuery.data;
  const availability = availabilityQuery.data?.availability;
  const openNow =
    context === "ONLINE_STORE"
      ? availability?.isOpen
      : query.isSuccess
        ? calculateOpenNow(query.data?.weekly ?? [], query.data?.exceptions ?? [], context, contextId, channel)
        : undefined;
  const source =
    context === "ONLINE_STORE"
      ? availability?.manualOverride === "AUTO"
        ? "SCHEDULE"
        : availability?.manualOverride
      : effective?.source;
  const hasConfiguredHours = (query.data?.weekly?.length ?? 0) > 0;
  const shouldShowEmpty = query.isSuccess && !hasConfiguredHours && emptyDraftKey !== scopeKey;

  useEffect(() => {
    if (query.isError) handleApiError(query.error, "Não foi possível carregar horários");
  }, [query.isError, query.error]);

  return (
    <AdminLayout title="Configurações" subtitle="Horários de funcionamento">
      <SettingsLayout>
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Horários</h2>
              <p className="text-sm text-muted-foreground">
                Grade semanal, exceções e status operacional atual.
              </p>
            </div>
            {query.isSuccess && !effectiveQuery.isPending && (
              <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
                <CircleDot
                  className={
                    "h-3.5 w-3.5 " +
                    (openNow ? "text-green-600" : "text-muted-foreground")
                  }
                />
                <span className="font-medium">
                  {openNow ? "Aberto agora" : "Fechado agora"}
                </span>
                {source && (
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    Fonte: {sourceLabel(source)}
                  </Badge>
                )}
              </div>
            )}
          </div>

          <SettingsSection
            title="Escopo"
            description="Escolha para qual contexto e canal você está configurando os horários."
          >
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contexto</Label>
                <Select
                  value={context}
                  onValueChange={(v) => {
                    setContext(v as BusinessHourContext);
                    setEmptyDraftKey("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTEXTS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canal</Label>
                <Select
                  value={channel}
                  onValueChange={(v) => {
                    setChannel(v as BusinessHourChannel);
                    setEmptyDraftKey("");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {context === "ONLINE_STORE" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Loja</Label>
                  <Select
                    value={storeId || undefined}
                    onValueChange={(v) => {
                      setStoreId(v);
                      setEmptyDraftKey("");
                    }}
                    disabled={storesQuery.isLoading || stores.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          storesQuery.isLoading
                            ? "Carregando…"
                            : stores.length === 0
                              ? "Nenhuma loja cadastrada"
                              : "Selecione uma loja"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {stores.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {context === "EVENT" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Evento</Label>
                  <Select
                    value={eventId || undefined}
                    onValueChange={(v) => {
                      setEventId(v);
                      setEmptyDraftKey("");
                    }}
                    disabled={eventsQuery.isLoading || events.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          eventsQuery.isLoading
                            ? "Carregando…"
                            : events.length === 0
                              ? "Nenhum evento cadastrado"
                              : "Selecione um evento"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </SettingsSection>

          {context === "ONLINE_STORE" && contextId && (
            <SettingsSection
              title="Status atual do estabelecimento"
              description="Status efetivo usado pela loja pÃºblica e pelo bloqueio de novos pedidos."
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={availabilityMutation.isPending}
                    onClick={() => availabilityMutation.mutate("AUTO")}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    AutomÃ¡tico
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={availabilityMutation.isPending}
                    onClick={() => availabilityMutation.mutate("FORCE_OPEN")}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Abrir agora
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={availabilityMutation.isPending}
                    onClick={() => availabilityMutation.mutate("FORCE_CLOSED")}
                  >
                    <Power className="mr-2 h-4 w-4" />
                    Fechar agora
                  </Button>
                </div>
              }
            >
              {availabilityQuery.isPending ? (
                <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
              ) : availabilityQuery.isError || !availability ? (
                <PageError message="NÃ£o foi possÃ­vel carregar o status da loja." onRetry={() => availabilityQuery.refetch()} />
              ) : (
                <div className="grid gap-3 text-sm md:grid-cols-4">
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="mt-1 font-semibold">
                      {availability.isOpen ? "Aberto" : "Fechado"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Fonte</p>
                    <p className="mt-1 font-semibold">
                      {availability.manualOverride === "AUTO"
                        ? "HorÃ¡rio programado"
                        : availability.manualOverride === "FORCE_OPEN"
                          ? "Aberto manualmente"
                          : "Fechado manualmente"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">PrÃ³xima mudanÃ§a</p>
                    <p className="mt-1 font-semibold">
                      {formatDateTime(availability.nextClosingAt ?? availability.nextOpeningAt) ?? "Sem previsÃ£o"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground">Timezone</p>
                    <p className="mt-1 font-semibold">{availability.timezone}</p>
                  </div>
                  {availability.reason && (
                    <p className="text-xs text-muted-foreground md:col-span-4">
                      Motivo: {reasonLabel(availability.reason)}
                    </p>
                  )}
                </div>
              )}
            </SettingsSection>
          )}

          {context === "ONLINE_STORE" && !contextId ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Selecione uma loja para carregar os horários.
            </div>
          ) : context === "EVENT" && !contextId ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Selecione um evento para carregar os horários.
            </div>
          ) : query.isError ? (
            <PageError message="Não foi possível carregar horários." onRetry={() => query.refetch()} />
          ) : query.isPending || !query.data ? (
            <PageLoading />
          ) : shouldShowEmpty ? (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm font-medium text-foreground">
                Nenhum horário configurado para este contexto e canal.
              </p>
              <p className="text-sm text-muted-foreground">
                Inicie uma grade vazia somente se deseja criar uma nova configuração para o escopo selecionado.
              </p>
              <Button variant="outline" onClick={() => setEmptyDraftKey(scopeKey)}>
                Iniciar configuração vazia
              </Button>
            </div>
          ) : (
            <>
              <SettingsSection title="Grade semanal">
                <div className="space-y-3">
                  {weekly.map((day, idx) => (
                    <DayRow
                      key={day.weekday}
                      day={day}
                      error={validation[idx]}
                      onOpenChange={(open) => updateDay(idx, { open })}
                      on24hChange={(v) => updateDay(idx, { is24h: v, periods: v ? [] : day.periods })}
                      onPeriodChange={(pIdx, p) => updatePeriod(idx, pIdx, p)}
                      onAddPeriod={() => addPeriod(idx)}
                      onRemovePeriod={(pIdx) => removePeriod(idx, pIdx)}
                    />
                  ))}
                </div>
              </SettingsSection>

              <ExceptionsSection
                context={context}
                channel={channel}
                contextId={contextId}
                storeId={context === "ONLINE_STORE" ? contextId : null}
                exceptions={query.data?.exceptions ?? []}
                token={token}
                businessHoursQueryKey={businessHoursQueryKey}
                effectiveQueryKey={effectiveQueryKey}
              />

              <StickySaveBar
                visible={isDirty}
                saving={saveWeekly.isPending}
                disabled={hasErrors}
                onCancel={() => {
                  setWeekly(JSON.parse(snapshot));
                }}
                onSave={() => saveWeekly.mutate()}
                message={
                  hasErrors ? "Corrija os erros antes de salvar." : "Alterações não salvas."
                }
              />
            </>
          )}
        </div>
      </SettingsLayout>
    </AdminLayout>
  );
}

function sourceLabel(s: string): string {
  switch (s) {
    case "SCHEDULE":
      return "Horario";
    case "FORCE_OPEN":
      return "Aberto manualmente";
    case "FORCE_CLOSED":
      return "Fechado manualmente";
    case "ORGANIZATION":
      return "Organização";
    case "ONLINE_STORE":
      return "Loja";
    case "EVENT":
      return "Evento";
    case "EXCEPTION":
      return "Exceção";
    case "OVERRIDE":
      return "Override";
    default:
      return s;
  }
}

function reasonLabel(reason: string): string {
  switch (reason) {
    case "OUTSIDE_BUSINESS_HOURS":
      return "Fora do horario programado";
    case "MANUALLY_CLOSED":
      return "Fechado manualmente";
    case "STORE_INACTIVE":
      return "Loja inativa";
    case "ONLINE_ORDERING_DISABLED":
      return "Pedidos online desativados";
    case "MINIMUM_ORDER_NOT_REACHED":
      return "Pedido minimo nao atingido";
    default:
      return reason;
  }
}

function formatDateTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DayRow({
  day,
  error,
  onOpenChange,
  on24hChange,
  onPeriodChange,
  onAddPeriod,
  onRemovePeriod,
}: {
  day: BusinessHourDay;
  error: string | null;
  onOpenChange: (v: boolean) => void;
  on24hChange: (v: boolean) => void;
  onPeriodChange: (pIdx: number, p: Partial<BusinessHourPeriod>) => void;
  onAddPeriod: () => void;
  onRemovePeriod: (pIdx: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="w-36 font-medium">{WEEKDAYS[day.weekday]}</div>
        <div className="flex items-center gap-2">
          <Switch checked={day.open} onCheckedChange={onOpenChange} />
          <span className="text-sm text-muted-foreground">
            {day.open ? "Aberto" : "Fechado"}
          </span>
        </div>
        {day.open && (
          <div className="flex items-center gap-2">
            <Switch checked={!!day.is24h} onCheckedChange={on24hChange} />
            <span className="text-sm text-muted-foreground">24 horas</span>
          </div>
        )}
      </div>

      {day.open && !day.is24h && (
        <div className="mt-3 space-y-2">
          {day.periods.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                type="time"
                value={p.open}
                onChange={(e) => onPeriodChange(i, { open: e.target.value })}
                className="w-28"
              />
              <span className="text-muted-foreground">—</span>
              <Input
                type="time"
                value={p.close}
                onChange={(e) => onPeriodChange(i, { close: e.target.value })}
                className="w-28"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onRemovePeriod(i)}
                aria-label="Remover período"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={onAddPeriod}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar período
          </Button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}

interface ExceptionFormState {
  id?: string;
  date: string;
  channel: BusinessHourChannel;
  closed: boolean;
  is24h: boolean;
  open: string;
  close: string;
  reason: string;
}

const EMPTY_EX: ExceptionFormState = {
  date: new Date().toISOString().slice(0, 10),
  channel: "ALL",
  closed: true,
  is24h: false,
  open: "08:00",
  close: "18:00",
  reason: "",
};

function ExceptionsSection({
  context,
  channel,
  contextId,
  storeId,
  exceptions,
  token,
  businessHoursQueryKey,
  effectiveQueryKey,
}: {
  context: BusinessHourContext;
  channel: BusinessHourChannel;
  contextId: string | null;
  storeId: string | null;
  exceptions: BusinessHourException[];
  token: string | null;
  businessHoursQueryKey: QueryKey;
  effectiveQueryKey: QueryKey;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExceptionFormState>(EMPTY_EX);

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        date: form.date,
        channel: form.channel,
        context,
        contextType: context,
        contextId,
        storeId,
        eventId: context === "EVENT" ? contextId : null,
        closed: form.closed,
        is24h: form.closed ? false : form.is24h,
        open: form.closed || form.is24h ? null : form.open,
        close: form.closed || form.is24h ? null : form.close,
        reason: form.reason || null,
      };
      if (form.id) return updateBusinessHourException(token!, form.id, body);
      return createBusinessHourException(token!, body);
    },
    onSuccess: () => {
      toast.success(form.id ? "Exceção atualizada" : "Exceção criada");
      setOpen(false);
      setForm(EMPTY_EX);
      queryClient.invalidateQueries({ queryKey: businessHoursQueryKey });
      queryClient.invalidateQueries({ queryKey: effectiveQueryKey });
    },
    onError: (err) => handleApiError(err, "Falha ao salvar exceção"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteBusinessHourException(token!, id),
    onSuccess: () => {
      toast.success("Exceção removida");
      queryClient.invalidateQueries({ queryKey: businessHoursQueryKey });
      queryClient.invalidateQueries({ queryKey: effectiveQueryKey });
    },
    onError: (err) => handleApiError(err, "Falha ao remover"),
  });

  function openCreate() {
    setForm({ ...EMPTY_EX, channel });
    setOpen(true);
  }
  function openEdit(ex: BusinessHourException) {
    setForm({
      id: ex.id,
      date: ex.date,
      channel: ex.channel,
      closed: ex.closed,
      is24h: !!ex.is24h,
      open: ex.open ?? "08:00",
      close: ex.close ?? "18:00",
      reason: ex.reason ?? "",
    });
    setOpen(true);
  }

  return (
    <SettingsSection
      title="Exceções e feriados"
      description="Datas específicas que sobrescrevem a grade semanal."
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nova exceção
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar exceção" : "Nova exceção"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Data</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Canal</Label>
                  <Select
                    value={form.channel}
                    onValueChange={(v) =>
                      setForm({ ...form, channel: v as BusinessHourChannel })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.closed}
                  onCheckedChange={(v) => setForm({ ...form, closed: v })}
                />
                <span className="text-sm">Fechado neste dia</span>
              </div>
              {!form.closed && (
                <>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={form.is24h}
                      onCheckedChange={(v) => setForm({ ...form, is24h: v })}
                    />
                    <span className="text-sm">Aberto 24 horas</span>
                  </div>
                  {!form.is24h && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Abre</Label>
                        <Input
                          type="time"
                          value={form.open}
                          onChange={(e) => setForm({ ...form, open: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Fecha</Label>
                        <Input
                          type="time"
                          value={form.close}
                          onChange={(e) => setForm({ ...form, close: e.target.value })}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">Motivo (opcional)</Label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Ex.: Natal"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {exceptions.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          Nenhuma exceção cadastrada.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {exceptions.map((ex) => (
            <li
              key={ex.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{formatDate(ex.date)}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {channelLabel(ex.channel)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {ex.closed
                    ? "Fechado"
                    : ex.is24h
                      ? "24 horas"
                      : `${ex.open ?? "--:--"} às ${ex.close ?? "--:--"}`}
                  {ex.reason ? ` — ${ex.reason}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(ex)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover exceção?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove.mutate(ex.id)}>
                        Remover
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsSection>
  );
}

function formatDate(iso: string): string {
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function channelLabel(c: BusinessHourChannel): string {
  return CHANNELS.find((x) => x.value === c)?.label ?? c;
}
