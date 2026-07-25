import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, RotateCcw, Save, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import {
  createPrintTemplate,
  deletePrintTemplate,
  duplicatePrintTemplate,
  listPrintTemplates,
  previewPrintTemplate,
  setDefaultPrintTemplate,
  updatePrintTemplate,
  type PrintTemplate,
  type PrintTemplateInput,
  type PrintTemplatePreview,
} from "@/lib/print-templates-api";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";

export const Route = createFileRoute("/admin/settings/printing/templates")({
  component: PrintTemplatesPage,
});

const defaultTemplate: PrintTemplateInput = {
  organizationId: null,
  eventId: null,
  printerId: null,
  name: "Modelo padrao Defumar",
  templateType: "PRODUCTION",
  paperWidthMm: 80,
  logoUrl: null,
  logoEnabled: false,
  logoWidthPx: 240,
  title: "NOME DO EVENTO",
  subtitle: "FICHA DE PRODUCAO",
  showOrderNumber: true,
  showDate: true,
  showTime: true,
  showOrigin: true,
  showOperator: true,
  showCustomer: false,
  showSector: true,
  showObservations: true,
  itemFontSize: 2,
  titleFontSize: 2,
  quantityBold: true,
  footerText: null,
  copies: 1,
  feedLines: 4,
  autoCut: true,
  printMode: "FULL_ORDER",
  isDefault: true,
  isActive: true,
};

function PrintTemplatesPage() {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>("");
  const [form, setForm] = useState<PrintTemplateInput>(defaultTemplate);

  const templatesQuery = useQuery({
    queryKey: [...qk.settings.printing(orgId), "templates"],
    queryFn: () => listPrintTemplates(token!),
    enabled: !!token && !!orgId,
  });

  const templates = templatesQuery.data ?? [];
  const selected = templates.find((template) => template.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && templates[0]) setSelectedId(templates[0].id);
  }, [selectedId, templates]);

  useEffect(() => {
    if (selected) {
      const { id: _id, ...editable } = selected;
      setForm(editable);
    }
  }, [selected]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [...qk.settings.printing(orgId), "templates"] });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Sessao expirada.");
      return selected ? updatePrintTemplate(token, selected.id, form) : createPrintTemplate(token, form);
    },
    onSuccess: async (template) => {
      toast.success("Modelo salvo.");
      setSelectedId(template.id);
      await invalidate();
    },
    onError: (error) => handleApiError(error, "Nao foi possivel salvar o modelo."),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: { type: "duplicate" | "default" | "delete"; id: string }) => {
      if (!token) throw new Error("Sessao expirada.");
      if (action.type === "duplicate") return duplicatePrintTemplate(token, action.id);
      if (action.type === "default") return setDefaultPrintTemplate(token, action.id);
      await deletePrintTemplate(token, action.id);
      return null;
    },
    onSuccess: async (template) => {
      toast.success("Acao concluida.");
      if (template) setSelectedId(template.id);
      else setSelectedId("");
      await invalidate();
    },
    onError: (error) => handleApiError(error, "Nao foi possivel executar a acao."),
  });

  const newTemplate = () => {
    setSelectedId("");
    setForm({ ...defaultTemplate, isDefault: false, name: "Novo modelo de ficha" });
  };

  return (
    <AdminLayout
      title="Modelos de ficha"
      subtitle="Configure o layout das fichas termicas por organizacao, evento ou impressora."
      actions={<Button variant="outline" asChild><Link to="/admin/settings/printing">Voltar</Link></Button>}
    >
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Modelos
              <Button size="sm" onClick={newTemplate}>Novo</Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {templates.map((template) => (
              <button
                key={template.id}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${selectedId === template.id ? "border-primary bg-primary/5" : ""}`}
                onClick={() => setSelectedId(template.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{template.name}</span>
                  {template.isDefault ? <Star className="h-4 w-4 fill-current" /> : null}
                </div>
                <p className="text-xs text-muted-foreground">{template.templateType} - {template.paperWidthMm}mm - {template.isActive ? "ativo" : "inativo"}</p>
              </button>
            ))}
            {!templates.length ? <p className="text-sm text-muted-foreground">Nenhum modelo cadastrado.</p> : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <TemplateForm
            value={form}
            onChange={setForm}
            onSave={() => saveMutation.mutate()}
            onRestore={() => setForm(defaultTemplate)}
            saving={saveMutation.isPending}
            selected={selected}
            onDuplicate={() => selected && actionMutation.mutate({ type: "duplicate", id: selected.id })}
            onDefault={() => selected && actionMutation.mutate({ type: "default", id: selected.id })}
            onDelete={() => selected && actionMutation.mutate({ type: "delete", id: selected.id })}
          />
          <LivePreview token={token} template={form} />
        </div>
      </div>
    </AdminLayout>
  );
}

function TemplateForm({
  value,
  onChange,
  onSave,
  onRestore,
  saving,
  selected,
  onDuplicate,
  onDefault,
  onDelete,
}: {
  value: PrintTemplateInput;
  onChange: (value: PrintTemplateInput) => void;
  onSave: () => void;
  onRestore: () => void;
  saving: boolean;
  selected: PrintTemplate | null;
  onDuplicate: () => void;
  onDefault: () => void;
  onDelete: () => void;
}) {
  const patch = (next: Partial<PrintTemplateInput>) => onChange({ ...value, ...next });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editor</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general">
          <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="fields">Campos</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="grid gap-4 md:grid-cols-2">
            <Field label="Nome"><Input value={value.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
            <Field label="Tipo">
              <Select value={value.templateType} onValueChange={(x) => patch({ templateType: x as PrintTemplateInput["templateType"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PRODUCTION">Producao</SelectItem>
                  <SelectItem value="CUSTOMER">Cliente</SelectItem>
                  <SelectItem value="DELIVERY">Entrega</SelectItem>
                  <SelectItem value="CASHIER">Caixa</SelectItem>
                  <SelectItem value="TEST">Teste</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Papel">
              <Select value={String(value.paperWidthMm)} onValueChange={(x) => patch({ paperWidthMm: Number(x) as 58 | 80 })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="58">58 mm</SelectItem>
                  <SelectItem value="80">80 mm</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Modo">
              <Select value={value.printMode} onValueChange={(x) => patch({ printMode: x as PrintTemplateInput["printMode"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_ORDER">Pedido completo</SelectItem>
                  <SelectItem value="BY_SECTOR">Por setor</SelectItem>
                  <SelectItem value="ONE_TICKET_PER_ITEM">Uma ficha por item</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Titulo"><Input value={value.title ?? ""} onChange={(e) => patch({ title: e.target.value })} /></Field>
            <Field label="Subtitulo"><Input value={value.subtitle ?? ""} onChange={(e) => patch({ subtitle: e.target.value })} /></Field>
            <Field label="Rodape"><Input value={value.footerText ?? ""} onChange={(e) => patch({ footerText: e.target.value })} /></Field>
            <Field label="Logo URL"><Input value={value.logoUrl ?? ""} onChange={(e) => patch({ logoUrl: e.target.value || null })} /></Field>
          </TabsContent>
          <TabsContent value="fields" className="grid gap-3 md:grid-cols-2">
            {([
              ["showOrderNumber", "Numero do pedido"],
              ["showDate", "Data"],
              ["showTime", "Hora"],
              ["showOrigin", "Origem"],
              ["showOperator", "Operador"],
              ["showCustomer", "Cliente"],
              ["showSector", "Setor"],
              ["showObservations", "Observacoes"],
              ["logoEnabled", "Logo"],
              ["quantityBold", "Quantidade em negrito"],
              ["isDefault", "Padrao do escopo"],
              ["isActive", "Ativo"],
              ["autoCut", "Corte automatico"],
            ] as const).map(([key, label]) => (
              <Toggle key={key} label={label} checked={Boolean(value[key])} onChange={(checked) => patch({ [key]: checked })} />
            ))}
          </TabsContent>
          <TabsContent value="layout" className="grid gap-4 md:grid-cols-2">
            <Field label="Largura da logo"><Input type="number" value={value.logoWidthPx} onChange={(e) => patch({ logoWidthPx: Number(e.target.value) })} /></Field>
            <Field label="Fonte do titulo"><Input type="number" min={1} max={3} value={value.titleFontSize} onChange={(e) => patch({ titleFontSize: Number(e.target.value) })} /></Field>
            <Field label="Fonte dos itens"><Input type="number" min={1} max={3} value={value.itemFontSize} onChange={(e) => patch({ itemFontSize: Number(e.target.value) })} /></Field>
            <Field label="Copias"><Input type="number" min={1} max={5} value={value.copies} onChange={(e) => patch({ copies: Number(e.target.value) })} /></Field>
            <Field label="Avanco final"><Input type="number" min={0} max={10} value={value.feedLines} onChange={(e) => patch({ feedLines: Number(e.target.value) })} /></Field>
          </TabsContent>
        </Tabs>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={onSave} disabled={saving}><Save className="mr-2 h-4 w-4" />Salvar</Button>
          <Button variant="outline" onClick={onRestore}><RotateCcw className="mr-2 h-4 w-4" />Restaurar Defumar</Button>
          {selected ? <Button variant="outline" onClick={onDuplicate}><Copy className="mr-2 h-4 w-4" />Duplicar</Button> : null}
          {selected ? <Button variant="outline" onClick={onDefault}><Star className="mr-2 h-4 w-4" />Definir padrao</Button> : null}
          {selected ? <Button variant="destructive" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" />Excluir</Button> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function LivePreview({ token, template }: { token?: string | null; template: PrintTemplateInput }) {
  const previewQuery = useQuery({
    queryKey: ["print-template-preview", template],
    queryFn: () => previewPrintTemplate(token!, template),
    enabled: !!token,
  });
  const preview = previewQuery.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pre-visualizacao</CardTitle>
      </CardHeader>
      <CardContent>
        <ThermalPaper preview={preview} width={template.paperWidthMm} />
      </CardContent>
    </Card>
  );
}

function ThermalPaper({ preview, width }: { preview?: PrintTemplatePreview; width: 58 | 80 }) {
  const px = width === 58 ? 260 : 360;
  return (
    <div className="mx-auto bg-white p-4 font-mono text-xs text-black shadow" style={{ width: px }}>
      {(preview?.lines ?? []).map((line, index) => {
        if (line.type === "separator") return <div key={index} className="my-2 border-t border-dashed border-black" />;
        if (line.type === "blank") return <div key={index} className="h-3" />;
        if (line.type === "logo") return line.url ? <div key={index} className="text-center"><img src={line.url} className="inline-block max-w-full grayscale" style={{ width: line.widthPx }} /></div> : null;
        return (
          <div key={index} className={`${line.align === "center" ? "text-center" : line.align === "right" ? "text-right" : ""} ${line.bold ? "font-black" : ""} ${line.size === "large" ? "text-base" : ""} whitespace-pre-wrap`}>
            {line.text}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1.5"><Label>{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
