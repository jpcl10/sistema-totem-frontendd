import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  Loader2,
  X,
  Copy,
  QrCode,
  Clock,
  CreditCard,
  PartyPopper,
  AlertTriangle,
  ArrowRight,
  UtensilsCrossed,
  Flame,
  Sparkles,
  Tag,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL, API_HEADERS, SOCKET_URL } from "../lib/auth";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicEventBranding } from "@/components/public/public-branding";
import { PublicChannelLoading } from "@/components/public/PublicChannelLoading";
import { PublicChannelError } from "@/components/public/PublicChannelError";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { resolveAssetUrl } from "@/lib/auth";
import { ProductImage } from "@/components/ProductImage";
import { handleApiError, toFriendlyMessage } from "@/lib/api-error";
import {
  getPublicMenu,
  getCanonicalPublicMenu,
  resolveLegacyPublicEvent,
  createPublicOrder,
  createPublicOrderCanonical,
  createTotemCardPaymentIntent,
  getCheckoutPaymentSettings,
  checkoutPayment,
  getPublicOrderStatus,
  getPublicApiRequestDiagnostics,
  type PublicMenu,
  type PublicProduct,
  type PublicProductOptionGroup,
  type PublicProductOption,
  type PublicCategory,
  type PublicEvent,
  type CheckoutPaymentSettings,
  type PaymentTransaction,
  type PublicOrderResponse,
  type CheckoutPaymentResponse,
} from "@/lib/public-api";

function logTotemPublicApiError(
  label: string,
  error: unknown,
  context: { eventSlug: string; organizationSlug?: string | null; payload?: unknown },
) {
  if (!import.meta.env.DEV) return;

  const diagnostics = getPublicApiRequestDiagnostics(error);
  const stack = error instanceof Error ? error.stack : undefined;

  /* eslint-disable no-console */
  console.groupCollapsed(`[Totem Public] ${label}`);
  console.error(error);
  console.info("Endpoint:", diagnostics?.endpoint ?? "desconhecido");
  console.info("Metodo:", diagnostics?.method ?? "desconhecido");
  console.info("Status HTTP:", diagnostics?.status ?? "sem resposta HTTP");
  console.info("Mensagem da API:", diagnostics?.apiMessage ?? (error instanceof Error ? error.message : String(error)));
  console.info("Payload enviado:", diagnostics?.payload ?? context.payload ?? null);
  console.info("Slug do evento:", diagnostics?.eventSlug ?? context.eventSlug);
  console.info("Slug da organizacao:", diagnostics?.organizationSlug ?? context.organizationSlug ?? null);
  console.info("Stack completa:", stack ?? "Stack indisponivel");
  console.groupEnd();
  /* eslint-enable no-console */
}

function isLegacyPixEnabled(event?: PublicEvent | null): boolean {
  const v = event?.pixEnabled as unknown;
  if (v === true) return true;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  if (typeof v === "number") return v === 1;
  return false;
}

export const Route = createFileRoute("/e/$slug")({
  component: LegacyPublicMenuRoute,
});

function LegacyPublicMenuRoute() {
  const { slug } = Route.useParams();
  return <PublicMenuPage eventSlug={slug} />;
}

function TotemWelcomeScreen({
  event,
  onStart,
}: {
  event: PublicEvent | null | undefined;
  onStart: () => void;
}) {
  const branding = usePublicEventBranding(event);
  const { name, welcomeMessage, logoUrl, bannerUrl, bannerMobileUrl, primaryColor, secondaryColor } = branding;
  const brandGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;

  return (
    <div
      className="min-h-[100dvh] overflow-x-hidden bg-background pb-10 animate-in fade-in duration-500"
      style={{
        ...branding.cssVars,
        ["--primary" as string]: primaryColor,
        ["--primary-glow" as string]: secondaryColor,
      }}
    >
      <header className="relative">
        <div className="relative h-[30dvh] min-h-56 max-h-[420px] w-full overflow-hidden sm:h-72">
          {bannerUrl || bannerMobileUrl ? (
            <>
              <picture className="block h-full w-full">
                {bannerMobileUrl && <source srcSet={bannerMobileUrl} media="(orientation: portrait)" />}
                <img
                  src={bannerUrl ?? bannerMobileUrl ?? ""}
                  alt=""
                  aria-hidden
                  draggable={false}
                  className="h-full w-full select-none object-cover object-center"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/35 to-transparent" />
            </>
          ) : (
            <>
              <div className="h-full w-full" style={{ background: brandGradient }} />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
            </>
          )}
        </div>

        <div className="mx-auto -mt-14 flex w-full max-w-5xl items-end gap-4 px-4 sm:-mt-16 sm:px-6 lg:px-8">
          <div className="relative shrink-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={name}
                draggable={false}
                className="h-24 w-24 rounded-2xl border-4 border-background bg-card object-cover shadow-xl ring-1 ring-border/40 sm:h-32 sm:w-32"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-background bg-gradient-to-br from-primary to-primary-glow text-3xl font-black text-primary-foreground shadow-xl ring-1 ring-border/40 sm:h-32 sm:w-32 sm:text-4xl"
                style={{ color: primaryColor }}
              >
                {name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 pb-2">
            <div className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-primary">
              Autoatendimento
            </div>
            <h1 className="line-clamp-2 break-words text-3xl font-black leading-tight tracking-tight text-foreground sm:text-5xl">
              {name}
            </h1>
            {welcomeMessage && (
              <p className="mt-2 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground sm:text-xl">
                {welcomeMessage}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onStart}
          className="group flex w-full items-center justify-between gap-5 rounded-2xl bg-gradient-to-r from-primary to-primary-glow px-6 py-6 text-left text-primary-foreground shadow-2xl shadow-primary/30 ring-1 ring-primary/30 transition active:scale-[0.99] sm:px-8 sm:py-8"
        >
          <span>
            <span className="block text-sm font-black uppercase tracking-widest opacity-80">
              Pedido no totem
            </span>
            <span className="mt-1 block text-3xl font-black tracking-tight sm:text-4xl">
              Começar pedido
            </span>
          </span>
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-xl transition group-active:scale-95 sm:h-20 sm:w-20">
            <ArrowRight className="h-8 w-8 sm:h-10 sm:w-10" strokeWidth={3} />
          </span>
        </button>
      </main>
    </div>
  );
}

interface CartItem {
  key: string;
  product: PublicProduct;
  quantity: number;
  notes?: string;
  selectedOptions?: {
    optionGroupId: string;
    optionIds: string[];
    displayOptions: {
      groupName: string;
      optionName: string;
      priceDeltaInCents: number;
    }[];
  }[];
  selectedFlavorProductIds?: string[];
  displayFlavors?: {
    id: string;
    name: string;
    priceInCents: number;
  }[];
  unitPriceInCents: number;
}

const SIZE_GROUP_RE = /(tamanho|size)/i;

function isSizeGroup(g: { name?: string; key?: string }): boolean {
  return SIZE_GROUP_RE.test(g.name ?? "") || SIZE_GROUP_RE.test(g.key ?? "");
}

function sortedGroups(g?: PublicProductOptionGroup[]): PublicProductOptionGroup[] {
  return [...(g ?? [])].sort((a, b) => {
    const sa = isSizeGroup(a) ? 0 : 1;
    const sb = isSizeGroup(b) ? 0 : 1;
    if (sa !== sb) return sa - sb;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
  });
}

function sortedOptions(o?: PublicProductOption[]): PublicProductOption[] {
  return [...(o ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
}

function getProductOptionGroups(product: PublicProduct): PublicProductOptionGroup[] {
  return Array.isArray(product.optionGroups)
    ? (product.optionGroups as PublicProductOptionGroup[])
    : [];
}

function getHalfAndHalfFlavors(product: PublicProduct): PublicProduct[] {
  const raw = product as Record<string, unknown>;
  const flavors = raw.halfAndHalfFlavors ?? raw.halfAndHalfFlavorProducts;
  return Array.isArray(flavors) ? (flavors as PublicProduct[]) : [];
}

function resolveFlavorFullPrice(
  product: PublicProduct,
  selectedSizeOptionKey: string | null,
): number {
  const sizeGroup = getProductOptionGroups(product).find((group) => isSizeGroup(group));
  if (!sizeGroup || !selectedSizeOptionKey) {
    return getPrice(product);
  }
  const sizeOption = sizeGroup.options.find((option) => option.key === selectedSizeOptionKey);
  return getPrice(product) + (sizeOption?.priceDeltaInCents ?? 0);
}

function getPrice(p: PublicProduct): number {
  if (typeof p.priceInCents === "number") return p.priceInCents;
  if (typeof p.price === "number") return Math.round(p.price * 100);
  return 0;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pick<T = unknown>(obj: Record<string, unknown> | undefined | null, ...keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const key of keys) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== "") return value as T;
  }
  return undefined;
}

function productBadges(product: PublicProduct): { label: string; tone: "hot" | "promo" | "new" }[] {
  const raw = product as unknown as Record<string, unknown>;
  const out: { label: string; tone: "hot" | "promo" | "new" }[] = [];
  if (pick<boolean>(raw, "bestSeller", "isBestSeller", "isPopular", "popular")) {
    out.push({ label: "Mais vendido", tone: "hot" });
  }
  const original = pick<number>(raw, "originalPriceInCents", "oldPriceInCents", "compareAtPriceInCents");
  if (
    pick<boolean>(raw, "isPromo", "onSale", "promo") ||
    (typeof original === "number" && original > getPrice(product))
  ) {
    out.push({ label: "Promoção", tone: "promo" });
  }
  if (pick<boolean>(raw, "isNew", "novo")) {
    out.push({ label: "Novo", tone: "new" });
  }
  const extra = pick<string>(raw, "badge", "tag");
  if (typeof extra === "string" && !out.find((badge) => badge.label === extra)) {
    out.push({ label: extra, tone: "new" });
  }
  return out;
}

function Badge({ children, tone }: { children: string; tone: "hot" | "promo" | "new" }) {
  const map = {
    hot: "bg-orange-500/15 text-orange-600 ring-orange-500/30",
    promo: "bg-rose-500/15 text-rose-600 ring-rose-500/30",
    new: "bg-primary/15 text-primary ring-primary/30",
  } as const;
  const icon =
    tone === "hot" ? (
      <Flame className="h-3 w-3" />
    ) : tone === "promo" ? (
      <Tag className="h-3 w-3" />
    ) : (
      <Sparkles className="h-3 w-3" />
    );
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${map[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

function isAvailable(p: PublicProduct): boolean {
  // Inative products are never shown
  if (p.active === false) return false;
  // Sold out products are never shown in the totem
  if (p.soldOut === true) return false;
  // If tracking stock and it's zero or less, it's unavailable
  if (p.trackStock === true && (p.stockQuantity ?? 0) <= 0) return false;
  return true;
}

function maxQty(p: PublicProduct): number {
  if (p.trackStock === true) return Math.max(0, p.stockQuantity ?? 0);
  return Number.POSITIVE_INFINITY;
}

export function PublicMenuPage({
  organizationSlug: organizationSlugProp,
  eventSlug: eventSlugProp,
}: {
  organizationSlug?: string;
  eventSlug?: string;
} = {}) {
  const slug = eventSlugProp ?? "";
  const organizationSlug = organizationSlugProp ?? null;
  const invalidTotemLink = !slug || (organizationSlugProp !== undefined && !organizationSlug);
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [addingProduct, setAddingProduct] = useState<PublicProduct | null>(null);
  const [productNotes, setProductNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [paymentStep, setPaymentStep] = useState<
    "loading" | "pix_automatic" | "pix_unavailable" | "card_waiting" | "card_declined" | "operator" | "paid" | null
  >(null);
  const [checkoutSettings, setCheckoutSettings] = useState<CheckoutPaymentSettings | null>(null);
  const [checkoutSettingsLoading, setCheckoutSettingsLoading] = useState(false);

  const [confirmation, setConfirmation] = useState<{
    id?: string;
    number: string;
    pix: boolean;
    totalInCents?: number;
    customerName?: string;
    transaction?: PaymentTransaction | null;
    error?: string | null;
    checkoutSettings?: CheckoutPaymentSettings;
    message?: string;
  } | null>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixExpired, setPixExpired] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // Totem payment flow
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CARD">("PIX");

  // Premium welcome screen shown before catalog
  const [showWelcome, setShowWelcome] = useState(true);
  const [legacyResolution, setLegacyResolution] = useState<{
    code?: string;
    canonicalUrl?: string | null;
    message?: string;
  } | null>(null);

  const resetTotem = () => {
    setConfirmation(null);
    setPaymentStep(null);
    setPixExpired(false);
    setRemainingSeconds(null);
    setCart([]);
    setAddingProduct(null);
    setProductNotes("");
    setCustomerName("");
    setCartOpen(false);
    setPixOpen(false);
    setPaymentMethod("PIX");
  };

  const showPixExpiredScreen = () => {
    // [redacted log]
    setPixExpired(true);
    setRemainingSeconds(0);
  };

  // Detect Kiosk Mode
  const isKioskMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const search = window.location.search;
    return search.includes("mode=kiosk");
  }, []);

  useEffect(() => {
    if (confirmation) {
      // If the order is already paid, we can reset after some time
      if (
        paymentStep === "paid" ||
        (!confirmation.pix && paymentStep !== "card_waiting" && paymentStep !== "loading")
      ) {
        const timeout = isKioskMode ? 10000 : 15000;
        const timer = setTimeout(() => {
          setConfirmation(null);
          setPaymentStep(null);
        }, timeout);
        return () => clearTimeout(timer);
      }
      // If it's PIX PENDING, we NEVER auto-reset.
      // The user must click "Novo pedido" or "Voltar ao início".
    }
  }, [confirmation, paymentStep, isKioskMode]);

  // PIX countdown timer based on paymentTransaction.expiresAt
  useEffect(() => {
    const expiresAt = confirmation?.transaction?.expiresAt;
    if (!expiresAt || paymentStep !== "pix_automatic" || pixExpired) {
      return;
    }
    const tick = () => {
      const diffMs = new Date(expiresAt as string).getTime() - Date.now();
      const secs = Math.max(0, Math.floor(diffMs / 1000));
      setRemainingSeconds(secs);
      // [redacted log]
      if (secs <= 0) {
        showPixExpiredScreen();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [confirmation?.transaction?.expiresAt, paymentStep, pixExpired]);

  // Auto-return to home 10s after PIX expired screen opens
  useEffect(() => {
    if (!pixExpired) return;
    const id = window.setTimeout(() => {
      resetTotem();
    }, 10000);
    return () => window.clearTimeout(id);
  }, [pixExpired]);

  // Socket.IO integration
  useEffect(() => {
    if (!confirmation?.id || !menu?.event?.id) return;
    if (paymentStep === "paid") return;

    const eventId = menu.event.id;
    const orderId = confirmation.id;
    const socketUrl = SOCKET_URL;
    const socket: Socket = io(socketUrl, {
      extraHeaders: API_HEADERS,
      transports: ["websocket", "polling"],
    });

    const markPaid = (source: string) => {
      // [redacted log]
      setPaymentStep("paid");
      toast.success("Pagamento confirmado!");
    };

    // Only confirm when the backend explicitly reports isPaymentConfirmed === true.
    // Never trust paymentStep, order.status, or transaction.status.
    socket.on("connect", () => {
      socket.emit("join-event-room", eventId);
    });

    socket.on("connect_error", (error) => {
      console.error("TOTEM SOCKET CONNECT ERROR:", error);
    });

    const isPaid = (status?: string) => status === "PAID" || status === "NOT_REQUIRED";
    const isFailed = (status?: string) =>
      status === "FAILED" || status === "CANCELLED" || status === "REFUNDED";

    socket.on("order-updated", (payload: any) => {
      const updatedOrder = payload?.order ?? payload;
      if (!updatedOrder || updatedOrder.id !== orderId) return;
      if (isPaid(updatedOrder?.paymentStatus)) {
        markPaid("order-updated");
      } else if (paymentStep === "card_waiting" && isFailed(updatedOrder?.paymentStatus)) {
        setPaymentStep("card_declined");
        toast.error("Pagamento não aprovado. Tente novamente.");
      }
    });

    socket.on("payment-transaction-updated", (payload: any) => {
      const order = payload?.order ?? payload;
      const tx = payload?.transaction ?? payload?.paymentTransaction ?? payload;
      const txOrderId = tx?.orderId ?? order?.id ?? order?.orderId;
      if (txOrderId && txOrderId !== orderId) return;
      if (isPaid(order?.paymentStatus)) {
        markPaid("payment-transaction-updated");
      } else if (
        paymentStep === "card_waiting" &&
        (isFailed(order?.paymentStatus) ||
          tx?.status === "REJECTED" ||
          tx?.status === "CANCELLED" ||
          tx?.status === "ERROR")
      ) {
        setPaymentStep("card_declined");
        toast.error("Pagamento não aprovado. Tente novamente.");
      }
    });

    socket.on("payment-expired", (payload: any) => {
      // [redacted log]
      const order = payload?.order ?? payload;
      const txOrderId = order?.id ?? order?.orderId ?? payload?.orderId;
      if (txOrderId && txOrderId !== orderId) return;
      showPixExpiredScreen();
    });

    // Polling fallback every 3s: if socket fails or reconnects late, polling catches up.
    let cancelled = false;
    const pollId = window.setInterval(async () => {
      if (cancelled) return;
      const res = await getPublicOrderStatus(orderId);
      if (!res) return;
      if (isPaid(res.paymentStatus)) markPaid("polling");
      else if (paymentStep === "card_waiting" && isFailed(res.paymentStatus)) {
        setPaymentStep("card_declined");
        toast.error("Pagamento não aprovado. Tente novamente.");
      }
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
      socket.disconnect();
    };
  }, [confirmation?.id, paymentStep, menu?.event?.id]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (invalidTotemLink) {
      logTotemPublicApiError("Link do totem invalido", new Error("Missing totem route params"), {
        eventSlug: slug,
        organizationSlug,
      });
      setError("Link do totem inválido.");
      setLoading(false);
      return () => {
        alive = false;
      };
    }
    if (!organizationSlug) {
      resolveLegacyPublicEvent(slug)
        .then((result) => {
          if (!alive) return;
          setLegacyResolution(result);
          if (result.canonicalUrl) {
            window.location.replace(result.canonicalUrl);
            return;
          }
          if (result.code === "AMBIGUOUS_EVENT_SLUG") {
            setError(result.message ?? "Este link não identifica um evento de forma única.");
          } else if (result.code === "LEGACY_EVENT_SLUG") {
            setError(result.message ?? "Use a URL canônica da organização para acessar este evento.");
          } else {
            setError("Evento não encontrado");
          }
        })
        .catch((e) => {
          logTotemPublicApiError("Falha ao resolver evento legado", e, {
            eventSlug: slug,
            organizationSlug,
          });
          if (alive) setError(toFriendlyMessage(e, "Não foi possível carregar o cardápio."));
        })
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }
    getCanonicalPublicMenu({
      organizationSlug,
      eventSlug: slug,
    })
      .then((m) => {
        if (!alive) return;
        setMenu(m);
        setActiveCat(m.categories[0]?.id ?? null);
      })
      .catch((e) => {
        logTotemPublicApiError("Falha ao carregar cardapio canonico", e, {
          eventSlug: slug,
          organizationSlug,
        });
        if (alive) setError(toFriendlyMessage(e, "Não foi possível carregar o cardápio."));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug, organizationSlug, invalidTotemLink]);

  const event = menu?.event;
  const totemPixAvailable =
    checkoutSettings?.totem?.pixAvailable ??
    checkoutSettings?.mercadoPago?.pixAutomaticAvailable ??
    false;
  const totemCardAvailable =
    checkoutSettings?.totem?.cardAvailable ??
    checkoutSettings?.mercadoPago?.terminalEnabled ??
    checkoutSettings?.mercadoPago?.cardEnabled ??
    false;
  const branding = usePublicEventBranding(event);
  const primary = branding.primaryColor;
  const secondary = branding.secondaryColor;
  const banner = branding.bannerUrl;
  const bannerMobile = branding.bannerMobileUrl;
  const logo = branding.logoUrl;
  const defaultProductImageUrl = branding.defaultProductImageUrl;
  const eventName = branding.name || event?.name || "Cardápio";
  const brandGradient = `linear-gradient(135deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 100%)`;

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const totalCents = cart.reduce((s, c) => s + c.unitPriceInCents * c.quantity, 0);

  useEffect(() => {
    if (!event?.id) {
      setCheckoutSettings(null);
      return;
    }
    let alive = true;
    setCheckoutSettingsLoading(true);
    getCheckoutPaymentSettings(event.id, "TOTEM", { organizationSlug, eventSlug: slug })
      .then((settings) => {
        if (!alive) return;
        setCheckoutSettings(settings);
        const pixAllowed =
          settings.totem?.pixAvailable ?? settings.mercadoPago?.pixAutomaticAvailable ?? false;
        const cardAllowed =
          settings.totem?.cardAvailable ??
          settings.mercadoPago?.terminalEnabled ??
          settings.mercadoPago?.cardEnabled ??
          false;
        if (!pixAllowed && cardAllowed) {
          setPaymentMethod("CARD");
        } else if (pixAllowed) {
          setPaymentMethod("PIX");
        }
      })
      .catch((err) => {
        logTotemPublicApiError("Falha ao carregar pagamentos do totem", err, {
          eventSlug: slug,
          organizationSlug,
          payload: { eventId: event.id, context: "TOTEM" },
        });
        if (!alive) return;
        setCheckoutSettings(null);
        toast.error(toFriendlyMessage(err, "Não foi possível carregar os pagamentos do totem."));
      })
      .finally(() => {
        if (alive) setCheckoutSettingsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [event?.id]);

  const productsByCat = useMemo(() => {
    const map: Record<string, PublicProduct[]> = {};
    if (!menu) return map;
    for (const c of menu.categories) {
      const list = c.products ?? menu.products?.filter((p) => p.categoryId === c.id) ?? [];
      map[c.id] = list.filter(isAvailable);
    }
    return map;
  }, [menu]);

  const hasAnyProducts = useMemo(() => {
    return Object.values(productsByCat).some((list) => list.length > 0);
  }, [productsByCat]);

  // Sync cart with available products
  useEffect(() => {
    if (!menu || !hasAnyProducts) return;

    setCart((prev) => {
      const filtered = prev.filter((item) => {
        // Find the product in any category of the fresh menu
        let found = false;
        for (const catId in productsByCat) {
          if (productsByCat[catId].some((p) => p.id === item.product.id)) {
            found = true;
            break;
          }
        }
        return found;
      });

      if (filtered.length !== prev.length) {
        toast.info("Alguns itens do seu carrinho não estão mais disponíveis e foram removidos.");
      }
      return filtered;
    });
  }, [menu, productsByCat, hasAnyProducts]);

  const addToCart = (product: PublicProduct) => {
    if (product.soldOut === true) {
      toast.error("Este produto não está mais disponível.");
      return;
    }
    if (!isAvailable(product)) {
      toast.error("Este produto não está mais disponível.");
      return;
    }
    setProductNotes("");
    setAddingProduct(product);
  };

  const addConfiguredToCart = ({
    product,
    quantity,
    unitPriceInCents,
    notes,
    selectedOptions,
    selectedFlavorProductIds,
    displayFlavors,
  }: {
    product: PublicProduct;
    quantity: number;
    unitPriceInCents: number;
    notes?: string;
    selectedOptions: NonNullable<CartItem["selectedOptions"]>;
    selectedFlavorProductIds: string[];
    displayFlavors: NonNullable<CartItem["displayFlavors"]>;
  }) => {
    const max = maxQty(product);
    setCart((prev) => {
      const optionKey = selectedOptions
        .map((group) => `${group.optionGroupId}:${group.optionIds.join(",")}`)
        .join("|");
      const flavorKey = selectedFlavorProductIds.join(",");
      const normalizedNotes = notes?.trim() ?? "";
      const key = `${product.id}::${optionKey}::${flavorKey}::${normalizedNotes}`;
      const i = prev.findIndex((c) => c.key === key);
      if (i >= 0) {
        if (prev[i].quantity + quantity > max) {
          toast.error(`Restam apenas ${max} ${max === 1 ? "unidade" : "unidades"} deste produto.`);
          return prev;
        }
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + quantity, product };
        return copy;
      }
      if (quantity > max) {
        toast.error("Este produto não está mais disponível.");
        return prev;
      }
      return [
        ...prev,
        {
          key,
          product,
          quantity,
          notes: normalizedNotes || undefined,
          selectedOptions,
          selectedFlavorProductIds,
          displayFlavors,
          unitPriceInCents,
        },
      ];
    });
  };

  const dec = (key: string) => {
    setCart((prev) =>
      prev.flatMap((c) =>
        c.key === key ? (c.quantity > 1 ? [{ ...c, quantity: c.quantity - 1 }] : []) : [c],
      ),
    );
  };

  const inc = (key: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;
        const max = maxQty(c.product);
        if (c.quantity + 1 > max) {
          toast.error(`Restam apenas ${max} ${max === 1 ? "unidade" : "unidades"} deste produto.`);
          return c;
        }
        return { ...c, quantity: c.quantity + 1 };
      }),
    );
  };

  const remove = (key: string) => {
    setCart((prev) => prev.filter((c) => c.key !== key));
  };

  const validateName = (raw: string): string | null => {
    const name = raw.trim();
    if (name.length === 0) return "Informe seu nome para continuar";
    if (name.length < 2) return "Nome muito curto";
    if (name.length > 60) return "Nome muito longo";
    if (!/^[\p{L}\s'.-]+$/u.test(name)) return "Use apenas letras";
    return null;
  };

  // Validates name + cart, refreshes menu and re-checks stock. Returns true on ready.
  const validateBeforeSubmit = async (): Promise<boolean> => {
    if (cart.length === 0) {
      toast.error("Adicione itens ao pedido antes de finalizar");
      return false;
    }
    const err = validateName(customerName);
    if (err) {
      setNameError(err);
      setCartOpen(true);
      toast.error(err);
      return false;
    }
    setNameError(null);
    try {
      const fresh = organizationSlug
        ? await getCanonicalPublicMenu({
            organizationSlug,
            eventSlug: slug,
          })
        : await getPublicMenu(slug);
      setMenu(fresh);
      const freshProducts = new Map<string, PublicProduct>();
      for (const c of fresh.categories) {
        for (const p of c.products ?? []) freshProducts.set(p.id, p);
      }
      for (const p of fresh.products ?? []) freshProducts.set(p.id, p);
      for (const item of cart) {
        const fp = freshProducts.get(item.product.id);
        if (!fp || fp.active === false || fp.soldOut === true) {
          toast.error(`Este produto não está mais disponível: ${item.product.name}`);
          return false;
        }
        if (fp.trackStock === true) {
          const stock = fp.stockQuantity ?? 0;
          if (stock <= 0) {
            toast.error(`Este produto não está mais disponível: ${item.product.name}`);
            return false;
          }
          if (item.quantity > stock) {
            toast.error(
              `Restam apenas ${stock} ${stock === 1 ? "unidade" : "unidades"} de ${item.product.name}.`,
            );
            return false;
          }
        }
      }
      return true;
    } catch (e) {
      logTotemPublicApiError("Falha ao validar pedido antes do envio", e, {
        eventSlug: slug,
        organizationSlug,
      });
      handleApiError(e, "Não foi possível validar seu pedido. Tente novamente.");
      return false;
    }
  };

  const buildOrderPayload = (method: "PIX" | "CARD"): Parameters<typeof createPublicOrder>[1] => {
    const payload: Parameters<typeof createPublicOrder>[1] = {
      customerName: customerName.trim(),
      checkoutContext: "TOTEM",
      paymentMethod: method,
      items: cart.map((c) => ({
        productId: c.product.id,
        quantity: c.quantity,
        notes: c.notes,
        selectedOptions: c.selectedOptions?.map((group) => ({
          optionGroupId: group.optionGroupId,
          optionIds: group.optionIds,
        })),
        selectedFlavorProductIds: c.selectedFlavorProductIds,
      })),
    };
    payload.paymentStatus = "PENDING";
    payload.status = method === "PIX" ? "PENDING" : "CONFIRMED";
    return payload;
  };

  const handleOrderCreated = async (order: PublicOrderResponse, method: "PIX" | "CARD") => {
    const num = String(order.number ?? order.orderNumber ?? order.code ?? order.id);
    const returnedPending = (order.paymentStatus ?? "").toUpperCase() === "PENDING";
    const awaitingPayment = method === "PIX" && returnedPending;

    setPaymentStep("loading");

    // Set confirmation early so the UI changes to the loading state
    setConfirmation({
      id: order.id,
      number: num,
      pix: method === "PIX",
      totalInCents: order.totalInCents || totalCents,
      customerName: customerName.trim(),
      transaction: null,
      error: null,
      checkoutSettings: undefined,
    });

    if (awaitingPayment) {
      try {
        const checkoutResponse = await Promise.race([
          checkoutPayment(
            order.id,
            { context: "TOTEM", paymentMethod: "PIX" },
            { organizationSlug, eventSlug: slug },
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("CHECKOUT_TIMEOUT")), 20000),
          ),
        ]);

        const nextPaymentStep =
          checkoutResponse.paymentStep === "pix_manual"
            ? "pix_unavailable"
            : checkoutResponse.paymentStep;
        setPaymentStep(nextPaymentStep);
        setConfirmation((prev) =>
          prev
            ? {
                ...prev,
                pix: nextPaymentStep !== "paid",
                transaction: checkoutResponse.paymentTransaction,
                message: checkoutResponse.message,
                error:
                  nextPaymentStep === "pix_unavailable"
                    ? checkoutResponse.message ?? "PIX indisponível neste totem."
                    : prev.error,
              }
            : null,
        );
      } catch (err) {
        logTotemPublicApiError("Falha ao iniciar pagamento do checkout", err, {
          eventSlug: slug,
          organizationSlug,
          payload: { orderId: order.id, context: "TOTEM", paymentMethod: "PIX" },
        });
        const isTimeout = (err as Error)?.message === "CHECKOUT_TIMEOUT";
        setPaymentStep("operator");
        setConfirmation((prev) =>
          prev
            ? {
                ...prev,
                error: isTimeout
                  ? "Não foi possível iniciar o pagamento agora. Tente novamente ou chame o operador."
                  : "Não foi possível carregar as opções de pagamento.",
              }
            : null,
        );
        toast.error(
          isTimeout
            ? "Tempo esgotado ao iniciar o pagamento. Tente novamente."
            : "Não foi possível iniciar o pagamento.",
        );
      }
    } else {
      if (!organizationSlug) {
        setPaymentStep("operator");
        setConfirmation((prev) =>
          prev
            ? {
                ...prev,
                error: "Link do totem inválido para pagamento com cartão.",
              }
            : null,
        );
        return;
      }

      try {
        const { paymentTransaction } = await createTotemCardPaymentIntent({
          organizationSlug,
          eventSlug: slug,
          orderId: order.id,
        });

        setPaymentStep("card_waiting");
        setConfirmation((prev) =>
          prev
            ? {
                ...prev,
                pix: false,
                transaction: paymentTransaction,
                message: "Aproxime ou insira o cartão no terminal do totem.",
                error: null,
              }
            : null,
        );
        toast.info("Aguardando pagamento no terminal.");
      } catch (err) {
        logTotemPublicApiError("Falha ao iniciar pagamento com cartão do totem", err, {
          eventSlug: slug,
          organizationSlug,
          payload: { orderId: order.id, context: "TOTEM", paymentMethod: "CARD" },
        });
        setPaymentStep("operator");
        setConfirmation((prev) =>
          prev
            ? {
                ...prev,
                error:
                  "Não foi possível iniciar o pagamento com cartão. Chame o operador.",
              }
            : null,
        );
        toast.error("Não foi possível iniciar o pagamento com cartão.");
      }
    }

    setCart([]);
    setCustomerName("");
    setCartOpen(false);
    setPixOpen(false);
  };

  const sendOrder = async (method: "PIX" | "CARD") => {
    setSubmitting(true);
    let payload: ReturnType<typeof buildOrderPayload> | null = null;
    try {
      payload = buildOrderPayload(method);
      const order = organizationSlug
        ? await createPublicOrderCanonical(organizationSlug, slug, payload)
        : await createPublicOrder(slug, payload);
      await handleOrderCreated(order, method);
    } catch (e) {
      logTotemPublicApiError("Falha ao criar pedido do totem", e, {
        eventSlug: slug,
        organizationSlug,
        payload,
      });
      const msg = String((e as { message?: string })?.message ?? "").toLowerCase();
      if (
        msg.includes("stock") ||
        msg.includes("estoque") ||
        msg.includes("sold") ||
        msg.includes("esgot")
      ) {
        toast.error("Estoque insuficiente para este produto.");
      } else {
        handleApiError(e, "Não foi possível finalizar seu pedido. Tente novamente.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitOrder = async () => {
    const ok = await validateBeforeSubmit();
    if (!ok) return;

    if (paymentMethod === "PIX") {
      if (!totemPixAvailable) {
        toast.error(
          checkoutSettings?.totem?.unavailablePixReason ??
            "PIX automático indisponível neste totem.",
        );
        return;
      }
      await sendOrder("PIX");
      return;
    }

    if (!totemCardAvailable) {
      toast.error("Pagamento com cartão indisponível neste totem.");
      return;
    }
    await sendOrder("CARD");
  };

  if (loading) {
    return <PublicChannelLoading />;
  }

  if (invalidTotemLink || error || !menu) {
    return (
      <PublicChannelError
        message={invalidTotemLink ? "Link do totem inválido." : error ?? "Evento não encontrado"}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const cartHasItems = totalItems > 0;

  if (showWelcome) {
    return (
      <TotemWelcomeScreen
        event={event}
        onStart={() => {
          setShowWelcome(false);
        }}
      />
    );
  }

  return (
    <div
      className={`min-h-[100dvh] overflow-x-hidden bg-background pb-40 ${isKioskMode ? "kiosk-mode select-none" : ""}`}
      style={{
        ["--brand-primary" as string]: primary,
        ["--brand-secondary" as string]: secondary,
        ["--primary" as string]: primary,
        ["--primary-glow" as string]: secondary,
        overscrollBehaviorX: "none",
      }}
    >
      <header className="relative">
        <div className="relative h-40 w-full overflow-hidden sm:h-56 md:h-60">
          {banner || bannerMobile ? (
            <>
              <picture className="block h-full w-full">
                {bannerMobile && <source srcSet={bannerMobile} media="(orientation: portrait)" />}
                <img
                  src={banner ?? bannerMobile ?? ""}
                  alt=""
                  aria-hidden
                  className="h-full w-full object-cover object-center"
                />
              </picture>
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
            </>
          ) : (
            <>
              <div className="h-full w-full" style={{ backgroundImage: brandGradient }} />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            </>
          )}
        </div>

        <div className="mx-auto -mt-10 max-w-5xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:items-end sm:gap-4">
            <div className="relative shrink-0">
              {logo ? (
                <img
                  src={logo}
                  alt={eventName}
                  className="h-20 w-20 rounded-xl border-[3px] border-background bg-card object-cover shadow-xl ring-1 ring-border/40 min-[390px]:h-24 min-[390px]:w-24 sm:h-28 sm:w-28 sm:rounded-2xl sm:border-4"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border-[3px] border-background bg-gradient-to-br from-primary to-primary-glow text-2xl font-black text-primary-foreground shadow-xl min-[390px]:h-24 min-[390px]:w-24 sm:h-28 sm:w-28 sm:rounded-2xl sm:border-4 sm:text-3xl">
                  {eventName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-0.5 sm:pb-1.5">
              <div className="mb-1.5 inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-primary">
                Autoatendimento
              </div>
              <h1 className="line-clamp-2 break-words text-xl font-black leading-tight tracking-tight text-foreground min-[390px]:text-2xl sm:text-3xl">
                {eventName}
              </h1>
              {event?.totemWelcomeMessage && (
                <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                  {event.totemWelcomeMessage}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {menu.categories.length > 0 && (
        <nav className="sticky top-0 z-30 mt-4 border-b border-border/60 bg-background/90 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl overflow-x-auto no-scrollbar touch-pan-x px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1.5 py-3">
              {menu.categories.map((c) => {
                const hasProds = (productsByCat[c.id]?.length ?? 0) > 0;
                if (!hasProds) return null;
                const isActive = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveCat(c.id);
                      const el = document.getElementById(`cat-${c.id}`);
                      if (el) {
                        const offset = 150;
                        const bodyRect = document.body.getBoundingClientRect().top;
                        const elementRect = el.getBoundingClientRect().top;
                        const elementPosition = elementRect - bodyRect;
                        window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
                      }
                    }}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all active:scale-95 sm:px-5 sm:py-2.5 sm:text-base ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-card text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* Menu Content */}
      <main className="mx-auto mt-4 w-full max-w-5xl space-y-8 px-4 pb-44 sm:px-6 lg:px-8">
        {!hasAnyProducts ? (
          <div className="text-center py-20 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-card p-10 text-center">
              <UtensilsCrossed className="mx-auto mb-3 h-12 w-12 text-muted-foreground/60" />
              <h2 className="text-xl font-medium text-foreground">Cardápio em preparação</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Volte em instantes para conferir as novidades.
              </p>
            </div>
          </div>
        ) : (
          menu.categories.map((cat) => (
            <CategorySection
              key={cat.id}
              category={cat}
              products={productsByCat[cat.id] ?? []}
              onAdd={addToCart}
              cart={cart}
              inc={inc}
              dec={dec}
              isKioskMode={isKioskMode}
              defaultProductImageUrl={defaultProductImageUrl}
            />
          ))
        )}
      </main>

      {cartHasItems && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-primary-glow p-3 text-primary-foreground shadow-2xl shadow-primary/30 ring-1 ring-primary/30">
            <button
              onClick={() => setCartOpen(true)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left font-semibold transition-all active:scale-[0.99]"
              aria-label="Ver carrinho"
            >
              <div className="relative">
                <ShoppingCart className="size-7" />
                <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-background text-[10px] font-black text-primary shadow">
                  {totalItems}
                </span>
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  Total
                </div>
                <div className="text-xl font-black">
                  {formatBRL(totalCents)}
                </div>
              </div>
            </button>

            <Button
              onClick={() => setCartOpen(true)}
              className="h-14 shrink-0 rounded-xl bg-background px-5 text-base font-black text-primary shadow-lg transition-all active:scale-[0.98] sm:px-8 sm:text-lg"
            >
              Finalizar
            </Button>
          </div>
        </div>
      )}

      {/* Product modal */}
      <Dialog
        open={!!addingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setAddingProduct(null);
            setProductNotes("");
          }
        }}
      >
        <DialogContent className="w-[min(94vw,760px)] gap-0 overflow-hidden rounded-3xl p-0">
          {addingProduct && (
            <TotemProductModalBody
              product={addingProduct}
              defaultProductImageUrl={defaultProductImageUrl}
              notes={productNotes}
              setNotes={setProductNotes}
              onAdd={(payload) => {
                addConfiguredToCart(payload);
                setAddingProduct(null);
                setProductNotes("");
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <CartSheet
          cart={cart}
          totalCents={totalCents}
          customerName={customerName}
          setCustomerName={(s) => {
            setCustomerName(s);
            if (nameError) setNameError(validateName(s));
          }}
          nameError={nameError}
          inc={inc}
          dec={dec}
          remove={remove}
          submit={submitOrder}
          submitting={submitting}
          primary={primary}
          secondary={secondary}
          isKioskMode={isKioskMode}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          pixAvailable={totemPixAvailable}
          cardAvailable={totemCardAvailable}
          paymentSettingsLoading={checkoutSettingsLoading}
          pixUnavailableReason={checkoutSettings?.totem?.unavailablePixReason ?? null}
          defaultProductImageUrl={defaultProductImageUrl}
        />
      </Sheet>

      {/* PIX payment dialog */}
      <Dialog
        open={pixOpen}
        onOpenChange={(o) => {
          if (submitting) return;
          setPixOpen(o);
        }}
      >
        <PixDialog
          event={event}
          totalCents={totalCents}
          submitting={submitting}
          onConfirm={() => sendOrder("PIX")}
          primary={primary}
          secondary={secondary}
          isKioskMode={isKioskMode}
        />
      </Dialog>

      {/* PIX Expired Screen */}
      {pixExpired && (
        <div className="fixed inset-0 z-[110] bg-background animate-in fade-in duration-300 flex flex-col items-center justify-center px-6 text-center">
          <div className="size-28 rounded-full flex items-center justify-center bg-red-100 text-red-600 mb-6">
            <AlertTriangle className="size-16" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-black" style={{ color: primary }}>
            PIX Expirado
          </h2>
          <p className="text-base sm:text-lg font-medium text-muted-foreground mt-4 max-w-md">
            O tempo para pagamento terminou.
          </p>
          <p className="text-base sm:text-lg font-medium text-muted-foreground max-w-md">
            Seu pedido foi cancelado automaticamente.
          </p>
          <Button
            className="mt-8 h-14 px-8 font-black rounded-2xl text-base"
            style={{ background: primary, color: "white" }}
            onClick={resetTotem}
          >
            Novo Pedido
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            Retornando ao início em alguns segundos...
          </p>
        </div>
      )}

      {/* Success/Confirmation View - Real Fullscreen for Totem */}
      {!pixExpired &&
        confirmation &&
        confirmation.pix &&
        paymentStep === "pix_automatic" &&
        confirmation.transaction && (
          <div className="fixed inset-0 z-[100] bg-background animate-in fade-in duration-300 flex flex-col items-center px-4 py-4 text-center overflow-hidden">
            <div className="w-full max-w-xl flex flex-col items-center flex-1 min-h-0">
              <h2
                className="text-2xl sm:text-3xl font-black leading-tight"
                style={{ color: primary }}
              >
                Pague com PIX
              </h2>
              <p className="text-base sm:text-lg font-bold mt-1" style={{ color: primary }}>
                Pedido #{confirmation.number} ? {formatBRL(confirmation.totalInCents || 0)}
              </p>
              {confirmation.customerName && (
                <p className="text-sm text-muted-foreground font-medium mt-0.5">
                  Cliente: {confirmation.customerName}
                </p>
              )}

              {remainingSeconds !== null && (
                <div className="mt-2 flex flex-col items-center">
                  <div
                    className={`text-xs font-bold uppercase tracking-widest ${remainingSeconds < 30 ? "text-red-600" : remainingSeconds < 60 ? "text-amber-600" : "text-muted-foreground"}`}
                  >
                    {remainingSeconds < 60
                      ? "Aten??o: Menos de 1 minuto restante"
                      : "Tempo restante para pagamento"}
                  </div>
                  <div
                    className={`font-black tabular-nums leading-none mt-1 ${
                      remainingSeconds < 30
                        ? "text-red-600 text-4xl animate-pulse"
                        : remainingSeconds < 60
                          ? "text-amber-600 text-3xl"
                          : "text-2xl"
                    }`}
                    style={remainingSeconds >= 60 ? { color: primary } : undefined}
                  >
                    {String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:
                    {String(remainingSeconds % 60).padStart(2, "0")}
                  </div>
                </div>
              )}

              <div className="bg-white p-3 rounded-2xl border-2 shadow-sm mt-3">
                {confirmation.transaction.qrCodeBase64 ? (
                  <img
                    src={`data:image/png;base64,${confirmation.transaction.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-[min(70vw,420px)] h-[min(70vw,420px)] block"
                  />
                ) : confirmation.transaction.qrCode ? (
                  <QRCodeSVG value={confirmation.transaction.qrCode} size={380} />
                ) : null}
              </div>

              {confirmation.transaction.pixCopyPaste && (
                <Button
                  variant="secondary"
                  className="mt-3 h-11 px-5 font-bold rounded-xl gap-2 text-sm shadow-sm"
                  onClick={() => {
                    const code = confirmation.transaction?.pixCopyPaste;
                    if (!code) {
                      toast.error("Código PIX indisponível. Tente novamente ou chame o operador.");
                      return;
                    }
                    navigator.clipboard.writeText(code);
                    toast.success("Código PIX copiado.");
                  }}
                >
                  <Copy className="size-4" />
                  Copiar código PIX
                </Button>
              )}

              <p className="mt-3 text-sm text-muted-foreground font-medium">
                Após pagar, aguarde a confirmação automática.
              </p>

              <Button
                variant="outline"
                className="mt-auto mb-2 h-12 px-6 font-black rounded-2xl border-2"
                onClick={() => {
                  setConfirmation(null);
                  setPaymentStep(null);
                }}
              >
                Cancelar pedido
              </Button>
            </div>
          </div>
        )}

      {confirmation &&
        !(confirmation.pix && paymentStep === "pix_automatic" && confirmation.transaction) && (
          <div className="fixed inset-0 z-[100] bg-background animate-in fade-in duration-300 flex flex-col items-center p-6 text-center overflow-y-auto">
            <div className="max-w-2xl w-full my-auto flex flex-col items-center py-10">
              <div
                className={`mb-8 flex ${isKioskMode ? "size-28" : "size-24"} items-center justify-center rounded-full shadow-xl animate-in zoom-in duration-500 delay-150 flex-shrink-0`}
                style={{ background: secondary, color: primary }}
              >
                {paymentStep === "paid" ? (
                  <PartyPopper className={isKioskMode ? "size-16" : "size-12"} />
                ) : paymentStep === "card_waiting" || paymentStep === "card_declined" ? (
                  <CreditCard className={isKioskMode ? "size-16" : "size-12"} />
                ) : (
                  <Clock className={isKioskMode ? "size-16" : "size-12"} />
                )}
              </div>

              <h2 className="text-4xl font-black mb-4 leading-tight" style={{ color: primary }}>
                {paymentStep === "pix_unavailable"
                  ? "PIX indisponível"
                  : paymentStep === "card_waiting"
                    ? "Aguardando cartão"
                    : paymentStep === "card_declined"
                      ? "Pagamento não aprovado"
                  : paymentStep === "operator"
                    ? "Pagamento pendente"
                    : paymentStep === "paid"
                      ? "Pagamento confirmado"
                      : "Pedido recebido!"}
              </h2>

              <p className="text-xl text-muted-foreground max-w-sm mx-auto mb-8 font-medium">
                {paymentStep === "loading"
                  ? "Iniciando pagamento..."
                  : paymentStep === "card_waiting"
                    ? "Aproxime ou insira o cartão no terminal do totem. O pedido só será concluído após aprovação."
                    : paymentStep === "card_declined"
                      ? "Não foi possível aprovar o pagamento. Tente novamente ou chame o operador."
                  : paymentStep === "paid"
                    ? "Seu pagamento foi confirmado. Seu pedido será preparado."
                    : confirmation.pix
                      ? "Seu pedido foi registrado e está aguardando confirmação do pagamento."
                      : "Seu pedido foi recebido e será processado."}
              </p>

              <div className="bg-muted/30 w-full max-w-md py-8 px-6 rounded-[2.5rem] border-2 border-dashed mb-8">
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      Número
                    </div>
                    <div
                      className="text-4xl font-black tracking-tighter"
                      style={{ color: primary }}
                    >
                      #{confirmation.number}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      Total
                    </div>
                    <div className="text-3xl font-black" style={{ color: primary }}>
                      {formatBRL(confirmation.totalInCents || 0)}
                    </div>
                  </div>
                  {confirmation.customerName && (
                    <div className="col-span-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                        Cliente
                      </div>
                      <div className="text-xl font-bold" style={{ color: primary }}>
                        {confirmation.customerName}
                      </div>
                    </div>
                  )}
                  <div className="col-span-2">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                      Status
                    </div>
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${
                        paymentStep === "paid"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {paymentStep === "paid" ? "Pago" : "Pagamento pendente"}
                    </div>
                  </div>
                </div>
              </div>

              {!confirmation.pix && paymentStep !== "paid" && (
                <div className="w-full max-w-md bg-white border-2 rounded-[2.5rem] p-8 mb-10 shadow-sm text-center">
                  {paymentStep === "card_waiting" ? (
                    <div className="space-y-4 py-4">
                      <Loader2 className="mx-auto size-12 animate-spin text-muted-foreground" />
                      <h3 className="text-xl font-black" style={{ color: primary }}>
                        Processando no terminal
                      </h3>
                      <p className="text-muted-foreground font-medium">
                        Aproxime ou insira o cartão e aguarde a confirmação automática.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4 py-4">
                      <div className="size-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                        <X className="size-8" />
                      </div>
                      {confirmation.error && (
                        <div className="p-3 bg-destructive/10 text-destructive text-sm font-bold rounded-xl">
                          {confirmation.error}
                        </div>
                      )}
                      <p className="text-muted-foreground font-medium">
                        O pedido não será enviado para produção enquanto o pagamento não for aprovado.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {confirmation.pix && paymentStep !== "paid" && (
                <div className="w-full max-w-md bg-white border-2 rounded-[2.5rem] p-8 mb-10 shadow-sm text-left">
                  {paymentStep === "loading" && (
                    <div className="flex flex-col items-center py-10 gap-4">
                      <Loader2 className="size-12 animate-spin text-muted-foreground" />
                      <p className="font-bold text-muted-foreground">Iniciando pagamento...</p>
                    </div>
                  )}

                  {paymentStep === "pix_automatic" && confirmation.transaction && (
                    <div className="space-y-6">
                      <h3
                        className="text-2xl font-black mb-2 flex items-center gap-2"
                        style={{ color: primary }}
                      >
                        <QrCode className="size-6" />
                        Pague com PIX
                      </h3>
                      <p className="text-sm font-medium text-muted-foreground mb-4">
                        Escaneie o QR Code ou copie o código PIX abaixo.
                      </p>

                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-white p-4 rounded-2xl border-2 shadow-sm">
                          {confirmation.transaction.qrCodeBase64 ? (
                            <img
                              src={`data:image/png;base64,${confirmation.transaction.qrCodeBase64}`}
                              alt="QR Code PIX"
                              className="size-48 sm:size-64"
                            />
                          ) : confirmation.transaction.qrCode ? (
                            <QRCodeSVG value={confirmation.transaction.qrCode} size={256} />
                          ) : null}
                        </div>

                        {confirmation.transaction.pixCopyPaste && (
                          <Button
                            variant="secondary"
                            className="w-full h-14 font-bold rounded-xl gap-2 text-lg shadow-sm"
                            onClick={() => {
                              const code = confirmation.transaction?.pixCopyPaste;
                              if (!code) {
                                toast.error(
                                  "Código PIX indisponível. Tente novamente ou chame o operador.",
                                );
                                return;
                              }
                              navigator.clipboard.writeText(code);
                              toast.success("Código PIX copiado.");
                            }}
                          >
                            <Copy className="size-5" />
                            Copiar código PIX
                          </Button>
                        )}
                      </div>

                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-800 text-sm font-bold flex gap-3 animate-pulse">
                        <Clock className="size-5 flex-shrink-0" />
                        <p>
                          Após o pagamento, aguarde a confirmação automática. Não feche esta tela
                          até concluir o pagamento.
                        </p>
                      </div>
                    </div>
                  )}

                  {(paymentStep === "pix_unavailable" || paymentStep === "operator") && (
                    <div className="space-y-4 text-center py-6">
                      <div className="size-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
                        <X className="size-8" />
                      </div>
                      {confirmation.error && (
                        <div className="p-3 bg-destructive/10 text-destructive text-sm font-bold rounded-xl mb-4">
                          {confirmation.error}
                        </div>
                      )}
                      <h3 className="text-xl font-black" style={{ color: primary }}>
                        {paymentStep === "pix_unavailable" ? "PIX indisponível" : "Pagamento pendente"}
                      </h3>
                      <p className="text-muted-foreground font-medium">
                        {paymentStep === "pix_unavailable"
                          ? "O Mercado Pago não está configurado corretamente para gerar PIX neste totem."
                          : "Use o terminal de cartão configurado ou procure um operador para concluir o pagamento."}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                {((!confirmation.pix && paymentStep !== "card_waiting") || paymentStep === "paid") && (
                  <Button
                    size="lg"
                    className={`flex-1 ${isKioskMode ? "h-20 text-xl" : "h-16 text-lg"} font-black rounded-3xl shadow-xl transition-all active:scale-95`}
                    style={{ background: primary, color: "#fff" }}
                    onClick={() => {
                      setConfirmation(null);
                      setPaymentStep(null);
                    }}
                  >
                    Novo pedido
                  </Button>
                )}
                <Button
                  size="lg"
                  variant="outline"
                  className={`flex-1 ${isKioskMode ? "h-20 text-xl" : "h-16 text-lg"} font-black rounded-3xl transition-all active:scale-95 border-2`}
                  onClick={() => {
                    setConfirmation(null);
                    setPaymentStep(null);
                  }}
                >
                  {confirmation.pix && paymentStep !== "paid"
                    ? "Cancelar pedido"
                    : "Voltar ao início"}
                </Button>
              </div>

              {((!confirmation.pix && paymentStep !== "card_waiting") || paymentStep === "paid") && (
                <p className="mt-8 text-xs text-muted-foreground opacity-50 font-medium italic">
                  Esta tela fechará automaticamente...
                </p>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

function TotemProductModalBody({
  product,
  defaultProductImageUrl,
  notes,
  setNotes,
  onAdd,
}: {
  product: PublicProduct;
  defaultProductImageUrl?: string | null;
  notes: string;
  setNotes: (value: string) => void;
  onAdd: (payload: {
    product: PublicProduct;
    quantity: number;
    unitPriceInCents: number;
    notes?: string;
    selectedOptions: NonNullable<CartItem["selectedOptions"]>;
    selectedFlavorProductIds: string[];
    displayFlavors: NonNullable<CartItem["displayFlavors"]>;
  }) => void;
}) {
  const [qty, setQty] = useState(1);
  const groups = useMemo(() => sortedGroups(getProductOptionGroups(product)), [product]);
  const flavorProducts = useMemo(
    () => getHalfAndHalfFlavors(product).sort((a, b) => a.name.localeCompare(b.name)),
    [product],
  );
  const acceptsHalfAndHalf =
    product.supportsHalfAndHalf === true ||
    product.acceptsHalfAndHalf === true ||
    product.pricingRule === "MAX_SELECTED_FLAVOR";
  const [pizzaMode, setPizzaMode] = useState<"WHOLE" | "HALF_AND_HALF">("WHOLE");
  const [secondFlavorId, setSecondFlavorId] = useState("");
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const group of groups) init[group.id] = [];
    return init;
  });

  useEffect(() => {
    setQty(1);
    setPizzaMode("WHOLE");
    setSecondFlavorId("");
    const init: Record<string, string[]> = {};
    for (const group of groups) init[group.id] = [];
    setSelectedByGroup(init);
  }, [groups, product.id]);

  function toggleOption(group: PublicProductOptionGroup, optionId: string) {
    setSelectedByGroup((prev) => {
      const current = prev[group.id] ?? [];
      const isSelected = current.includes(optionId);
      const max = Math.max(1, group.maxSelections || 1);
      let next: string[];
      if (max === 1) {
        next = isSelected ? [] : [optionId];
      } else if (isSelected) {
        next = current.filter((id) => id !== optionId);
      } else {
        if (current.length >= max) return prev;
        next = [...current, optionId];
      }
      return { ...prev, [group.id]: next };
    });
  }

  const sizeGroup = useMemo(() => groups.find((group) => isSizeGroup(group)) ?? null, [groups]);
  const selectedSizeOption = useMemo(() => {
    if (!sizeGroup) return null;
    const selectedId = selectedByGroup[sizeGroup.id]?.[0];
    if (!selectedId) return null;
    return sizeGroup.options.find((option) => option.id === selectedId) ?? null;
  }, [selectedByGroup, sizeGroup]);
  const selectedSizeOptionKey = selectedSizeOption?.key ?? null;
  const selectedSizeDeltaInCents = selectedSizeOption?.priceDeltaInCents ?? 0;
  const primaryFullPriceInCents = getPrice(product) + selectedSizeDeltaInCents;
  const secondFlavor = useMemo(
    () => flavorProducts.find((flavor) => flavor.id === secondFlavorId) ?? null,
    [flavorProducts, secondFlavorId],
  );
  const secondFlavorFullPriceInCents = secondFlavor
    ? resolveFlavorFullPrice(secondFlavor, selectedSizeOptionKey)
    : 0;
  const addonTotalInCents = useMemo(
    () =>
      groups.reduce((sum, group) => {
        if (isSizeGroup(group)) return sum;
        const ids = selectedByGroup[group.id] ?? [];
        for (const id of ids) {
          const option = group.options.find((o) => o.id === id);
          if (option) sum += option.priceDeltaInCents ?? 0;
        }
        return sum;
      }, 0),
    [groups, selectedByGroup],
  );
  const flavorBasePrice =
    acceptsHalfAndHalf && pizzaMode === "HALF_AND_HALF" && secondFlavor
      ? Math.max(primaryFullPriceInCents, secondFlavorFullPriceInCents)
      : primaryFullPriceInCents;
  const previewUnitPrice = flavorBasePrice + addonTotalInCents;
  const img = resolveAssetUrl(product.imageUrl) || defaultProductImageUrl || null;
  const badges = productBadges(product);
  const original = pick<number>(
    product as unknown as Record<string, unknown>,
    "originalPriceInCents",
    "oldPriceInCents",
    "compareAtPriceInCents",
  );

  const validation = useMemo(() => {
    if (acceptsHalfAndHalf && pizzaMode === "HALF_AND_HALF" && !secondFlavor) {
      return { ok: false, reason: "Escolha o segundo sabor" };
    }
    for (const group of groups) {
      const ids = selectedByGroup[group.id] ?? [];
      const min = group.required ? Math.max(1, group.minSelections || 1) : group.minSelections || 0;
      if (ids.length < min) return { ok: false, reason: `Selecione pelo menos ${min} em "${group.name}"` };
    }
    return { ok: true, reason: null as string | null };
  }, [acceptsHalfAndHalf, groups, pizzaMode, secondFlavor, selectedByGroup]);

  function handleAdd() {
    if (!validation.ok) {
      toast.error(validation.reason ?? "Complete as opções obrigatórias");
      return;
    }
    const selectedOptions = groups
      .map((group) => {
        const ids = selectedByGroup[group.id] ?? [];
        if (ids.length === 0) return null;
        const displayOptions = ids.map((id) => {
          const option = group.options.find((o) => o.id === id);
          return {
            groupName: group.name,
            optionName: option?.name ?? "",
            priceDeltaInCents: option?.priceDeltaInCents ?? 0,
          };
        });
        return { optionGroupId: group.id, optionIds: ids, displayOptions };
      })
      .filter((value): value is NonNullable<CartItem["selectedOptions"]>[number] => value !== null);
    const displayFlavors =
      pizzaMode === "HALF_AND_HALF" && secondFlavor
        ? [
            { id: product.id, name: product.name, priceInCents: primaryFullPriceInCents },
            { id: secondFlavor.id, name: secondFlavor.name, priceInCents: secondFlavorFullPriceInCents },
          ]
        : [];

    onAdd({
      product,
      quantity: qty,
      unitPriceInCents: previewUnitPrice,
      notes,
      selectedOptions,
      selectedFlavorProductIds: pizzaMode === "HALF_AND_HALF" && secondFlavor ? [secondFlavor.id] : [],
      displayFlavors,
    });
  }

  return (
    <div className="flex max-h-[90dvh] flex-col">
      <div className="relative h-64 w-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        {img ? (
          <ProductImage src={img} alt={product.name} size="lg" rounded="rounded-none" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <UtensilsCrossed className="h-16 w-16" />
          </div>
        )}
        {badges.length > 0 && (
          <div className="absolute left-4 top-4 flex flex-wrap gap-1">
            {badges.map((badge) => (
              <Badge key={badge.label} tone={badge.tone}>
                {badge.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-5 overflow-y-auto p-6">
        <div>
          <DialogTitle className="text-3xl font-black tracking-tight text-foreground">
            {product.name}
          </DialogTitle>
          {product.description && (
            <DialogDescription className="mt-2 text-base leading-relaxed text-muted-foreground">
              {product.description}
            </DialogDescription>
          )}
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-primary">{formatBRL(previewUnitPrice)}</span>
            {typeof original === "number" && original > getPrice(product) && (
              <span className="text-sm text-muted-foreground line-through">
                {formatBRL(original)}
              </span>
            )}
          </div>
        </div>

        {acceptsHalfAndHalf && flavorProducts.length > 0 && (
          <section className="rounded-xl border border-border/60 bg-muted/30">
            <div className="border-b border-border/50 px-4 py-3">
              <h3 className="text-base font-black text-foreground">Sabor da pizza</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                O valor da pizza meio a meio será o do sabor de maior preço.
              </p>
            </div>
            <div className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-2">
                {(["WHOLE", "HALF_AND_HALF"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPizzaMode(mode)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition active:scale-[0.98] ${
                      pizzaMode === mode
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {mode === "WHOLE" ? "Inteira" : "Meio a meio"}
                  </button>
                ))}
              </div>
              {pizzaMode === "HALF_AND_HALF" && (
                <div className="grid gap-2">
                  {flavorProducts.map((flavor) => (
                    <button
                      key={flavor.id}
                      type="button"
                      onClick={() => setSecondFlavorId(flavor.id)}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] ${
                        secondFlavorId === flavor.id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/70 bg-background text-foreground"
                      }`}
                    >
                      <span className="font-bold">{flavor.name}</span>
                      <span className="font-black text-primary">
                        {formatBRL(resolveFlavorFullPrice(flavor, selectedSizeOptionKey))}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {groups.map((group) => {
          const ids = selectedByGroup[group.id] ?? [];
          return (
            <section key={group.id} className="rounded-xl border border-border/60 bg-muted/30">
              <div className="flex items-start justify-between gap-3 border-b border-border/50 px-4 py-3">
                <div>
                  <h3 className="text-base font-black text-foreground">{group.name}</h3>
                  {group.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                  )}
                </div>
                {group.required && (
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary">
                    Obrigatório
                  </span>
                )}
              </div>
              <div className="grid gap-2 p-4">
                {sortedOptions(group.options).map((option) => {
                  const checked = ids.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => toggleOption(group, option.id)}
                      className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition active:scale-[0.98] ${
                        checked
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border/70 bg-background text-foreground"
                      }`}
                    >
                      <span className="font-bold">{option.name}</span>
                      <span className="font-black text-primary">
                        {option.priceDeltaInCents > 0 ? `+ ${formatBRL(option.priceDeltaInCents)}` : "Incluso"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="rounded-xl border border-border/60 bg-muted/30 p-4">
          <h3 className="text-base font-black text-foreground">Observações</h3>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex.: sem cebola, ponto da carne, retirar ingrediente..."
            className="mt-3 min-h-24 rounded-2xl text-base"
            maxLength={240}
          />
        </section>
      </div>

      <div className="flex flex-shrink-0 items-center gap-4 border-t border-border/60 bg-background p-5">
        <div className="flex items-center rounded-2xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setQty((value) => Math.max(1, value - 1))}
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-card text-primary shadow-sm active:scale-95"
            aria-label="Diminuir quantidade"
          >
            <Minus className="h-6 w-6" />
          </button>
          <span className="w-14 text-center text-2xl font-black text-foreground">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((value) => value + 1)}
            className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm active:scale-95"
            aria-label="Aumentar quantidade"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
        <Button
          type="button"
          onClick={handleAdd}
          className="h-16 flex-1 rounded-2xl bg-gradient-to-r from-primary to-primary-glow text-xl font-black text-primary-foreground shadow-lg shadow-primary/30"
        >
          Adicionar · {formatBRL(previewUnitPrice * qty)}
        </Button>
      </div>
    </div>
  );
}

function CategorySection({
  category,
  products,
  onAdd,
  cart,
  inc,
  dec,
  isKioskMode,
  defaultProductImageUrl,
}: {
  category: PublicCategory;
  products: PublicProduct[];
  onAdd: (p: PublicProduct) => void;
  cart: CartItem[];
  inc: (id: string) => void;
  dec: (id: string) => void;
  isKioskMode: boolean;
  defaultProductImageUrl?: string | null;
}) {
  if (products.length === 0) return null;
  return (
    <section id={`cat-${category.id}`} className="mb-10 scroll-mt-32 last:mb-32">
      <div className="mb-3 flex items-baseline justify-between px-1">
        <h2 className="text-2xl font-black tracking-tight text-foreground">
          {category.name}
        </h2>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {products.length} {products.length === 1 ? "item" : "itens"}
        </span>
      </div>
      {category.description && (
        <p className="text-muted-foreground mb-4 text-sm px-1 font-medium leading-relaxed">
          {category.description}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {products.map((p) => {
          const item = cart.find((c) => c.product.id === p.id);
          const img = resolveAssetUrl(p.imageUrl) || defaultProductImageUrl || null;
          const badges = productBadges(p);
          const original = pick<number>(
            p as unknown as Record<string, unknown>,
            "originalPriceInCents",
            "oldPriceInCents",
            "compareAtPriceInCents",
          );
          return (
            <article
              key={p.id}
              className="group relative flex w-full items-stretch gap-4 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
            >
              <button
                type="button"
                onClick={() => onAdd(p)}
                className="flex min-w-0 flex-1 flex-col text-left"
              >
                <div className="pr-1">
                  {badges.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {badges.map((badge) => (
                        <Badge key={badge.label} tone={badge.tone}>
                          {badge.label}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <h3 className="line-clamp-1 text-xl font-bold leading-tight text-foreground">
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-snug text-muted-foreground">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-2xl font-black text-primary">
                      {formatBRL(getPrice(p))}
                    </span>
                    {typeof original === "number" && original > getPrice(p) && (
                      <span className="text-sm text-muted-foreground line-through">
                        {formatBRL(original)}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => onAdd(p)}
                  className="relative h-32 w-32 overflow-hidden rounded-xl bg-gradient-to-br from-muted to-muted/50 sm:h-36 sm:w-36"
                >
                  {img ? (
                    <ProductImage
                      src={img}
                      alt={p.name}
                      size="sm"
                      rounded="rounded-xl"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
                      <UtensilsCrossed className="h-10 w-10" />
                    </div>
                  )}
                  {item && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <div className="rounded-full bg-card px-3 py-1 shadow-lg ring-1 ring-border/60">
                        <span className="text-sm font-black text-primary">
                          {item.quantity}x
                        </span>
                      </div>
                    </div>
                  )}
                </button>

                {item ? (
                  <div className="absolute -bottom-2 -right-2 flex items-center gap-1 rounded-full bg-card p-1 shadow-lg ring-2 ring-background">
                      <button
                        onClick={() => dec(item.key)}
                        className={`${isKioskMode ? "size-12" : "size-10"} rounded-full bg-muted flex items-center justify-center text-primary shadow-sm active:scale-90`}
                        aria-label="Diminuir"
                      >
                        <Minus className={isKioskMode ? "size-6" : "size-5"} />
                      </button>
                      <span className={`font-black ${isKioskMode ? "text-xl w-10" : "text-base w-7"} text-center text-primary`}>
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => inc(item.key)}
                        className={`${isKioskMode ? "size-12" : "size-10"} rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm active:scale-90`}
                        aria-label="Aumentar"
                      >
                        <Plus className={isKioskMode ? "size-6" : "size-5"} />
                      </button>
                  </div>
                ) : (
                  <button
                    onClick={() => onAdd(p)}
                    className="absolute -bottom-2 -right-2 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-lg shadow-primary/40 ring-2 ring-background transition group-hover:scale-110 group-active:scale-95"
                    aria-label="Adicionar"
                  >
                    <Plus className="size-6" strokeWidth={3} />
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function CartSheet({
  cart,
  totalCents,
  customerName,
  setCustomerName,
  nameError,
  inc,
  dec,
  remove,
  submit,
  submitting,
  primary,
  secondary,
  isKioskMode,
  paymentMethod,
  setPaymentMethod,
  pixAvailable,
  cardAvailable,
  paymentSettingsLoading,
  pixUnavailableReason,
  defaultProductImageUrl,
}: {
  cart: CartItem[];
  totalCents: number;
  customerName: string;
  setCustomerName: (s: string) => void;
  nameError: string | null;
  inc: (id: string) => void;
  dec: (id: string) => void;
  remove: (id: string) => void;
  submit: () => void;
  submitting: boolean;
  primary: string;
  secondary: string;
  isKioskMode: boolean;
  paymentMethod: "PIX" | "CARD";
  setPaymentMethod: (m: "PIX" | "CARD") => void;
  pixAvailable: boolean;
  cardAvailable: boolean;
  paymentSettingsLoading: boolean;
  pixUnavailableReason?: string | null;
  defaultProductImageUrl?: string | null;
}) {
  const empty = cart.length === 0;
  const selectedMethodAvailable =
    paymentMethod === "PIX" ? pixAvailable : cardAvailable;

  useEffect(() => {
    if (paymentMethod === "PIX" && !pixAvailable && cardAvailable) {
      setPaymentMethod("CARD");
    } else if (paymentMethod === "CARD" && !cardAvailable && pixAvailable) {
      setPaymentMethod("PIX");
    }
  }, [paymentMethod, pixAvailable, cardAvailable, setPaymentMethod]);
  return (
    <SheetContent
      side="bottom"
      className={`${isKioskMode ? "h-full" : "h-[92dvh]"} w-full flex flex-col p-0 border-none shadow-2xl rounded-t-[2.5rem] overflow-hidden`}
    >
      <SheetHeader
        className="p-5 pt-8 flex-shrink-0"
        style={{ background: primary, color: "#fff" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <SheetTitle className="text-white text-2xl font-black">Meu pedido</SheetTitle>
            <SheetDescription className="text-white/80 text-sm font-medium">
              {cart.length} {cart.length === 1 ? "item selecionado" : "itens selecionados"}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {empty ? (
          <div className="text-center py-20 text-muted-foreground">
            <div className="bg-muted size-20 rounded-full flex items-center justify-center mx-auto mb-6 opacity-50">
              <ShoppingCart className="size-10" />
            </div>
            <p className="text-xl font-bold">Seu carrinho está vazio</p>
            <p className="text-sm mt-2">Escolha alguns produtos para começar seu pedido.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cart.map((c) => {
              const img = resolveAssetUrl(c.product.imageUrl) || defaultProductImageUrl || null;
              return (
                <div
                  key={c.key}
                  className="bg-card p-4 rounded-3xl flex gap-4 items-center border border-border/70 hover:border-primary/30 transition-colors shadow-sm"
                >
                  <div className="size-20 flex-shrink-0">
                    <ProductImage
                      src={img}
                      alt={c.product.name}
                      size="sm"
                      rounded="rounded-2xl"
                      className="h-full w-full object-cover shadow-sm"
                    />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="font-bold leading-tight text-lg line-clamp-1">
                        {c.product.name}
                      </div>
                      <div className="font-black whitespace-nowrap text-lg">
                        {formatBRL(c.unitPriceInCents * c.quantity)}
                      </div>
                    </div>
                    {(c.displayFlavors?.length || c.selectedOptions?.length || c.notes) && (
                      <div className="space-y-1 text-xs font-medium text-muted-foreground">
                        {c.displayFlavors && c.displayFlavors.length > 0 && (
                          <p className="line-clamp-1">
                            Sabores: {c.displayFlavors.map((flavor) => flavor.name).join(" + ")}
                          </p>
                        )}
                        {c.selectedOptions?.flatMap((group) =>
                          group.displayOptions.map((option) => `${option.groupName}: ${option.optionName}`),
                        ).map((label) => (
                          <p key={label} className="line-clamp-1">{label}</p>
                        ))}
                        {c.notes && <p className="line-clamp-1">Obs.: {c.notes}</p>}
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1 bg-background rounded-full p-1 shadow-sm border border-border/70">
                        <button
                          onClick={() => dec(c.key)}
                          className="size-10 rounded-full flex items-center justify-center active:bg-muted transition-colors"
                          aria-label="Diminuir"
                        >
                          <Minus className="size-5" />
                        </button>
                        <span className="font-black w-8 text-center text-lg">{c.quantity}</span>
                        <button
                          onClick={() => inc(c.key)}
                          className="size-10 rounded-full flex items-center justify-center active:bg-muted transition-colors"
                          aria-label="Aumentar"
                        >
                          <Plus className="size-5" />
                        </button>
                      </div>

                      <button
                        onClick={() => remove(c.key)}
                        className="size-12 rounded-2xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all active:scale-90"
                        aria-label="Remover"
                      >
                        <Trash2 className="size-6" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t p-5 pb-8 space-y-4 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex-shrink-0">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
            Seu Nome
          </label>
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Ex.: João Silva"
            maxLength={60}
            className={`${isKioskMode ? "h-16" : "h-14"} text-lg font-bold rounded-xl border-2 focus-visible:ring-primary/20`}
            aria-invalid={!!nameError}
          />
          {nameError && (
            <p className="text-[10px] text-destructive font-bold flex items-center gap-1 ml-1">
              <X className="size-3" /> {nameError}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
            Forma de pagamento
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("PIX")}
              disabled={!pixAvailable || paymentSettingsLoading}
              className={`rounded-2xl border-2 p-3 text-left transition-all ${
                paymentMethod === "PIX"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-muted bg-white"
              } ${!pixAvailable || paymentSettingsLoading ? "opacity-40 cursor-not-allowed" : "active:scale-[0.98]"}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                PIX
              </div>
              <div className="text-sm font-bold mt-0.5">
                {pixAvailable ? "QR Code automático" : "Indisponível"}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("CARD")}
              disabled={!cardAvailable || paymentSettingsLoading}
              className={`rounded-2xl border-2 p-3 text-left transition-all ${
                paymentMethod === "CARD" ? "border-sky-500 bg-sky-50" : "border-muted bg-white"
              } ${!cardAvailable || paymentSettingsLoading ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                Cartão
              </div>
              <div className="text-sm font-bold mt-0.5">
                {cardAvailable ? "Terminal do totem" : "Indisponível"}
              </div>
            </button>
          </div>
          {!pixAvailable && pixUnavailableReason && (
            <p className="text-xs font-semibold text-muted-foreground">
              {pixUnavailableReason}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm font-bold text-muted-foreground">Total do pedido</span>
          <span
            className={`font-black ${isKioskMode ? "text-3xl" : "text-2xl"}`}
            style={{ color: primary }}
          >
            {formatBRL(totalCents)}
          </span>
        </div>

        <Button
          onClick={submit}
          disabled={
            submitting ||
            empty ||
            paymentSettingsLoading ||
            !selectedMethodAvailable
          }
          className={`w-full ${isKioskMode ? "h-20 text-2xl" : "h-16 text-xl"} font-black rounded-2xl shadow-lg transition-all active:scale-[0.98]`}
          style={
            paymentMethod === "CARD"
              ? { background: primary, color: "#fff" }
              : { background: secondary, color: primary }
          }
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin mr-2" /> Enviando pedido...
            </>
          ) : paymentSettingsLoading ? (
            "Carregando pagamentos..."
          ) : paymentMethod === "CARD" ? (
            "Pagar com cartão"
          ) : (
            "Gerar PIX"
          )}
        </Button>
      </div>
    </SheetContent>
  );
}

function PixDialog({
  event,
  totalCents,
  submitting,
  onConfirm,
  primary,
  secondary,
  isKioskMode,
}: {
  event: PublicEvent | undefined;
  totalCents: number;
  submitting: boolean;
  onConfirm: () => void;
  primary: string;
  secondary: string;
  isKioskMode: boolean;
}) {
  const key = event?.pixKey ?? "";
  const qrValue = event?.pixQrCode && event.pixQrCode.trim().length > 0 ? event.pixQrCode : key;
  const receiver = event?.pixReceiverName ?? "";
  const instructions = event?.pixInstructions ?? "";

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Chave PIX copiada.");
    } catch {
      toast.error("Não foi possível copiar a chave.");
    }
  };

  return (
    <DialogContent
      className={`${isKioskMode ? "max-w-none w-full h-full rounded-none" : "max-w-md w-[95vw] rounded-[2rem]"} p-0 overflow-hidden border-none shadow-2xl`}
    >
      <DialogHeader
        className={`px-6 ${isKioskMode ? "pt-10 pb-6" : "pt-6 pb-4"}`}
        style={{ background: primary, color: "#fff" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="size-12 rounded-2xl flex items-center justify-center"
            style={{ background: secondary, color: primary }}
          >
            <QrCode className="size-6" />
          </div>
          <div>
            <DialogTitle className="text-2xl font-extrabold text-white">
              Pagamento via PIX
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Total{" "}
              {(totalCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="px-6 py-5 space-y-5 max-h-[60dvh] overflow-y-auto no-scrollbar">
        {qrValue ? (
          <div className="flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl border-2 shadow-sm">
              <QRCodeSVG value={qrValue} size={196} level="M" />
            </div>
            <p className="text-xs text-muted-foreground mt-2">Escaneie ou copie a chave abaixo</p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
            Chave PIX não configurada.
          </div>
        )}

        {receiver && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Recebedor</div>
            <div className="font-semibold">{receiver}</div>
          </div>
        )}

        {key && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Chave PIX
            </div>
            <div className="flex gap-2">
              <Input value={key} readOnly className="font-mono text-sm" />
              <Button
                type="button"
                variant="outline"
                onClick={copyKey}
                aria-label="Copiar chave PIX"
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {instructions && (
          <div className="rounded-xl bg-muted p-3 text-sm whitespace-pre-wrap">{instructions}</div>
        )}
      </div>

      <div
        className={`border-t ${isKioskMode ? "p-10 pb-12" : "p-6 pb-8"} bg-card shadow-[0_-10px_40px_rgba(0,0,0,0.05)]`}
      >
        <Button
          onClick={onConfirm}
          disabled={submitting}
          className={`w-full ${isKioskMode ? "h-20 text-2xl" : "h-16 text-xl"} font-black rounded-2xl shadow-lg transition-all active:scale-[0.98]`}
          style={{ background: secondary, color: primary }}
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin" /> Enviando pedido...
            </>
          ) : (
            "Aguardar confirmação"
          )}
        </Button>
      </div>
    </DialogContent>
  );
}


