import { useEffect, useState } from "react";
import { Wrench, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ToggleRow } from "./shared-ui";

export interface OperationsForm {
  averagePreparationTimeInMinutes: number;
  lateOrderAlertMinutes: number;
  allowCancel: boolean;
  cancelMessage: string;
  notificationSound: "default" | "soft" | "alert" | "silent";
  autoHideDeliveredOrders: boolean;
  autoHideDeliveredAfterMinutes: number;
  defaultSector: "ALL" | "BAR" | "KITCHEN";
}

const DEFAULT_OPERATIONS: OperationsForm = {
  averagePreparationTimeInMinutes: 15,
  lateOrderAlertMinutes: 25,
  allowCancel: true,
  cancelMessage: "Pedido cancelado pelo operador.",
  notificationSound: "default",
  autoHideDeliveredOrders: false,
  autoHideDeliveredAfterMinutes: 10,
  defaultSector: "ALL",
};

const OPERATIONS_KEY = (id: string) => `admin.settings.operations.event.${id}`;

const SOUND_LABELS: Record<OperationsForm["notificationSound"], string> = {
  default: "Padrão",
  soft: "Suave",
  alert: "Alerta",
  silent: "Silencioso",
};

const SECTOR_LABELS: Record<OperationsForm["defaultSector"], string> = {
  ALL: "Todos",
  BAR: "Bar",
  KITCHEN: "Cozinha",
};

export function OperationsCard({ eventId, disabled }: { eventId: string; disabled: boolean }) {
  const [form, setForm] = useState<OperationsForm>(DEFAULT_OPERATIONS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!eventId || typeof window === "undefined") {
      setForm(DEFAULT_OPERATIONS);
      setDirty(false);
      return;
    }
    try {
      const raw = window.localStorage.getItem(OPERATIONS_KEY(eventId));
      setForm(raw ? { ...DEFAULT_OPERATIONS, ...JSON.parse(raw) } : DEFAULT_OPERATIONS);
    } catch {
      setForm(DEFAULT_OPERATIONS);
    }
    setDirty(false);
  }, [eventId]);

  const update = <K extends keyof OperationsForm>(key: K, value: OperationsForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!eventId || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(OPERATIONS_KEY(eventId), JSON.stringify(form));
      setDirty(false);
      toast.success("Configurações operacionais salvas");
    } catch {
      toast.error("Falha ao salvar configurações operacionais");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Configurações Operacionais
          </CardTitle>
          <CardDescription>
            Defina SLAs, sons e comportamento operacional por evento.
          </CardDescription>
        </div>
        <Badge variant="secondary">Por evento</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {disabled ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Selecione um evento para configurar a operação.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="op-prep">Tempo médio de preparo (min)</Label>
                  <Input
                    id="op-prep"
                    type="number"
                    min={1}
                    max={240}
                    value={form.averagePreparationTimeInMinutes}
                    onChange={(e) => update("averagePreparationTimeInMinutes", Math.max(1, Number(e.target.value) || 0))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="op-delay">Alerta de atraso (min)</Label>
                  <Input
                    id="op-delay"
                    type="number"
                    min={1}
                    max={240}
                    value={form.lateOrderAlertMinutes}
                    onChange={(e) => update("lateOrderAlertMinutes", Math.max(1, Number(e.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <ToggleRow
                  label="Permitir cancelar pedidos"
                  checked={form.allowCancel}
                  onChange={(v) => update("allowCancel", v)}
                />
                <ToggleRow
                  label="Ocultar pedidos entregues automaticamente"
                  checked={form.autoHideDeliveredOrders}
                  onChange={(v) => update("autoHideDeliveredOrders", v)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="op-cancel-msg">Mensagem padrão de cancelamento</Label>
                <Textarea
                  id="op-cancel-msg"
                  rows={2}
                  value={form.cancelMessage}
                  onChange={(e) => update("cancelMessage", e.target.value)}
                  disabled={!form.allowCancel}
                  placeholder="Mensagem exibida ao cancelar um pedido"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Som de notificação do painel</Label>
                  <Select
                    value={form.notificationSound}
                    onValueChange={(v) =>
                      update("notificationSound", v as OperationsForm["notificationSound"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SOUND_LABELS) as OperationsForm["notificationSound"][]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {SOUND_LABELS[k]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="op-hide">Tempo para ocultar entregues (min)</Label>
                  <Input
                    id="op-hide"
                    type="number"
                    min={1}
                    max={240}
                    value={form.autoHideDeliveredAfterMinutes}
                    onChange={(e) =>
                      update("autoHideDeliveredAfterMinutes", Math.max(1, Number(e.target.value) || 0))
                    }
                    disabled={!form.autoHideDeliveredOrders}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Setor padrão do operador</Label>
                <Select
                  value={form.defaultSector}
                  onValueChange={(v) =>
                    update("defaultSector", v as OperationsForm["defaultSector"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SECTOR_LABELS) as OperationsForm["defaultSector"][]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {SECTOR_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={!dirty}>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar operacional
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Preview operacional</Label>
              <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tempo médio</span>
                  <span className="font-medium">{form.averagePreparationTimeInMinutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alerta de atraso</span>
                  <span className="font-medium">{form.lateOrderAlertMinutes} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Som ativo</span>
                  <span className="font-medium">{SOUND_LABELS[form.notificationSound]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ocultação automática</span>
                  <span className="font-medium">
                    {form.autoHideDeliveredOrders ? `${form.autoHideDeliveredAfterMinutes} min` : "Desativada"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Setor padrão</span>
                  <span className="font-medium">{SECTOR_LABELS[form.defaultSector]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cancelamento</span>
                  <Badge variant={form.allowCancel ? "default" : "secondary"}>
                    {form.allowCancel ? "Permitido" : "Bloqueado"}
                  </Badge>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Salvo localmente neste navegador por evento.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
