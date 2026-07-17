import { useCallback, useEffect, useState } from "react";
import { Save, Loader2, Power, PowerOff, RotateCcw, AlertCircle, Wrench, Clock } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  getEvent,
  updateEvent,
  archiveEvent,
  restoreEvent,
  reopenEvent,
  type EventItem,
} from "@/lib/events-api";
import { handleApiError } from "@/lib/api-error";

interface Props {
  eventId: string;
  onChanged?: () => void;
}

interface OperationForm {
  requireCustomerName: boolean;
  allowOrderWithoutPayment: boolean;
  sendToProductionAfterPaymentOnly: boolean;
  allowCancel: boolean;
  allowEdit: boolean;
  controlStock: boolean;
  blockOutOfStock: boolean;
  showUnavailableOnTotem: boolean;
  totemAutoResetSeconds: number;
  pendingOrderTimeoutMinutes: number;
  pixPaymentExpirationMinutes: number;
  operationalMessage: string;
}

const DEFAULTS: OperationForm = {
  requireCustomerName: true,
  allowOrderWithoutPayment: false,
  sendToProductionAfterPaymentOnly: true,
  allowCancel: true,
  allowEdit: false,
  controlStock: true,
  blockOutOfStock: true,
  showUnavailableOnTotem: false,
  totemAutoResetSeconds: 60,
  pendingOrderTimeoutMinutes: 15,
  pixPaymentExpirationMinutes: 5,
  operationalMessage: "",
};

const LOCAL_KEY = (id: string) => `admin.event.operation.${id}`;

function deriveStatus(ev: EventItem | null): "ACTIVE" | "INACTIVE" | "CLOSED" {
  if (!ev) return "INACTIVE";
  const closed = (ev as any).closed === true || ev.status === "closed";
  if (closed) return "CLOSED";
  const active =
    (ev as any).active === true ||
    ev.status === "active" ||
    (typeof (ev as any).active === "undefined" && ev.status !== "inactive" && ev.status !== "archived");
  return active ? "ACTIVE" : "INACTIVE";
}

function loadLocal(eventId: string): Partial<OperationForm> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY(eventId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function fromEvent(ev: EventItem | null, eventId: string): OperationForm {
  const local = loadLocal(eventId);
  return {
    ...DEFAULTS,
    ...local,
    requireCustomerName:
      typeof ev?.totemRequireCustomerName === "boolean"
        ? ev.totemRequireCustomerName
        : local.requireCustomerName ?? DEFAULTS.requireCustomerName,
    showUnavailableOnTotem:
      typeof ev?.totemShowLowStock === "boolean"
        ? ev.totemShowLowStock
        : local.showUnavailableOnTotem ?? DEFAULTS.showUnavailableOnTotem,
    totemAutoResetSeconds:
      typeof ev?.totemAutoResetSeconds === "number"
        ? ev.totemAutoResetSeconds
        : local.totemAutoResetSeconds ?? DEFAULTS.totemAutoResetSeconds,
    pixPaymentExpirationMinutes:
      typeof ev?.pixPaymentExpirationMinutes === "number"
        ? ev.pixPaymentExpirationMinutes
        : local.pixPaymentExpirationMinutes ?? DEFAULTS.pixPaymentExpirationMinutes,
  };
}

export function EventOperationSettings({ eventId, onChanged }: Props) {
  const { token } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [form, setForm] = useState<OperationForm>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<null | "deactivate" | "activate" | "reopen">(null);
  const [statusBusy, setStatusBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    try {
      const ev = await getEvent(token, eventId);
      setEvent(ev);
      setForm(fromEvent(ev, eventId));
      setDirty(false);
    } catch (err) {
      handleApiError(err, "Falha ao carregar configurações do evento");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const status = deriveStatus(event);
  const isClosed = status === "CLOSED";

  const update = <K extends keyof OperationForm>(k: K, v: OperationForm[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!token || !eventId) return;
    if (isClosed) {
      toast.error("Reabra o evento para alterar as configurações.");
      return;
    }

    const pixExpiration = Number(form.pixPaymentExpirationMinutes);
    if (Number.isNaN(pixExpiration) || pixExpiration < 2 || pixExpiration > 15) {
      toast.error("O tempo de expiração do PIX deve estar entre 2 e 15 minutos.");
      return;
    }

    setSaving(true);
    try {
      // Persist backend-supported fields via PATCH /events/:id
      await updateEvent(token, eventId, {
        totemRequireCustomerName: form.requireCustomerName,
        totemShowLowStock: form.showUnavailableOnTotem,
        totemAutoResetSeconds: Number(form.totemAutoResetSeconds) || 60,
        pixPaymentExpirationMinutes: pixExpiration || 5,
      });
      // Persist the rest locally (campos sem suporte no backend ainda)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCAL_KEY(eventId), JSON.stringify(form));
      }
      toast.success("Configurações de operação salvas");
      setDirty(false);
      onChanged?.();
      await reload();
    } catch (err) {
      handleApiError(err, "Falha ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusAction = async () => {
    if (!token || !eventId || !confirm) return;
    setStatusBusy(true);
    try {
      if (confirm === "deactivate") {
        await archiveEvent(token, eventId);
        toast.success("Evento desativado");
      } else if (confirm === "activate") {
        await restoreEvent(token, eventId);
        toast.success("Evento ativado");
      } else if (confirm === "reopen") {
        await reopenEvent(token, eventId);
        toast.success("Evento reaberto");
      }
      setConfirm(null);
      onChanged?.();
      await reload();
    } catch (err) {
      handleApiError(err, "Falha ao alterar status do evento");
    } finally {
      setStatusBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do evento */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Power className="h-5 w-5 text-primary" />
                Status do Evento
              </CardTitle>
              <CardDescription>
                Controle se o evento está disponível para operação.
              </CardDescription>
            </div>
            <Badge
              className={
                status === "ACTIVE"
                  ? "bg-emerald-500"
                  : status === "CLOSED"
                  ? "bg-rose-500"
                  : "bg-slate-400"
              }
            >
              {status === "ACTIVE" ? "Ativo" : status === "CLOSED" ? "Fechado" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          {status === "ACTIVE" && (
            <Button variant="outline" onClick={() => setConfirm("deactivate")}>
              <PowerOff className="mr-2 h-4 w-4" /> Desativar evento
            </Button>
          )}
          {status === "INACTIVE" && (
            <Button onClick={() => setConfirm("activate")}>
              <Power className="mr-2 h-4 w-4" /> Ativar evento
            </Button>
          )}
          {status === "CLOSED" && (
            <Button onClick={() => setConfirm("reopen")}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reabrir evento
            </Button>
          )}
          {isClosed && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertCircle className="h-4 w-4" />
              Evento fechado: reabra para alterar configurações operacionais.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regras operacionais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Regras de operação
          </CardTitle>
          <CardDescription>
            Defina o comportamento prático do evento durante o atendimento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset disabled={isClosed} className="space-y-6 disabled:opacity-60">
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <ToggleRow
                label="Exigir nome do cliente no pedido"
                checked={form.requireCustomerName}
                onChange={(v) => update("requireCustomerName", v)}
              />
              <ToggleRow
                label="Permitir pedido sem pagamento confirmado"
                checked={form.allowOrderWithoutPayment}
                onChange={(v) => update("allowOrderWithoutPayment", v)}
              />
              <ToggleRow
                label="Enviar para produção somente após pagamento confirmado"
                checked={form.sendToProductionAfterPaymentOnly}
                onChange={(v) => update("sendToProductionAfterPaymentOnly", v)}
              />
              <ToggleRow
                label="Permitir cancelamento de pedido"
                checked={form.allowCancel}
                onChange={(v) => update("allowCancel", v)}
              />
              <ToggleRow
                label="Permitir edição de pedido após criado"
                checked={form.allowEdit}
                onChange={(v) => update("allowEdit", v)}
                hint="Em breve"
              />
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <ToggleRow
                label="Controlar estoque dos produtos"
                checked={form.controlStock}
                onChange={(v) => update("controlStock", v)}
              />
              <ToggleRow
                label="Bloquear venda de produto sem estoque"
                checked={form.blockOutOfStock}
                onChange={(v) => update("blockOutOfStock", v)}
              />
              <ToggleRow
                label="Mostrar produtos indisponíveis no autoatendimento"
                checked={form.showUnavailableOnTotem}
                onChange={(v) => update("showUnavailableOnTotem", v)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="op-reset">Tempo de reset automático do autoatendimento (segundos)</Label>
                <Input
                  id="op-reset"
                  type="number"
                  min={10}
                  max={600}
                  value={form.totemAutoResetSeconds}
                  onChange={(e) =>
                    update("totemAutoResetSeconds", Math.max(10, Number(e.target.value) || 0))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="op-pending">
                  Tempo limite p/ pedido pendente (min){" "}
                  <span className="text-xs text-muted-foreground">(em breve)</span>
                </Label>
                <Input
                  id="op-pending"
                  type="number"
                  min={1}
                  max={240}
                  value={form.pendingOrderTimeoutMinutes}
                  onChange={(e) =>
                    update("pendingOrderTimeoutMinutes", Math.max(1, Number(e.target.value) || 0))
                  }
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="op-pix-expiration" className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Tempo de expiração do PIX (min)
                </Label>
                <Input
                  id="op-pix-expiration"
                  type="number"
                  min={2}
                  max={15}
                  value={form.pixPaymentExpirationMinutes}
                  onChange={(e) =>
                    update("pixPaymentExpirationMinutes", Math.max(2, Number(e.target.value) || 0))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Após esse período o QR Code PIX será invalidado, o pedido será cancelado
                  automaticamente e o cliente retornará para a tela inicial do autoatendimento.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="op-msg">
                Mensagem operacional para o cliente{" "}
                <span className="text-xs text-muted-foreground">(em breve)</span>
              </Label>
              <Textarea
                id="op-msg"
                rows={2}
                value={form.operationalMessage}
                onChange={(e) => update("operationalMessage", e.target.value)}
                placeholder="Ex.: Pagamentos somente via Pix neste evento."
              />
            </div>
          </fieldset>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!dirty || saving || isClosed}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "deactivate" && "Desativar evento?"}
              {confirm === "activate" && "Ativar evento?"}
              {confirm === "reopen" && "Reabrir evento?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm === "deactivate" &&
                "O evento ficará indisponível para novos pedidos no autoatendimento e nos links públicos."}
              {confirm === "activate" &&
                "O evento voltará a aceitar pedidos e ficará visível nos canais públicos."}
              {confirm === "reopen" &&
                "Ao reabrir, será possível alterar configurações e receber pedidos novamente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleStatusAction} disabled={statusBusy}>
              {statusBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="text-sm">
        {label}
        {hint && <span className="ml-2 text-xs text-muted-foreground">({hint})</span>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
