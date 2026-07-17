import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, CheckCircle2, Users, Package, ShoppingCart, DollarSign, Loader2 } from "lucide-react";
import { SuperAdminLayout, AccessDenied, useIsSuperAdmin } from "@/components/super-admin-layout";
import { API_BASE_URL, authHeaders } from "@/lib/auth";
import { apiFetch, fromResponse, handleApiError } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/super-admin/")({
  component: OverviewPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Stats {
  totalOrgs: number;
  activeOrgs: number;
  users: number;
  enabledModules: number;
}

function countEnabledModules(modules: unknown): number {
  if (Array.isArray(modules)) {
    return modules.filter((m) =>
      m && (typeof m !== "object" || (m as { enabled?: boolean }).enabled !== false),
    ).length;
  }
  if (modules && typeof modules === "object") {
    return Object.values(modules as Record<string, unknown>).filter(Boolean).length;
  }
  return 0;
}

function OverviewPage() {
  const { loading: authLoading, isSuperAdmin } = useIsSuperAdmin();
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin || !token) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [orgsRes, usersRes] = await Promise.all([
          apiFetch(`${API_BASE_URL}/super-admin/organizations`, { headers: authHeaders(token) }),
          apiFetch(`${API_BASE_URL}/super-admin/users`, { headers: authHeaders(token) }),
        ]);
        if (!orgsRes.ok) throw await fromResponse(orgsRes, "Erro ao carregar organizações.");
        const orgsData = await orgsRes.json();
        const orgs: Array<{ active?: boolean; modules?: unknown }> = Array.isArray(orgsData)
          ? orgsData
          : orgsData.organizations ?? orgsData.data ?? orgsData.items ?? [];

        let usersCount = 0;
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          const users = Array.isArray(usersData)
            ? usersData
            : usersData.users ?? usersData.data ?? usersData.items ?? [];
          usersCount = users.length;
        }

        const enabledModules = orgs.reduce((sum, o) => sum + countEnabledModules(o.modules), 0);

        if (!cancelled) {
          setStats({
            totalOrgs: orgs.length,
            activeOrgs: orgs.filter((o) => o.active !== false).length,
            users: usersCount,
            enabledModules,
          });
        }
      } catch (err) {
        handleApiError(err, "Não foi possível carregar a visão geral.");
        if (!cancelled) setStats({ totalOrgs: 0, activeOrgs: 0, users: 0, enabledModules: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSuperAdmin, token]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) return <AccessDenied />;

  const v = (n?: number) => (loading ? "…" : String(n ?? 0));

  return (
    <SuperAdminLayout title="Visão geral" subtitle="Panorama da plataforma Defumar Events">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total de organizações" value={v(stats?.totalOrgs)} icon={Building2} />
        <StatCard label="Organizações ativas" value={v(stats?.activeOrgs)} icon={CheckCircle2} />
        <StatCard label="Usuários cadastrados" value={v(stats?.users)} icon={Users} />
        <StatCard label="Módulos habilitados" value={v(stats?.enabledModules)} icon={Package} />
        <StatCard label="Pedidos online hoje" value="—" icon={ShoppingCart} hint="Em breve" />
        <StatCard label="Receita estimada" value="—" icon={DollarSign} hint="Em breve" />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold text-foreground">Bem-vindo à área do dono da plataforma</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Gerencie organizações clientes, usuários administradores e módulos disponíveis do SaaS.
          Use o menu à esquerda para navegar entre as seções.
        </p>
      </div>
    </SuperAdminLayout>
  );
}
