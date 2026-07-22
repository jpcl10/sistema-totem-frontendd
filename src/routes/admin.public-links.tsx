import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageLoading, PageEmpty } from "@/components/admin/page";
import { QRCodeCanvas } from "qrcode.react";
import {
  Copy,
  ExternalLink,
  QrCode,
  Search,
  Store,
  Monitor,
  Tv,
  CalendarDays,
  Loader2,
  Link2,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { qk } from "@/lib/query-keys";

import { AdminLayout } from "@/components/admin-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/contexts/organization-context";
import { listOnlineStores, type OnlineStore } from "@/lib/online-store-api";
import { listEvents, type EventItem } from "@/lib/events-api";
import { buildPublicEventUrl, getCallScreenUrl } from "@/lib/public-event-urls";
import { cn } from "@/lib/utils";

interface Search {
  eventId?: string;
}

export const Route = createFileRoute("/admin/public-links")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    eventId: typeof search.eventId === "string" ? search.eventId : undefined,
  }),
  component: PublicLinksPage,
});

function absoluteUrl(path: string): string {
  if (typeof window === "undefined") return path;
  if (/^https?:/i.test(path)) return path;
  return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function copyToClipboard(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  } catch {
    toast.error("Não foi possível copiar o link");
  }
}

function openLink(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

interface LinkResource {
  title: string;
  description?: string;
  url: string;
  icon?: React.ComponentType<{ className?: string }>;
}

function LinkRow({
  resource,
  onQr,
}: {
  resource: LinkResource;
  onQr: (r: LinkResource) => void;
}) {
  const Icon = resource.icon ?? Link2;
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="font-medium leading-tight">{resource.title}</p>
          {resource.description && (
            <p className="text-xs text-muted-foreground">{resource.description}</p>
          )}
          <p className="mt-1 truncate text-xs text-muted-foreground" title={resource.url}>
            {resource.url}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:shrink-0">
        <Button size="sm" variant="outline" onClick={() => copyToClipboard(resource.url)}>
          <Copy className="mr-1 h-3.5 w-3.5" /> Copiar
        </Button>
        <Button size="sm" variant="outline" onClick={() => openLink(resource.url)}>
          <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir
        </Button>
        <Button size="sm" variant="outline" onClick={() => onQr(resource)}>
          <QrCode className="mr-1 h-3.5 w-3.5" /> QR Code
        </Button>
      </div>
    </div>
  );
}

function QrDialog({
  resource,
  onClose,
}: {
  resource: LinkResource | null;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${resource?.title ?? "qr-code"}.png`.replace(/\s+/g, "-").toLowerCase();
    a.click();
  };

  return (
    <Dialog open={!!resource} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        {resource && (
          <>
            <DialogHeader>
              <DialogTitle>{resource.title}</DialogTitle>
              <DialogDescription className="break-all text-xs">
                {resource.url}
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center py-4" ref={canvasRef}>
              <QRCodeCanvas value={resource.url} size={240} level="M" includeMargin />
            </div>
            <Button variant="outline" onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" /> Baixar PNG
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function statusVariant(status?: string): "default" | "secondary" | "outline" {
  const s = (status || "").toUpperCase();
  if (s === "ACTIVE" || s === "LIVE" || s === "OPEN" || s === "RUNNING") return "default";
  if (s === "FINISHED" || s === "CLOSED" || s === "ENDED") return "outline";
  return "secondary";
}

function statusLabel(status?: string): string {
  const s = (status || "").toUpperCase();
  const map: Record<string, string> = {
    ACTIVE: "Ativo",
    LIVE: "Ao vivo",
    RUNNING: "Em andamento",
    OPEN: "Aberto",
    DRAFT: "Rascunho",
    SCHEDULED: "Agendado",
    FINISHED: "Encerrado",
    CLOSED: "Fechado",
    ENDED: "Encerrado",
    PAUSED: "Pausado",
  };
  return map[s] || status || "—";
}

function isFinished(status?: string): boolean {
  const s = (status || "").toUpperCase();
  return s === "FINISHED" || s === "CLOSED" || s === "ENDED";
}

function PublicLinksPage() {
  const { token } = useAuth();
  const { organizationId, organizationName, organizationSlug } = useOrganization();
  const { eventId: deepEventId } = Route.useSearch();

  const [qrTarget, setQrTarget] = useState<LinkResource | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "finished">("all");
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | undefined>(undefined);

  const enabled = !!token && !!organizationId;

  const storesQ = useQuery({
    queryKey: qk.publicLinks.all(organizationId),
    enabled,
    queryFn: () => listOnlineStores(token!),
  });

  const eventsQ = useQuery({
    queryKey: qk.publicLinks.events(organizationId),
    enabled,
    queryFn: () => listEvents(token!),
  });

  const stores: OnlineStore[] = storesQ.data ?? [];
  const events: EventItem[] = eventsQ.data ?? [];

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((ev) => {
      const finished = isFinished(ev.status);
      if (statusFilter === "active" && finished) return false;
      if (statusFilter === "finished" && !finished) return false;
      if (!q) return true;
      return (
        ev.name?.toLowerCase().includes(q) ||
        ev.slug?.toLowerCase().includes(q)
      );
    });
  }, [events, search, statusFilter]);

  // Deep-link: expand + highlight the target event.
  useEffect(() => {
    if (!deepEventId || events.length === 0) return;
    const target = events.find((e) => e.id === deepEventId);
    if (!target) return;
    setOpenAccordion(target.id);
    setHighlightEventId(target.id);
    // Scroll after paint
    requestAnimationFrame(() => {
      const el = document.getElementById(`event-card-${target.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    const t = setTimeout(() => setHighlightEventId(null), 3000);
    return () => clearTimeout(t);
  }, [deepEventId, events]);

  return (
    <AdminLayout title="Links Públicos">
      <div className="space-y-8 p-4 md:p-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Links Públicos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os acessos públicos da sua organização e dos seus eventos.
          </p>
        </header>

        {/* Section 1 — Organization links */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Links da organização</h2>
            {organizationName && (
              <Badge variant="outline" className="ml-1 text-xs">
                {organizationName}
              </Badge>
            )}
          </div>

          {!enabled ? (
            <PageLoading label="Carregando organização…" variant="spinner" />
          ) : storesQ.isLoading ? (
            <PageLoading label="Carregando lojas…" variant="spinner" />
          ) : stores.length === 0 ? (
            <PageEmpty
              icon={Link2}
              title="Nenhuma loja online configurada"
              description="Configure uma loja online para gerar este link."
            />
          ) : (

            <div className="grid gap-3">
              {stores.map((store) => {
                const active = store.active !== false && store.status !== "INACTIVE";
                const url = absoluteUrl(`/p/${store.slug}`);
                return (
                  <div key={store.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{store.name}</span>
                      <Badge variant={active ? "default" : "outline"} className="text-xs">
                        {active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <LinkRow
                      resource={{
                        title: `Cardápio Online — ${store.name}`,
                        description: "Loja pública com carrinho e checkout via WhatsApp",
                        url,
                        icon: Store,
                      }}
                      onQr={setQrTarget}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 2 — Event links */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Links dos eventos</h2>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou slug…"
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="finished">Encerrados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!enabled ? null : eventsQ.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando eventos…
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              Nenhum evento encontrado.
            </div>
          ) : (
            <Accordion
              type="single"
              collapsible
              value={openAccordion}
              onValueChange={setOpenAccordion}
              className="space-y-2"
            >
              {filteredEvents.map((ev) => {
                const finished = isFinished(ev.status);
                const totemUrl = absoluteUrl(
                  organizationSlug
                    ? buildPublicEventUrl({
                        organizationSlug,
                        eventSlug: ev.slug,
                      })
                    : `/e/${ev.slug}`,
                );
                const chamadaUrl = absoluteUrl(getCallScreenUrl(ev.slug, organizationSlug ?? undefined));
                return (
                  <AccordionItem
                    key={ev.id}
                    value={ev.id}
                    id={`event-card-${ev.id}`}
                    className={cn(
                      "rounded-lg border bg-card px-4 transition-shadow",
                      highlightEventId === ev.id &&
                        "ring-2 ring-primary shadow-lg animate-pulse",
                    )}
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2 text-left">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{ev.name}</p>
                          <p className="text-xs text-muted-foreground">/{ev.slug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {ev.startsAt && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(ev.startsAt).toLocaleDateString("pt-BR")}
                            </span>
                          )}
                          <Badge variant={statusVariant(ev.status)} className="text-xs">
                            {statusLabel(ev.status)}
                          </Badge>
                          <Badge
                            variant={finished ? "outline" : "secondary"}
                            className="text-xs"
                          >
                            {finished ? "Encerrado" : "Ativo"}
                          </Badge>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2 pb-4 pt-2">
                      <LinkRow
                        resource={{
                          title: "Totem de Autoatendimento",
                          description: "Link para os totens de venda no local",
                          url: totemUrl,
                          icon: Monitor,
                        }}
                        onQr={setQrTarget}
                      />
                      <LinkRow
                        resource={{
                          title: "Painel de Chamada (TV)",
                          description: "Exibição de pedidos prontos para retirada",
                          url: chamadaUrl,
                          icon: Tv,
                        }}
                        onQr={setQrTarget}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </section>

        {/* Fallback for deep-link to unknown event */}
        {deepEventId && enabled && !eventsQ.isLoading &&
          !events.some((e) => e.id === deepEventId) && (
            <p className="text-xs text-muted-foreground">
              Evento indicado não foi encontrado nesta organização.{" "}
              <Link to="/admin/public-links" className="underline">
                Limpar filtro
              </Link>
            </p>
          )}
      </div>

      <QrDialog resource={qrTarget} onClose={() => setQrTarget(null)} />
    </AdminLayout>
  );
}
