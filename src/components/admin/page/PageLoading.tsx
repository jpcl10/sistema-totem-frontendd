import { Loader2 } from "lucide-react";

interface PageLoadingProps {
  label?: string;
  rows?: number;
  variant?: "spinner" | "skeleton";
  className?: string;
}

/** Standard loading state for admin pages. Presentational only. */
export function PageLoading({
  label = "Carregando…",
  rows = 4,
  variant = "skeleton",
  className,
}: PageLoadingProps) {
  if (variant === "spinner") {
    return (
      <div
        className={`flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/60 p-10 text-sm text-muted-foreground ${className ?? ""}`}
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div
      className={`space-y-2 rounded-xl border border-border bg-card/60 p-4 ${className ?? ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-12 animate-pulse rounded-lg bg-muted/60"
          aria-hidden
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}
