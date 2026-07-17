import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Star,
  Tags,
  Trash2,
  User,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { PageLoading, PageError } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { handleApiError } from "@/lib/api-error";
import {
  CUSTOMER_SOURCE_LABEL,
  attachCustomerInterest,
  createCustomerAddress,
  detachCustomerInterest,
  getCustomer,
  listInterests,
  setCustomerAddressStatus,
  setCustomerStatus,
  updateCustomer,
  updateCustomerAddress,
  type CustomerAddress,
  type CustomerDetail,
  type CustomerSource,
  type Interest,
} from "@/lib/customers-api";
import { Info, StatCard } from "@/components/admin/customers/customer-info";
import { EditCustomerDialog } from "@/components/admin/customers/edit-customer-dialog";
import { AddressDialog } from "@/components/admin/customers/address-dialog";
import { InterestsSection } from "@/components/admin/customers/interests-section";

export const Route = createFileRoute("/admin/customers/$id")({
  head: () => ({
    meta: [{ title: "Cliente — Defumar" }],
  }),
  component: CustomerDetailPage,
});

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function fmtMoney(cents: number | undefined | null): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function sourceLabel(s: CustomerSource | null | undefined): string {
  if (!s) return "—";
  return CUSTOMER_SOURCE_LABEL[s] ?? s;
}

function CustomerDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const { organizationId: impersonatedOrgId, isSuperAdmin } = useOrganization();
  const orgId = isSuperAdmin ? impersonatedOrgId : user?.organizationId ?? null;

  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [interests, setInterests] = useState<Interest[]>([]);

  const [editingCustomer, setEditingCustomer] = useState(false);
  const [addrEditing, setAddrEditing] = useState<CustomerAddress | null>(null);
  const [addrCreating, setAddrCreating] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setErr(null);
    try {
      const [c, i] = await Promise.all([
        getCustomer(token, id),
        listInterests(token, { limit: 100, active: true }),
      ]);
      setData(c);
      setInterests(i);
    } catch (e) {
      setErr(handleApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token, orgId]);

  if (!token || !orgId) {
    return (
      <AdminLayout title="Cliente">
        <PageLoading label="Carregando sessão…" variant="spinner" />
      </AdminLayout>
    );
  }

  if (loading) {
    return (
      <AdminLayout title="Cliente">
        <PageLoading rows={5} />
      </AdminLayout>
    );
  }

  if (err || !data) {
    return (
      <AdminLayout title="Cliente">
        <PageError
          title="Cliente indisponível"
          message={err ?? "Cliente não encontrado."}
          onRetry={() => void load()}
        />
        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/admin/customers" })}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
      </AdminLayout>
    );
  }


  const c = data;

  const toggleActive = async () => {
    if (!token) return;
    try {
      await setCustomerStatus(token, c.id, !c.active);
      toast.success(c.active ? "Cliente inativado" : "Cliente reativado");
      void load();
    } catch (e) {
      toast.error(handleApiError(e));
    }
  };

  const summary = c.summary ?? ({} as CustomerDetail["summary"]);
  const totalOrders = summary.totalOrders ?? summary.totalOrdersCount ?? 0;
  const totalOnline = summary.totalOnlineOrders ?? summary.onlineOrdersCount ?? 0;
  const totalEvent = summary.totalEventOrders ?? summary.eventOrdersCount ?? 0;
  const totalSpent = summary.totalSpent ?? summary.totalSpentInCents ?? 0;

  return (
    <AdminLayout
      title={c.name}
      subtitle={c.active ? "Cliente ativo" : "Cliente inativo"}
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/customers">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditingCustomer(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </Button>
          <Button size="sm" variant={c.active ? "outline" : "default"} onClick={toggleActive}>
            {c.active ? (
              <>
                <PowerOff className="mr-1.5 h-4 w-4" /> Inativar
              </>
            ) : (
              <>
                <Power className="mr-1.5 h-4 w-4" /> Reativar
              </>
            )}
          </Button>
        </div>
      }
    >
      {/* Resumo (Parte 3): sempre visível acima das abas, valores vindos da API. */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total de pedidos" value={String(totalOrders)} />
        <StatCard label="Total gasto" value={fmtMoney(totalSpent)} />
        <StatCard label="Ticket médio" value={fmtMoney(summary.averageTicket)} />
        <StatCard label="Último pedido" value={fmtDate(summary.lastOrderAt)} />
        <StatCard label="Cliente desde" value={fmtDate(c.createdAt)} />
        <StatCard label="Última origem" value={sourceLabel(summary.lastOrderSource)} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex w-full flex-wrap">
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="addresses">Endereços ({c.addresses.length})</TabsTrigger>
          <TabsTrigger value="orders">Pedidos</TabsTrigger>
          <TabsTrigger value="interests">Interesses ({c.interests.length})</TabsTrigger>
          <TabsTrigger value="communication">Comunicação</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>


        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" /> Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Info label="Telefone" value={c.phone} />
                <Info label="E-mail" value={c.email} />
                <Info label="Documento" value={c.document} />
                <Info
                  label="Nascimento"
                  value={c.birthDate ? new Date(c.birthDate).toLocaleDateString("pt-BR") : null}
                />
                <Info label="Observações" value={c.notes} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Info label="Pedidos" value={String(totalOrders)} />
                <Info label="Online" value={String(totalOnline)} />
                <Info label="Eventos" value={String(totalEvent)} />
                <Info label="Ticket médio" value={fmtMoney(summary.averageTicket)} />
                <Info label="Total gasto" value={fmtMoney(totalSpent)} />
                <Info label="Último pedido" value={fmtDate(summary.lastOrderAt)} />
                <Info label="Últ. canal" value={sourceLabel(summary.lastOrderSource)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Origem</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Info label="Primeira" value={sourceLabel(c.firstSource)} />
                <Info label="Última" value={sourceLabel(c.lastSource)} />
                <Info label="Primeiro contato" value={fmtDate(c.firstSeenAt)} />
                <Info label="Último contato" value={fmtDate(c.lastSeenAt)} />
                <Info label="Criado em" value={fmtDate(c.createdAt)} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setAddrCreating(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo endereço
            </Button>
          </div>
          {c.addresses.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <MapPin className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Nenhum endereço cadastrado.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {c.addresses.map((a) => (
                <Card key={a.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{a.label ?? "Endereço"}</span>
                        {a.isDefault && (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                            <Star className="mr-1 h-3 w-3" /> Padrão
                          </Badge>
                        )}
                        {!a.active && <Badge variant="secondary">Inativo</Badge>}
                      </div>
                      <div className="text-muted-foreground">
                        {a.street}
                        {a.number ? `, ${a.number}` : ""}
                        {a.complement ? ` — ${a.complement}` : ""}
                      </div>
                      <div className="text-muted-foreground">
                        {[a.neighborhood, a.city, a.state].filter(Boolean).join(" — ")}
                        {a.postalCode ? ` · ${a.postalCode}` : ""}
                      </div>
                      {a.reference && (
                        <div className="text-xs text-muted-foreground">Ref.: {a.reference}</div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setAddrEditing(a)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await setCustomerAddressStatus(token, c.id, a.id, !a.active);
                            void load();
                          } catch (e) {
                            toast.error(handleApiError(e));
                          }
                        }}
                      >
                        {a.active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="interests" className="space-y-3">
          <InterestsSection
            customerId={c.id}
            linked={c.interests
              .map((l) => l.interest ?? interests.find((i) => i.id === l.interestId))
              .filter((x): x is Interest => !!x)}
            available={interests}
            onChanged={load}
          />
        </TabsContent>

        {/* Pedidos (Parte 6): sem endpoint dedicado ainda; mostra o resumo real da API. */}
        <TabsContent value="orders" className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total" value={String(totalOrders)} />
            <StatCard label="Online" value={String(totalOnline)} />
            <StatCard label="Eventos" value={String(totalEvent)} />
            <StatCard label="Comandas ativas" value={String(summary.activeTabs ?? 0)} />
          </div>
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Histórico detalhado de pedidos será disponibilizado em uma
              próxima etapa.
              {/* TODO: consumir endpoint dedicado de pedidos por cliente
                  quando o backend expuser (não criar mock aqui). */}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comunicação (Parte 8): sem estrutura de preferências no backend ainda. */}
        <TabsContent value="communication" className="space-y-3">
          <Card>
            <CardContent className="space-y-3 p-4 text-sm">
              <p className="text-muted-foreground">
                Preferências de comunicação serão habilitadas após a
                integração do WhatsApp e a definição do consentimento.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Info label="Telefone" value={c.phone} />
                <Info label="E-mail" value={c.email} />
                <Info
                  label="Status do cliente"
                  value={c.active ? "Ativo" : "Inativo"}
                />
              </div>
              {/* TODO(whatsapp): quando existirem campos persistidos de
                  consentimento/preferências, substituir este bloco por
                  toggles reais consumindo o contrato oficial. Não usar
                  localStorage nem Interest como preferência. */}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Timeline (Parte 9): apenas eventos reais do DTO. */}
        <TabsContent value="timeline" className="space-y-3">
          <Card>
            <CardContent className="p-4">
              <ol className="space-y-3 border-l border-border pl-4 text-sm">
                {c.createdAt && (
                  <li>
                    <div className="font-medium">Cliente cadastrado</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(c.createdAt)} · {sourceLabel(c.firstSource)}
                    </div>
                  </li>
                )}
                {c.firstSeenAt && c.firstSeenAt !== c.createdAt && (
                  <li>
                    <div className="font-medium">Primeiro contato</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(c.firstSeenAt)}
                    </div>
                  </li>
                )}
                {summary.lastOrderAt && (
                  <li>
                    <div className="font-medium">Último pedido</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(summary.lastOrderAt)} ·{" "}
                      {sourceLabel(summary.lastOrderSource)}
                    </div>
                  </li>
                )}
                {c.lastSeenAt && c.lastSeenAt !== summary.lastOrderAt && (
                  <li>
                    <div className="font-medium">Última interação</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(c.lastSeenAt)}
                    </div>
                  </li>
                )}
                {!c.createdAt &&
                  !c.firstSeenAt &&
                  !summary.lastOrderAt &&
                  !c.lastSeenAt && (
                    <li className="text-muted-foreground">
                      Sem eventos disponíveis para este cliente.
                    </li>
                  )}
              </ol>
              {/* TODO: expandir com criação/atualização de endereço, mudança
                  de status e outros eventos quando o backend expuser um
                  stream de auditoria por cliente. */}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


      <EditCustomerDialog
        open={editingCustomer}
        onOpenChange={setEditingCustomer}
        customer={c}
        onSaved={() => {
          setEditingCustomer(false);
          void load();
        }}
      />
      <AddressDialog
        open={addrCreating}
        onOpenChange={setAddrCreating}
        customerId={c.id}
        onSaved={() => {
          setAddrCreating(false);
          void load();
        }}
      />
      <AddressDialog
        open={!!addrEditing}
        onOpenChange={(o) => !o && setAddrEditing(null)}
        customerId={c.id}
        address={addrEditing}
        onSaved={() => {
          setAddrEditing(null);
          void load();
        }}
      />
    </AdminLayout>
  );
}

