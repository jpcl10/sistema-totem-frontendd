import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import {
  Building2,
  Palette,
  Clock,
  Store,
  Bike,
  BookOpen,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Printer,
  SlidersHorizontal,
  MonitorSmartphone,
  Cpu,
  Link2,
  CalendarDays,
  Settings2,
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
  moduleKey?: string;
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
      { to: "/admin/settings/branding", label: "Identidade Visual", icon: Palette },
      { to: "/admin/settings/business-hours", label: "Horários", icon: Clock },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/admin/settings/online-orders", label: "Loja Online", icon: Store, capability: "hasOnlineOrders" },
      { to: "/admin/settings/delivery", label: "Delivery", icon: Bike, capability: "hasOnlineOrders" },
      { to: "/admin/online-menu", label: "Catálogo Online", icon: BookOpen, capability: "hasOnlineOrders" },
      { to: "/admin/settings/checkout", label: "Checkout", icon: ShoppingCart, capability: "hasOnlineOrders" },
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

      {
        to: "/admin/settings/legacy",
        search: { tab: "operacional" },
        label: "Operacional",
        icon: SlidersHorizontal,
      },
      {
        to: "/admin/settings/legacy",
        search: { tab: "totem" },
        label: "Totens",
        icon: MonitorSmartphone,
        capability: "hasTotem",
      },
    ],
  },
  {
    label: "Experiência da Loja",
    items: [
      {
        to: "/admin/settings/catalog-online",
        label: "Catálogo Online",
        icon: ShoppingBag,
        capability: "hasOnlineOrders",
      },
    ],
  },
  {
    label: "Infraestrutura",
    items: [
      { to: "/admin/devices", label: "Dispositivos", icon: Cpu },
      { to: "/admin/public-links", label: "Links Públicos", icon: Link2 },
      { to: "/admin/events", label: "Eventos", icon: CalendarDays, capability: "hasEvents" },
    ],
  },
  {
    label: "Avançado",
    items: [
      { to: "/admin/settings/legacy", label: "Configurações Avançadas", icon: Settings2 },
    ],
  },
];

function itemVisible(it: Item, capabilities: SettingsCapabilities, role?: string | null): boolean {
  if (it.roles && !it.roles.includes((role ?? "").toUpperCase())) return false;
  if (!it.capability) return true;
  const v = capabilities[it.capability];
  // If capability is unknown/undefined, keep visible (avoid hiding when backend hasn't reported).
  return v !== false;
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
        const visibleItems = group.items.filter((i) => itemVisible(i, capabilities, role));
        if (visibleItems.length === 0) return null;
        return (
          <div key={group.label} className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {visibleItems.map((it) => {
              const active =
                pathname === it.to ||
                (it.to !== "/admin/settings/legacy" && pathname.startsWith(it.to + "/"));
              const Icon = it.icon;
              return (
                <Link
                  key={it.label + it.to}
                  to={it.to}
                  search={it.search as never}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{it.label}</span>
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
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { organization } = useOrganization();
  const { user } = useAuth();
  const capabilities: SettingsCapabilities =
    (organization as { capabilities?: SettingsCapabilities } | null)?.capabilities ?? {};
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-4 md:flex-row md:gap-6">
      {/* Mobile trigger */}
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
              <SheetTitle>Configurações</SheetTitle>
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

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-24 rounded-xl border border-border bg-card">
          <NavList pathname={pathname} capabilities={capabilities} role={user?.role} />
        </div>
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
