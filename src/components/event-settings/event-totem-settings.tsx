import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Monitor,
  Save,
  RotateCcw,
  Loader2,
  Upload,
  Trash2,
  ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getEvent, updateEvent, uploadImage, type EventItem } from "@/lib/events-api";
import { resolveAssetUrl } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

interface EventTotemSettingsProps {
  eventId: string;
  onSaveSuccess?: () => void;
}

export interface TotemForm {
  welcomeMessage: string;
  backgroundColor: string;
  textColor: string;
  showPrices: boolean;
  showLowStock: boolean;
  requireCustomerName: boolean;
  autoResetSeconds: number;
  showLogo: boolean;
  fullscreenRecommended: boolean;
  useGradient: boolean;
  gradientColor: string;
  logoUrl: string;
  bannerUrl: string;
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
};

const GRADIENT_KEY = (id: string) => `admin.settings.kiosk.gradient.${id}`;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;


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
  };
}

export function EventTotemSettings({ eventId, onSaveSuccess }: EventTotemSettingsProps) {
  const { token } = useAuth();
  const [eventData, setEventData] = useState<EventItem | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [form, setForm] = useState<TotemForm>(DEFAULT_FORM);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!token || !eventId) {
      setEventData(null);
      setForm(DEFAULT_FORM);
      return;
    }
    setLoadingEvent(true);
    getEvent(token, eventId)
      .then((ev) => {
        if (cancelled) return;
        setEventData(ev);
        setForm(fromEvent(ev));
        setDirty(false);
      })
      .catch((err) => {
        if (!cancelled) handleApiError(err, "Não foi possível carregar o evento.");
      })
      .finally(() => {
        if (!cancelled) setLoadingEvent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, eventId]);

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
      } as Partial<EventItem>;

      if (form.logoUrl !== originalLogo) {
        (patch as Record<string, unknown>).logoUrl = form.logoUrl || null;
      }
      if (form.bannerUrl !== originalBanner) {
        (patch as Record<string, unknown>).bannerUrl = form.bannerUrl || null;
      }


      const updated = await updateEvent(token, eventId, patch);
      try {
        const fresh = await getEvent(token, eventId);
        setEventData(fresh);
        setForm(fromEvent(fresh));
      } catch {
        setEventData(updated);
        setForm(fromEvent(updated));
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          GRADIENT_KEY(eventId),
          JSON.stringify({ useGradient: form.useGradient, gradientColor: form.gradientColor }),
        );
      }
      setDirty(false);
      toast.success("Configurações do totem salvas");
      onSaveSuccess?.();
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

  const previewBg = form.useGradient
    ? `linear-gradient(135deg, ${form.backgroundColor}, ${form.gradientColor})`
    : form.backgroundColor;

  const eventLogo = resolveAssetUrl(form.logoUrl);
  const eventBanner = resolveAssetUrl(form.bannerUrl);

  if (loadingEvent) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando configurações do evento...
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            Configurações do Totem
          </CardTitle>
          <CardDescription>
            Defina identidade visual e comportamento do totem.
          </CardDescription>
        </div>
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
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cart-reset">Reset automático do carrinho (segundos)</Label>
            <Input
              id="cart-reset"
              type="number"
              min={10}
              max={600}
              value={form.autoResetSeconds}
              onChange={(e) =>
                update("autoResetSeconds", Math.max(10, Number(e.target.value) || 0))
              }
              disabled={!eventId}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="welcome">Mensagem de boas-vindas</Label>
              <Textarea
                id="welcome"
                rows={2}
                maxLength={200}
                value={form.welcomeMessage}
                onChange={(e) => update("welcomeMessage", e.target.value)}
                placeholder="Ex.: Bem-vindo ao nosso evento!"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <AssetField
                label="Logo do evento"
                hint="PNG/SVG transparente. Até 5MB."
                value={form.logoUrl}
                ratio="square"
                token={token}
                onChange={(v) => update("logoUrl", v)}
              />
              <AssetField
                label="Banner / capa"
                hint="Recomendado 1920x600. Até 5MB."
                value={form.bannerUrl}
                ratio="banner"
                token={token}
                onChange={(v) => update("bannerUrl", v)}
              />
            </div>


            <div className="grid gap-4 sm:grid-cols-3">
              <ColorField
                label="Cor de fundo"
                value={form.backgroundColor}
                onChange={(v) => update("backgroundColor", v)}
              />
              <ColorField
                label="Cor do gradiente"
                value={form.gradientColor}
                onChange={(v) => update("gradientColor", v)}
                disabled={!form.useGradient}
              />
              <ColorField
                label="Cor do texto"
                value={form.textColor}
                onChange={(v) => update("textColor", v)}
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <ToggleRow
                label="Usar gradiente no fundo"
                description="Visual local — ainda não persistido no servidor."
                checked={form.useGradient}
                onChange={(v) => update("useGradient", v)}
              />
              <ToggleRow
                label="Mostrar logo do evento"
                checked={form.showLogo}
                onChange={(v) => update("showLogo", v)}
              />
              <ToggleRow
                label="Mostrar preços"
                checked={form.showPrices}
                onChange={(v) => update("showPrices", v)}
              />
              <ToggleRow
                label="Mostrar aviso de estoque baixo"
                checked={form.showLowStock}
                onChange={(v) => update("showLowStock", v)}
              />
              <ToggleRow
                label="Solicitar nome do cliente"
                checked={form.requireCustomerName}
                onChange={(v) => update("requireCustomerName", v)}
              />
              <ToggleRow
                label="Modo fullscreen recomendado"
                checked={form.fullscreenRecommended}
                onChange={(v) => update("fullscreenRecommended", v)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pré-visualização</Label>
            <div
              className="relative overflow-hidden rounded-xl border border-border shadow-[var(--shadow-soft)]"
              style={{
                background: previewBg,
                color: form.textColor,
                aspectRatio: "9 / 16",
                maxHeight: 520,
              }}
            >
              {eventBanner && (
                <img
                  src={eventBanner}
                  alt=""
                  className="h-32 w-full object-cover opacity-80"
                />
              )}
              <div className="flex flex-col items-center gap-4 px-6 py-8 text-center">
                {form.showLogo && eventLogo && (
                  <img
                    src={eventLogo}
                    alt="Logo"
                    className="h-20 w-20 rounded-lg object-contain"
                  />
                )}
                <p
                  className="text-lg font-semibold leading-snug"
                  style={{ color: form.textColor }}
                >
                  {form.welcomeMessage || "Bem-vindo!"}
                </p>
                <div
                  className="mt-2 inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.12)",
                    color: form.textColor,
                  }}
                >
                  Toque para começar
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-md border border-input bg-transparent disabled:opacity-50"
        />
        <Input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      </div>
    </div>
  );
}

function AssetField({
  label,
  hint,
  value,
  ratio,
  token,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  ratio: "square" | "banner";
  token?: string | null;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const display = resolveAssetUrl(value);
  const aspect = ratio === "banner" ? "aspect-[16/5]" : "aspect-square";

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Imagem muito grande (máx. 5MB)");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(token, file);
      onChange(url);
      toast.success("Imagem enviada");
    } catch (err) {
      handleApiError(err, "Falha ao enviar imagem");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div
        className={`relative ${aspect} flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30`}
      >
        {display ? (
          <img src={display} alt="" className="h-full w-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">Sem imagem</span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {value ? "Trocar" : "Enviar"}
        </Button>
        {value && !uploading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remover
          </Button>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

