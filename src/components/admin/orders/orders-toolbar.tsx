import { useMemo, useState } from "react";
import { Filter, Search, X, MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EventItem } from "@/lib/events-api";
import type {
  SectorFilter,
  ViewFilter,
} from "@/components/admin/orders/helpers";

const ORIGIN_OPTIONS = [
  { value: "ONLINE", label: "Online" },
  { value: "EVENT", label: "Evento" },
];

const CHANNEL_OPTIONS = [
  { value: "DIGITAL_MENU", label: "Cardápio digital" },
  { value: "ADMIN", label: "Painel" },
  { value: "TOTEM", label: "Totem" },
  { value: "POS", label: "PDV" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "API", label: "API" },
  { value: "EVENT", label: "Evento" },
];

const STATUS_OPTIONS = [
  { value: "NEW", label: "Novo" },
  { value: "CONFIRMED", label: "Confirmado" },
  { value: "PREPARING", label: "Em preparo" },
  { value: "READY", label: "Pronto" },
  { value: "OUT_FOR_DELIVERY", label: "Em entrega" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];

const VIEWS: { key: ViewFilter; label: string }[] = [
  { key: "ACTIVE", label: "Ativos" },
  { key: "DELIVERED", label: "Entregues" },
  { key: "ALL", label: "Histórico" },
];

const SECTORS: { key: SectorFilter; label: string }[] = [
  { key: "ALL", label: "Todos" },
  { key: "BAR", label: "Bar" },
  { key: "KITCHEN", label: "Cozinha" },
];

export type OrdersToolbarFilters = {
  origin: string;
  channel: string;
  status: string;
  eventId: string;
};

type Props = {
  // view / sector
  view: ViewFilter;
  onViewChange: (v: ViewFilter) => void;
  sector: SectorFilter;
  onSectorChange: (v: SectorFilter) => void;

  // search
  searchInput: string;
  onSearchInputChange: (v: string) => void;

  // filters
  filters: OrdersToolbarFilters;
  onFiltersChange: (patch: Partial<OrdersToolbarFilters>) => void;
  onClearAll: () => void;

  // module context
  showEvents: boolean;
  showOnlineFilters: boolean;
  events: EventItem[];
  eventsLoading: boolean;
};

export function OrdersToolbar({
  view,
  onViewChange,
  sector,
  onSectorChange,
  searchInput,
  onSearchInputChange,
  filters,
  onFiltersChange,
  onClearAll,
  showEvents,
  showOnlineFilters,
  events,
  eventsLoading,
}: Props) {
  const [openFilters, setOpenFilters] = useState(false);
  const [openSheet, setOpenSheet] = useState(false);

  const activeChips = useMemo(() => {
    const out: { key: keyof OrdersToolbarFilters; label: string }[] = [];
    if (filters.origin) {
      const l = ORIGIN_OPTIONS.find((o) => o.value === filters.origin)?.label;
      out.push({ key: "origin", label: `Origem: ${l ?? filters.origin}` });
    }
    if (filters.channel) {
      const l = CHANNEL_OPTIONS.find((o) => o.value === filters.channel)?.label;
      out.push({ key: "channel", label: `Canal: ${l ?? filters.channel}` });
    }
    if (filters.status) {
      const l = STATUS_OPTIONS.find((o) => o.value === filters.status)?.label;
      out.push({ key: "status", label: `Status: ${l ?? filters.status}` });
    }
    if (filters.eventId) {
      const l = events.find((e) => e.id === filters.eventId)?.name;
      out.push({ key: "eventId", label: `Evento: ${l ?? "—"}` });
    }
    return out;
  }, [filters, events]);

  const activeCount = activeChips.length;

  const AdvancedFiltersBody = (
    <div className="grid gap-3">
      {showEvents && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Evento
          </label>
          <Select
            value={filters.eventId || "__ALL__"}
            onValueChange={(v) =>
              onFiltersChange({ eventId: v === "__ALL__" ? "" : v })
            }
            disabled={eventsLoading}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue
                placeholder={eventsLoading ? "Carregando..." : "Todos os eventos"}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Todos os eventos</SelectItem>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showOnlineFilters && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Origem
          </label>
          <Select
            value={filters.origin || "__ALL__"}
            onValueChange={(v) =>
              onFiltersChange({ origin: v === "__ALL__" ? "" : v })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Todas origens" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Todas origens</SelectItem>
              {ORIGIN_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showOnlineFilters && (
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Canal
          </label>
          <Select
            value={filters.channel || "__ALL__"}
            onValueChange={(v) =>
              onFiltersChange({ channel: v === "__ALL__" ? "" : v })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Todos canais" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__ALL__">Todos canais</SelectItem>
              {CHANNEL_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          Status
        </label>
        <Select
          value={filters.status || "__ALL__"}
          onValueChange={(v) =>
            onFiltersChange({ status: v === "__ALL__" ? "" : v })
          }
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder="Todos status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__ALL__">Todos status</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-start text-muted-foreground"
          onClick={() => {
            onClearAll();
            setOpenFilters(false);
            setOpenSheet(false);
          }}
        >
          <X className="mr-1 h-4 w-4" /> Limpar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="sticky top-16 z-[5] -mx-4 mb-3 border-b border-border bg-background/95 px-4 pb-3 pt-3 backdrop-blur md:-mx-6 md:px-6">
      {/* Row: view tabs + search + sector + filters */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:flex sm:flex-wrap sm:justify-between">
        {/* Left: view segmented */}
        <div className="inline-flex min-w-0 items-center rounded-md border border-border bg-card p-0.5">
          {VIEWS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onViewChange(opt.key)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition ${
                view === opt.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Right cluster */}
        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
          {/* Search always visible */}
          <div className="relative min-w-0 flex-1 sm:w-[280px] sm:flex-none">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              placeholder="Buscar pedido, cliente, telefone…"
              className="h-9 pl-8 pr-8"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => onSearchInputChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted"
                aria-label="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Sector segmented */}
          <div className="hidden items-center rounded-md border border-border bg-card p-0.5 md:inline-flex">
            {SECTORS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => onSectorChange(opt.key)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  sector === opt.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Advanced filters — Popover on desktop */}
          <div className="hidden md:block">
            <Popover open={openFilters} onOpenChange={setOpenFilters}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Filter className="h-4 w-4" />
                  Filtros
                  {activeCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80">
                {AdvancedFiltersBody}
              </PopoverContent>
            </Popover>
          </div>

          {/* Mobile: Sheet with sector + filters */}
          <div className="md:hidden">
            <Sheet open={openSheet} onOpenChange={setOpenSheet}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <MoreVertical className="h-4 w-4" />
                  {activeCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                      {activeCount}
                    </Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Filtros</SheetTitle>
                </SheetHeader>
                <div className="mt-4 grid gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Setor
                    </label>
                    <div className="inline-flex items-center rounded-md border border-border bg-card p-0.5">
                      {SECTORS.map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => onSectorChange(opt.key)}
                          className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                            sector === opt.key
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {AdvancedFiltersBody}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* Chips of active filters */}
      {activeCount > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-1"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => onFiltersChange({ [chip.key]: "" })}
                className="ml-0.5 rounded hover:bg-muted-foreground/20"
                aria-label={`Remover ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
}
