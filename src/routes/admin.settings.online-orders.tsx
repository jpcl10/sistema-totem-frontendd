import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin-layout";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { StoreScope } from "@/components/admin/settings/StoreScope";
import { StickySaveBar } from "@/components/admin/settings/StickySaveBar";
import { useSelectedStore } from "@/hooks/use-selected-store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useOnlineOrdersSettings,
  useUpdateOnlineOrdersSettings,
} from "@/hooks/use-store-settings";
import type { UpdateOnlineOrdersSettingsBody } from "@/lib/settings-api";

const searchSchema = z.object({
  storeId: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/admin/settings/online-orders")({
  validateSearch: zodValidator(searchSchema),
  component: OnlineOrdersSettingsPage,
});

function OnlineOrdersSettingsPage() {
  const { storeId: urlStoreId } = Route.useSearch();
  const scope = useSelectedStore(urlStoreId || null);

  return (
    <AdminLayout
      title="Loja Online"
      subtitle="Aceitação de pedidos, mensagens e requisitos do checkout."
    >
      <SettingsLayout>
        <StoreScope scope={scope}>
          {(storeId) => <OnlineOrdersInner storeId={storeId} />}
        </StoreScope>
      </SettingsLayout>
    </AdminLayout>
  );
}

interface FormState {
  onlineOrderingEnabled: boolean;
  digitalMenuEnabled: boolean;
  autoAcceptOrders: boolean;
  allowOrdersOutsideHours: boolean;
  minimumOrderReais: string;
  estimatedPreparationMinutes: number;
  closedMessage: string;
  checkoutNotice: string;
  orderConfirmationMessage: string;
  requireCustomerName: boolean;
  requireCustomerPhone: boolean;
  allowCustomerNotes: boolean;
}

function centsToInput(cents: number | null): string {
  if (cents == null || cents === 0) return "";
  return (cents / 100).toString();
}
function inputToCents(v: string): number {
  const s = v.trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function OnlineOrdersInner({ storeId }: { storeId: string }) {
  const q = useOnlineOrdersSettings(storeId);
  const m = useUpdateOnlineOrdersSettings(storeId);

  const [state, setState] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<FormState | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const e = q.data.effective;
    const next: FormState = {
      onlineOrderingEnabled: e.onlineOrderingEnabled,
      digitalMenuEnabled: e.digitalMenuEnabled,
      autoAcceptOrders: e.autoAcceptOrders,
      allowOrdersOutsideHours: e.allowOrdersOutsideHours,
      minimumOrderReais: centsToInput(e.minimumOrderInCents),
      estimatedPreparationMinutes: e.estimatedPreparationMinutes,
      closedMessage: e.closedMessage ?? "",
      checkoutNotice: e.checkoutNotice ?? "",
      orderConfirmationMessage: e.orderConfirmationMessage ?? "",
      requireCustomerName: e.requireCustomerName,
      requireCustomerPhone: e.requireCustomerPhone,
      allowCustomerNotes: e.allowCustomerNotes,
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
            <div className="mt-6 space-y-3">
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
    const body: UpdateOnlineOrdersSettingsBody = {
      onlineOrderingEnabled: state.onlineOrderingEnabled,
      digitalMenuEnabled: state.digitalMenuEnabled,
      autoAcceptOrders: state.autoAcceptOrders,
      allowOrdersOutsideHours: state.allowOrdersOutsideHours,
      minimumOrderInCents: inputToCents(state.minimumOrderReais),
      estimatedPreparationMinutes: state.estimatedPreparationMinutes,
      closedMessage: state.closedMessage.trim() || null,
      checkoutNotice: state.checkoutNotice.trim() || null,
      orderConfirmationMessage:
        state.orderConfirmationMessage.trim() || null,
      requireCustomerName: state.requireCustomerName,
      requireCustomerPhone: state.requireCustomerPhone,
      allowCustomerNotes: state.allowCustomerNotes,
    };
    try {
      await m.mutateAsync(body);
      toast.success("Configurações da loja online salvas.");
      setInitial(state);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  };

  return (
    <div className="space-y-6 pb-24">
      <SettingsSection
        title="Operação"
        description="Canais online e aceitação de pedidos."
      >
        <ToggleRow
          label="Aceitar pedidos online"
          description="Se desativado, o checkout fica bloqueado."
          checked={state.onlineOrderingEnabled}
          onChange={(v) => setState({ ...state, onlineOrderingEnabled: v })}
        />
        <ToggleRow
          label="Cardápio digital público"
          description="Exibe a loja em /p/:slug."
          checked={state.digitalMenuEnabled}
          onChange={(v) => setState({ ...state, digitalMenuEnabled: v })}
        />
        <ToggleRow
          label="Aceitar automaticamente"
          description="Pedidos vão direto para preparo, sem confirmação manual."
          checked={state.autoAcceptOrders}
          onChange={(v) => setState({ ...state, autoAcceptOrders: v })}
        />
        <ToggleRow
          label="Aceitar fora do horário"
          description="Permite receber pedidos mesmo com a loja fechada."
          checked={state.allowOrdersOutsideHours}
          onChange={(v) => setState({ ...state, allowOrdersOutsideHours: v })}
        />
      </SettingsSection>

      <SettingsSection
        title="Regras do pedido"
        description="Valor mínimo, tempo estimado e mensagens ao cliente."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="min">Pedido mínimo (R$)</Label>
            <Input
              id="min"
              type="number"
              step="0.01"
              min={0}
              value={state.minimumOrderReais}
              onChange={(e) =>
                setState({ ...state, minimumOrderReais: e.target.value })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="prep">Tempo de preparo (min)</Label>
            <Input
              id="prep"
              type="number"
              min={0}
              value={String(state.estimatedPreparationMinutes)}
              onChange={(e) =>
                setState({
                  ...state,
                  estimatedPreparationMinutes: Number(e.target.value) || 0,
                })
              }
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="closed">Mensagem quando fechado</Label>
          <Textarea
            id="closed"
            rows={2}
            value={state.closedMessage}
            onChange={(e) =>
              setState({ ...state, closedMessage: e.target.value })
            }
            placeholder="Ex.: Estamos fechados agora. Volte às 18h."
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="notice">Aviso no checkout</Label>
          <Textarea
            id="notice"
            rows={2}
            value={state.checkoutNotice}
            onChange={(e) =>
              setState({ ...state, checkoutNotice: e.target.value })
            }
            placeholder="Ex.: Pedidos aceitos até 30 min antes do fechamento."
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm">Mensagem de confirmação do pedido</Label>
          <Textarea
            id="confirm"
            rows={2}
            value={state.orderConfirmationMessage}
            onChange={(e) =>
              setState({
                ...state,
                orderConfirmationMessage: e.target.value,
              })
            }
            placeholder="Ex.: Recebemos seu pedido! Já estamos preparando."
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Cliente"
        description="O que é obrigatório no checkout do cardápio digital."
      >
        <ToggleRow
          label="Exigir nome do cliente"
          checked={state.requireCustomerName}
          onChange={(v) => setState({ ...state, requireCustomerName: v })}
        />
        <ToggleRow
          label="Exigir telefone / WhatsApp"
          checked={state.requireCustomerPhone}
          onChange={(v) => setState({ ...state, requireCustomerPhone: v })}
        />
        <ToggleRow
          label="Permitir observações no pedido"
          checked={state.allowCustomerNotes}
          onChange={(v) => setState({ ...state, allowCustomerNotes: v })}
        />
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
