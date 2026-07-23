import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toFriendlyMessage } from "@/lib/api-error";

interface PageErrorProps {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  className?: string;
}

function extractMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  if (error instanceof Error) return toFriendlyMessage(error, fallback);
  if (typeof error === "string") return toFriendlyMessage(new Error(error), fallback);
  return fallback;
}

/** Standard error state for admin pages. Presentational only. */
export function PageError({
  title = "Não foi possível carregar",
  message,
  error,
  onRetry,
  className,
}: PageErrorProps) {
  const resolved = message ?? extractMessage(error, "Ocorreu um erro inesperado.");
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center ${className ?? ""}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{resolved}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
