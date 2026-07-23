import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, LogIn, Loader2, Search, RefreshCw, Plus, Pencil, LayoutGrid } from "lucide-react";
import { SuperAdminLayout, AccessDenied, useIsSuperAdmin } from "@/components/super-admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { API_BASE_URL, authHeaders } from "@/lib/auth";
import { apiFetch, fromResponse, toFriendlyMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { PLATFORM_MODULES, type PlatformModule } from "@/lib/super-admin-store";
import { moduleLabel } from "@/lib/organization-modules";
import { qk } from "@/lib/query-keys";

export const Route = createFileRoute("/super-admin/organizations")({
  component: OrganizationsPage,
});

interface OrgRow {
  id: string;
  name: string;
  slug?: string;
  city?: string;
  whatsapp?: string;
  active?: boolean;
  createdAt?: string;
  modules?: unknown;
  usersCount?: number;
  users_count?: number;
  [k: string]: unknown;
}

interface OrgForm {
  id?: string;
  name: string;
  slug: string;
  city: string;
  whatsapp: string;
  active: boolean;
  modules: PlatformModule[];
}

const emptyForm: OrgForm = {
  name: "",
  slug: "",
  city: "",
  whatsapp: "",
  active: true,
  modules: [],
};

function normalizeModules(m: unknown): PlatformModule[] {
  const known = PLATFORM_MODULES as readonly string[];
  const out = new Set<PlatformModule>();
  if (Array.isArray(m)) {
    for (const it of m) {
      if (typeof it === "string" && known.includes(it)) out.add(it as PlatformModule);
      else if (it && typeof it === "object") {
        const o = it as { key?: string; name?: string; module?: string; moduleKey?: string; enabled?: boolean };
        if (o.enabled === false) continue;
        const k = o.moduleKey || o.key || o.name || o.module;
        if (k && known.includes(k)) out.add(k as PlatformModule);
      }
    }
  } else if (m && typeof m === "object") {
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) {
      if (!v) continue;
      if (known.includes(k)) out.add(k as PlatformModule);
    }
  }
  return Array.from(out);
}

function buildModulesPayload(modules: PlatformModule[]) {
  return {
    modules: PLATFORM_MODULES.map((moduleKey) => ({
      moduleKey,
      enabled: modules.includes(moduleKey),
    })),
  };
}

function unwrapOrgId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.id === "string") return obj.id;
  const organization = obj.organization as Record<string, unknown> | undefined;
  if (organization && typeof organization.id === "string") return organization.id;
  const nested = obj.data as Record<string, unknown> | undefined;
  if (nested && typeof nested.id === "string") return nested.id;
  return null;
}

function OrganizationsPage() {
  const { loading: authLoading, isSuperAdmin } = useIsSuperAdmin();
  const { token } = useAuth();
  const { switchOrganization, refreshOrganization, organizationId: activeOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [orgs, setOrgs] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [form, setForm] = useState<OrgForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await apiFetch(`${API_BASE_URL}/super-admin/organizations`, {
        headers: authHeaders(token),
      });
      if (!res.ok) throw await fromResponse(res, "Não foi possível carregar organizações.");
      const data = await res.json();
      const list: OrgRow[] = Array.isArray(data)
        ? data
        : data.organizations ?? data.data ?? data.items ?? [];
      setOrgs(list);
    } catch (err) {
      toast.error(toFriendlyMessage(err, "Não foi possível carregar as organizações."));
      setOrgs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, token]);

  const filtered = useMemo(
    () =>
      orgs.filter((o) =>
        !query
          ? true
          : [o.name, o.slug, o.city]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(query.toLowerCase())),
      ),
    [orgs, query],
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
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (o: OrgRow) => {
    setForm({
      id: o.id,
      name: o.name ?? "",
      slug: o.slug ?? "",
      city: o.city ?? "",
      whatsapp: (o.whatsapp as string) ?? "",
      active: o.active !== false,
      modules: normalizeModules(o.modules),
    });
    setFormOpen(true);
  };

  const openModules = (o: OrgRow) => {
    setForm({
      id: o.id,
      name: o.name ?? "",
      slug: o.slug ?? "",
      city: o.city ?? "",
      whatsapp: (o.whatsapp as string) ?? "",
      active: o.active !== false,
      modules: normalizeModules(o.modules),
    });
    setModulesOpen(true);
  };

  const submit = async () => {
    if (!token) return;
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error("Preencha o nome e o slug.");
      return;
    }
    setSaving(true);
    try {
      const modulesPayload = buildModulesPayload(form.modules);
      const body = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        city: form.city.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        active: form.active,
        modules: modulesPayload.modules,
      };
      const url = form.id
        ? `${API_BASE_URL}/super-admin/organizations/${form.id}`
        : `${API_BASE_URL}/super-admin/organizations`;
      const res = await apiFetch(url, {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...authHeaders(token) },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw await fromResponse(res, "Não foi possível salvar a organização.");
      const savedData = await res.json().catch(() => null);
      const savedOrgId = form.id ?? unwrapOrgId(savedData);
      if (savedOrgId) {
        const modulesRes = await apiFetch(
          `${API_BASE_URL}/super-admin/organizations/${savedOrgId}/modules`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json", ...authHeaders(token) },
            body: JSON.stringify(modulesPayload),
          },
        );
        if (!modulesRes.ok) throw await fromResponse(modulesRes, "Organização salva, mas não foi possível atualizar os módulos.");
      }
      toast.success(form.id ? "Organização atualizada" : "Organização criada");
      setFormOpen(false);
      await load();
      await invalidateOrgCaches(savedOrgId);
    } catch (err) {
      toast.error(toFriendlyMessage(err, "Não foi possível salvar a organização."));
    } finally {
      setSaving(false);
    }
  };

  const invalidateOrgCaches = async (savedOrgId: string | null | undefined) => {
    await queryClient.invalidateQueries({ queryKey: qk.superAdmin.organizations() });
    if (savedOrgId && savedOrgId === activeOrgId) {
      await queryClient.invalidateQueries({ queryKey: qk.organization.all() });
      await refreshOrganization();
    }
  };

  const submitModules = async () => {
    if (!token || !form.id) return;
    setSaving(true);
    try {
      const payload = buildModulesPayload(form.modules);
      const res = await apiFetch(
        `${API_BASE_URL}/super-admin/organizations/${form.id}/modules`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders(token) },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw await fromResponse(res, "Não foi possível atualizar módulos.");
      toast.success("Módulos atualizados");
      setModulesOpen(false);
      await load();
      await invalidateOrgCaches(form.id);
    } catch (err) {
      toast.error(toFriendlyMessage(err, "Não foi possível atualizar os módulos."));
    } finally {
      setSaving(false);
    }
  };

  const enterOrg = async (o: OrgRow) => {
    await switchOrganization({ id: o.id, name: o.name, slug: o.slug });
    toast.success(`Contexto: ${o.name}`);
    navigate({ to: "/admin/dashboard", search: { organizationId: o.id } as never });
  };

  const goUsers = (o: OrgRow) => {
    navigate({ to: "/super-admin/users", search: { organizationId: o.id } as never });
  };

  const moduleCount = (o: OrgRow) => normalizeModules(o.modules).length;
  const userCount = (o: OrgRow): number | string => {
    const c = o.usersCount ?? o.users_count;
    return typeof c === "number" ? c : "—";
  };

  const toggleModule = (m: PlatformModule) => {
    setForm((f) => ({
      ...f,
      modules: f.modules.includes(m) ? f.modules.filter((x) => x !== m) : [...f.modules, m],
    }));
  };

  return (
    <SuperAdminLayout
      title="Organizações"
      subtitle="Gerencie os clientes SaaS da plataforma"
      actions={
        <div className="flex gap-2">
          <Button onClick={load} variant="outline" className="gap-2" disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova organização
          </Button>
        </div>
      }
    >
      <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, slug ou cidade"
            className="pl-9"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Nome</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Cidade</th>
                <th className="px-3 py-2">Módulos</th>
                <th className="px-3 py-2">Usuários</th>
                <th className="px-3 py-2">Criada em</th>
                <th className="px-3 py-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Carregando organizações…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                    <Building2 className="mx-auto mb-2 h-6 w-6 opacity-50" />
                    Nenhuma organização encontrada
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((o) => (
                  <tr key={o.id} className="border-b border-border/60 hover:bg-accent/30">
                    <td className="px-3 py-3 font-medium text-foreground">{o.name}</td>
                    <td className="px-3 py-3 text-muted-foreground">{o.slug || "—"}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          o.active === false
                            ? "bg-muted text-muted-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {o.active === false ? "Inativa" : "Ativa"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{o.city || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{moduleCount(o) || "—"}</td>
                    <td className="px-3 py-3 text-muted-foreground">{userCount(o)}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => enterOrg(o)} className="gap-1">
                          <LogIn className="h-3.5 w-3.5" /> Acessar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(o)} className="gap-1" aria-label="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => openModules(o)} className="gap-1" aria-label="Módulos">
                          <LayoutGrid className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => goUsers(o)} className="gap-1" aria-label="Usuários">
                          Usuários
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar organização" : "Nova organização"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} />
            </div>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Switch checked={form.active} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
              <Label>Ativa</Label>
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label>Módulos</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {PLATFORM_MODULES.map((m) => (
                  <label
                    key={m}
                    className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      form.modules.includes(m) ? "border-primary bg-primary/5" : "border-border"
                    }`}
                  >
                    <span>{moduleLabel(m)}</span>
                    <Switch checked={form.modules.includes(m)} onCheckedChange={() => toggleModule(m)} />
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : form.id ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modules-only dialog */}
      <Dialog open={modulesOpen} onOpenChange={setModulesOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Módulos — {form.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_MODULES.map((m) => (
              <label
                key={m}
                className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                  form.modules.includes(m) ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <span>{moduleLabel(m)}</span>
                <Switch checked={form.modules.includes(m)} onCheckedChange={() => toggleModule(m)} />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModulesOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submitModules} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SuperAdminLayout>
  );
}
