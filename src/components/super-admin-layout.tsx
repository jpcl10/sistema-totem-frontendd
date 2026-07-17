import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  CreditCard,
  Settings,
  LogOut,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { SidebarNav } from "@/components/layout/SidebarNav";
import type { NavItem } from "@/lib/organization-modules";

const navItems: NavItem[] = [
  { label: "Visão geral", icon: LayoutDashboard, to: "/super-admin" },
  { label: "Organizações", icon: Building2, to: "/super-admin/organizations" },
  { label: "Usuários", icon: Users, to: "/super-admin/users" },
  { label: "Módulos", icon: Package, to: "/super-admin/modules" },
  { label: "Assinaturas/Planos", icon: CreditCard, to: "/super-admin/plans" },
  { label: "Configurações", icon: Settings, to: "/super-admin/settings" },
];


interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SuperAdminLayout({ title, subtitle, actions, children }: Props) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleLogout = () => {
    signOut();
    navigate({ to: "/admin/login" });
  };

  const initials = user?.name
    ? user.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "SA";

  return (
    <div className="flex min-h-screen w-full bg-[var(--gradient-subtle)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg text-primary-foreground shadow-[var(--shadow-soft)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">Super Admin</span>
            <span className="block truncate text-[10px] uppercase tracking-wider text-muted-foreground">
              Defumar Platform
            </span>
          </div>
        </div>

        <SidebarNav
          items={navItems}
          activePath={pathname}
          exactPaths={["/super-admin"]}
        />


        <div className="space-y-1 border-t border-border p-4">
          <Link
            to="/admin/dashboard"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao painel
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border bg-card/80 px-6 backdrop-blur">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">
            {actions}
            {user && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.role}</p>
              </div>
            )}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              {initials}
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="md:hidden" aria-label="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}

export function AccessDenied() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--gradient-subtle)] p-6">
      <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        <div
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-primary-foreground"
          style={{ background: "var(--gradient-primary)" }}
        >
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-foreground">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta área é exclusiva para SUPER_ADMIN da plataforma Defumar Events.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link
            to="/admin/dashboard"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao painel
          </Link>
        </div>
      </div>
    </div>
  );
}

export function useIsSuperAdmin() {
  const { user, loading } = useAuth();
  const role = (user?.role || "").toUpperCase();
  return { loading, isSuperAdmin: role === "SUPER_ADMIN", user };
}
