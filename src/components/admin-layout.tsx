import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LogOut, Loader2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { SidebarNav } from "@/components/layout/SidebarNav";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { buildNavItems } from "@/lib/organization-modules";
import { OrgBanner } from "@/components/admin/org-banner";
import { OrgBreadcrumb } from "@/components/admin/breadcrumb";

interface AdminLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AdminLayout({ title, subtitle, actions, children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const { user: profile, loading, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { organizationModules, isSuperAdmin, isImpersonating, organizationName } = useOrganization();


  const navItems = useMemo(() => buildNavItems(organizationModules), [organizationModules]);

  const handleLogout = () => {
    signOut();
    navigate({ to: "/admin/login" });
  };

  const initials = profile?.name
    ? profile.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
    : "??";

  return (
    <div className="flex min-h-screen w-full bg-[var(--gradient-subtle)]">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card/80 backdrop-blur md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <img
            src="/branding/icon-1024.png"
            alt="Defumar Events"
            className="h-9 w-9 rounded-lg object-cover"
          />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight text-foreground">
              Defumar Events
            </div>
            {isImpersonating && organizationName && (
              <div className="truncate text-[10px] uppercase tracking-wider text-primary">
                {organizationName}
              </div>
            )}
          </div>
        </div>

        <SidebarNav
          items={navItems}
          activePath={pathname}
          exactPaths={["/admin/dashboard"]}
        />


        {isSuperAdmin && (
          <div className="border-t border-border p-4">
            <Link
              to="/super-admin"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
            >
              <ShieldCheck className="h-4 w-4" />
              Superadministrador
            </Link>
          </div>
        )}

        <div className="border-t border-border p-4">
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
            <OrgBreadcrumb pageTitle={title} />
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-3">
            {actions}
            {profile && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-foreground">{profile.name}</p>
                <p className="text-xs text-muted-foreground">{profile.role}</p>
              </div>
            )}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-primary-foreground shadow-[var(--shadow-soft)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : initials}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="md:hidden"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <OrgBanner />

        <main className="flex-1 space-y-6 p-6">{children}</main>
      </div>
    </div>
  );
}
