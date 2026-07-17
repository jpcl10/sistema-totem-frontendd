import { Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAssetUrl } from "@/lib/auth";
import type { CallScreenContext, CallScreenBranding } from "@/lib/call-screen-api";

type CallScreenHeaderProps = {
  context: CallScreenContext;
  branding: CallScreenBranding;
  clock: Date | null;
  className?: string;
};

function formatClock(date: Date | null) {
  if (!date) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function fallbackInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? "D"}${parts[1]![0] ?? ""}`.toUpperCase();
}

export function CallScreenHeader({
  context,
  branding,
  clock,
  className,
}: CallScreenHeaderProps) {
  const logo = resolveAssetUrl(branding.logoUrl);
  const typeLabel = context.type === "STORE" ? "Retirada" : "Tela de Chamada";

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-6 border-b border-white/10 bg-white/5 px-5 py-4 backdrop-blur-xl md:px-8 md:py-5",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/10 shadow-lg shadow-black/20">
          {logo ? (
            <img src={logo} alt={context.name} className="h-full w-full object-contain p-2" />
          ) : (
            <span className="text-lg font-semibold tracking-[0.2em] text-white/90">
              {fallbackInitials(context.name)}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight text-white md:text-3xl">
              {context.name}
            </h1>
            <span className="inline-flex items-center rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-white/80">
              {typeLabel}
            </span>
          </div>
          <p className="mt-1 text-sm text-white/70 md:text-base">{context.type === "STORE" ? "Retirada" : "Tela de Chamada"}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 shadow-lg shadow-black/20 backdrop-blur-xl">
        <Clock3 className="h-5 w-5 text-[color:var(--call-primary)]" />
        <div className="text-right">
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-white md:text-4xl">
            {formatClock(clock)}
          </div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-white/50">Horário do servidor</div>
        </div>
      </div>
    </header>
  );
}

