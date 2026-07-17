import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface PageFiltersProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    "aria-label"?: string;
  };
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/**
 * Unified filter bar: optional search input on the left, slot for filter
 * controls in the middle, optional actions slot on the right. Presentational.
 */
export function PageFilters({ search, children, actions, className }: PageFiltersProps) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-3 md:flex-row md:items-center ${className ?? ""}`}
    >
      {search && (
        <div className="relative md:min-w-[240px] md:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? "Buscar…"}
            aria-label={search["aria-label"] ?? search.placeholder ?? "Buscar"}
            className="pl-9"
          />
        </div>
      )}
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      {actions && <div className="flex flex-wrap items-center gap-2 md:ml-auto">{actions}</div>}
    </div>
  );
}
