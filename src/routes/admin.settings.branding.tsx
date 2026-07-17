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
import { ColorField } from "@/components/admin/settings/shared-ui";
import { AssetUploader } from "@/components/admin/asset-uploader";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  getBrandingSettings,
  updateBrandingSettings,
  type BrandingSettings,
} from "@/lib/settings-api";
import { useDirtyForm } from "@/hooks/use-dirty-form";
import { handleApiError } from "@/lib/api-error";
import { resolveAssetUrl } from "@/lib/auth";

export const Route = createFileRoute("/admin/settings/branding")({
  component: BrandingPage,
});

type FormShape = {
  logoUrl: string | null;
  lightLogoUrl: string | null;
  darkLogoUrl: string | null;
  faviconUrl: string | null;
  bannerDesktopUrl: string | null;
  bannerMobileUrl: string | null;
  socialImageUrl: string | null;
  defaultProductImageUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  theme: string;
};

const EMPTY: FormShape = {
  logoUrl: null,
  lightLogoUrl: null,
  darkLogoUrl: null,
  faviconUrl: null,
  bannerDesktopUrl: null,
  bannerMobileUrl: null,
  socialImageUrl: null,
  defaultProductImageUrl: null,
  primaryColor: "#EA580C",
  secondaryColor: "#0F172A",
  backgroundColor: "#FFFFFF",
  theme: "LIGHT",
};

function fromApi(b: BrandingSettings | undefined | null): FormShape {
  return {
    logoUrl: b?.logoUrl ?? null,
    lightLogoUrl: b?.lightLogoUrl ?? null,
    darkLogoUrl: b?.darkLogoUrl ?? null,
    faviconUrl: b?.faviconUrl ?? null,
    bannerDesktopUrl: b?.bannerDesktopUrl ?? null,
    bannerMobileUrl: b?.bannerMobileUrl ?? null,
    socialImageUrl: b?.socialImageUrl ?? null,
    defaultProductImageUrl: b?.defaultProductImageUrl ?? null,
    primaryColor: b?.primaryColor ?? EMPTY.primaryColor,
    secondaryColor: b?.secondaryColor ?? EMPTY.secondaryColor,
    backgroundColor: b?.backgroundColor ?? EMPTY.backgroundColor,
    theme: (b?.theme as string) ?? EMPTY.theme,
  };
}

function BrandingPage() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: qk.settings.branding(orgId),
    queryFn: () => getBrandingSettings(token!),
    enabled: !!token && !!orgId,
  });

  const form = useDirtyForm<FormShape>(EMPTY);

  const mutation = useMutation({
    mutationFn: async (patch: Partial<BrandingSettings>) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug("[branding] PATCH payload", patch);
      }
      await updateBrandingSettings(token!, patch);
      // Authoritative refetch — do not trust the PATCH response as full state.
      await queryClient.invalidateQueries({ queryKey: qk.settings.branding(orgId) });
      const refetched = await queryClient.fetchQuery({
        queryKey: qk.settings.branding(orgId),
        queryFn: () => getBrandingSettings(token!),
      });
      return refetched;
    },
    onSuccess: (result) => {
      toast.success("Identidade visual salva");
      form.reset(fromApi(result));
      queryClient.invalidateQueries({ queryKey: qk.settings.all(orgId) });
      queryClient.invalidateQueries({ queryKey: qk.settings.root(orgId) });
      queryClient.invalidateQueries({ queryKey: qk.settings.effective(orgId) });
    },
    onError: (err) => handleApiError(err, "Não foi possível salvar"),
  });

  useEffect(() => {
    if (!query.data) return;
    if (form.isDirty) return;
    if (mutation.isPending) return;
    const hydrated = fromApi(query.data);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[branding] hydrated form", hydrated);
    }
    form.reset(hydrated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  const v = form.values;

  function buildPatch(): Partial<BrandingSettings> {
    const snap = form.snapshot;
    const patch: Partial<BrandingSettings> = {};
    (Object.keys(v) as Array<keyof FormShape>).forEach((k) => {
      if (v[k] !== snap[k]) {
        (patch as Record<string, unknown>)[k] = v[k];
      }
    });
    return patch;
  }


  return (
    <AdminLayout title="Configurações" subtitle="Identidade visual da organização">
      <SettingsLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">Identidade Visual</h2>
            <p className="text-sm text-muted-foreground">
              Logotipos, banners, cores e tema usados nas telas voltadas ao cliente.
            </p>
          </div>

          {query.isLoading ? (
            <PageLoading />
          ) : query.isError ? (
            <PageError
              message="Não foi possível carregar a identidade visual."
              onRetry={() => query.refetch()}
            />
          ) : (
            <>
              <SettingsSection title="Logotipos" description="Versões clara, escura e favicon.">
                <SettingsGroup columns={2}>
                  <AssetUploader
                    label="Logo principal"
                    description="Usado por padrão em toda a plataforma."
                    token={token}
                    value={v.logoUrl}
                    onChange={(url) => form.setValues({ logoUrl: url })}
                  />
                  <AssetUploader
                    label="Favicon"
                    description="Ícone exibido na aba do navegador."
                    token={token}
                    value={v.faviconUrl}
                    onChange={(url) => form.setValues({ faviconUrl: url })}
                  />
                  <AssetUploader
                    label="Logo (tema claro)"
                    token={token}
                    value={v.lightLogoUrl}
                    onChange={(url) => form.setValues({ lightLogoUrl: url })}
                  />
                  <AssetUploader
                    label="Logo (tema escuro)"
                    token={token}
                    value={v.darkLogoUrl}
                    onChange={(url) => form.setValues({ darkLogoUrl: url })}
                  />
                </SettingsGroup>
              </SettingsSection>

              <SettingsSection title="Banners e compartilhamento">
                <SettingsGroup columns={2}>
                  <AssetUploader
                    label="Banner desktop"
                    token={token}
                    value={v.bannerDesktopUrl}
                    onChange={(url) => form.setValues({ bannerDesktopUrl: url })}
                    aspect="wide"
                  />
                  <AssetUploader
                    label="Banner mobile"
                    token={token}
                    value={v.bannerMobileUrl}
                    onChange={(url) => form.setValues({ bannerMobileUrl: url })}
                    aspect="tall"
                  />
                  <AssetUploader
                    label="Imagem social (OG)"
                    description="Preview em redes sociais e WhatsApp."
                    token={token}
                    value={v.socialImageUrl}
                    onChange={(url) => form.setValues({ socialImageUrl: url })}
                    aspect="wide"
                  />
                  <AssetUploader
                    label="Imagem padrão de produto"
                    description="Usada quando um item não tem foto."
                    token={token}
                    value={v.defaultProductImageUrl}
                    onChange={(url) => form.setValues({ defaultProductImageUrl: url })}
                  />
                </SettingsGroup>
              </SettingsSection>

              <SettingsSection title="Cores e tema">
                <SettingsGroup columns={3}>
                  <ColorField
                    label="Cor primária"
                    value={v.primaryColor}
                    onChange={(vv) => form.setValues({ primaryColor: vv })}
                  />
                  <ColorField
                    label="Cor secundária"
                    value={v.secondaryColor}
                    onChange={(vv) => form.setValues({ secondaryColor: vv })}
                  />
                  <ColorField
                    label="Cor de fundo"
                    value={v.backgroundColor}
                    onChange={(vv) => form.setValues({ backgroundColor: vv })}
                  />
                  <div className="space-y-2">
                    <Label>Tema</Label>
                    <Select
                      value={v.theme}
                      onValueChange={(val) => form.setValues({ theme: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LIGHT">Claro</SelectItem>
                        <SelectItem value="DARK">Escuro</SelectItem>
                        <SelectItem value="SYSTEM">Automático</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SettingsGroup>
              </SettingsSection>

              <SettingsSection title="Prévia" description="Como sua marca aparece nas telas.">
                <div
                  className="overflow-hidden rounded-xl border border-border"
                  style={{ background: v.backgroundColor }}
                >
                  <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ background: v.secondaryColor, color: "#fff" }}
                  >
                    <div className="flex items-center gap-2">
                      {v.logoUrl ? (
                        <img
                          src={resolveAssetUrl(v.logoUrl)}
                          alt=""
                          className="h-6 w-6 rounded object-cover"
                        />
                      ) : null}
                      <span className="text-sm font-semibold">Sua marca</span>
                    </div>
                    <Button
                      size="sm"
                      style={{ background: v.primaryColor, color: "#fff", border: "none" }}
                    >
                      Ação principal
                    </Button>
                  </div>
                  <div className="p-6 text-sm" style={{ color: v.secondaryColor }}>
                    Prévia da paleta aplicada ao header, botão e fundo.
                  </div>
                </div>
              </SettingsSection>

              <StickySaveBar
                visible={form.isDirty}
                saving={mutation.isPending}
                onCancel={form.revert}
                onSave={() => {
                  const patch = buildPatch();
                  if (Object.keys(patch).length === 0) return;
                  mutation.mutate(patch);
                }}
              />

            </>
          )}
        </div>
      </SettingsLayout>
    </AdminLayout>
  );
}
