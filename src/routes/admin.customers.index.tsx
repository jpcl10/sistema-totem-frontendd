import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Pencil,
  Power,
  PowerOff,
  Filter,
  Tags,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { handleApiError } from "@/lib/api-error";
import { PageLoading, PageEmpty } from "@/components/admin/page";
import {
  CUSTOMER_SOURCE_LABEL,
  createCustomer,
  createInterest,
  listCustomers,
  listInterests,
  setCustomerStatus,
  setInterestStatus,
  updateCustomer,
  updateInterest,
  type Customer,
  type CustomerSource,
  type Interest,
  type ListCustomersParams,
} from "@/lib/customers-api";

export const Route = createFileRoute("/admin/customers/")({
  head: () => ({
    meta: [
      { title: "Clientes — Defumar" },
      { name: "description", content: "Gestão central de clientes." },
    ],
  }),
  component: CustomersPage,
});

function SourceBadge({ source }: { source: CustomerSource | null }) {
  if (!source) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <Badge variant="secondary" className="font-normal">
      {CUSTOMER_SOURCE_LABEL[source] ?? source}
    </Badge>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

function CustomersPage() {
  const { token, user } = useAuth();
  const { organizationId: impersonatedOrgId, isSuperAdmin } = useOrganization();
  const orgId = isSuperAdmin ? impersonatedOrgId : user?.organizationId ?? null;

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("all");
  const [interestFilter, setInterestFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [interests, setInterests] = useState<Interest[]>([]);
  const [interestsDialogOpen, setInterestsDialogOpen] = useState(false);

  const [creating, setCreating] = useState(false);


  const canQuery = Boolean(token && orgId);

  const params: ListCustomersParams = useMemo(
    () => ({
      search: search.trim() || undefined,
      active: activeFilter === "all" ? undefined : activeFilter === "true",
      interestId: interestFilter === "all" ? undefined : interestFilter,
      page,
      limit,
      sortBy: "createdAt",
      sortOrder: "desc",
    }),
    [search, activeFilter, interestFilter, page, limit],
  );

  const load = async () => {
    if (!token || !canQuery) return;
    setLoading(true);
    setErr(null);
    try {
      const [c, i] = await Promise.all([
        listCustomers(token, params),
        interests.length === 0 ? listInterests(token, { limit: 100 }) : Promise.resolve(interests),
      ]);
      setCustomers(c.data);
      setTotal(c.pagination.total);
      setTotalPages(c.pagination.totalPages);
      if (interests.length === 0) setInterests(i);
    } catch (e) {
      setErr(handleApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canQuery) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, orgId, page, activeFilter, interestFilter]);

  // debounce search
  useEffect(() => {
    if (!canQuery) return;
    const h = setTimeout(() => {
      setPage(1);
      void load();
    }, 350);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const refreshInterests = async () => {
    if (!token) return;
    try {
      setInterests(await listInterests(token, { limit: 100 }));
    } catch (e) {
      handleApiError(e);
    }
  };




  if (!token) {
    return (
      <AdminLayout title="Clientes">
        <PageLoading label="Carregando sessão…" variant="spinner" />
      </AdminLayout>
    );
  }

  if (!orgId) {
    return (
      <AdminLayout title="Clientes">
        <PageEmpty
          icon={AlertCircle}
          title="Contexto de organização necessário"
          description="Selecione uma organização (impersonação) para acessar os clientes."
        />
      </AdminLayout>
    );
  }



  return (
    <AdminLayout
      title="Clientes"
      subtitle="Base central de clientes da organização"
      actions={
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setInterestsDialogOpen(true)}
          >
            <Tags className="mr-1.5 h-4 w-4" /> Interesses
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo cliente
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="min-w-[220px] flex-1">
              <Label className="text-xs">Buscar</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome, telefone, e-mail, documento…"
                />
              </div>
            </div>
            <div className="w-[160px]">
              <Label className="text-xs">Status</Label>
              <Select
                value={activeFilter}
                onValueChange={(v: "all" | "true" | "false") => {
                  setActiveFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="true">Ativos</SelectItem>
                  <SelectItem value="false">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[200px]">
              <Label className="text-xs">Interesse</Label>
              <Select
                value={interestFilter}
                onValueChange={(v) => {
                  setInterestFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {interests.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              <Filter className="mr-1 inline h-3 w-3" />
              {total} {total === 1 ? "cliente" : "clientes"}
            </div>
          </CardContent>
        </Card>

        {err && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> {err}
          </div>
        )}

        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Últ. origem</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && customers.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      <Users className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        {c.document && (
                          <div className="text-xs text-muted-foreground">{c.document}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{c.phone ?? <span className="text-muted-foreground">—</span>}</div>
                        <div className="text-xs text-muted-foreground">{c.email ?? ""}</div>
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={c.firstSource} />
                      </TableCell>
                      <TableCell>
                        <SourceBadge source={c.lastSource} />
                      </TableCell>
                      <TableCell className="text-sm">{fmtDate(c.createdAt)}</TableCell>
                      <TableCell>
                        {c.active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Button asChild size="sm" variant="outline">
                            <Link
                              to="/admin/customers/$id"
                              params={{ id: c.id }}
                              aria-label={`Abrir ${c.name}`}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              Abrir
                            </Link>
                          </Button>
                        </div>

                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between border-t p-3 text-sm">
            <div className="text-muted-foreground">
              Página {page} de {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <CustomerFormDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={() => {
          setCreating(false);
          void load();
        }}
      />



      <InterestsDialog
        open={interestsDialogOpen}
        onOpenChange={setInterestsDialogOpen}
        interests={interests}
        onChanged={refreshInterests}
      />
    </AdminLayout>
  );
}

/* ============ Customer Form ============ */

function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customer?: Customer | null;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const editing = !!customer;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(customer?.name ?? "");
      setPhone(customer?.phone ?? "");
      setEmail(customer?.email ?? "");
      setDocument(customer?.document ?? "");
      setBirthDate(customer?.birthDate ? customer.birthDate.slice(0, 10) : "");
      setNotes(customer?.notes ?? "");
      setActive(customer?.active ?? true);
    }
  }, [open, customer]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        document: document.trim() || null,
        birthDate: birthDate || null,
        notes: notes.trim() || null,
        active,
      };
      if (editing && customer) {
        await updateCustomer(token, customer.id, payload);
        toast.success("Cliente atualizado");
      } else {
        await createCustomer(token, payload);
        toast.success("Cliente criado");
      }
      onSaved();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            Dados básicos do cliente. Endereços e interesses são gerenciados na tela de detalhe.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label htmlFor="c-name">Nome</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-phone">Telefone</Label>
              <Input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c-email">E-mail</Label>
              <Input
                id="c-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-doc">Documento</Label>
              <Input id="c-doc" value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c-birth">Nascimento</Label>
              <Input
                id="c-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="c-notes">Observações</Label>
            <Textarea
              id="c-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="c-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="c-active" className="cursor-pointer">
              Ativo
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ============ Interests Manager ============ */

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function InterestsDialog({
  open,
  onOpenChange,
  interests,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  interests: Interest[];
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setKey("");
      setEditingId(null);
    }
  }, [open]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateInterest(token, editingId, {
          name: name.trim(),
          key: key.trim() || slugify(name),
        });
        toast.success("Interesse atualizado");
      } else {
        await createInterest(token, {
          name: name.trim(),
          key: key.trim() || slugify(name),
          active: true,
        });
        toast.success("Interesse criado");
      }
      setName("");
      setKey("");
      setEditingId(null);
      onChanged();
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (i: Interest) => {
    if (!token) return;
    try {
      await setInterestStatus(token, i.id, !i.active);
      onChanged();
    } catch (err) {
      handleApiError(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerenciar interesses</DialogTitle>
          <DialogDescription>
            Interesses são usados para segmentar clientes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Nome"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!editingId) setKey(slugify(e.target.value));
            }}
            required
          />
          <Input placeholder="chave" value={key} onChange={(e) => setKey(e.target.value)} />
          <Button type="submit" disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingId ? (
              "Salvar"
            ) : (
              "Adicionar"
            )}
          </Button>
        </form>

        <div className="max-h-[300px] space-y-1 overflow-y-auto">
          {interests.length === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Nenhum interesse cadastrado.
            </div>
          )}
          {interests.map((i) => (
            <div
              key={i.id}
              className="flex items-center gap-2 rounded border p-2 text-sm"
            >
              <div className="flex-1">
                <div className="font-medium">{i.name}</div>
                <div className="text-xs text-muted-foreground">{i.key}</div>
              </div>
              {!i.active && <Badge variant="secondary">Inativo</Badge>}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingId(i.id);
                  setName(i.name);
                  setKey(i.key);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggle(i)}>
                {i.active ? (
                  <PowerOff className="h-3.5 w-3.5" />
                ) : (
                  <Power className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
