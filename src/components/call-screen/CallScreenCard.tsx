import { cn } from "@/lib/utils";
import type { CallScreenOrder } from "@/lib/call-screen-api";

type CallScreenCardProps = {
  order: CallScreenOrder;
  highlighted?: boolean;
};

function formatUpdatedAt(updatedAt: string) {
  const date = new Date(updatedAt);
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function CallScreenCard({ order, highlighted }: CallScreenCardProps) {
  const isReady = order.status === "READY";

  return (
    <article
      className={cn(
        "rounded-[20px] border px-5 py-4 shadow-[0_18px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-transform duration-300",
        isReady
          ? "border-emerald-400/35 bg-emerald-400/12"
          : "border-amber-400/30 bg-amber-400/12",
        highlighted && "animate-[pulse_1.5s_ease-in-out_2] ring-2 ring-white/30",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium uppercase tracking-[0.28em] text-white/55">
            {order.publicCode}
          </div>
          <div className="mt-2 break-words text-3xl font-semibold leading-tight text-white md:text-4xl">
            {order.displayName ?? "Sem nome"}
          </div>
        </div>
        <div
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em]",
            isReady
              ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-100"
              : "border-amber-400/35 bg-amber-400/15 text-amber-100",
          )}
        >
          {order.statusLabel}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="text-sm text-white/65">Atualizado {formatUpdatedAt(order.updatedAt)}</div>
        <div className={cn("h-3 w-3 rounded-full", isReady ? "bg-emerald-300" : "bg-amber-300")} />
      </div>
    </article>
  );
}

