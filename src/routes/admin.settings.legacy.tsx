import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import {
  Settings as SettingsIcon,
  Monitor,
  Wrench,
  Printer,
  CreditCard,
  Save,
  RotateCcw,
  Loader2,
  Upload,
  Trash2,
  ImageIcon,
  AlertCircle,
  RefreshCw,
  QrCode,
  ShieldCheck,
  Globe,
  Layout,
} from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { EventTotemSettings } from "@/components/event-settings/event-totem-settings";
import { PrintersManager } from "@/components/PrintersManager";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { listEvents, getEvent, updateEvent, type EventItem } from "@/lib/events-api";
import { resolveAssetUrl } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import {
  listPaymentProviderSettings,
  updatePaymentProviderSettings,
  type PaymentProviderSetting,
  type UpdatePaymentProviderInput,
} from "@/lib/payment-settings-api";
import { ToggleRow, ColorField, PlaceholderCard } from "@/components/admin/settings/shared-ui";
import { OperationsCard } from "@/components/admin/settings/operations-card";
import { PrintingCard } from "@/components/admin/settings/printing-card";

import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

const legacySearchSchema = z.object({
  tab: fallback(z.string(), "geral").default("geral"),
});

export const Route = createFileRoute("/admin/settings/legacy")({
  validateSearch: zodValidator(legacySearchSchema),
  component: SettingsPage,
});


interface TotemForm {
  welcomeMessage: string;
  backgroundColor: string;
  textColor: string;
  showPrices: boolean;
  showLowStock: boolean;
  requireCustomerName: boolean;
  autoResetSeconds: number;
  showLogo: boolean;
  fullscreenRecommended: boolean;
  // Visual extras (local-only — not sent to backend)
  useGradient: boolean;
  gradientColor: string;
  // Asset URLs (sent as logoUrl/bannerUrl)
  logoUrl: string;
  bannerUrl: string;
  // PIX settings
  pixEnabled: boolean;
  pixKey: string;
  pixReceiverName: string;
  pixInstructions: string;
  // Printing settings
  printingEnabled: boolean;
  autoPrintEnabled: boolean;
  printMode: "FULL_ORDER" | "BY_SECTOR" | "BOTH";
  printerPaperSize: "58mm" | "80mm";
}

const DEFAULT_FORM: TotemForm = {
  welcomeMessage: "Bem-vindo! Faça seu pedido por aqui.",
  backgroundColor: "#0F172A",
  textColor: "#FFFFFF",
  showPrices: true,
  showLowStock: true,
  requireCustomerName: true,
  autoResetSeconds: 60,
  showLogo: true,
  fullscreenRecommended: true,
  useGradient: false,
  gradientColor: "#1E293B",
  logoUrl: "",
  bannerUrl: "",
  pixEnabled: false,
  pixKey: "",
  pixReceiverName: "",
  pixInstructions: "",
  printingEnabled: false,
  autoPrintEnabled: false,
  printMode: "BY_SECTOR",
  printerPaperSize: "80mm",
};

const GRADIENT_KEY = (id: string) => `admin.settings.kiosk.gradient.${id}`;

const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

function fromEvent(ev: EventItem | null): TotemForm {
  if (!ev) return DEFAULT_FORM;
  let gradient: { useGradient: boolean; gradientColor: string } = {
    useGradient: false,
    gradientColor: DEFAULT_FORM.gradientColor,
  };
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(GRADIENT_KEY(ev.id));
      if (raw) gradient = { ...gradient, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
  }
  return {
    welcomeMessage: ev.totemWelcomeMessage ?? DEFAULT_FORM.welcomeMessage,
    backgroundColor: ev.totemBackgroundColor ?? DEFAULT_FORM.backgroundColor,
    textColor: ev.totemTextColor ?? DEFAULT_FORM.textColor,
    showPrices: ev.totemShowPrices ?? DEFAULT_FORM.showPrices,
    showLowStock: ev.totemShowLowStock ?? DEFAULT_FORM.showLowStock,
    requireCustomerName: ev.totemRequireCustomerName ?? DEFAULT_FORM.requireCustomerName,
    autoResetSeconds: ev.totemAutoResetSeconds ?? DEFAULT_FORM.autoResetSeconds,
    showLogo: ev.totemShowLogo ?? DEFAULT_FORM.showLogo,
    fullscreenRecommended: ev.totemFullscreenRecommended ?? DEFAULT_FORM.fullscreenRecommended,
    useGradient: gradient.useGradient,
    gradientColor: gradient.gradientColor,
    logoUrl: ev.logoUrl ?? "",
    bannerUrl: ev.bannerUrl ?? "",
    pixEnabled: ev.pixEnabled ?? DEFAULT_FORM.pixEnabled,
    pixKey: ev.pixKey ?? DEFAULT_FORM.pixKey,
    pixReceiverName: ev.pixReceiverName ?? DEFAULT_FORM.pixReceiverName,
    pixInstructions: ev.pixInstructions ?? DEFAULT_FORM.pixInstructions,
    printingEnabled: (ev.printingEnabled as boolean | undefined) ?? DEFAULT_FORM.printingEnabled,
    autoPrintEnabled: (ev.autoPrintEnabled as boolean | undefined) ?? DEFAULT_FORM.autoPrintEnabled,
    printMode: ((ev.printMode as TotemForm["printMode"] | undefined) ?? DEFAULT_FORM.printMode),
    printerPaperSize: ((ev.printerPaperSize as TotemForm["printerPaperSize"] | undefined) ?? DEFAULT_FORM.printerPaperSize),
  };
}

// (upload happens via uploadImage from events-api; no base64 conversion)

function SettingsPage() {
  const legacySearch = Route.useSearch();
  const legacyNavigate = Route.useNavigate();
  const { token } = useAuth();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventId, setEventId] = useState<string>("");
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [form, setForm] = useState<TotemForm>(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const orgId = useOrgId();
  const queryClient = useQueryClient();

  // Mercado Pago settings state
  const [mpSaving, setMpSaving] = useState(false);
  const [mpForm, setMpForm] = useState<UpdatePaymentProviderInput & {
    publicKeyConfigured?: boolean;
    accessTokenConfigured?: boolean;
    webhookSecretConfigured?: boolean;
  }>({
    enabled: false,
    pixEnabled: false,
    cardEnabled: false,
    terminalEnabled: false,
    webhookUrl: "",
    accessToken: "",
    publicKey: "",
    webhookSecret: "",
  });
  const [mpDirty, setMpDirty] = useState(false);

  // Load events list via React Query
  const eventsQuery = useQuery({
    queryKey: qk.events.list(orgId),
    queryFn: () => listEvents(token!),
    enabled: !!token && !!orgId,
  });
  const loadingEvents = eventsQuery.isLoading;

  const loadEventsList = useCallback(async () => {
    setEventsError(null);
    await queryClient.invalidateQueries({ queryKey: qk.events.list(orgId) });
  }, [queryClient, orgId]);

  useEffect(() => {
    if (eventsQuery.error) {
      setEvents([]);
      setEventsError(handleApiError(eventsQuery.error, "Não foi possível carregar os eventos."));
      return;
    }
    const list = eventsQuery.data;
    if (!list) return;
    setEvents(list);
    setEventsError(null);
    if (list.length > 0) {
      setEventId((prev) => {
        if (prev && list.some((e) => e.id === prev)) return prev;
        const active = list.find(
          (e) => String(e.status ?? "").toUpperCase() === "ACTIVE",
        );
        return (active ?? list[0]).id;
      });
    } else {
      setEventId("");
    }
  }, [eventsQuery.data, eventsQuery.error]);

  // Load Mercado Pago settings via React Query
  const mpQuery = useQuery({
    queryKey: qk.settings.payment(orgId),
    queryFn: () => listPaymentProviderSettings(token!),
    enabled: !!token && !!orgId,
  });
  const mpLoading = mpQuery.isLoading;

  const loadMpSettings = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.settings.payment(orgId) });
  }, [queryClient, orgId]);

  useEffect(() => {
    if (mpQuery.error) {
      handleApiError(mpQuery.error, "Não foi possível carregar as configurações do Mercado Pago.", { silent: true });
      return;
    }
    const settings = mpQuery.data;
    if (!settings) return;
    const mp = settings.find((s) => s.provider === "MERCADO_PAGO");
    if (mp) {
      setMpForm({
        enabled: mp.enabled,
        pixEnabled: mp.pixEnabled,
        cardEnabled: mp.cardEnabled,
        terminalEnabled: mp.terminalEnabled,
        webhookUrl: mp.webhookUrl || "",
        accessToken: "",
        publicKey: "",
        webhookSecret: "",
        accessTokenConfigured: mp.accessTokenConfigured,
        publicKeyConfigured: mp.publicKeyConfigured,
        webhookSecretConfigured: mp.webhookSecretConfigured,
      });
      setMpDirty(false);
    }
  }, [mpQuery.data, mpQuery.error]);

  const handleMpSave = async () => {
    if (!token) return;
    setMpSaving(true);
    try {
      const payload: UpdatePaymentProviderInput = {
        enabled: mpForm.enabled,
        pixEnabled: mpForm.pixEnabled,
        cardEnabled: mpForm.cardEnabled,
        terminalEnabled: mpForm.terminalEnabled,
        webhookUrl: mpForm.webhookUrl,
      };

      if (mpForm.accessToken) payload.accessToken = mpForm.accessToken;
      if (mpForm.publicKey) payload.publicKey = mpForm.publicKey;
      if (mpForm.webhookSecret) payload.webhookSecret = mpForm.webhookSecret;

      await updatePaymentProviderSettings(token, "MERCADO_PAGO", payload);
      toast.success("Configurações do Mercado Pago salvas com sucesso!");
      await loadMpSettings();
    } catch (err) {
      handleApiError(err, "Falha ao salvar configurações do Mercado Pago.");
    } finally {
      setMpSaving(false);
    }
  };

  // Load selected event via React Query
  const eventDetailQuery = useQuery({
    queryKey: qk.events.detail(orgId, eventId),
    queryFn: () => getEvent(token!, eventId),
    enabled: !!token && !!orgId && !!eventId,
  });
  const loadingEvent = eventDetailQuery.isLoading;

  useEffect(() => {
    if (!token || !eventId) {
      setEventData(null);
      setForm(DEFAULT_FORM);
      return;
    }
    if (eventDetailQuery.error) {
      handleApiError(eventDetailQuery.error, "Não foi possível carregar o evento.");
      return;
    }
    const ev = eventDetailQuery.data;
    if (ev) {
      setEventData(ev);
      setForm(fromEvent(ev));
      setDirty(false);
    }
  }, [eventDetailQuery.data, eventDetailQuery.error, token, eventId]);


  const update = <K extends keyof TotemForm>(key: K, value: TotemForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!token || !eventId) return;
    setSaving(true);
    try {
      const originalLogo = (eventData?.logoUrl as string | undefined) ?? "";
      const originalBanner = (eventData?.bannerUrl as string | undefined) ?? "";

      const patch: Partial<EventItem> = {
        totemWelcomeMessage: form.welcomeMessage,
        totemBackgroundColor: form.backgroundColor,
        totemTextColor: form.textColor,
        totemShowPrices: form.showPrices,
        totemShowLowStock: form.showLowStock,
        totemRequireCustomerName: form.requireCustomerName,
        totemAutoResetSeconds: Math.max(10, Math.min(600, form.autoResetSeconds || 60)),
        totemShowLogo: form.showLogo,
        totemFullscreenRecommended: form.fullscreenRecommended,
        pixEnabled: form.pixEnabled,
        pixKey: form.pixKey || undefined,
        pixReceiverName: form.pixReceiverName || undefined,
        pixInstructions: form.pixInstructions || undefined,
        printingEnabled: form.printingEnabled,
        autoPrintEnabled: form.autoPrintEnabled,
        printMode: form.printMode,
        printerPaperSize: form.printerPaperSize,
      } as Partial<EventItem>;

      if (form.logoUrl !== originalLogo) {
        (patch as Record<string, unknown>).logoUrl = form.logoUrl || null;
      }
      if (form.bannerUrl !== originalBanner) {
        (patch as Record<string, unknown>).bannerUrl = form.bannerUrl || null;
      }


      const updated = await updateEvent(token, eventId, patch);
      // Re-fetch to guarantee persisted state from backend
      try {
        const fresh = await getEvent(token, eventId);
        setEventData(fresh);
        setForm(fromEvent(fresh));
      } catch {
        setEventData(updated);
        setForm(fromEvent(updated));
      }
      // Persist visual-only gradient locally
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          GRADIENT_KEY(eventId),
          JSON.stringify({ useGradient: form.useGradient, gradientColor: form.gradientColor }),
        );
      }
      setDirty(false);
      toast.success("Configurações do totem salvas");
    } catch (err) {
      handleApiError(err, "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...DEFAULT_FORM, logoUrl: form.logoUrl, bannerUrl: form.bannerUrl });
    setDirty(true);
    toast.message("Valores padrão restaurados (lembre de salvar)");
  };

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === eventId) ?? eventData,
    [events, eventId, eventData],
  );

  const previewBg = form.useGradient
    ? `linear-gradient(135deg, ${form.backgroundColor}, ${form.gradientColor})`
    : form.backgroundColor;

  const eventLogo = resolveAssetUrl(form.logoUrl);
  const eventBanner = resolveAssetUrl(form.bannerUrl);

  return (
    <AdminLayout
      title="Configurações"
      subtitle="Personalize o sistema e o comportamento do totem"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} disabled={saving || !eventId}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Padrões
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving || !eventId}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      }
    >
      <Tabs value={legacySearch.tab} onValueChange={(v) => legacyNavigate({ search: { tab: v }, replace: true })} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="totem">Totem</TabsTrigger>
          <TabsTrigger value="operacional">Operacional</TabsTrigger>
          <TabsTrigger value="impressao">Impressão</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <div className="grid gap-6">
            <PlaceholderCard
              icon={<SettingsIcon className="h-5 w-5 text-primary" />}
              title="Configurações gerais"
              description="Nome da empresa, fuso horário, idioma padrão e identidade visual."
            />
          </div>
        </TabsContent>

        <TabsContent value="totem">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-primary" />
                  Configurações do Totem
                </CardTitle>
                <CardDescription>
                  Defina identidade visual e comportamento do totem por evento.
                </CardDescription>
              </div>
              <Badge variant="secondary">Por evento</Badge>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Evento</Label>
                    {loadingEvents && (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Carregando...
                      </span>
                    )}
                  </div>
                  <Select
                    value={eventId || ""}
                    onValueChange={(v) => setEventId(v)}
                    disabled={loadingEvents || !!eventsError || events.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          loadingEvents
                            ? "Carregando eventos..."
                            : eventsError
                              ? "Erro ao carregar"
                              : events.length === 0
                                ? "Nenhum evento encontrado"
                                : "Selecione um evento"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.name}
                          {String(e.status ?? "").toUpperCase() === "ACTIVE" ? " · ativo" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {eventsError ? (
                    <div className="flex items-start justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                      <span className="inline-flex items-start gap-1.5">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {eventsError}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={() => void loadEventsList()}
                      >
                        <RefreshCw className="mr-1 h-3 w-3" />
                        Tentar novamente
                      </Button>
                    </div>
                  ) : (
                    selectedEvent?.slug && (
                      <p className="text-xs text-muted-foreground">
                        Slug público: <code>/e/{selectedEvent.slug}</code>
                      </p>
                    )
                  )}
                </div>
              </div>

              {!eventId ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Selecione um evento para configurar a identidade visual do totem.
                </div>
              ) : (
                <EventTotemSettings
                  eventId={eventId}
                  onSaveSuccess={() => {
                    // Re-fetch event data in the parent if needed, 
                    // though the component handles its own state
                  }}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="operacional">
          <OperationsCard eventId={eventId} disabled={!eventId || loadingEvent} />
        </TabsContent>

        <TabsContent value="impressao">
          <PrintingCard
            eventId={eventId}
            loading={loadingEvent}
            form={form}
            update={update}
            eventName={selectedEvent?.name ?? "Evento"}
          />
        </TabsContent>

        <TabsContent value="pagamentos">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <QrCode className="h-5 w-5 text-primary" />
                    PIX Manual do Evento
                  </CardTitle>
                  <CardDescription>
                    Configure pagamento via PIX manual para este evento.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Configuração por evento</Badge>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!dirty || saving || !eventId}
                  >
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar PIX Manual
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {!eventId ? (
                  <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                    Selecione um evento para configurar o PIX.
                  </div>
                ) : loadingEvent ? (
                  <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Carregando configurações...
                  </div>
                ) : (
                  <div className="grid gap-6">
                    <div className="space-y-4">
                      <ToggleRow
                        label="Habilitar PIX manual"
                        description="Exibe QR Code e instruções de pagamento no checkout."
                        checked={form.pixEnabled}
                        onChange={(v) => update("pixEnabled", v)}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="pix-key">Chave PIX</Label>
                          <Input
                            id="pix-key"
                            value={form.pixKey}
                            onChange={(e) => update("pixKey", e.target.value)}
                            placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                            disabled={!form.pixEnabled}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pix-name">Nome do recebedor</Label>
                          <Input
                            id="pix-name"
                            value={form.pixReceiverName}
                            onChange={(e) => update("pixReceiverName", e.target.value)}
                            placeholder="Nome que aparece no QR Code"
                            disabled={!form.pixEnabled}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pix-instructions">Instruções de pagamento</Label>
                        <Textarea
                          id="pix-instructions"
                          rows={2}
                          value={form.pixInstructions}
                          onChange={(e) => update("pixInstructions", e.target.value)}
                          placeholder="Ex.: Após pagar, mostre o comprovante no balcão."
                          disabled={!form.pixEnabled}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Pré-visualização PIX</Label>
                      <div className="rounded-xl border border-border bg-muted/30 p-4">
                        <div className="flex items-center gap-2 pb-3">
                          <Badge variant={form.pixEnabled ? "default" : "secondary"}>
                            {form.pixEnabled ? "PIX habilitado" : "PIX desabilitado"}
                          </Badge>
                        </div>
                        {form.pixEnabled ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Chave</span>
                              <span className="font-medium truncate max-w-[180px]">
                                {form.pixKey || "—"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Recebedor</span>
                              <span className="font-medium truncate max-w-[180px]">
                                {form.pixReceiverName || "—"}
                              </span>
                            </div>
                            {form.pixInstructions && (
                              <div className="mt-2 rounded-md bg-background/80 p-2 text-xs text-muted-foreground">
                                {form.pixInstructions}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            O pagamento via PIX não será exibido no checkout.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Integração Mercado Pago da Organização
                  </CardTitle>
                  <CardDescription>
                    Configure PIX automático, cartão e maquininha usando Mercado Pago. Vale para toda a organização.
                  </CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline">Configuração da organização</Badge>
                  <Button 
                    size="sm" 
                    onClick={handleMpSave} 
                    disabled={!mpDirty || mpSaving || mpLoading}
                  >
                    {mpSaving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar Mercado Pago
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {mpLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4">
                      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-4">
                        <ToggleRow
                          label="Ativar Mercado Pago"
                          checked={mpForm.enabled}
                          onChange={(v) => {
                            setMpForm(prev => ({ ...prev, enabled: v }));
                            setMpDirty(true);
                          }}
                        />
                        <Separator />
                        <ToggleRow
                          label="Ativar PIX automático"
                          description="Geração automática de QR Code no Totem."
                          checked={mpForm.pixEnabled}
                          onChange={(v) => {
                            setMpForm(prev => ({ ...prev, pixEnabled: v }));
                            setMpDirty(true);
                          }}
                        />
                        <ToggleRow
                          label="Ativar cartão via checkout online"
                          description="Habilita pagamentos via cartão (Checkout do Mercado Pago)."
                          checked={mpForm.cardEnabled}
                          onChange={(v) => {
                            setMpForm(prev => ({ ...prev, cardEnabled: v }));
                            setMpDirty(true);
                          }}
                        />
                        <ToggleRow
                          label="Ativar terminal Point / maquininha"
                          description="Integração com terminais Point do Mercado Pago."
                          checked={mpForm.terminalEnabled}
                          onChange={(v) => {
                            setMpForm(prev => ({ ...prev, terminalEnabled: v }));
                            setMpDirty(true);
                          }}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="mp-access-token">Access Token</Label>
                            {mpForm.accessTokenConfigured && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                                Configurado
                              </Badge>
                            )}
                          </div>
                          <Input
                            id="mp-access-token"
                            type="password"
                            placeholder="Digite o novo Access Token se quiser atualizar"
                            value={mpForm.accessToken}
                            onChange={(e) => {
                              setMpForm(prev => ({ ...prev, accessToken: e.target.value }));
                              setMpDirty(true);
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="mp-public-key">Public Key</Label>
                            {mpForm.publicKeyConfigured && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                                Configurada
                              </Badge>
                            )}
                          </div>
                          <Input
                            id="mp-public-key"
                            placeholder="Public Key do Mercado Pago"
                            value={mpForm.publicKey}
                            onChange={(e) => {
                              setMpForm(prev => ({ ...prev, publicKey: e.target.value }));
                              setMpDirty(true);
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="mp-webhook-secret">Webhook Secret</Label>
                            {mpForm.webhookSecretConfigured && (
                              <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                                Configurado
                              </Badge>
                            )}
                          </div>
                          <Input
                            id="mp-webhook-secret"
                            type="password"
                            placeholder="Secret para validação de webhooks"
                            value={mpForm.webhookSecret}
                            onChange={(e) => {
                              setMpForm(prev => ({ ...prev, webhookSecret: e.target.value }));
                              setMpDirty(true);
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="mp-webhook-url">Webhook URL</Label>
                          <div className="flex gap-2">
                            <Input
                              id="mp-webhook-url"
                              placeholder="https://seu-dominio.com/api/webhooks/mercadopago"
                              value={mpForm.webhookUrl}
                              onChange={(e) => {
                                setMpForm(prev => ({ ...prev, webhookUrl: e.target.value }));
                                setMpDirty(true);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(mpForm.webhookUrl || "");
                                toast.info("URL copiada!");
                              }}
                              disabled={!mpForm.webhookUrl}
                            >
                              <Globe className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Use esta URL no painel do Mercado Pago para configurar o webhook. Em produção, use um domínio fixo.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-md bg-blue-500/10 p-3 text-xs text-blue-700 flex gap-2 border border-blue-200">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p>
                          As credenciais sensíveis (Access Token e Webhook Secret) são salvas apenas no backend e não são exibidas novamente por segurança. 
                          Os campos ficam vazios para que você possa digitar um novo valor apenas se precisar atualizar.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

    </AdminLayout>
  );
}
