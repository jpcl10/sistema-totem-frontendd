import { useEffect, useState } from "react";
import { Plus, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ManualSaleDrawer } from "@/components/admin/manual-sale-drawer";
import { StoreManualSaleDrawer } from "@/components/admin/store-manual-sale-drawer";
import {
  resolveStrategies,
  type OrderCreationStrategy,
} from "@/lib/order-strategies";
import { listOnlineStores, type OnlineStore } from "@/lib/online-store-api";

type Props = {
  token: string;
  hasEvents: boolean;
  hasOnline: boolean;
  currentEventId?: string;
  currentEventName?: string;
  onCreated?: () => void;
};

/**
 * "Novo Pedido" button — always visible. Routes to the correct
 * OrderCreationStrategy based on active modules. Shows a picker when
 * multiple strategies are available (hybrid orgs) or when a resource
 * (event/store) must be chosen first.
 */
export function NewOrderButton({
  token,
  hasEvents,
  hasOnline,
  currentEventId,
  currentEventName,
  onCreated,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<OrderCreationStrategy[]>([]);
  const [stores, setStores] = useState<OnlineStore[]>([]);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);

  const [activeEvent, setActiveEvent] = useState<
    { id: string; name?: string } | null
  >(null);
  const [activeStore, setActiveStore] = useState<
    { id: string; name?: string } | null
  >(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await resolveStrategies({
        token,
        hasEvents,
        hasOnline,
        currentEventId,
        currentEventName,
      });
      setStrategies(res.strategies);
      setStores(res.onlineStores);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, hasEvents, hasOnline, currentEventId]);

  const trigger = async (kind: "event" | "store") => {
    if (kind === "event") {
      if (!currentEventId) {
        setEventPickerOpen(true);
        toast.info("Selecione um evento no filtro para lançar a venda.");
        return;
      }
      setActiveEvent({ id: currentEventId, name: currentEventName });
      return;
    }
    // store
    if (stores.length === 1) {
      setActiveStore({ id: stores[0].id, name: stores[0].name });
      return;
    }
    if (stores.length === 0) {
      // Try to load
      try {
        const list = await listOnlineStores(token);
        setStores(list);
        if (list.length === 1) {
          setActiveStore({ id: list[0].id, name: list[0].name });
          return;
        }
      } catch {
        /* ignore */
      }
    }
    setStorePickerOpen(true);
  };

  const showEvent = hasEvents;
  const showStore = hasOnline;

  const label = (
    <>
      <Plus className="h-4 w-4" />
      Novo Pedido
    </>
  );

  const renderButton = () => {
    // Both available → dropdown
    if (showEvent && showStore) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="shadow-sm" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
              <ChevronDown className="ml-1 h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void trigger("event")}>
              Novo pedido no evento
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void trigger("store")}>
              Novo pedido na loja
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    // Only events
    if (showEvent) {
      return (
        <Button
          size="sm"
          className="shadow-sm"
          disabled={loading}
          onClick={() => void trigger("event")}
          title={
            !currentEventId
              ? "Selecione um evento para lançar a venda"
              : "Novo pedido no evento"
          }
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
        </Button>
      );
    }
    // Only online
    return (
      <Button
        size="sm"
        className="shadow-sm"
        disabled={loading}
        onClick={() => void trigger("store")}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </Button>
    );
  };

  return (
    <>
      {renderButton()}

      {activeEvent && (
        <ManualSaleDrawer
          open
          onOpenChange={(v) => !v && setActiveEvent(null)}
          eventId={activeEvent.id}
          token={token}
          onCreated={() => {
            setActiveEvent(null);
            onCreated?.();
          }}
        />
      )}

      {activeStore && (
        <StoreManualSaleDrawer
          open
          onOpenChange={(v) => !v && setActiveStore(null)}
          storeId={activeStore.id}
          storeName={activeStore.name}
          token={token}
          onCreated={() => {
            setActiveStore(null);
            onCreated?.();
          }}
        />
      )}

      {/* Store picker */}
      <Dialog open={storePickerOpen} onOpenChange={setStorePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar loja</DialogTitle>
            <DialogDescription>Escolha a loja onde o pedido será lançado.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            {stores.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setStorePickerOpen(false);
                  setActiveStore({ id: s.id, name: s.name });
                }}
                className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm hover:border-primary"
              >
                <div className="font-semibold">{s.name}</div>
                {s.description && <div className="text-xs text-muted-foreground">{s.description}</div>}
              </button>
            ))}
            {stores.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                Nenhuma loja cadastrada.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Event picker (informational — real selection happens via header filter) */}
      <Dialog open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione um evento</DialogTitle>
            <DialogDescription>
              Use o filtro de evento acima para selecionar onde a venda será lançada.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      {/* Discard the ref if strategies list is empty (nothing to render). */}
      {strategies.length === 0 ? null : null}
    </>
  );
}
