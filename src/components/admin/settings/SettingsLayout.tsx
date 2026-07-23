import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bike,
  BookOpen,
  Building2,
  CalendarDays,
  Clock,
  CreditCard,
  Link2,
  Menu,
  MonitorSmartphone,
  Palette,
  Printer,
  ShoppingCart,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useOrganization } from "@/contexts/organization-context";
import { useAuth } from "@/lib/auth-context";
import type { SettingsCapabilities } from "@/lib/settings-api";
import { cn } from "@/lib/utils";

interface Item {
  to: string;
  search?: Record<string, string>;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  capability?: keyof SettingsCapabilities;
  roles?: string[];
}

interface Group {
  label: string;
  items: Item[];
}

const GROUPS: Group[] = [
  {
    label: "Principal",
    items: [
      { to: "/admin/settings/organization", label: "Organização", icon: Building2 },
      { to: "/admin/settings/branding", label: "Identidade visual", icon: Palette },
      { to: "/admin/settings/business-hours", label: "Horários", icon: Clock },
    ],
  },
  {
    label: "Vendas",
    items: [
      { to: "/admin/settings/online-orders", label: "Loja online", icon: Store, capability: "hasOnlineOrders" },
      { to: "/admin/settings/delivery", label: "Entrega", icon: Bike, capability: "hasOnlineOrders" },
      { to: "/admin/settings/catalog-online", label: "Catálogo online", icon: BookOpen, capability: "hasOnlineOrders" },
      { to: "/admin/settings/checkout", label: "Checkout", icon: ShoppingCart, capability: "hasOnlineOrders" },
    ],
  },
  {
    label: "Operação",
    items: [
      {
        to: "/admin/settings/payments",
        label: "Pagamentos",
        icon: CreditCard,
        capability: "hasPayments",
        roles: ["ADMIN", "SUPER_ADMIN"],
      },
      {
        to: "/admin/settings/printing",
        label: "Impressão",
        icon: Printer,
        capability: "hasPrinting",
      },
      { to: "/admin/devices", label: "Dispositivos", icon: MonitorSmartphone },
    ],
  },
  {
    label: "Integrações",
    items: [
      { to: "/admin/public-links", label: "Links públicos", icon: Link2 },
    ],
  },
  {
    label: "Eventos",
    items: [
      { to: "/admin/events", label: "Padrões de eventos", icon: CalendarDays, capability: "hasEvents" },
    ],
  },
];

function itemVisible(it: Item, capabilities: SettingsCapabilities, role?: string | null): boolean {
  if (it.roles && !it.roles.includes((role ?? "").toUpperCase())) return false;
  if (!it.capability) return true;
  const value = capabilities[it.capability];
  return value !== false;
}

function NavList({
  pathname,
  onNavigate,
  capabilities,
  role,
}: {
  pathname: string;
  onNavigate?: () => void;
  capabilities: SettingsCapabilities;
  role?: string | null;
}) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto p-4">
      {GROUPS.map((group) => {
        const visibleItems = group.items.filter((item) => itemVisible(item, capabilities, role));
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {visibleItems.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={`${item.label}-${item.to}`}
                  to={item.to}
                  search={item.search as never}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { organization } = useOrganization();
  const { user } = useAuth();
  const capabilities: SettingsCapabilities =
    (organization as { capabilities?: SettingsCapabilities } | null)?.capabilities ?? {};
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 md:flex-row md:gap-6">
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu className="mr-2 h-4 w-4" />
              Seções
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border px-4 py-3">
              <SheetTitle>Configurações da organização</SheetTitle>
            </SheetHeader>
            <NavList
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              capabilities={capabilities}
              role={user?.role}
            />
          </SheetContent>
        </Sheet>
      </div>

      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-24 rounded-xl border border-border bg-card">
          <NavList pathname={pathname} capabilities={capabilities} role={user?.role} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
