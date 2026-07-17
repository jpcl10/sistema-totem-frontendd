import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface PageStat {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
}

const TONE_CLASS: Record<NonNullable<PageStat["tone"]>, string> = {
  default: "bg-card text-foreground",
  primary: "bg-primary/5 text-foreground",
  success: "bg-emerald-500/5 text-foreground",
  warning: "bg-amber-500/5 text-foreground",
  danger: "bg-destructive/5 text-foreground",
};

interface PageStatsProps {
  stats: PageStat[];
  className?: string;
}

/** Uniform metrics grid for admin dashboards. Presentational only. */
export function PageStats({ stats, className }: PageStatsProps) {
  return (
    <div
      className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-4 ${className ?? ""}`}
    >
      {stats.map((s) => {
        const Icon = s.icon;
        const tone = TONE_CLASS[s.tone ?? "default"];
        return (
          <div
            key={s.label}
            className={`flex items-start justify-between rounded-xl border border-border p-4 shadow-[var(--shadow-soft)] ${tone}`}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-1 truncate text-2xl font-semibold text-foreground">{s.value}</p>
              {s.hint && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{s.hint}</p>
              )}
            </div>
            {Icon && (
              <div className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
