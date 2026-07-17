import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type CallScreenErrorProps = {
  message: string;
  onRetry: () => void;
};

export function CallScreenError({ message, onRetry }: CallScreenErrorProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-8 text-white">
      <div className="w-full max-w-xl rounded-[28px] border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/20 bg-rose-400/10 text-rose-100">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Não foi possível carregar a tela</h2>
        <p className="mt-3 text-sm leading-6 text-white/70 md:text-base">{message}</p>
        <div className="mt-6 flex justify-center">
          <Button onClick={onRetry} className="rounded-xl px-5">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    </div>
  );
}

