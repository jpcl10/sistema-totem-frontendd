import { createFileRoute } from "@tanstack/react-router";
import { CreditCard, Loader2 } from "lucide-react";
import { SuperAdminLayout, AccessDenied, useIsSuperAdmin } from "@/components/super-admin-layout";

export const Route = createFileRoute("/super-admin/plans")({
  component: PlansPage,
});

const plans = [
  { name: "Starter", price: "R$ 199/mês", features: ["1 evento ativo", "Pedidos online", "Suporte por email"] },
  { name: "Pro", price: "R$ 499/mês", features: ["Eventos ilimitados", "Totem + NFC", "Impressão térmica", "Relatórios"] },
  { name: "Enterprise", price: "Sob consulta", features: ["Tudo do Pro", "Multi-organização", "SLA dedicado", "White-label"] },
];

function PlansPage() {
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
    <SuperAdminLayout title="Assinaturas / Planos" subtitle="Placeholder — gestão de planos SaaS">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground"
                style={{ background: "var(--gradient-primary)" }}
              >
                <CreditCard className="h-4 w-4" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{p.name}</h3>
            </div>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">{p.price}</p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {p.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Integração de cobrança/assinaturas será implementada em breve.
      </p>
    </SuperAdminLayout>
  );
}
