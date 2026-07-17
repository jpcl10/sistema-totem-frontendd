import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { SuperAdminLayout, AccessDenied, useIsSuperAdmin } from "@/components/super-admin-layout";
import { superAdminStore, PLATFORM_MODULES, type PlatformModule } from "@/lib/super-admin-store";
import { moduleLabel } from "@/lib/organization-modules";
import { toast } from "sonner";

export const Route = createFileRoute("/super-admin/modules")({
  component: ModulesPage,
});

function ModulesPage() {
  const { loading, isSuperAdmin } = useIsSuperAdmin();
  const [refresh, setRefresh] = useState(0);

  const orgs = useMemo(() => {
    if (typeof window === "undefined") return [];
    return superAdminStore.listOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) return <AccessDenied />;

  const toggle = (orgId: string, module: PlatformModule) => {
    const org = orgs.find((o) => o.id === orgId);
    if (!org) return;
    const modules = org.modules.includes(module)
      ? org.modules.filter((m) => m !== module)
      : [...org.modules, module];
    superAdminStore.updateOrganization(orgId, { modules });
    toast.success("Módulos atualizados");
    setRefresh((n) => n + 1);
  };

  return (
    <SuperAdminLayout title="Módulos" subtitle="Habilite ou desabilite módulos por organização">
      {orgs.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-soft)]">
          <Package className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma organização cadastrada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orgs.map((o) => (
            <div key={o.id} className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{o.name}</h3>
                  <p className="text-xs text-muted-foreground">{o.slug}</p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {o.modules.length}/{PLATFORM_MODULES.length} habilitados
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {PLATFORM_MODULES.map((m) => {
                  const active = o.modules.includes(m);
                  return (
                    <button
                      key={m}
                      onClick={() => toggle(o.id, m)}
                      className={`rounded-lg border px-3 py-2 text-left text-xs font-medium transition-all ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-accent"
                      }`}
                    >
                      {moduleLabel(m)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </SuperAdminLayout>
  );
}
