import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Printer as PrinterIcon, Send, Pencil, Check, X, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import {
  listPrinters,
  createPrinter,
  updatePrinter,
  testPrinter,
  type PrinterItem,
  type PrinterSector,
  type PrinterPaper,
  type PrinterConnectionType,
} from "@/lib/printers-api";

const EMPTY = {
  name: "",
  connectionType: "TCP_IP" as PrinterConnectionType,
  ipAddress: "",
  port: 9100,
  sector: "FULL_ORDER" as PrinterSector,
  paperSize: "80mm" as PrinterPaper,
  active: true,
};

function sectorLabel(s: PrinterSector) {
  return s === "BAR" ? "Bar" : s === "KITCHEN" ? "Cozinha" : "Todos os setores";
}

function connectionLabel(c: PrinterConnectionType) {
  return c === "SK210_LOCAL" ? "Totem SK210" : "Rede TCP/IP";
}

export function PrintersManager({ eventId }: { eventId: string }) {
  const { token } = useAuth();
  const [printers, setPrinters] = useState<PrinterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PrinterItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!token || !eventId) return;
    setLoading(true);
    try {
      const list = await listPrinters(token, eventId);
      setPrinters(list);
    } catch (e) {
      handleApiError(e, "Não foi possível carregar as impressoras.");
    } finally {
      setLoading(false);
    }
  }, [token, eventId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  };
  const openEdit = (p: PrinterItem) => {
    setEditing(p);
    setForm({
      name: p.name ?? "",
      connectionType: (p.connectionType ?? "TCP_IP") as PrinterConnectionType,
      ipAddress: (p.ipAddress ?? p.ip ?? "") as string,
      port: p.port ?? 9100,
      sector: p.sector ?? "FULL_ORDER",
      paperSize: p.paperSize ?? "80mm",
      active: p.active ?? true,
    });
    setCreating(true);
  };

  const handleSave = async () => {
    if (!token || !eventId) return;
    if (!form.name.trim()) {
      toast.error("Informe o nome da impressora.");
      return;
    }
    const isLocal = form.connectionType === "SK210_LOCAL";
    if (!isLocal && (!form.ipAddress.trim() || !form.port)) {
      toast.error("Informe IP e porta para impressoras TCP/IP.");
      return;
    }
    const payload = isLocal
      ? {
          name: "Impressora interna Totem SK210",
          sector: "FULL_ORDER" as const,
          connectionType: "SK210_LOCAL" as const,
          ipAddress: "local",
          port: 0,
          paperSize: form.paperSize,
          active: form.active,
        }
      : {
          name: form.name,
          sector: form.sector,
          connectionType: "TCP_IP" as const,
          ipAddress: form.ipAddress,
          port: form.port,
          paperSize: form.paperSize,
          active: form.active,
        };

    setSaving(true);
    try {
      if (editing) {
        await updatePrinter(token, editing.id, payload);
        toast.success("Impressora atualizada.");
      } else {
        await createPrinter(token, eventId, payload);
        toast.success("Impressora cadastrada.");
      }
      setCreating(false);
      await reload();
    } catch (e) {
      handleApiError(e, "Não foi possível salvar a impressora.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (p: PrinterItem, active: boolean) => {
    if (!token) return;
    try {
      await updatePrinter(token, p.id, { active });
      setPrinters((prev) => prev.map((x) => (x.id === p.id ? { ...x, active } : x)));
    } catch (e) {
      handleApiError(e, "Não foi possível atualizar o status.");
    }
  };

  const handleTest = async (p: PrinterItem) => {
    if (!token) return;
    setTestingId(p.id);
    try {
      await testPrinter(token, p.id);
      toast.success(`Teste enviado para ${p.name}.`);
    } catch (e) {
      handleApiError(e, "Falha ao enviar teste.");
    } finally {
      setTestingId(null);
    }
  };

  const isLocal = form.connectionType === "SK210_LOCAL";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium flex items-center gap-2">
            <PrinterIcon className="h-4 w-4 text-primary" /> Impressoras cadastradas
          </h4>
          <p className="text-xs text-muted-foreground">
            Gerencie as impressoras térmicas vinculadas a este evento.
          </p>
        </div>
        <Button size="sm" onClick={openCreate} disabled={!eventId}>
          <Plus className="h-4 w-4" /> Nova impressora
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : printers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma impressora cadastrada ainda.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Conexão</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((p) => {
                const ct = (p.connectionType ?? "TCP_IP") as PrinterConnectionType;
                const ip = (p.ipAddress ?? p.ip ?? "") as string;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {ct === "SK210_LOCAL" ? "Impressora interna Totem SK210" : p.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={ct === "SK210_LOCAL" ? "default" : "secondary"}>
                        {connectionLabel(ct)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ct === "SK210_LOCAL" ? (
                        <span className="text-muted-foreground font-sans">
                          Impressora interna do totem
                        </span>
                      ) : (
                        `${ip}:${p.port}`
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{sectorLabel(p.sector)}</Badge>
                    </TableCell>
                    <TableCell>{p.paperSize}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!p.active}
                          onCheckedChange={(v) => handleToggleActive(p, v)}
                        />
                        {p.active ? (
                          <span className="text-xs text-emerald-600 inline-flex items-center gap-1">
                            <Check className="h-3 w-3" /> Ativa
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <X className="h-3 w-3" /> Inativa
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTest(p)}
                          disabled={testingId === p.id || !p.active}
                        >
                          {testingId === p.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Imprimir teste
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={creating} onOpenChange={(o) => !o && setCreating(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar impressora" : "Nova impressora"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!isLocal && (
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Impressora Bar"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Tipo de conexão</Label>
              <Select
                value={form.connectionType}
                onValueChange={(v) => {
                  const next = v as PrinterConnectionType;
                  setForm((f) => ({
                    ...f,
                    connectionType: next,
                    ipAddress: next === "SK210_LOCAL" ? "local" : f.ipAddress === "local" ? "" : f.ipAddress,
                    port: next === "SK210_LOCAL" ? 0 : f.port || 9100,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TCP_IP">Impressora de rede TCP/IP</SelectItem>
                  <SelectItem value="SK210_LOCAL">Impressora interna do Totem SK210</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className={`grid ${isLocal ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
              {!isLocal && (
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Select
                    value={form.sector}
                    onValueChange={(v) => setForm({ ...form, sector: v as PrinterSector })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_ORDER">Todos os setores</SelectItem>
                      <SelectItem value="BAR">Bar</SelectItem>
                      <SelectItem value="KITCHEN">Cozinha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Papel</Label>
                <Select
                  value={form.paperSize}
                  onValueChange={(v) => setForm({ ...form, paperSize: v as PrinterPaper })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="58mm">58 mm</SelectItem>
                    <SelectItem value="80mm">80 mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLocal ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-2">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <p>
                    A impressora interna do Totem SK210 é usada para imprimir o comprovante do cliente. 
                    Ela será processada pelo app instalado no totem. Desative esta opção caso não queira imprimir comprovante no próprio totem.
                  </p>
                </div>
                <div className="pl-6 italic text-[10px]">
                  * O teste da impressora interna será executado pelo app Android do totem.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="space-y-1.5">
                  <Label>IP da impressora</Label>
                  <Input
                    value={form.ipAddress}
                    onChange={(e) => setForm({ ...form, ipAddress: e.target.value })}
                    placeholder="192.168.0.100"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Porta</Label>
                  <Input
                    type="number"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Ativa</p>
                <p className="text-xs text-muted-foreground">
                  Impressoras inativas não recebem comandas nem testes.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Cadastrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
