import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  children?: ReactNode;
}

/**
 * Standard page header for admin screens. Presentational only.
 * Note: `AdminLayout` already renders a top-of-page header with the title
 * from the route. Use `PageHeader` for a *section* header inside the main
 * content area (e.g. above a filters bar), not to duplicate the layout one.
 */
export function PageHeader({ title, subtitle, actions, breadcrumb, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0 space-y-1">
        {breadcrumb}
        <h2 className="truncate text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
