import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsGroup({
  title,
  description,
  children,
  className,
  columns = 2,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  columns?: 1 | 2 | 3;
}) {
  const grid =
    columns === 1
      ? "grid-cols-1"
      : columns === 3
        ? "grid-cols-1 md:grid-cols-3"
        : "grid-cols-1 md:grid-cols-2";
  return (
    <div className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-0.5">
          {title && <h4 className="text-sm font-semibold text-foreground">{title}</h4>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className={cn("grid gap-4", grid)}>{children}</div>
    </div>
  );
}
