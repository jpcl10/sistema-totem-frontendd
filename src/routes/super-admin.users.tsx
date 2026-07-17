import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, UsersRound, Search, RefreshCw } from "lucide-react";
import { SuperAdminLayout, AccessDenied, useIsSuperAdmin } from "@/components/super-admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { API_BASE_URL, authHeaders } from "@/lib/auth";
import { apiFetch, fromResponse } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/super-admin/users")({
  component: UsersPage,
  validateSearch: (s: Record<string, unknown>) => ({
    organizationId: typeof s.organizationId === "string" ? s.organizationId : undefined,
  }),
});

interface OrgRow {
  id: string;
  name: string;
  slug?: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR" | string;
  active?: boolean;
  organizationId?: string;
  organization?: { id?: string; name?: string };
  createdAt?: string;
}

interface FormState {
  id?: string;
  name: string;
  email: string;
  password: string;
  organizationId: string;
  role: "ADMIN" | "OPERATOR";
  active: boolean;
}

const emptyForm: FormState = {
  name: "",
  email: "",
  password: "",
  organizationId: "",
  role: "ADMIN",
  active: true,
};

function UsersPage() {
  const { loading: authLoading, isSuperAdmin } = useIsSuperAdmin();
  const { token } = useAuth();
  const search = useSearch({ from: "/super-admin/users" });
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState<string>(search.organizationId ?? "all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [oRes, uRes] = await Promise.all([
        apiFetch(`${API_BASE_URL}/super-admin/organizations`, { headers: authHeaders(token) }),
        apiFetch(`${API_BASE_URL}/super-admin/users`, { headers: authHeaders(token) }),
      ]);
      if (!oRes.ok) throw await fromResponse(oRes, "Erro ao carregar organizações.");
      if (!uRes.ok) throw await fromResponse(uRes, "Erro ao carregar usuários.");
      const oData = await oRes.json();
      const uData = await uRes.json();
      setOrgs(Array.isArray(oData) ? oData : oData.organizations ?? oData.data ?? []);
      setUsers(Array.isArray(uData) ? uData : uData.users ?? uData.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar dados.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, token]);

  const orgName = (id?: string) => orgs.find((o) => o.id === id)?.name || "—";

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const uOrg = u.organizationId ?? u.organization?.id;
        if (orgFilter !== "all" && uOrg !== orgFilter) return false;
        if (!query) return true;
        return [u.name, u.email, orgName(uOrg)].some((v) =>
          String(v ?? "").toLowerCase().includes(query.toLowerCase()),
        );
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, query, orgFilter, orgs],
  );

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) return <AccessDenied />;

  const openCreate = () => {
    setForm({
      ...emptyForm,
      organizationId: orgFilter !== "all" ? orgFilter : orgs[0]?.id ?? "",
    });
    setOpen(true);
  };

  const openEdit = (u: UserRow) => {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      password: "",
      organizationId: u.organizationId ?? u.organization?.id ?? "",
      role: (u.role as "ADMIN" | "OPERATOR") ?? "ADMIN",
      active: u.active !== false,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    if (!form.organizationId) {
      toast.error("Selecione uma organização");
      return;
    }
    if (!form.id && !form.password) {
      toast.error("Senha é obrigatória");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        organizationId: form.organizationId,
        role: form.role,
        active: form.active,
      };
      if (form.password) body.password = form.password;
      const url = form.id
        ? `${API_BASE_URL}/super-admin/users/${form.id}`
        : `${API_BASE_URL}/super-admin/users`;
      const res = await apiFetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await fromResponse(res, "Erro ao salvar usuário.");
      toast.success(form.id ? "Usuário atualizado" : "Usuário criado");
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (u: UserRow) => {
    if (!token) return;
    if (!confirm(`Remover ${u.name}?`)) return;
    try {
      const res = await apiFetch(`${API_BASE_URL}/super-admin/users/${u.id}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      if (!res.ok) throw await fromResponse(res, "Erro ao remover usuário.");
      toast.success("Usuário removido");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover.");
    }
  };

  return (
    <SuperAdminLayout
      title="Usuários"
      subtitle="Usuários administradores das organizações"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button onClick={openCreate} disabled={orgs.length === 0} className="gap-2">
            <Plus className="h-4 w-4" /> Novo usuário
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome, email ou organização"
              className="pl-9"
            />
          </div>
          <div className="min-w-[220px]">
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas as organizações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as organizações</SelectItem>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Organização</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Criado em</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    <UsersRound className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    Nenhum usuário encontrado
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-border/60 hover:bg-accent/30">
                    <td className="px-3 py-3 font-medium text-foreground">{u.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {u.organization?.name ?? orgName(u.organizationId)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-foreground">
                        {u.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.active !== false
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {u.active !== false ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {u.createdAt ? new Date(u.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(u)} aria-label="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => remove(u)}
                          className="text-destructive hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar usuário" : "Novo usuário"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Senha{" "}
                {form.id && (
                  <span className="text-xs text-muted-foreground">(deixe em branco para manter)</span>
                )}
              </Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organização</Label>
              <Select
                value={form.organizationId}
                onValueChange={(v) => setForm((f) => ({ ...f, organizationId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select
                value={form.role}
                onValueChange={(v: "ADMIN" | "OPERATOR") => setForm((f) => ({ ...f, role: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="OPERATOR">OPERATOR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <Label>Ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
