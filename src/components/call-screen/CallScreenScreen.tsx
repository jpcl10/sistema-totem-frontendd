import { useEffect, useMemo, useRef, useState } from "react";
import { CallScreenColumn } from "./CallScreenColumn";
import { CallScreenEmpty } from "./CallScreenEmpty";
import { CallScreenError } from "./CallScreenError";
import { CallScreenHeader } from "./CallScreenHeader";
import { CallScreenLayout } from "./CallScreenLayout";
import { CallScreenLoading } from "./CallScreenLoading";
import { useCallScreen } from "@/hooks/use-call-screen";
import type { CallScreenContextType } from "@/lib/call-screen-api";
import { audioManager } from "@/lib/audio-manager";

type CallScreenScreenProps = {
  type: CallScreenContextType;
  slug: string;
};

function formatError(error: unknown) {
  if (!error) return "Não foi possível carregar a tela pública de chamada.";
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Não foi possível carregar a tela pública de chamada.";
}

export function CallScreenScreen({ type, slug }: CallScreenScreenProps) {
  const {
    data,
    clock,
    error,
    isInitialLoading,
    refetch,
    maxItemsPerColumn,
    soundEnabled,
  } = useCallScreen(type, slug);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const seenReadyIdsRef = useRef<string[] | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);

  const readyIds = useMemo(() => data?.orders.ready.map((order) => order.id) ?? [], [data?.orders.ready]);

  useEffect(() => {
    if (!data) return;
    if (seenReadyIdsRef.current === null) {
      seenReadyIdsRef.current = readyIds;
      return;
    }
    const previous = new Set(seenReadyIdsRef.current);
    const nextFlash = readyIds.filter((id) => !previous.has(id));
    seenReadyIdsRef.current = readyIds;

    if (nextFlash.length === 0) return;

    setFlashIds(new Set(nextFlash));
    if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashIds(new Set());
    }, 2200);

    if (soundEnabled) {
      audioManager.playBeep("alert");
    }
  }, [data, readyIds, soundEnabled]);

  useEffect(
    () => () => {
      if (flashTimeoutRef.current) window.clearTimeout(flashTimeoutRef.current);
    },
    [],
  );

  if (error && !data) {
    return <CallScreenError message={formatError(error)} onRetry={refetch} />;
  }

  if (isInitialLoading || !data) {
    return <CallScreenLoading />;
  }

  const { context, branding, configuration } = data;
  const showPreparing = configuration.showPreparing !== false;
  const showReady = configuration.showReady !== false;
  const noColumnsEnabled = !showPreparing && !showReady;

  return (
    <CallScreenLayout
      backgroundColor={branding.backgroundColor}
      textColor={branding.textColor}
      primaryColor={branding.primaryColor}
      secondaryColor={branding.secondaryColor}
    >
      <div className="flex min-h-screen flex-col">
        {error && data && (
          <div className="border-b border-rose-400/20 bg-rose-500/10 px-5 py-3 text-sm text-rose-50 md:px-8">
            {formatError(error)}
          </div>
        )}
        <CallScreenHeader context={context} branding={branding} clock={clock} />

        <main className="grid flex-1 min-h-0 gap-5 px-5 py-5 md:px-8 md:py-8 xl:grid-cols-2">
          {noColumnsEnabled ? (
            <div className="xl:col-span-2">
              <CallScreenEmpty
                title="Nenhuma coluna habilitada"
                description="A configuração atual desta tela não exibe colunas."
              />
            </div>
          ) : (
            <>
              {showPreparing ? (
                <CallScreenColumn
                  title="Em preparo"
                  accent="amber"
                  orders={data.orders.preparing}
                  maxItemsPerColumn={maxItemsPerColumn}
                  emptyTitle="Nenhum pedido em preparo"
                  emptyDescription="Assim que um pedido entrar em preparo, ele aparece aqui."
                  highlightedIds={flashIds}
                />
              ) : (
                <div className="hidden xl:block" />
              )}

              {showReady ? (
                <CallScreenColumn
                  title="Prontos"
                  accent="emerald"
                  orders={data.orders.ready}
                  maxItemsPerColumn={maxItemsPerColumn}
                  emptyTitle="Nenhum pedido pronto"
                  emptyDescription="Os pedidos concluídos aparecem nesta coluna."
                  highlightedIds={flashIds}
                />
              ) : (
                <div className="hidden xl:block" />
              )}
            </>
          )}
        </main>
      </div>
    </CallScreenLayout>
  );
}
