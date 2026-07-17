import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { PageError } from "@/components/admin/page/PageError";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { StickySaveBar } from "@/components/admin/settings/StickySaveBar";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { listEvents, type EventItem } from "@/lib/events-api";
import { listOnlineStores, type OnlineStore } from "@/lib/online-store-api";
import { listDevices, type Device } from "@/lib/devices-api";
import {
  useCreatePaymentTerminal,
  useEffectivePaymentSettings,
  useOrganizationPaymentSettings,
  usePaymentTerminals,
  useUpdateEventPaymentSettings,
  useUpdateOnlineStorePaymentSettings,
  useUpdateOrganizationPaymentSettings,
  useUpdatePaymentProviderCredentials,
} from "@/hooks/use-payment-settings";
import type {
  ContextPaymentSettingsInput,
  EffectivePaymentSettings,
  PaymentContextType,
  PaymentEnvironment,
  PaymentProvider,
  PaymentTerminal,
} from "@/lib/payment-settings-api";

export const Route = createFileRoute("/admin/settings/payments")({
  component: PaymentSettingsPage,
});

const PROVIDERS: PaymentProvider[] = [
  "MANUAL",
  "MERCADO_PAGO",
  "STONE",
  "PAGSEGURO",
  "CIELO",
  "GETNET",
  "OTHER",
];

const CARD_PROVIDERS: PaymentProvider[] = ["STONE", "MERCADO_PAGO", "CIELO", "GETNET", "OTHER"];
const ENVIRONMENTS: PaymentEnvironment[] = ["SANDBOX", "PRODUCTION"];

const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  MANUAL: "Manual",
  MERCADO_PAGO: "Mercado Pago",
  STONE: "Stone",
  PAGSEGURO: "PagSeguro",
  CIELO: "Cielo",
  GETNET: "Getnet",
  OTHER: "Outro",
};

const ENVIRONMENT_LABEL: Record<PaymentEnvironment, string> = {
  SANDBOX: "Sandbox",
  PRODUCTION: "Produção",
};

const METHOD_LABEL = {
  pix: "PIX",
  credit: "Cartão de crédito",
  debit: "Cartão de débito",
  cash: "Dinheiro",
  nfcBalance: "Saldo NFC",
} as const;

type MethodKey = keyof EffectivePaymentSettings["methods"];

type OrganizationForm = {
  pixEnabled: boolean;
  creditEnabled: boolean;
  debitEnabled: boolean;
  cashEnabled: boolean;
  nfcBalanceEnabled: boolean;
  defaultProvider: PaymentProvider;
  pixExpirationMinutes: number;
  maxInstallments: number;
  environment: PaymentEnvironment;
};

const EMPTY_ORG_FORM: OrganizationForm = {
  pixEnabled: false,
  creditEnabled: false,
  debitEnabled: false,
  cashEnabled: true,
  nfcBalanceEnabled: false,
  defaultProvider: "MANUAL",
  pixExpirationMinutes: 5,
  maxInstallments: 1,
  environment: "PRODUCTION",
};

function fromEffective(settings?: EffectivePaymentSettings | null): OrganizationForm {
  if (!settings) return EMPTY_ORG_FORM;
  return {
    pixEnabled: settings.methods.pix,
    creditEnabled: settings.methods.credit,
    debitEnabled: settings.methods.debit,
    cashEnabled: settings.methods.cash,
    nfcBalanceEnabled: settings.methods.nfcBalance,
    defaultProvider: settings.defaultProvider,
    pixExpirationMinutes: settings.pixExpirationMinutes,
    maxInstallments: settings.maxInstallments,
    environment: settings.environment,
  };
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.round(value), min), max);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Nunca conectado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Nunca conectado";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isRecent(value?: string | null) {
  if (!value) return false;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts <= 5 * 60 * 1000;
}

function getProviderStatus(settings: EffectivePaymentSettings | undefined, provider: PaymentProvider) {
  return settings?.providers.find((item) => item.provider === provider) ?? null;
}

function PaymentSettingsPage() {
  const { user } = useAuth();
  const role = user?.role?.toUpperCase();

  if (role === "OPERATOR") {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <AdminLayout
      title="Configurações de Pagamento"
      subtitle="Centralize os métodos de pagamento e as credenciais financeiras da organização."
    >
      <SettingsLayout>
        <PaymentSettingsContent />
      </SettingsLayout>
    </AdminLayout>
  );
}

function PaymentSettingsContent() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const organizationQuery = useOrganizationPaymentSettings();
  const terminalsQuery = usePaymentTerminals();

  const referencesQuery = useQuery({
    queryKey: qk.settings.paymentReferences(orgId),
    enabled: !!token && !!orgId,
    queryFn: async () => {
      const [events, stores, devices] = await Promise.all([
        listEvents(token!).catch(() => [] as EventItem[]),
        listOnlineStores(token!).catch(() => [] as OnlineStore[]),
        listDevices(token!).catch(() => [] as Device[]),
      ]);
      return { events, stores, devices };
    },
  });

  if (organizationQuery.isLoading) {
    return <PaymentSettingsSkeleton />;
  }

  if (organizationQuery.isError || !organizationQuery.data) {
    return (
      <PageError
        message="Não foi possível carregar as configurações de pagamento."
        onRetry={() => organizationQuery.refetch()}
      />
    );
  }

  const settings = organizationQuery.data;
  const references = referencesQuery.data ?? { events: [], stores: [], devices: [] };

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">
              {ENVIRONMENT_LABEL[settings.environment]}
            </Badge>
            <ProviderConfiguredBadge status={getProviderStatus(settings, settings.defaultProvider)} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A organização define o teto de métodos e credenciais. Eventos, lojas e POS só podem
            restringir o que já está habilitado aqui.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => organizationQuery.refetch()}>
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {settings.environment === "PRODUCTION" && (
        <Alert className="border-amber-500/40 bg-amber-500/10">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle>Ambiente de produção</AlertTitle>
          <AlertDescription>
            Transações reais poderão ser processadas neste ambiente.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="methods" className="space-y-5">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="methods">Métodos</TabsTrigger>
          <TabsTrigger value="providers">PIX e provedores</TabsTrigger>
          <TabsTrigger value="cards">Cartões</TabsTrigger>
          <TabsTrigger value="terminals">Terminais</TabsTrigger>
          <TabsTrigger value="contexts">Contextos</TabsTrigger>
          <TabsTrigger value="security">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="methods">
          <OrganizationMethodsTab settings={settings} />
        </TabsContent>
        <TabsContent value="providers">
          <ProviderCredentialsTab settings={settings} />
        </TabsContent>
        <TabsContent value="cards">
          <CardsTab settings={settings} />
        </TabsContent>
        <TabsContent value="terminals">
          <TerminalsTab
            terminals={terminalsQuery.data ?? []}
            loading={terminalsQuery.isLoading}
            error={terminalsQuery.isError}
            onRetry={() => terminalsQuery.refetch()}
            events={references.events}
            stores={references.stores}
            devices={references.devices}
          />
        </TabsContent>
        <TabsContent value="contexts">
          <ContextsTab
            organizationSettings={settings}
            events={references.events}
            stores={references.stores}
          />
        </TabsContent>
        <TabsContent value="security">
          <SecurityTab settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OrganizationMethodsTab({ settings }: { settings: EffectivePaymentSettings }) {
  const form = useDirtyForm<OrganizationForm>(fromEffective(settings));
  const updateMutation = useUpdateOrganizationPaymentSettings();

  useEffect(() => {
    form.reset(fromEffective(settings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  const save = async () => {
    const payload = {
      pixEnabled: form.values.pixEnabled,
      creditEnabled: form.values.creditEnabled,
      debitEnabled: form.values.debitEnabled,
      cashEnabled: form.values.cashEnabled,
      nfcBalanceEnabled: form.values.nfcBalanceEnabled,
      defaultProvider: form.values.defaultProvider,
      pixExpirationMinutes: clampNumber(form.values.pixExpirationMinutes, 2, 60),
      maxInstallments: clampNumber(form.values.maxInstallments, 1, 24),
      environment: form.values.environment,
    };

    try {
      const updated = await updateMutation.mutateAsync(payload);
      form.reset(fromEffective(updated));
      toast.success("Configurações de pagamento salvas.");
    } catch (error) {
      handleApiError(error, "Não foi possível salvar as configurações.");
    }
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <SettingsSection
            title="Métodos de pagamento"
            description="Defina quais métodos a organização pode usar em eventos, lojas, PDV e totens."
          >
            <SettingsGroup columns={1}>
              <PaymentSwitch
                label="PIX"
                description="Permite pagamentos por PIX automático quando o provedor estiver configurado."
                checked={form.values.pixEnabled}
                onChange={(pixEnabled) => form.setValues({ pixEnabled })}
              />
              <PaymentSwitch
                label="Cartão de crédito"
                description="Disponibiliza crédito nos contextos autorizados e em terminais compatíveis."
                checked={form.values.creditEnabled}
                onChange={(creditEnabled) => form.setValues({ creditEnabled })}
              />
              <PaymentSwitch
                label="Cartão de débito"
                description="Disponibiliza débito nos contextos autorizados e em terminais compatíveis."
                checked={form.values.debitEnabled}
                onChange={(debitEnabled) => form.setValues({ debitEnabled })}
              />
              <PaymentSwitch
                label="Dinheiro"
                description="Permite baixa manual em dinheiro pela operação."
                checked={form.values.cashEnabled}
                onChange={(cashEnabled) => form.setValues({ cashEnabled })}
              />
              <PaymentSwitch
                label="Saldo NFC"
                description="Mantém a integração de saldo NFC/cashless existente."
                checked={form.values.nfcBalanceEnabled}
                onChange={(nfcBalanceEnabled) => form.setValues({ nfcBalanceEnabled })}
              />
            </SettingsGroup>
          </SettingsSection>

          <SettingsSection
            title="Provider e limites"
            description="Configuração padrão usada quando o contexto não define uma restrição própria."
          >
            <SettingsGroup columns={2}>
              <Field label="Provedor padrão">
                <select
                  value={form.values.defaultProvider}
                  onChange={(event) =>
                    form.setValues({ defaultProvider: event.target.value as PaymentProvider })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_LABEL[provider]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ambiente">
                <select
                  value={form.values.environment}
                  onChange={(event) =>
                    form.setValues({ environment: event.target.value as PaymentEnvironment })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {ENVIRONMENTS.map((environment) => (
                    <option key={environment} value={environment}>
                      {ENVIRONMENT_LABEL[environment]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Expiração do PIX (minutos)">
                <Input
                  type="number"
                  min={2}
                  max={60}
                  value={form.values.pixExpirationMinutes}
                  onChange={(event) =>
                    form.setValues({ pixExpirationMinutes: Number(event.target.value) })
                  }
                />
              </Field>
              <Field label="Máximo de parcelas">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={form.values.maxInstallments}
                  onChange={(event) =>
                    form.setValues({ maxInstallments: Number(event.target.value) })
                  }
                />
              </Field>
            </SettingsGroup>
          </SettingsSection>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-primary" />
                Resumo efetivo
              </CardTitle>
              <CardDescription>Configuração base da organização.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {Object.entries(settings.methods).map(([key, enabled]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {METHOD_LABEL[key as MethodKey]}
                  </span>
                  <StatusBadge enabled={enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      <StickySaveBar
        visible={form.isDirty}
        saving={updateMutation.isPending}
        onCancel={form.revert}
        onSave={save}
      />
    </>
  );
}

function ProviderCredentialsTab({ settings }: { settings: EffectivePaymentSettings }) {
  const [accessToken, setAccessToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [environment, setEnvironment] = useState<PaymentEnvironment>(settings.environment);
  const [active, setActive] = useState(true);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const credentialsMutation = useUpdatePaymentProviderCredentials();
  const mercadoPago = getProviderStatus(settings, "MERCADO_PAGO");
  const hasCredentialInput = Boolean(accessToken.trim() || webhookSecret.trim());

  const submitCredentials = async () => {
    const credentials: Record<string, string> = {};
    if (accessToken.trim()) credentials.accessToken = accessToken.trim();
    if (webhookSecret.trim()) credentials.webhookSecret = webhookSecret.trim();

    try {
      await credentialsMutation.mutateAsync({
        provider: "MERCADO_PAGO",
        input: {
          environment,
          active,
          ...(Object.keys(credentials).length > 0 ? { credentials } : {}),
        },
      });
      setAccessToken("");
      setWebhookSecret("");
      setShowAccessToken(false);
      setShowWebhookSecret(false);
      setConfirmOpen(false);
      toast.success("Credenciais do Mercado Pago salvas.");
    } catch (error) {
      handleApiError(error, "Não foi possível salvar as credenciais.");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <SettingsSection
        title="Mercado Pago"
        description="Configure as credenciais usadas para PIX automático. Os campos secretos não são exibidos novamente."
      >
        <div className="space-y-5">
          <Alert>
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>Credenciais protegidas</AlertTitle>
            <AlertDescription>
              As credenciais são criptografadas no servidor e não poderão ser visualizadas novamente.
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <SecretField
              label="Access Token"
              value={accessToken}
              onChange={setAccessToken}
              visible={showAccessToken}
              onVisibleChange={setShowAccessToken}
              placeholder="Cole o access token"
            />
            <SecretField
              label="Webhook Secret"
              value={webhookSecret}
              onChange={setWebhookSecret}
              visible={showWebhookSecret}
              onVisibleChange={setShowWebhookSecret}
              placeholder="Cole o segredo do webhook"
            />
            <Field label="Ambiente">
              <select
                value={environment}
                onChange={(event) => setEnvironment(event.target.value as PaymentEnvironment)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {ENVIRONMENTS.map((item) => (
                  <option key={item} value={item}>
                    {ENVIRONMENT_LABEL[item]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Permite usar esta credencial.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <Button
            disabled={credentialsMutation.isPending || (!hasCredentialInput && active === mercadoPago?.active)}
            onClick={() => setConfirmOpen(true)}
          >
            {credentialsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar credenciais
          </Button>
        </div>
      </SettingsSection>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4 text-primary" />
            Status do provedor
          </CardTitle>
          <CardDescription>Nenhum segredo é retornado pela API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <StatusLine label="Configuração" value={mercadoPago?.configured ? "Configurado" : "Não configurado"} ok={Boolean(mercadoPago?.configured)} />
          <StatusLine label="Status" value={mercadoPago?.active ? "Ativo" : "Inativo"} ok={Boolean(mercadoPago?.active)} />
          <StatusLine label="Ambiente" value={ENVIRONMENT_LABEL[mercadoPago?.environment ?? settings.environment]} ok />
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir credenciais?</AlertDialogTitle>
            <AlertDialogDescription>
              Você está substituindo as credenciais atuais deste provedor. Os valores anteriores
              não poderão ser visualizados depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={submitCredentials}>
              Confirmar substituição
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CardsTab({ settings }: { settings: EffectivePaymentSettings }) {
  const cardProvider =
    CARD_PROVIDERS.includes(settings.defaultProvider) ? settings.defaultProvider : "STONE";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Cartões e parcelamento
          </CardTitle>
          <CardDescription>
            Cartões são processados por terminal/PinPad. Esta tela prepara a configuração
            organizacional; a integração física depende do totem.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <InfoTile label="Crédito" value={settings.methods.credit ? "Habilitado" : "Desabilitado"} />
          <InfoTile label="Débito" value={settings.methods.debit ? "Habilitado" : "Desabilitado"} />
          <InfoTile label="Máximo de parcelas" value={`${settings.maxInstallments}x`} />
          <InfoTile label="Provedor padrão de cartão" value={PROVIDER_LABEL[cardProvider]} />
        </CardContent>
      </Card>

      <Alert className="h-fit border-primary/20 bg-primary/5">
        <Terminal className="h-4 w-4" />
        <AlertTitle>PinPad externo</AlertTitle>
        <AlertDescription>
          A integração física do PinPad depende da configuração do terminal e do aplicativo do
          totem. Nenhum SDK de PinPad foi integrado nesta tela.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function TerminalsTab({
  terminals,
  loading,
  error,
  onRetry,
  events,
  stores,
  devices,
}: {
  terminals: PaymentTerminal[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  events: EventItem[];
  stores: OnlineStore[];
  devices: Device[];
}) {
  const [open, setOpen] = useState(false);

  if (loading) return <PaymentSettingsSkeleton compact />;
  if (error) {
    return (
      <PageError
        message="Não foi possível carregar os terminais de pagamento."
        onRetry={onRetry}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Terminais</h2>
          <p className="text-sm text-muted-foreground">
            Vincule PinPads e terminais externos a dispositivos, eventos ou lojas.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Adicionar terminal
        </Button>
      </div>

      {terminals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 p-10 text-center">
            <Terminal className="h-10 w-10 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Nenhum terminal cadastrado</h3>
              <p className="text-sm text-muted-foreground">
                Cadastre o identificador externo fornecido pelo provedor.
              </p>
            </div>
            <Button variant="outline" onClick={() => setOpen(true)}>
              Adicionar terminal
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {terminals.map((terminal) => (
            <TerminalCard
              key={terminal.id}
              terminal={terminal}
              event={events.find((item) => item.id === terminal.eventId)}
              store={stores.find((item) => item.id === terminal.onlineStoreId)}
              device={devices.find((item) => item.id === terminal.deviceId)}
            />
          ))}
        </div>
      )}

      <TerminalDialog
        open={open}
        onOpenChange={setOpen}
        events={events}
        stores={stores}
        devices={devices}
      />
    </div>
  );
}

function ContextsTab({
  organizationSettings,
  events,
  stores,
}: {
  organizationSettings: EffectivePaymentSettings;
  events: EventItem[];
  stores: OnlineStore[];
}) {
  const [contextType, setContextType] = useState<PaymentContextType>("EVENT");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const targetEventId = contextType === "EVENT" ? eventId : null;
  const targetStoreId = contextType === "ONLINE_STORE" ? storeId : null;

  useEffect(() => {
    if (!eventId && events[0]?.id) setEventId(events[0].id);
  }, [eventId, events]);

  useEffect(() => {
    if (!storeId && stores[0]?.id) setStoreId(stores[0].id);
  }, [storeId, stores]);

  const effectiveQuery = useEffectivePaymentSettings({
    contextType,
    eventId: targetEventId,
    onlineStoreId: targetStoreId,
  });

  const eventMutation = useUpdateEventPaymentSettings(targetEventId);
  const storeMutation = useUpdateOnlineStorePaymentSettings(targetStoreId);
  const canEdit =
    contextType === "POS" ||
    (contextType === "EVENT" && Boolean(targetEventId)) ||
    (contextType === "ONLINE_STORE" && Boolean(targetStoreId));

  const saveOverride = async (input: ContextPaymentSettingsInput) => {
    if (contextType === "POS") {
      toast.info("POS usa a configuração efetiva da organização nesta versão.");
      return;
    }

    try {
      if (contextType === "EVENT") {
        await eventMutation.mutateAsync(input);
      } else {
        await storeMutation.mutateAsync(input);
      }
      toast.success("Overrides do contexto salvos.");
      effectiveQuery.refetch();
    } catch (error) {
      handleApiError(error, "Não foi possível salvar os overrides.");
    }
  };

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Configuração efetiva por contexto"
        description="Veja como eventos, lojas e POS herdam a configuração financeira da organização."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Contexto">
            <select
              value={contextType}
              onChange={(event) => setContextType(event.target.value as PaymentContextType)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="EVENT">Evento</option>
              <option value="ONLINE_STORE">Loja online</option>
              <option value="POS">PDV</option>
            </select>
          </Field>
          {contextType === "EVENT" && (
            <Field label="Evento">
              <select
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {contextType === "ONLINE_STORE" && (
            <Field label="Loja online">
              <select
                value={storeId}
                onChange={(event) => setStoreId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
      </SettingsSection>

      {effectiveQuery.isLoading ? (
        <PaymentSettingsSkeleton compact />
      ) : effectiveQuery.isError ? (
        <PageError
          message="Não foi possível carregar a configuração efetiva."
          onRetry={() => effectiveQuery.refetch()}
        />
      ) : effectiveQuery.data ? (
        <ContextOverrideEditor
          organizationSettings={organizationSettings}
          effectiveSettings={effectiveQuery.data}
          canEdit={canEdit && contextType !== "POS"}
          saving={eventMutation.isPending || storeMutation.isPending}
          onSave={saveOverride}
        />
      ) : null}
    </div>
  );
}

function ContextOverrideEditor({
  organizationSettings,
  effectiveSettings,
  canEdit,
  saving,
  onSave,
}: {
  organizationSettings: EffectivePaymentSettings;
  effectiveSettings: EffectivePaymentSettings;
  canEdit: boolean;
  saving: boolean;
  onSave: (input: ContextPaymentSettingsInput) => Promise<void>;
}) {
  const initial = useMemo(
    () => ({
      pixEnabledOverride: effectiveSettings.methods.pix,
      creditEnabledOverride: effectiveSettings.methods.credit,
      debitEnabledOverride: effectiveSettings.methods.debit,
      cashEnabledOverride: effectiveSettings.methods.cash,
      nfcBalanceEnabledOverride: effectiveSettings.methods.nfcBalance,
      maxInstallmentsOverride: effectiveSettings.maxInstallments,
    }),
    [effectiveSettings],
  );
  const form = useDirtyForm(initial);

  useEffect(() => {
    form.reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const save = async () => {
    await onSave({
      inheritOrganizationSettings: true,
      pixEnabledOverride: form.values.pixEnabledOverride,
      creditEnabledOverride: form.values.creditEnabledOverride,
      debitEnabledOverride: form.values.debitEnabledOverride,
      cashEnabledOverride: form.values.cashEnabledOverride,
      nfcBalanceEnabledOverride: form.values.nfcBalanceEnabledOverride,
      maxInstallmentsOverride: clampNumber(form.values.maxInstallmentsOverride, 1, 24),
    });
    form.reset(form.values);
  };

  return (
    <>
      <SettingsSection
        title="Overrides do contexto"
        description="Desabilite métodos herdados sem duplicar credenciais."
      >
        <div className="space-y-4">
          <ContextMethodSwitch
            method="pix"
            orgEnabled={organizationSettings.methods.pix}
            checked={form.values.pixEnabledOverride}
            onChange={(pixEnabledOverride) => form.setValues({ pixEnabledOverride })}
            disabled={!canEdit}
          />
          <ContextMethodSwitch
            method="credit"
            orgEnabled={organizationSettings.methods.credit}
            checked={form.values.creditEnabledOverride}
            onChange={(creditEnabledOverride) => form.setValues({ creditEnabledOverride })}
            disabled={!canEdit}
          />
          <ContextMethodSwitch
            method="debit"
            orgEnabled={organizationSettings.methods.debit}
            checked={form.values.debitEnabledOverride}
            onChange={(debitEnabledOverride) => form.setValues({ debitEnabledOverride })}
            disabled={!canEdit}
          />
          <ContextMethodSwitch
            method="cash"
            orgEnabled={organizationSettings.methods.cash}
            checked={form.values.cashEnabledOverride}
            onChange={(cashEnabledOverride) => form.setValues({ cashEnabledOverride })}
            disabled={!canEdit}
          />
          <ContextMethodSwitch
            method="nfcBalance"
            orgEnabled={organizationSettings.methods.nfcBalance}
            checked={form.values.nfcBalanceEnabledOverride}
            onChange={(nfcBalanceEnabledOverride) =>
              form.setValues({ nfcBalanceEnabledOverride })
            }
            disabled={!canEdit}
          />
          <Field label="Máximo de parcelas do contexto">
            <Input
              type="number"
              min={1}
              max={24}
              disabled={!canEdit}
              value={form.values.maxInstallmentsOverride}
              onChange={(event) =>
                form.setValues({ maxInstallmentsOverride: Number(event.target.value) })
              }
            />
          </Field>
        </div>
      </SettingsSection>

      <StickySaveBar
        visible={form.isDirty}
        saving={saving}
        disabled={!canEdit}
        onCancel={form.revert}
        onSave={save}
      />
    </>
  );
}

function SecurityTab({ settings }: { settings: EffectivePaymentSettings }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Segredos financeiros
          </CardTitle>
          <CardDescription>Comportamento seguro aplicado nesta tela.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Nenhuma credencial é buscada, exibida, gravada em storage ou enviada em URL.</p>
          <p>Campos secretos começam vazios e são limpos após salvar.</p>
          <p>Somente ADMIN e SUPER_ADMIN podem acessar e editar estas configurações.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Providers configurados
          </CardTitle>
          <CardDescription>Status seguro retornado pelo backend.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum provider retornado. Salve as configurações para criar o novo modelo.
            </p>
          ) : (
            settings.providers.map((provider) => (
              <div
                key={`${provider.provider}-${provider.environment}`}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{PROVIDER_LABEL[provider.provider]}</p>
                  <p className="text-xs text-muted-foreground">
                    {ENVIRONMENT_LABEL[provider.environment]}
                  </p>
                </div>
                <ProviderConfiguredBadge status={provider} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TerminalDialog({
  open,
  onOpenChange,
  events,
  stores,
  devices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  events: EventItem[];
  stores: OnlineStore[];
  devices: Device[];
}) {
  const createMutation = useCreatePaymentTerminal();
  const [provider, setProvider] = useState<PaymentProvider>("STONE");
  const [externalTerminalId, setExternalTerminalId] = useState("");
  const [active, setActive] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [contextType, setContextType] = useState<"NONE" | "EVENT" | "ONLINE_STORE">("NONE");
  const [eventId, setEventId] = useState("");
  const [onlineStoreId, setOnlineStoreId] = useState("");

  const reset = () => {
    setProvider("STONE");
    setExternalTerminalId("");
    setActive(true);
    setDeviceId("");
    setContextType("NONE");
    setEventId("");
    setOnlineStoreId("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!externalTerminalId.trim()) {
      toast.error("Informe o External Terminal ID.");
      return;
    }

    try {
      await createMutation.mutateAsync({
        provider,
        externalTerminalId: externalTerminalId.trim(),
        active,
        deviceId: deviceId || null,
        eventId: contextType === "EVENT" ? eventId || null : null,
        onlineStoreId: contextType === "ONLINE_STORE" ? onlineStoreId || null : null,
      });
      toast.success("Terminal salvo.");
      reset();
      onOpenChange(false);
    } catch (error) {
      handleApiError(error, "Não foi possível salvar o terminal.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar terminal</DialogTitle>
          <DialogDescription>
            Use o identificador externo fornecido pelo provedor do PinPad.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Provedor">
              <select
                value={provider}
                onChange={(event) => setProvider(event.target.value as PaymentProvider)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PROVIDERS.filter((item) => item !== "MANUAL").map((item) => (
                  <option key={item} value={item}>
                    {PROVIDER_LABEL[item]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="External Terminal ID">
              <Input
                value={externalTerminalId}
                onChange={(event) => setExternalTerminalId(event.target.value)}
                placeholder="terminal externo"
              />
            </Field>
            <Field label="Dispositivo vinculado">
              <select
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem dispositivo</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-3">
              <div>
                <p className="text-sm font-medium">Ativo</p>
                <p className="text-xs text-muted-foreground">Disponível para uso.</p>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border p-3">
            <Field label="Contexto opcional">
              <select
                value={contextType}
                onChange={(event) => {
                  const next = event.target.value as "NONE" | "EVENT" | "ONLINE_STORE";
                  setContextType(next);
                  if (next !== "EVENT") setEventId("");
                  if (next !== "ONLINE_STORE") setOnlineStoreId("");
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="NONE">Sem vínculo</option>
                <option value="EVENT">Evento</option>
                <option value="ONLINE_STORE">Loja online</option>
              </select>
            </Field>
            {contextType === "EVENT" && (
              <Field label="Evento">
                <select
                  value={eventId}
                  onChange={(event) => setEventId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione</option>
                  {events.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {contextType === "ONLINE_STORE" && (
              <Field label="Loja online">
                <select
                  value={onlineStoreId}
                  onChange={(event) => setOnlineStoreId(event.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione</option>
                  {stores.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar terminal
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TerminalCard({
  terminal,
  event,
  store,
  device,
}: {
  terminal: PaymentTerminal;
  event?: EventItem;
  store?: OnlineStore;
  device?: Device;
}) {
  const recent = isRecent(terminal.lastSeenAt);
  return (
    <Card>
      <CardContent className="grid gap-4 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
        <div className="min-w-0">
          <p className="truncate font-medium">{terminal.externalTerminalId}</p>
          <p className="text-sm text-muted-foreground">{PROVIDER_LABEL[terminal.provider]}</p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">Dispositivo</p>
          <p className="truncate">{device?.name ?? terminal.deviceId ?? "Sem vínculo"}</p>
        </div>
        <div className="text-sm">
          <p className="text-muted-foreground">Contexto</p>
          <p className="truncate">{event?.name ?? store?.name ?? "Organização"}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <Badge variant={terminal.active ? "default" : "secondary"}>
            {terminal.active ? "Ativo" : "Inativo"}
          </Badge>
          <Badge variant="outline">{recent ? "Online recentemente" : formatDateTime(terminal.lastSeenAt)}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function ContextMethodSwitch({
  method,
  orgEnabled,
  checked,
  onChange,
  disabled,
}: {
  method: MethodKey;
  orgEnabled: boolean;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const blocked = !orgEnabled;
  const control = (
    <Switch
      checked={orgEnabled && checked}
      disabled={disabled || blocked}
      onCheckedChange={onChange}
    />
  );

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{METHOD_LABEL[method]}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Badge variant={orgEnabled ? "outline" : "secondary"}>
            {orgEnabled ? "Habilitado pela organização" : "Desabilitado pela organização"}
          </Badge>
          {orgEnabled && !checked && <Badge variant="secondary">Desabilitado neste contexto</Badge>}
          {orgEnabled && checked && <Badge variant="outline">Herdado</Badge>}
        </div>
      </div>
      {blocked ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{control}</span>
            </TooltipTrigger>
            <TooltipContent>
              Este método está bloqueado na organização.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        control
      )}
    </div>
  );
}

function PaymentSwitch({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SecretField({
  label,
  value,
  onChange,
  visible,
  onVisibleChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  placeholder?: string;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <Input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onVisibleChange(!visible)}
          aria-label={visible ? "Ocultar segredo" : "Mostrar segredo"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </Field>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatusBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className="border-none bg-emerald-500/10 text-emerald-600">Habilitado</Badge>
  ) : (
    <Badge variant="secondary">Desabilitado</Badge>
  );
}

function ProviderConfiguredBadge({ status }: { status: { configured: boolean; active: boolean } | null }) {
  if (!status?.configured) {
    return <Badge variant="secondary">Não configurado</Badge>;
  }
  return status.active ? (
    <Badge className="border-none bg-emerald-500/10 text-emerald-600">Configurado</Badge>
  ) : (
    <Badge className="border-none bg-amber-500/10 text-amber-700">Configurado inativo</Badge>
  );
}

function StatusLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="inline-flex items-center gap-1 font-medium">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        ) : (
          <XCircle className="h-4 w-4 text-muted-foreground" />
        )}
        {value}
      </span>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function PaymentSettingsSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full" />
        ))}
      </div>
    </div>
  );
}
