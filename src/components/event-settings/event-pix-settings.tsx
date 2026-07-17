import { useCallback, useEffect, useState } from "react";
import { Save, Loader2, QrCode } from "lucide-react";
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
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { getEvent, updateEvent, type EventItem } from "@/lib/events-api";
import { handleApiError } from "@/lib/api-error";

interface Props {
  eventId: string;
}

interface PixForm {
  pixEnabled: boolean;
  pixKey: string;
  pixReceiverName: string;
  pixInstructions: string;
}

const DEFAULTS: PixForm = {
  pixEnabled: false,
  pixKey: "",
  pixReceiverName: "",
  pixInstructions: "",
};

function fromEvent(ev: EventItem): PixForm {
  return {
    pixEnabled: ev.pixEnabled ?? DEFAULTS.pixEnabled,
    pixKey: ev.pixKey ?? "",
    pixReceiverName: ev.pixReceiverName ?? "",
    pixInstructions: ev.pixInstructions ?? "",
  };
}

export function EventPixSettings({ eventId }: Props) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PixForm>(DEFAULTS);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    try {
      const ev = await getEvent(token, eventId);
      setForm(fromEvent(ev));
      setDirty(false);
    } catch (err) {
      handleApiError(err, "Não foi possível carregar as configurações de PIX.");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = <K extends keyof PixForm>(key: K, value: PixForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!token || !eventId) return;
    setSaving(true);
    try {
      await updateEvent(token, eventId, {
        pixEnabled: form.pixEnabled,
        pixKey: form.pixKey || undefined,
        pixReceiverName: form.pixReceiverName || undefined,
        pixInstructions: form.pixInstructions || undefined,
      } as Partial<EventItem>);
      toast.success("PIX Manual salvo com sucesso!");
      setDirty(false);
      await load();
    } catch (err) {
      handleApiError(err, "Falha ao salvar PIX Manual.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            PIX Manual do Evento
          </CardTitle>
          <CardDescription>
            Configure o pagamento via PIX manual exibido no checkout deste evento.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!dirty || saving || loading}
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
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando configurações...
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Habilitar PIX manual</p>
                <p className="text-xs text-muted-foreground">
                  Exibe QR Code e instruções de pagamento no checkout.
                </p>
              </div>
              <Switch
                checked={form.pixEnabled}
                onCheckedChange={(v) => update("pixEnabled", v)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-pix-key">Chave PIX</Label>
                <Input
                  id="event-pix-key"
                  value={form.pixKey}
                  onChange={(e) => update("pixKey", e.target.value)}
                  placeholder="CPF, CNPJ, e-mail, celular ou chave aleatória"
                  disabled={!form.pixEnabled}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-pix-name">Nome do recebedor</Label>
                <Input
                  id="event-pix-name"
                  value={form.pixReceiverName}
                  onChange={(e) => update("pixReceiverName", e.target.value)}
                  placeholder="Nome que aparece no QR Code"
                  disabled={!form.pixEnabled}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-pix-instructions">Instruções de pagamento</Label>
              <Textarea
                id="event-pix-instructions"
                rows={2}
                value={form.pixInstructions}
                onChange={(e) => update("pixInstructions", e.target.value)}
                placeholder="Ex.: Após pagar, mostre o comprovante no balcão."
                disabled={!form.pixEnabled}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
