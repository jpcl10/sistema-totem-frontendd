import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, Loader2, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

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
import type { EventItem } from "@/lib/events-api";
import { listOnlineStores, type OnlineStore } from "@/lib/online-store-api";

type Props = {
  token: string;
  hasEvents: boolean;
  hasOnline: boolean;
  events: EventItem[];
  eventsLoading?: boolean;
  currentEventId?: string;
  currentEventName?: string;
  onCreated?: () => void;
};

export function NewOrderButton({
  token,
  hasEvents,
  hasOnline,
  events,
  eventsLoading = false,
  currentEventId,
  currentEventName,
  onCreated,
}: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [strategies, setStrategies] = useState<OrderCreationStrategy[]>([]);
  const [stores, setStores] = useState<OnlineStore[]>([]);
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [noEventOpen, setNoEventOpen] = useState(false);

  const [activeEvent, setActiveEvent] = useState<{ id: string; name?: string } | null>(null);
  const [activeStore, setActiveStore] = useState<{ id: string; name?: string } | null>(null);

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
      const selectedEvent = events.find((event) => event.id === currentEventId);
      if (selectedEvent || currentEventId) {
        setActiveEvent({ id: selectedEvent?.id ?? currentEventId!, name: selectedEvent?.name ?? currentEventName });
        return;
      }
      if (eventsLoading) {
        toast.info("Carregando eventos disponiveis.");
        return;
      }

      const activeEvents = events.filter(isActiveEvent);
      if (activeEvents.length === 1) {
        const event = activeEvents[0];
        setActiveEvent({ id: event.id, name: event.name });
        return;
      }
      if (activeEvents.length > 1) {
        setEventPickerOpen(true);
        return;
      }
      setNoEventOpen(true);
      return;
    }

    if (stores.length === 1) {
      setActiveStore({ id: stores[0].id, name: stores[0].name });
      return;
    }
    if (stores.length === 0) {
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
            <DropdownMenuItem onSelect={() => void trigger("event")}>Novo pedido no evento</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void trigger("store")}>Novo pedido na loja</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    if (showEvent) {
      return (
        <Button size="sm" className="shadow-sm" disabled={loading} onClick={() => void trigger("event")}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
        </Button>
      );
    }
    return (
      <Button size="sm" className="shadow-sm" disabled={loading} onClick={() => void trigger("store")}>
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

      <Dialog open={storePickerOpen} onOpenChange={setStorePickerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecionar loja</DialogTitle>
            <DialogDescription>Escolha a loja onde o pedido sera lancado.</DialogDescription>
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

      <Dialog open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Selecionar evento</DialogTitle>
            <DialogDescription>Escolha onde a venda manual sera lancada.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[60vh] gap-3 overflow-y-auto py-2">
            {events.filter(isActiveEvent).map((event) => (
              <div key={event.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <div className="font-semibold">{event.name}</div>
                      <div className="text-xs text-muted-foreground">{event.status ?? "Ativo"}</div>
                    </div>
                    <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatEventDate(event)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {eventText(event, ["locationName", "location", "address"]) || "-"}
                      </span>
                      <span>Organizacao: {eventText(event, ["organizationName", "organization"]) || "Atual"}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setEventPickerOpen(false);
                      setActiveEvent({ id: event.id, name: event.name });
                    }}
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={noEventOpen} onOpenChange={setNoEventOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nenhum evento ativo</DialogTitle>
            <DialogDescription>Cadastre ou reabra um evento antes de lancar uma venda manual.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoEventOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => {
                setNoEventOpen(false);
                void navigate({ to: "/admin/events" });
              }}
            >
              Ir para Eventos
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {strategies.length === 0 ? null : null}
    </>
  );
}

function isActiveEvent(event: EventItem): boolean {
  const status = String(event.status ?? "ACTIVE").toUpperCase();
  return !["CLOSED", "ARCHIVED", "CANCELLED", "CANCELED", "ENDED", "INACTIVE"].includes(status);
}

function formatEventDate(event: EventItem): string {
  const startsAt = typeof event.startsAt === "string" ? event.startsAt : "";
  if (!startsAt) return "-";
  return new Date(startsAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventText(event: EventItem, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value;
    if (value && typeof value === "object" && "name" in value) {
      const name = (value as { name?: unknown }).name;
      if (typeof name === "string" && name.trim()) return name;
    }
  }
  return undefined;
}
