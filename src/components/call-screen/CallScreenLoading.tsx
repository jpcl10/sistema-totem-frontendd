import { Skeleton } from "@/components/ui/skeleton";

export function CallScreenLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-5 py-5 text-white md:px-8 md:py-8">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 rounded-[24px] border border-white/10 bg-white/5 p-4 backdrop-blur-xl md:p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-2xl bg-white/10" />
            <div className="space-y-3">
              <Skeleton className="h-8 w-72 bg-white/10" />
              <Skeleton className="h-4 w-36 bg-white/10" />
            </div>
          </div>
          <Skeleton className="h-16 w-44 rounded-2xl bg-white/10" />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <Skeleton className="h-8 w-40 bg-white/10" />
            <div className="mt-5 space-y-4">
              <Skeleton className="h-32 rounded-[20px] bg-white/10" />
              <Skeleton className="h-32 rounded-[20px] bg-white/10" />
              <Skeleton className="h-32 rounded-[20px] bg-white/10" />
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
            <Skeleton className="h-8 w-40 bg-white/10" />
            <div className="mt-5 space-y-4">
              <Skeleton className="h-32 rounded-[20px] bg-white/10" />
              <Skeleton className="h-32 rounded-[20px] bg-white/10" />
              <Skeleton className="h-32 rounded-[20px] bg-white/10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

