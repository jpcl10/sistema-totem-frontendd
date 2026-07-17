import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin-layout";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { StickySaveBar } from "@/components/admin/settings/StickySaveBar";
import { PageLoading } from "@/components/admin/page/PageLoading";
import { PageError } from "@/components/admin/page/PageError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useOrgId } from "@/hooks/use-org-id";
import { qk } from "@/lib/query-keys";
import {
  getSettings,
  updateGeneralSettings,
  type GeneralSettings,
} from "@/lib/settings-api";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { handleApiError } from "@/lib/api-error";

export const Route = createFileRoute("/admin/settings/organization")({
  component: OrganizationPage,
});

type FormShape = {
  legalName: string;
  document: string;
  contactEmail: string;
  contactPhone: string;
  whatsapp: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  timezone: string;
  locale: string;
  currency: string;
};

const EMPTY: FormShape = {
  legalName: "",
  document: "",
  contactEmail: "",
  contactPhone: "",
  whatsapp: "",
  address: "",
  city: "",
  state: "",
  postalCode: "",
  timezone: "America/Sao_Paulo",
  locale: "pt-BR",
  currency: "BRL",
};

function fromApi(g: GeneralSettings | undefined | null): FormShape {
  return {
    legalName: g?.legalName ?? "",
    document: g?.document ?? "",
    contactEmail: g?.contactEmail ?? "",
    contactPhone: g?.contactPhone ?? "",
    whatsapp: g?.whatsapp ?? "",
    address: g?.address ?? "",
    city: g?.city ?? "",
    state: g?.state ?? "",
    postalCode: g?.postalCode ?? "",
    timezone: g?.timezone ?? EMPTY.timezone,
    locale: g?.locale ?? EMPTY.locale,
    currency: g?.currency ?? EMPTY.currency,
  };
}

function toPayload(v: FormShape): Partial<GeneralSettings> {
  const trim = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    legalName: trim(v.legalName),
    document: trim(v.document),
    contactEmail: trim(v.contactEmail),
    contactPhone: trim(v.contactPhone),
    whatsapp: trim(v.whatsapp),
    address: trim(v.address),
    city: trim(v.city),
    state: trim(v.state),
    postalCode: trim(v.postalCode),
    timezone: trim(v.timezone) ?? undefined,
    locale: trim(v.locale) ?? undefined,
    currency: trim(v.currency) ?? undefined,
  };
}

function OrganizationPage() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.settings.root(orgId),
    queryFn: () => getSettings(token!),
    enabled: !!token && !!orgId,
  });

  const form = useDirtyForm<FormShape>(EMPTY);

  useEffect(() => {
    if (query.data) form.reset(fromApi(query.data.general));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: (payload: Partial<GeneralSettings>) => updateGeneralSettings(token!, payload),
    onSuccess: (result) => {
      toast.success("Configurações salvas");
      form.reset(fromApi(result));
      queryClient.invalidateQueries({ queryKey: qk.settings.all(orgId) });
    },
    onError: (err) => handleApiError(err, "Não foi possível salvar"),
  });

  const emailInvalid =
    !!form.values.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.values.contactEmail);

  return (
    <AdminLayout title="Configurações" subtitle="Centro de Configurações da organização">
      <SettingsLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Organização</h2>
            <p className="text-sm text-muted-foreground">
              Dados cadastrais e regionais da sua operação.
            </p>
          </div>

          {query.isLoading ? (
            <PageLoading />
          ) : query.isError ? (
            <PageError
              message="Não foi possível carregar as configurações."
              onRetry={() => query.refetch()}
            />
          ) : (
            <>
              <SettingsSection
                title="Identificação"
                description="Dados legais da organização usados em recibos e integrações."
              >
                <SettingsGroup columns={2}>
                  <Field label="Razão social">
                    <Input
                      value={form.values.legalName}
                      onChange={(e) => form.setValues({ legalName: e.target.value })}
                      placeholder="Ex.: Guello's Alimentos LTDA"
                    />
                  </Field>
                  <Field label="Documento (CNPJ/CPF)">
                    <Input
                      value={form.values.document}
                      onChange={(e) => form.setValues({ document: e.target.value })}
                      placeholder="00.000.000/0000-00"
                    />
                  </Field>
                </SettingsGroup>
              </SettingsSection>

              <SettingsSection title="Contato" description="Como seus clientes falam com você.">
                <SettingsGroup columns={3}>
                  <Field
                    label="E-mail de contato"
                    error={emailInvalid ? "E-mail inválido" : undefined}
                  >
                    <Input
                      type="email"
                      value={form.values.contactEmail}
                      onChange={(e) => form.setValues({ contactEmail: e.target.value })}
                      placeholder="contato@empresa.com"
                    />
                  </Field>
                  <Field label="Telefone">
                    <Input
                      value={form.values.contactPhone}
                      onChange={(e) => form.setValues({ contactPhone: e.target.value })}
                      placeholder="(11) 99999-0000"
                    />
                  </Field>
                  <Field label="WhatsApp">
                    <Input
                      value={form.values.whatsapp}
                      onChange={(e) => form.setValues({ whatsapp: e.target.value })}
                      placeholder="(11) 99999-0000"
                    />
                  </Field>
                </SettingsGroup>
              </SettingsSection>

              <SettingsSection title="Endereço" description="Endereço da sede ou principal ponto.">
                <SettingsGroup columns={2}>
                  <Field label="Endereço" className="md:col-span-2">
                    <Input
                      value={form.values.address}
                      onChange={(e) => form.setValues({ address: e.target.value })}
                      placeholder="Rua, número, complemento"
                    />
                  </Field>
                  <Field label="Cidade">
                    <Input
                      value={form.values.city}
                      onChange={(e) => form.setValues({ city: e.target.value })}
                    />
                  </Field>
                  <Field label="Estado">
                    <Input
                      value={form.values.state}
                      onChange={(e) => form.setValues({ state: e.target.value })}
                      maxLength={2}
                      placeholder="SP"
                    />
                  </Field>
                  <Field label="CEP">
                    <Input
                      value={form.values.postalCode}
                      onChange={(e) => form.setValues({ postalCode: e.target.value })}
                      placeholder="00000-000"
                    />
                  </Field>
                </SettingsGroup>
              </SettingsSection>

              <SettingsSection
                title="Regionalização"
                description="Fuso, idioma e moeda usados em toda a plataforma."
              >
                <SettingsGroup columns={3}>
                  <Field label="Fuso horário">
                    <Select
                      value={form.values.timezone}
                      onValueChange={(v) => form.setValues({ timezone: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Sao_Paulo">America/Sao_Paulo</SelectItem>
                        <SelectItem value="America/Fortaleza">America/Fortaleza</SelectItem>
                        <SelectItem value="America/Manaus">America/Manaus</SelectItem>
                        <SelectItem value="America/Belem">America/Belem</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Idioma">
                    <Select
                      value={form.values.locale}
                      onValueChange={(v) => form.setValues({ locale: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                        <SelectItem value="en-US">English (US)</SelectItem>
                        <SelectItem value="es-ES">Español</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Moeda">
                    <Select
                      value={form.values.currency}
                      onValueChange={(v) => form.setValues({ currency: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">Real (BRL)</SelectItem>
                        <SelectItem value="USD">Dólar (USD)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </SettingsGroup>
              </SettingsSection>

              <StickySaveBar
                visible={form.isDirty}
                saving={mutation.isPending}
                disabled={emailInvalid}
                onCancel={form.revert}
                onSave={() => mutation.mutate(toPayload(form.values))}
              />
            </>
          )}
        </div>
      </SettingsLayout>
    </AdminLayout>
  );
}

function Field({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <div className={"space-y-1.5 " + (className ?? "")}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
