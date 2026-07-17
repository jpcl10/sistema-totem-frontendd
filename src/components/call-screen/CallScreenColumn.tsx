import { cn } from "@/lib/utils";
import type { CallScreenOrder } from "@/lib/call-screen-api";
import { CallScreenCard } from "./CallScreenCard";
import { CallScreenEmpty } from "./CallScreenEmpty";

type CallScreenColumnProps = {
  title: string;
  accent: "amber" | "emerald";
  orders: CallScreenOrder[];
  maxItemsPerColumn: number;
  emptyTitle: string;
  emptyDescription?: string;
  highlightedIds?: Set<string>;
};

export function CallScreenColumn({
  title,
  accent,
  orders,
  maxItemsPerColumn,
  emptyTitle,
  emptyDescription,
  highlightedIds,
}: CallScreenColumnProps) {
  const items = orders.slice(0, Math.max(1, maxItemsPerColumn));

  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-[28px] border bg-white/5 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl",
        accent === "emerald" ? "border-emerald-400/20" : "border-amber-400/20",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
        <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">{title}</h2>
        <span
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em]",
            accent === "emerald"
              ? "border-emerald-400/25 bg-emerald-400/12 text-emerald-100"
              : "border-amber-400/25 bg-amber-400/12 text-amber-100",
          )}
        >
          {items.length}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 pt-5">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((order) => (
              <CallScreenCard
                key={order.id}
                order={order}
                highlighted={highlightedIds?.has(order.id)}
              />
            ))}
          </div>
        ) : (
          <CallScreenEmpty title={emptyTitle} description={emptyDescription} />
        )}
      </div>
    </section>
  );
}

