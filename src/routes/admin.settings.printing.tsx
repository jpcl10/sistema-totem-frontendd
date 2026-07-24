import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { Printer, Check, WifiOff } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { SettingsGroup } from "@/components/admin/settings/SettingsGroup";
import { StickySaveBar } from "@/components/admin/settings/StickySaveBar";
import { PageLoading, PageError } from "@/components/admin/page";
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
import { useDirtyForm } from "@/hooks/use-dirty-form";
import {
  usePrintingSettings,
  useUpdatePrintingSettings,
  usePrinterDevices,
} from "@/hooks/use-printing-settings";
import type {
  PrintMode,
  PrinterPaperSize,
  PrintingSector,
  PrintingSource,
} from "@/lib/settings-api";
import {
  buildPrintingPatch,
  hydratePrintingForm,
  PRINTING_SECTORS,
  PRINTING_SOURCES,
  type PrintingFormState,
} from "@/lib/printing-patch";
import type { Device } from "@/lib/devices-api";

export const Route = createFileRoute("/admin/settings/printing")({
  component: PrintingSettingsPage,
});

const PRINT_MODE_LABEL: Record<PrintMode, string> = {
  FULL_ORDER: "Comanda completa",
  BY_SECTOR: "Por setor",
  BOTH: "Completa + por setor",
};

const SOURCE_LABEL: Record<PrintingSource, string> = {
  ONLINE_STORE: "Loja online",
  MANUAL_STORE: "Venda manual (loja)",
  EVENT: "Evento",
  MANUAL_EVENT: "Venda manual (evento)",
  TOTEM: "Totem",
  POS: "PDV",
  API: "API",
  WAITER: "Garçom",
};

const SECTOR_LABEL: Record<PrintingSector, string> = {
  COOK: "Cozinha",
  BAR: "Bar",
  GENERAL: "Geral",
};

function PrintingSettingsPage() {
  return (
    <AdminLayout
      title="Impressão"
      subtitle="Configurações de impressão, impressoras vinculadas e regras por origem/setor."
    >
      <SettingsLayout>
        <PrintingInner />
      </SettingsLayout>
    </AdminLayout>
  );
}

function PrintingInner() {
  const q = usePrintingSettings();
  const m = useUpdatePrintingSettings();
  const devicesQ = usePrinterDevices();

  const initial = useMemo<PrintingFormState | null>(
    () => (q.data ? hydratePrintingForm(q.data) : null),
    [q.data],
  );

  // useDirtyForm requires a value on first mount; feed a stable empty state
  // and swap the snapshot when the query resolves.
  const seed = useMemo<PrintingFormState>(
    () =>
      initial ??
      hydratePrintingForm({
        settings: null,
        effective: {
          sources: {} as never,
          sectors: {} as never,
        },
      }),
    [initial],
  );
  const form = useDirtyForm<PrintingFormState>(seed);

  const lastResetKey = useRef<unknown>(null);
  useEffect(() => {
    if (initial && lastResetKey.current !== q.data) {
      lastResetKey.current = q.data;
      form.reset(initial);
    }
  }, [initial, q.data, form]);

  if (q.isLoading || !initial) return <PageLoading rows={5} />;
  if (q.isError) {
    return (
      <PageError
        error={q.error}
        onRetry={() => {
          void q.refetch();
        }}
      />
    );
  }

  const source = q.data?.source;
  const devices = devicesQ.data ?? [];
  const v = form.values;

  const onSave = async () => {
    const body = buildPrintingPatch(form.snapshot, v);
    if (Object.keys(body).length === 0) return;
    try {
      const res = await m.mutateAsync(body);
      // Reset com resposta completa — nunca com o patch parcial.
      form.reset(hydratePrintingForm({ settings: res.settings, effective: res.effective }));
      toast.success("Configurações de impressão salvas com sucesso.");
    } catch {
      toast.error("Não foi possível salvar as configurações de impressão.");
    }
  };

  const setSource = (
    key: PrintingSource,
    patch: Partial<PrintingFormState["sources"][PrintingSource]>,
  ) =>
    form.setValues((prev) => ({
      ...prev,
      sources: { ...prev.sources, [key]: { ...prev.sources[key], ...patch } },
    }));

  const setSector = (
    key: PrintingSector,
    patch: Partial<PrintingFormState["sectors"][PrintingSector]>,
  ) =>
    form.setValues((prev) => ({
      ...prev,
      sectors: { ...prev.sectors, [key]: { ...prev.sectors[key], ...patch } },
    }));

  return (
    <div className="space-y-6 pb-24">
      <SettingsSection
        title="Impressão"
        description="Comportamento global do sistema de impressão."
        actions={
          source && (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" /> {source}
            </Badge>
          )
        }
      >
        <ToggleRow
          label="Habilitar impressão"
          hint="Quando desligado, nenhum PrintJob é gerado."
          checked={v.printingEnabled}
          onChange={(x) => form.setValues({ printingEnabled: x })}
        />
        <ToggleRow
          label="Impressão automática"
          hint="Envia jobs automaticamente quando pedidos são criados."
          checked={v.autoPrintEnabled}
          onChange={(x) => form.setValues({ autoPrintEnabled: x })}
          disabled={!v.printingEnabled}
        />
        <ToggleRow
          label="Permitir reimpressão"
          checked={v.allowReprint}
          onChange={(x) => form.setValues({ allowReprint: x })}
        />
        <ToggleRow
          label="Separar por setor (split)"
          hint="Gera uma via por setor de produção."
          checked={v.splitBySector}
          onChange={(x) => form.setValues({ splitBySector: x })}
        />
        <ToggleRow
          label="Mesclar cópias (merge)"
          checked={v.mergeCopies}
          onChange={(x) => form.setValues({ mergeCopies: x })}
        />

        <SettingsGroup columns={2}>
          <div className="grid gap-1.5">
            <Label>Tamanho do papel</Label>
            <Select
              value={v.paperSize}
              onValueChange={(x) => form.setValues({ paperSize: x as PrinterPaperSize })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm</SelectItem>
                <SelectItem value="80mm">80mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title="Impressoras vinculadas"
        description="Escolha um dispositivo (PRINTER, PRINT_AGENT ou SK210) para cada função."
      >
        <SettingsGroup columns={2}>
          <DeviceSelect
            label="Padrão"
            value={v.defaultPrinterDeviceId}
            devices={devices}
            loading={devicesQ.isLoading}
            onChange={(id) => form.setValues({ defaultPrinterDeviceId: id })}
          />
          <DeviceSelect
            label="Cozinha"
            value={v.kitchenPrinterDeviceId}
            devices={devices}
            loading={devicesQ.isLoading}
            onChange={(id) => form.setValues({ kitchenPrinterDeviceId: id })}
          />
          <DeviceSelect
            label="Bar"
            value={v.barPrinterDeviceId}
            devices={devices}
            loading={devicesQ.isLoading}
            onChange={(id) => form.setValues({ barPrinterDeviceId: id })}
          />
          <DeviceSelect
            label="Expedição"
            value={v.expeditionPrinterDeviceId}
            devices={devices}
            loading={devicesQ.isLoading}
            onChange={(id) => form.setValues({ expeditionPrinterDeviceId: id })}
          />
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection title="Layout do cupom" description="Elementos exibidos na impressão.">
        <SettingsGroup columns={2}>
          {(
            [
              ["showLogo", "Logo"],
              ["showPrices", "Preços"],
              ["showQrCode", "QR Code"],
              ["showPayment", "Pagamento"],
              ["showOrderSource", "Origem do pedido"],
              ["showOrderNotes", "Observações do pedido"],
              ["showItemNotes", "Observações dos itens"],
              ["showOptions", "Opções / adicionais"],
            ] as const
          ).map(([k, label]) => (
            <ToggleRow
              key={k}
              label={label}
              checked={v[k] as boolean}
              onChange={(x) => form.setValues({ [k]: x } as Partial<PrintingFormState>)}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>

      <SettingsSection
        title="Origens"
        description="Ativação, impressão automática e modo por canal de origem."
      >
        <div className="space-y-3">
          {PRINTING_SOURCES.map((k) => {
            const cfg = v.sources[k];
            return (
              <div key={k} className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">{SOURCE_LABEL[k]}</p>
                    <p className="text-xs text-muted-foreground">{k}</p>
                  </div>
                  <Switch
                    checked={cfg.enabled}
                    onCheckedChange={(x) => setSource(k, { enabled: x })}
                  />
                </div>
                <SettingsGroup columns={2}>
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2">
                    <Label className="text-xs">Impressão automática</Label>
                    <Switch
                      checked={cfg.autoPrint}
                      onCheckedChange={(x) => setSource(k, { autoPrint: x })}
                      disabled={!cfg.enabled}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">Modo</Label>
                    <Select
                      value={cfg.printMode}
                      onValueChange={(x) => setSource(k, { printMode: x as PrintMode })}
                      disabled={!cfg.enabled}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(PRINT_MODE_LABEL) as PrintMode[]).map((m) => (
                          <SelectItem key={m} value={m}>
                            {PRINT_MODE_LABEL[m]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </SettingsGroup>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Setores" description="Ativação por setor de produção.">
        <SettingsGroup columns={3}>
          {PRINTING_SECTORS.map((k) => (
            <ToggleRow
              key={k}
              label={SECTOR_LABEL[k]}
              hint={k}
              checked={v.sectors[k].enabled}
              onChange={(x) => setSector(k, { enabled: x })}
            />
          ))}
        </SettingsGroup>
      </SettingsSection>

      <StickySaveBar
        visible={form.isDirty}
        saving={m.isPending}
        onSave={onSave}
        onCancel={form.revert}
      />
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

const NONE = "__none__";

function DeviceSelect({
  label,
  value,
  devices,
  loading,
  onChange,
}: {
  label: string;
  value: string | null;
  devices: Device[];
  loading?: boolean;
  onChange: (id: string | null) => void;
}) {
  const current = devices.find((d) => d.id === value);
  const online =
    current &&
    current.status === "ACTIVE" &&
    current.authStatus === "ACTIVE" &&
    !!current.lastHeartbeatAt;
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Select
        value={value ?? NONE}
        onValueChange={(x) => onChange(x === NONE ? null : x)}
        disabled={loading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Sem impressora" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Sem impressora</SelectItem>
          {devices.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <span className="flex items-center gap-2">
                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                {d.name} <span className="text-xs text-muted-foreground">· {d.type}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{current.code}</span>
          {online ? (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <Check className="h-3 w-3" /> Online
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-[10px]">
              <WifiOff className="h-3 w-3" /> {current.status}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
