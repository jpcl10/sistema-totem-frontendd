import { Printer, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintersManager } from "@/components/PrintersManager";
import { ToggleRow } from "./shared-ui";

// Minimal shape of the parent TotemForm used by this card
export interface PrintingFormFields {
  printingEnabled: boolean;
  autoPrintEnabled: boolean;
  printMode: "FULL_ORDER" | "BY_SECTOR" | "BOTH";
  printerPaperSize: "58mm" | "80mm";
}

const PRINT_MODE_LABELS: Record<PrintingFormFields["printMode"], string> = {
  FULL_ORDER: "Pedido completo",
  BY_SECTOR: "Separado por setor",
  BOTH: "Ambos",
};

const PRINT_MODE_HELP: Record<PrintingFormFields["printMode"], string> = {
  FULL_ORDER: "Imprime todos os itens juntos em uma única comanda.",
  BY_SECTOR: "Imprime uma comanda separada para cada setor presente no pedido (BAR, COZINHA).",
  BOTH: "Imprime a comanda completa + uma comanda por setor.",
};

export function PrintingCard<T extends PrintingFormFields>({
  eventId,
  loading,
  form,
  update,
  eventName,
}: {
  eventId: string;
  loading: boolean;
  form: T;
  update: <K extends keyof T>(key: K, value: T[K]) => void;
  eventName: string;
}) {
  const paperWidth = form.printerPaperSize === "58mm" ? 220 : 300;
  const cols = form.printerPaperSize === "58mm" ? 32 : 48;

  const sampleItems = [
    { name: "Chopp Pilsen 300ml", qty: 2, sector: "BAR" },
    { name: "Caipirinha de Limão", qty: 1, sector: "BAR" },
    { name: "Porção de Batata Frita", qty: 1, sector: "COZINHA" },
    { name: "X-Burger", qty: 1, sector: "COZINHA" },
  ];

  const renderReceipt = (title: string, items: typeof sampleItems) => (
    <div
      className="bg-white text-black shadow-sm"
      style={{
        width: paperWidth,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
        lineHeight: 1.35,
        padding: 10,
        border: "1px dashed #000",
      }}
    >
      <div className="text-center font-bold uppercase">{eventName}</div>
      <div className="text-center font-bold">── {title} ──</div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div>Pedido: <b>#0123</b></div>
      <div>Cliente: João</div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      {items.map((it, i) => (
        <div key={i}><b>{it.qty}x</b> {it.name}</div>
      ))}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div className="text-center" style={{ fontSize: 9, opacity: 0.6 }}>
        {cols} cols · {form.printerPaperSize}
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            Configurações de Impressão
          </CardTitle>
          <CardDescription>
            Defina como as comandas serão impressas para este evento.
          </CardDescription>
        </div>
        <Badge variant="secondary">Por evento</Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {!eventId ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Selecione um evento para configurar a impressão.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border p-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Carregando configurações...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="space-y-4">
              <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                <ToggleRow
                  label="Ativar impressão"
                  description="Habilita o sistema de impressão de comandas neste evento."
                  checked={form.printingEnabled}
                  onChange={(v) => update("printingEnabled" as keyof T, v as T[keyof T])}
                />
                <ToggleRow
                  label="Impressão automática"
                  description="Envia automaticamente para a impressora quando o pedido é confirmado."
                  checked={form.autoPrintEnabled}
                  onChange={(v) => update("autoPrintEnabled" as keyof T, v as T[keyof T])}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Modo de impressão</Label>
                  <Select
                    value={form.printMode}
                    onValueChange={(v) => update("printMode" as keyof T, v as T[keyof T])}
                    disabled={!form.printingEnabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_ORDER">Pedido completo</SelectItem>
                      <SelectItem value="BY_SECTOR">Separado por setor</SelectItem>
                      <SelectItem value="BOTH">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamanho do papel</Label>
                  <Select
                    value={form.printerPaperSize}
                    onValueChange={(v) => update("printerPaperSize" as keyof T, v as T[keyof T])}
                    disabled={!form.printingEnabled}
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

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-xs">
                <p className="font-medium text-foreground">Como cada modo funciona:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li><b>Pedido completo:</b> imprime todos os itens juntos em uma única comanda.</li>
                  <li><b>Separado por setor:</b> imprime uma comanda por setor existente no pedido (Bar, Cozinha).</li>
                  <li><b>Ambos:</b> imprime a comanda completa + comandas por setor.</li>
                </ul>
                <p className="pt-2 text-foreground">
                  Selecionado: <b>{PRINT_MODE_LABELS[form.printMode]}</b> — {PRINT_MODE_HELP[form.printMode]}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Pré-visualização ({form.printerPaperSize})</Label>
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 max-h-[520px] overflow-y-auto">
                {form.printMode === "FULL_ORDER" && renderReceipt("COMANDA COMPLETA", sampleItems)}
                {form.printMode === "BY_SECTOR" && (
                  <>
                    {renderReceipt("COMANDA BAR", sampleItems.filter((i) => i.sector === "BAR"))}
                    {renderReceipt("COMANDA COZINHA", sampleItems.filter((i) => i.sector === "COZINHA"))}
                  </>
                )}
                {form.printMode === "BOTH" && (
                  <>
                    {renderReceipt("COMANDA COMPLETA", sampleItems)}
                    {renderReceipt("COMANDA BAR", sampleItems.filter((i) => i.sector === "BAR"))}
                    {renderReceipt("COMANDA COZINHA", sampleItems.filter((i) => i.sector === "COZINHA"))}
                  </>
                )}
              </div>
              {!form.printingEnabled && (
                <p className="text-xs text-muted-foreground">
                  Impressão desativada — nenhuma comanda será emitida.
                </p>
              )}
            </div>
          </div>
        )}

        {eventId && !loading && (
          <>
            <Separator />
            <PrintersManager eventId={eventId} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
