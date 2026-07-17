import type { CategorySector } from "@/lib/catalog-api";
import { SECTOR_BADGE } from "@/lib/catalog-helpers";

export function SectorBadge({ sector }: { sector?: CategorySector }) {
  if (!sector) return null;
  const label = sector === "KITCHEN" ? "Cozinha" : "Bar";
  return (
    <span
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${SECTOR_BADGE[sector]}`}
    >
      {label}
    </span>
  );
}

export function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 pt-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function EmptyBlock({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground"
        style={{ background: "var(--gradient-primary)" }}
      >
        {icon}
      </div>
      <h4 className="font-semibold text-foreground">{title}</h4>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function MetricCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "foreground" | "success" | "muted";
}) {
  const toneClasses: Record<typeof tone, string> = {
    primary: "bg-primary/10 text-primary ring-primary/15",
    foreground: "bg-foreground/5 text-foreground ring-foreground/10",
    success: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
    muted: "bg-muted text-muted-foreground ring-border",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/70 p-3 backdrop-blur-sm">
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ${toneClasses[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold leading-tight text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-border bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          active ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" : "bg-muted-foreground/50"
        }`}
      />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}
