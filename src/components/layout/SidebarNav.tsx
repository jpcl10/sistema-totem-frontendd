import { Link } from "@tanstack/react-router";
import type { NavItem } from "@/lib/organization-modules";

interface SidebarNavProps {
  items: NavItem[];
  activePath: string;
  /**
   * Path that should only match on exact equality (e.g. `/admin/dashboard`
   * shouldn't stay "active" for every deeper `/admin/...` route). Optional.
   */
  exactPaths?: string[];
  className?: string;
}

/**
 * Shared sidebar navigation for admin & super-admin layouts.
 * Purely presentational — receives the item list from the caller so each
 * layout keeps ownership of its own module registry.
 */
export function SidebarNav({ items, activePath, exactPaths, className }: SidebarNavProps) {
  const exact = new Set(exactPaths ?? []);
  return (
    <nav className={`flex-1 space-y-1 overflow-y-auto p-4 ${className ?? ""}`}>
      {items.map((item) => {
        const isExact = exact.has(item.to);
        const active =
          !item.disabled &&
          (isExact ? activePath === item.to : activePath.startsWith(item.to));

        const cls = `group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
          active
            ? "bg-primary/10 text-primary shadow-sm"
            : item.disabled
              ? "text-muted-foreground/50 cursor-not-allowed"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`;

        if (item.disabled) {
          return (
            <span key={item.label + item.to} className={cls} aria-disabled="true">
              <item.icon className="h-4 w-4" aria-hidden />
              {item.label}
            </span>
          );
        }

        return (
          <Link
            key={item.label + item.to}
            to={item.to}
            search={item.search as never}
            className={cls}
            aria-current={active ? "page" : undefined}
          >
            <item.icon
              className="h-4 w-4 transition-transform group-hover:scale-110"
              aria-hidden
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
