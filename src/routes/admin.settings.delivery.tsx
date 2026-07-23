import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { StoreScope } from "@/components/admin/settings/StoreScope";
import { useSelectedStore } from "@/hooks/use-selected-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StickySaveBar } from "@/components/admin/settings/StickySaveBar";
import {
  useDeliverySettings,
  useUpdateDeliverySettings,
} from "@/hooks/use-store-settings";
import type { UpdateDeliverySettingsBody } from "@/lib/settings-api";

const searchSchema = z.object({
  storeId: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/admin/settings/delivery")({
  validateSearch: zodValidator(searchSchema),
  component: DeliverySettingsPage,
});

function DeliverySettingsPage() {
  const { storeId: urlStoreId } = Route.useSearch();
  const scope = useSelectedStore(urlStoreId || null);

  return (
    <AdminLayout title="Entrega" subtitle="Regras gerais de entrega e retirada.">
      <SettingsLayout>
        <StoreScope scope={scope}>
          {(storeId) => <DeliveryInner storeId={storeId} />}
        </StoreScope>
      </SettingsLayout>
    </AdminLayout>
  );
}

interface FormState {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  counterEnabled: boolean;
  dineInEnabled: boolean;
  estimatedDeliveryMinutes: number;
  freeDeliveryAboveReais: string; // input state (reais)
  defaultDeliveryFeeReais: string;
  requireDeliveryAddress: boolean;
}

function centsToInput(cents: number | null): string {
  if (cents == null) return "";
  return (cents / 100).toString();
}
function inputToCents(v: string): number | null {
  const s = v.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function DeliveryInner({ storeId }: { storeId: string }) {
  const q = useDeliverySettings(storeId);
  const m = useUpdateDeliverySettings(storeId);

  const [state, setState] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const d = q.data.delivery;
    const next: FormState = {
      deliveryEnabled: d.deliveryEnabled,
      pickupEnabled: d.pickupEnabled,
      counterEnabled: d.counterEnabled,
      dineInEnabled: d.dineInEnabled,
      estimatedDeliveryMinutes: d.estimatedDeliveryMinutes,
      freeDeliveryAboveReais: centsToInput(d.freeDeliveryAboveInCents),
      defaultDeliveryFeeReais: centsToInput(d.defaultDeliveryFeeInCents),
      requireDeliveryAddress: d.requireDeliveryAddress,
    };
    setState(next);
    setInitial(next);
  }, [q.data]);

  if (q.isLoading || !state || !initial) {
    return (
      <div className="space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="mb-4 h-4 w-40 animate-pulse rounded bg-muted/60" />
            <div className="mb-2 h-3 w-64 animate-pulse rounded bg-muted/40" />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="h-10 animate-pulse rounded-md bg-muted/40" />
              <div className="h-10 animate-pulse rounded-md bg-muted/40" />
              <div className="h-10 animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const onSave = async () => {
    const body: UpdateDeliverySettingsBody = {
      deliveryEnabled: state.deliveryEnabled,
      pickupEnabled: state.pickupEnabled,
      counterEnabled: state.counterEnabled,
      dineInEnabled: state.dineInEnabled,
      estimatedDeliveryMinutes: state.estimatedDeliveryMinutes,
      freeDeliveryAboveInCents: inputToCents(state.freeDeliveryAboveReais),
      defaultDeliveryFeeInCents:
        inputToCents(state.defaultDeliveryFeeReais) ?? 0,
      requireDeliveryAddress: state.requireDeliveryAddress,
    };
    try {
      await m.mutateAsync(body);
      toast.success("Configurações de entrega salvas com sucesso.");
      setInitial(state);
    } catch {
      toast.error("Não foi possível salvar as configurações de entrega.");
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <SettingsSection
        title="Atendimento"
        description="Canais habilitados para receber pedidos nesta loja."
      >
        <ToggleRow
          label="Entrega"
          description="Habilita o fluxo de entrega no cardápio digital."
          checked={state.deliveryEnabled}
          onChange={(v) => setState({ ...state, deliveryEnabled: v })}
        />
        <ToggleRow
          label="Retirada"
          description="O cliente retira o pedido no balcão."
          checked={state.pickupEnabled}
          onChange={(v) => setState({ ...state, pickupEnabled: v })}
        />
        <ToggleRow
          label="Balcão / Presencial"
          description="Pedidos feitos localmente pelo operador."
          checked={state.counterEnabled}
          onChange={(v) => setState({ ...state, counterEnabled: v })}
        />
        <ToggleRow
          label="Consumo no local"
          description="Habilita o fluxo para consumo no local."
          checked={state.dineInEnabled}
          onChange={(v) => setState({ ...state, dineInEnabled: v })}
        />
      </SettingsSection>

      <SettingsSection
        title="Regras gerais"
        description="Aplicadas quando nenhuma regra de taxa mais específica atende."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            id="prep"
            label="Estimativa de entrega (min)"
            type="number"
            value={String(state.estimatedDeliveryMinutes)}
            onChange={(v) =>
              setState({ ...state, estimatedDeliveryMinutes: Number(v) || 0 })
            }
          />
          <Field
            id="fee"
            label="Taxa padrão (R$)"
            type="number"
            step="0.01"
            value={state.defaultDeliveryFeeReais}
            onChange={(v) => setState({ ...state, defaultDeliveryFeeReais: v })}
          />
          <Field
            id="free"
            label="Frete grátis acima de (R$)"
            type="number"
            step="0.01"
            value={state.freeDeliveryAboveReais}
            onChange={(v) => setState({ ...state, freeDeliveryAboveReais: v })}
          />
        </div>
        <ToggleRow
          label="Exigir endereço de entrega"
          description="Obriga o cliente a informar o endereço no checkout de entrega."
          checked={state.requireDeliveryAddress}
          onChange={(v) => setState({ ...state, requireDeliveryAddress: v })}
        />
      </SettingsSection>

      <SettingsSection
        title="Regras de taxa (bairros / fixas)"
        description="Gerencie a cobrança por bairro ou por regra fixa."
      >
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6">
          <MapPin className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-sm font-medium">Regras de taxa</p>
            <p className="text-xs text-muted-foreground">
              Configure taxas fixas ou por bairro em uma tela dedicada.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link
              to="/admin/settings/delivery/rules"
              search={{ storeId } as never}
            >
              Abrir regras
            </Link>
          </Button>
        </div>
      </SettingsSection>

      <StickySaveBar
        visible={dirty}
        saving={m.isPending}
        onSave={onSave}
        onCancel={() => setState(initial)}
      />
    </div>
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
    <div className="flex items-start justify-between gap-4 border-b border-border/60 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  step,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
