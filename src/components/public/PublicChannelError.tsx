import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/**
 * Estado de erro para canais públicos. Sem Design System paralelo:
 * usa Button do shadcn e tokens semânticos.
 */
export function PublicChannelError({ title, message, onRetry }: Props) {
  return (
    <div
      className="min-h-dvh bg-background flex items-center justify-center p-6 text-center"
      role="alert"
    >
      <div className="max-w-md">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {title ?? "Cardápio indisponível"}
        </h1>
        {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}
        {onRetry && (
          <Button className="mt-6" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
