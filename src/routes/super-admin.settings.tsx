import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { SuperAdminLayout, AccessDenied, useIsSuperAdmin } from "@/components/super-admin-layout";

export const Route = createFileRoute("/super-admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { loading, isSuperAdmin } = useIsSuperAdmin();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!isSuperAdmin) return <AccessDenied />;

  return (
    <SuperAdminLayout title="Configurações da plataforma" subtitle="Ajustes gerais do SaaS">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-base font-semibold text-foreground">Em breve</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Configurações globais da plataforma, integrações e branding aparecerão aqui.
        </p>
      </div>
    </SuperAdminLayout>
  );
}
