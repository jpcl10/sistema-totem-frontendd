import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading premium para canais públicos (Totem, cardápio).
 * Reutiliza apenas Skeleton do shadcn — sem Design System paralelo.
 */
export function PublicChannelLoading() {
  return (
    <div className="min-h-dvh bg-background p-6 sm:p-10" role="status" aria-live="polite">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
