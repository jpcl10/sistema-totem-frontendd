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
  PartyPopper,
  AlertTriangle,
  Nfc,
  BadgeCheck,
  ShieldAlert,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import defumarFlame from "@/assets/defumar-d-flame.svg";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL, API_HEADERS, SOCKET_URL } from "../lib/auth";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicEventBranding } from "@/components/public/public-branding";
import { PublicChannelLoading } from "@/components/public/PublicChannelLoading";
import { PublicChannelError } from "@/components/public/PublicChannelError";
import { PublicChannelHeader } from "@/components/public/PublicChannelHeader";
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
  createPublicOrder,
  getCheckoutPaymentSettings,
  createPixAutomaticPayment,
  checkoutPayment,
  getPublicOrderStatus,
  identifyNfc,
  payWithNfcBalance,
  type PublicMenu,
  type PublicProduct,
  type PublicCategory,
  type PublicEvent,
  type CheckoutPaymentSettings,
  type PaymentTransaction,
  type PublicOrderResponse,
  type CheckoutPaymentResponse,
  type NfcIdentifiedCustomer,
} from "@/lib/public-api";
import { enqueueJobsForOrder, type PrintSector } from "@/lib/print-queue";

function isPixEnabled(event?: PublicEvent | null): boolean {
  const v = event?.pixEnabled as unknown;
  if (v === true) return true;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  if (typeof v === "number") return v === 1;
  return false;
}

export const Route = createFileRoute("/e/$slug")({
  component: PublicMenuPage,
});

function TotemWelcomeScreen({
  event,
  onStart,
}: {
  event: PublicEvent | null | undefined;
  onStart: () => void;
}) {
  const branding = usePublicEventBranding(event);
  const { name, welcomeMessage, logoUrl, bannerUrl, primaryColor, textColor } = branding;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-hidden animate-in fade-in duration-500"
      style={{
        ...branding.cssVars,
        background: "var(--brand-bg)",
        color: "var(--brand-fg)",
      }}
    >
      {/* Hero banner (opcional) */}
      {bannerUrl && (
        <div className="relative h-56 w-full shrink-0 sm:h-72">
          <img
            src={bannerUrl}
            alt=""
            aria-hidden
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, var(--brand-bg) 95%)",
            }}
          />
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-10 pt-8 text-center">
        {/* Identidade: logo OU nome (não duplicar) */}
        {logoUrl ? (
          <>
            <img
              src={logoUrl}
              alt={name}
              draggable={false}
              className="h-32 w-32 select-none object-contain sm:h-40 sm:w-40 animate-in zoom-in-95 duration-700"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            {name && (
              <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
                {name}
              </h1>
            )}
          </>
        ) : (
          name && (
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
              {name}
            </h1>
          )
        )}

        {welcomeMessage && (
          <p className="max-w-xl text-base sm:text-lg" style={{ opacity: 0.8 }}>
            {welcomeMessage}
          </p>
        )}

        {/* CTA primário */}
        <button
          type="button"
          onClick={onStart}
          className="group mt-2 flex w-full max-w-md items-center justify-center gap-3 rounded-2xl px-6 py-6 text-lg font-bold uppercase tracking-wider transition-all duration-300 hover:scale-[1.02] active:scale-[0.99]"
          style={{
            background: primaryColor,
            color: textColor === "hsl(var(--foreground))" ? "#FFFFFF" : textColor,
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.35)",
          }}
        >
          <span>Começar pedido</span>
          <ArrowRight className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-1" />
        </button>

        {/* Cartão NFC informativo — comportamento existente preservado */}
        <div className="w-full max-w-md rounded-2xl border border-border/40 bg-white/5 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
              style={{ background: primaryColor, color: "#FFFFFF" }}
            >
              <Nfc className="h-7 w-7" aria-hidden />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold uppercase tracking-wide">
                Aproxime sua pulseira ou cartão
              </p>
              <p className="mt-1 text-xs" style={{ opacity: 0.7 }}>
                Identificação rápida e segura.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function categoryEmoji(name: string): string {
  const n = name.toLowerCase();
  if (/(drink|coquetel|cocktail|caipi)/.test(n)) return "🍹";
  if (/(cerveja|beer|chopp)/.test(n)) return "🍺";
  if (/(vinho|wine)/.test(n)) return "🍷";
  if (/(bebida|refri|suco|água|agua|water)/.test(n)) return "🥤";
  if (/(café|cafe|coffee)/.test(n)) return "☕";
  if (/(burg|hamb|sandu|sandwich)/.test(n)) return "🍔";
  if (/(pizza)/.test(n)) return "🍕";
  if (/(porç|porc|fritas|petisco|snack)/.test(n)) return "🍟";
  if (/(sobremesa|doce|dessert|sorvete|ice)/.test(n)) return "🍰";
  if (/(churras|carne|bbq|grill|defum)/.test(n)) return "🔥";
  if (/(salada|veg|salad)/.test(n)) return "🥗";
  if (/(massa|pasta|macar)/.test(n)) return "🍝";
  if (/(combo|kit|promo)/.test(n)) return "⭐";
  return "🍽️";
}

function TotemCategoryPicker({
  eventName,
  categories,
  hasNfcIdentified,
  onPickCategory,
  onOpenNfc,
}: {
  eventName: string;
  categories: { cat: PublicCategory; count: number }[];
  hasNfcIdentified: boolean;
  onPickCategory: (id: string) => void;
  onOpenNfc: () => void;
}) {
  const cols = categories.length <= 4 ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3";
  return (
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto text-white animate-in fade-in duration-500"
      style={{
        background: "radial-gradient(ellipse at 50% 0%, #0F2C5C 0%, #0A1830 45%, #061126 100%)",
      }}
    >
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[#0D6EFD]/25 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-180px] left-1/2 h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-[#0D6EFD]/15 blur-[160px]" />

      {/* Header */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-10 text-center">
        <div className="relative mb-5">
          <div className="absolute inset-0 -z-10 mx-auto h-28 w-28 rounded-full bg-[#0D6EFD]/30 blur-[60px]" />
          <img
            src={defumarFlame}
            alt="Defumar"
            draggable={false}
            className="h-20 w-20 select-none object-contain drop-shadow-[0_8px_30px_rgba(13,110,253,0.45)]"
          />
        </div>
        {eventName && (
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.35em] text-[#7CC4FF]/80">
            {eventName}
          </p>
        )}
        <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          O que você deseja{" "}
          <span className="bg-gradient-to-r from-[#60A5FA] via-[#3B82F6] to-[#7CC4FF] bg-clip-text text-transparent">
            hoje?
          </span>
        </h1>
        <p className="mt-3 max-w-md text-sm text-white/65 sm:text-base">
          Selecione uma categoria para visualizar os produtos disponíveis.
        </p>
      </div>

      {/* NFC hint */}
      <div className="relative z-10 mx-auto mt-8 w-full max-w-3xl px-6">
        <button
          type="button"
          onClick={onOpenNfc}
          className="group relative w-full overflow-hidden rounded-2xl border border-[#3B82F6]/25 bg-white/[0.04] p-4 text-left backdrop-blur-xl transition-all hover:border-[#3B82F6]/50 hover:bg-white/[0.06] active:scale-[0.99]"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0D6EFD]/15 to-transparent" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D6EFD] to-[#1E40AF] shadow-[0_10px_30px_rgba(13,110,253,0.5)]">
              <Nfc className="h-7 w-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold uppercase tracking-wide text-white">
                {hasNfcIdentified ? "Cartão identificado" : "Aproxime sua pulseira ou cartão"}
              </p>
              <p className="mt-0.5 text-xs text-white/60">Identificação rápida e segura.</p>
            </div>
            <ArrowRight className="h-5 w-5 text-white/40 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </div>

      {/* Category grid */}
      <div className="relative z-10 mx-auto mt-8 w-full max-w-5xl flex-1 px-6 pb-8">
        <div className={`grid grid-cols-1 gap-4 ${cols}`}>
          {categories.map(({ cat, count }) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onPickCategory(cat.id)}
              className="group relative flex min-h-[220px] flex-col items-start justify-between overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-left backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#3B82F6]/60 hover:bg-white/[0.07] hover:shadow-[0_20px_60px_rgba(13,110,253,0.45)] active:scale-[0.98]"
            >
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0D6EFD]/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#0D6EFD]/20 blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D6EFD]/30 to-[#1E40AF]/20 text-4xl shadow-inner ring-1 ring-white/10">
                <span aria-hidden>{categoryEmoji(cat.name)}</span>
              </div>

              <div className="relative mt-6 w-full">
                <h3 className="text-2xl font-black leading-tight tracking-tight text-white">
                  {cat.name}
                </h3>
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
                    {count} {count === 1 ? "produto" : "produtos"}
                  </p>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0D6EFD] text-white shadow-[0_6px_20px_rgba(13,110,253,0.6)] transition-transform group-hover:translate-x-1">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 mx-auto w-full max-w-3xl px-6 pb-8">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-4 text-center backdrop-blur-xl">
          {[
            { icon: QrCode, label: "PIX", sub: "Atendimento rápido" },
            { icon: Nfc, label: "NFC", sub: "Pagamento seguro" },
            { icon: CreditCard, label: "Cartão", sub: "Tempo real" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-[#7CC4FF]" />
              <div className="text-left">
                <p className="text-xs font-bold tracking-widest text-white/85">{label}</p>
                <p className="text-[11px] leading-tight text-white/45">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface CartItem {
  product: PublicProduct;
  quantity: number;
}

function getPrice(p: PublicProduct): number {
  if (typeof p.priceInCents === "number") return p.priceInCents;
  if (typeof p.price === "number") return Math.round(p.price * 100);
  return 0;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

function PublicMenuPage() {
  const { slug } = Route.useParams();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // New paymentStep state for the final flow
  const [paymentStep, setPaymentStep] = useState<
    "loading" | "pix_automatic" | "pix_manual" | "operator" | "paid" | null
  >(null);

  const [confirmation, setConfirmation] = useState<{
    id?: string;
    number: string;
    pix: boolean;
    totalInCents?: number;
    customerName?: string;
    transaction?: PaymentTransaction | null;
    isManualPix?: boolean;
    error?: string | null;
    checkoutSettings?: CheckoutPaymentSettings;
    manualPix?: {
      pixKey?: string;
      receiverName?: string;
      city?: string;
      instructions?: string;
    };
    message?: string;
  } | null>(null);
  const [pixOpen, setPixOpen] = useState(false);
  const [pixExpired, setPixExpired] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);

  // NFC Identification
  const [nfcOpen, setNfcOpen] = useState(false);
  const [nfcUid, setNfcUid] = useState("");
  const [nfcLoading, setNfcLoading] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [nfcNotFound, setNfcNotFound] = useState(false);
  const [nfcBlocked, setNfcBlocked] = useState(false);
  const [identifiedCustomer, setIdentifiedCustomer] = useState<NfcIdentifiedCustomer | null>(null);
  const [nfcSuccess, setNfcSuccess] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);

  // NFC balance payment flow
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "NFC">("PIX");
  const [nfcConfirmOpen, setNfcConfirmOpen] = useState(false);
  const [nfcPaying, setNfcPaying] = useState(false);
  const [nfcPaidBalance, setNfcPaidBalance] = useState<number | null>(null);

  // Premium welcome screen shown before catalog
  const [showWelcome, setShowWelcome] = useState(true);
  // Premium category picker shown right after welcome, before the catalog list
  const [showCategoryPicker, setShowCategoryPicker] = useState(true);

  // Auto-dismiss welcome + picker once a customer is identified via NFC
  useEffect(() => {
    if (identifiedCustomer) {
      setShowWelcome(false);
      setShowCategoryPicker(false);
    }
  }, [identifiedCustomer]);

  const resetTotem = () => {
    setConfirmation(null);
    setPaymentStep(null);
    setPixExpired(false);
    setRemainingSeconds(null);
    setCart([]);
    setCustomerName("");
    setCartOpen(false);
    setPixOpen(false);
    setIdentifiedCustomer(null);
    setNfcSuccess(false);
    setNfcNotFound(false);
    setNfcBlocked(false);
    setNfcUid("");
    setNfcReading(false);
    setPaymentMethod("PIX");
    setNfcConfirmOpen(false);
    setNfcPaying(false);
    setNfcPaidBalance(null);
  };

  const showPixExpiredScreen = () => {
    // [redacted log]
    setPixExpired(true);
    setRemainingSeconds(0);
  };

  const openNfcModal = () => {
    setNfcUid("");
    setNfcError(null);
    setNfcNotFound(false);
    setNfcBlocked(false);
    setNfcOpen(true);
  };

  const runNfcIdentify = async (uidInput: string, opts: { auto?: boolean } = {}) => {
    const raw = uidInput.replace(/[^0-9A-Fa-f]/g, "").toUpperCase();
    if (raw.length < 8) {
      if (!opts.auto) setNfcError("Informe um UID válido (mín. 8 caracteres hex).");
      return;
    }
    // Dismiss virtual keyboard / blur active element
    try {
      (document.activeElement as HTMLElement | null)?.blur?.();
    } catch {
      /* noop */
    }
    setNfcOpen(false);
    setNfcLoading(true);
    setNfcError(null);
    setNfcNotFound(false);
    setNfcBlocked(false);
    setNfcReading(true);
    // Brief reading animation for perceived feedback
    const minDelay = new Promise((r) => setTimeout(r, 600));
    try {
      const [result] = await Promise.all([identifyNfc(slug, raw), minDelay]);
      setNfcReading(false);
      if (result.blocked) {
        setNfcBlocked(true);
        return;
      }
      if (!result.found || !result.customer) {
        setNfcNotFound(true);
        return;
      }
      setIdentifiedCustomer(result.customer);
      if (result.customer.name && !customerName.trim()) {
        setCustomerName(result.customer.name);
      }
      setNfcSuccess(true);
    } catch (err) {
      setNfcReading(false);
      setNfcError(toFriendlyMessage(err));
      if (opts.auto) toast.error(toFriendlyMessage(err));
    } finally {
      setNfcLoading(false);
    }
  };

  const handleNfcIdentify = () => runNfcIdentify(nfcUid);

  const clearIdentifiedCustomer = () => {
    setIdentifiedCustomer(null);
    setNfcSuccess(false);
  };

  // Auto-close success screen after 2s
  useEffect(() => {
    if (!nfcSuccess) return;
    const t = setTimeout(() => setNfcSuccess(false), 2000);
    return () => clearTimeout(t);
  }, [nfcSuccess]);

  // Auto-dismiss error overlays after 3s
  useEffect(() => {
    if (!nfcNotFound && !nfcBlocked) return;
    const t = setTimeout(() => {
      setNfcNotFound(false);
      setNfcBlocked(false);
    }, 3000);
    return () => clearTimeout(t);
  }, [nfcNotFound, nfcBlocked]);

  // Listen to SK210 native NFC bridge — fully automatic identification
  useEffect(() => {
    const onSk210 = (ev: Event) => {
      const detail = (ev as CustomEvent<{ uid?: string }>).detail;
      const uid = typeof detail?.uid === "string" ? detail.uid : "";
      if (!uid) return;
      setNfcUid(uid);
      void runNfcIdentify(uid, { auto: true });
    };
    window.addEventListener("sk210:nfc", onSk210 as EventListener);
    // Also expose a global helper the native layer can call
    (window as unknown as { sk210NfcRead?: (uid: string) => void }).sk210NfcRead = (
      uid: string,
    ) => {
      window.dispatchEvent(new CustomEvent("sk210:nfc", { detail: { uid } }));
    };
    return () => {
      window.removeEventListener("sk210:nfc", onSk210 as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Detect Kiosk Mode
  const isKioskMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    const search = window.location.search;
    return search.includes("mode=kiosk");
  }, []);

  useEffect(() => {
    if (confirmation) {
      // If the order is already paid, we can reset after some time
      if (paymentStep === "paid" || !confirmation.pix) {
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

    socket.on("order-updated", (payload: any) => {
      const updatedOrder = payload?.order ?? payload;
      if (!updatedOrder || updatedOrder.id !== orderId) return;
      if (isPaid(updatedOrder?.paymentStatus)) {
        markPaid("order-updated");
      }
    });

    socket.on("payment-transaction-updated", (payload: any) => {
      const order = payload?.order ?? payload;
      const tx = payload?.transaction ?? payload?.paymentTransaction ?? payload;
      const txOrderId = tx?.orderId ?? order?.id ?? order?.orderId;
      if (txOrderId && txOrderId !== orderId) return;
      if (isPaid(order?.paymentStatus)) {
        markPaid("payment-transaction-updated");
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
    getPublicMenu(slug)
      .then((m) => {
        if (!alive) return;
        setMenu(m);
        setActiveCat(m.categories[0]?.id ?? null);
      })
      .catch(
        (e) => alive && setError(toFriendlyMessage(e, "Não foi possível carregar o cardápio.")),
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  const event = menu?.event;
  const primary = event?.primaryColor || "#0f172a";
  const secondary = event?.secondaryColor || "#f59e0b";

  const totalItems = cart.reduce((s, c) => s + c.quantity, 0);
  const totalCents = cart.reduce((s, c) => s + getPrice(c.product) * c.quantity, 0);

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
    const max = maxQty(product);
    setCart((prev) => {
      const i = prev.findIndex((c) => c.product.id === product.id);
      if (i >= 0) {
        if (prev[i].quantity + 1 > max) {
          toast.error(`Restam apenas ${max} ${max === 1 ? "unidade" : "unidades"} deste produto.`);
          return prev;
        }
        const copy = [...prev];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1, product };
        return copy;
      }
      if (1 > max) {
        toast.error("Este produto não está mais disponível.");
        return prev;
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const dec = (id: string) => {
    setCart((prev) =>
      prev.flatMap((c) =>
        c.product.id === id ? (c.quantity > 1 ? [{ ...c, quantity: c.quantity - 1 }] : []) : [c],
      ),
    );
  };

  const inc = (id: string) => {
    setCart((prev) =>
      prev.map((c) => {
        if (c.product.id !== id) return c;
        const max = maxQty(c.product);
        if (c.quantity + 1 > max) {
          toast.error(`Restam apenas ${max} ${max === 1 ? "unidade" : "unidades"} deste produto.`);
          return c;
        }
        return { ...c, quantity: c.quantity + 1 };
      }),
    );
  };

  const remove = (id: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== id));
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
      const fresh = await getPublicMenu(slug);
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
      handleApiError(e, "Não foi possível validar seu pedido. Tente novamente.");
      return false;
    }
  };

  const buildOrderPayload = (pix: boolean): Parameters<typeof createPublicOrder>[1] => {
    const payload: Parameters<typeof createPublicOrder>[1] = {
      customerName: customerName.trim(),
      items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
    };
    if (pix) {
      payload.paymentMethod = "PIX";
      payload.paymentStatus = "PENDING";
      payload.status = "PENDING";
    }
    return payload;
  };

  const handleOrderCreated = async (order: PublicOrderResponse) => {
    const num = String(order.number ?? order.orderNumber ?? order.code ?? order.id);
    const returnedPending = (order.paymentStatus ?? "").toUpperCase() === "PENDING";
    const awaitingPayment = returnedPending;

    setPaymentStep("loading");

    // Set confirmation early so the UI changes to the loading state
    setConfirmation({
      id: order.id,
      number: num,
      pix: awaitingPayment,
      totalInCents: order.totalInCents || totalCents,
      customerName: customerName.trim(),
      transaction: null,
      isManualPix: false,
      error: null,
      checkoutSettings: undefined,
    });

    if (awaitingPayment) {
      try {
        const checkoutResponse = await Promise.race([
          checkoutPayment(order.id),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("CHECKOUT_TIMEOUT")), 20000),
          ),
        ]);

        // Logs already handled in checkoutPayment
        setPaymentStep(checkoutResponse.paymentStep);
        setConfirmation((prev) =>
          prev
            ? {
                ...prev,
                pix: checkoutResponse.paymentStep !== "paid",
                transaction: checkoutResponse.paymentTransaction,
                isManualPix: checkoutResponse.paymentStep === "pix_manual",
                manualPix: checkoutResponse.manualPix,
                message: checkoutResponse.message,
              }
            : null,
        );
      } catch (err) {
        console.error("CHECKOUT PAYMENT ERROR:", err);
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
            : "Falha ao iniciar o pagamento.",
        );
      }
    } else {
      // Not awaiting payment (already paid or cash)
      setPaymentStep(null);

      // Print tickets
      if (menu) {
        const categoryIndex = new Map<string, PrintSector>();
        for (const cat of menu.categories ?? []) {
          const rec = cat as unknown as { sector?: string };
          const s = (rec.sector ?? "").toUpperCase();
          if (s === "BAR") categoryIndex.set(cat.id, "BAR");
          else if (s === "KITCHEN" || s === "COZINHA") categoryIndex.set(cat.id, "KITCHEN");
        }
        try {
          enqueueJobsForOrder(
            {
              ...order,
              items:
                (order.items as unknown as Record<string, unknown>[]) ??
                cart.map((c) => ({
                  productId: c.product.id,
                  name: c.product.name,
                  quantity: c.quantity,
                  priceInCents: getPrice(c.product),
                  categoryId: c.product.categoryId,
                })),
            },
            { eventName: event?.name ?? menu.event.name, eventId: event?.id, categoryIndex },
          );
        } catch (err) {
          if (import.meta.env.DEV) console.warn("enqueue print jobs failed", err);
          toast.error(
            "Pedido confirmado, mas houve falha ao enviar para impressão. Chame o operador.",
          );
        }
      }

      toast.success("Pedido recebido!");
    }

    setCart([]);
    setCustomerName("");
    setCartOpen(false);
    setPixOpen(false);
  };

  const sendOrder = async (pix: boolean) => {
    setSubmitting(true);
    try {
      const payload = buildOrderPayload(pix);
      const order = await createPublicOrder(slug, payload);
      await handleOrderCreated(order);
    } catch (e) {
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

    if (paymentMethod === "NFC") {
      // Validate balance before opening confirmation
      const balance = identifiedCustomer?.balanceInCents ?? 0;
      if (!identifiedCustomer) {
        toast.error("Aproxime seu cartão NFC para usar saldo.");
        return;
      }
      if (balance < totalCents) {
        toast.error(`Saldo insuficiente. Disponível: ${formatBRL(balance)}`);
        return;
      }
      setNfcConfirmOpen(true);
      return;
    }

    const pix = isPixEnabled(event);
    if (pix) {
      await sendOrder(true);
      return;
    }
    await sendOrder(false);
  };

  const submitNfcPayment = async () => {
    if (!identifiedCustomer || nfcPaying) return;
    const uid = identifiedCustomer.uid;
    setNfcPaying(true);
    setPaymentStep("loading");
    try {
      // Create order first (pending). Backend pay-with-nfc-balance will mark it paid.
      const order = await createPublicOrder(slug, {
        customerName: customerName.trim(),
        items: cart.map((c) => ({ productId: c.product.id, quantity: c.quantity })),
        paymentMethod: "NFC_BALANCE",
        paymentStatus: "PENDING",
        status: "PENDING",
      });

      const num = String(order.number ?? order.orderNumber ?? order.code ?? order.id);
      setConfirmation({
        id: order.id,
        number: num,
        pix: false,
        totalInCents: order.totalInCents || totalCents,
        customerName: customerName.trim(),
        transaction: null,
        isManualPix: false,
        error: null,
      });

      const result = await payWithNfcBalance(slug, order.id, uid);
      const newBalance =
        result.newBalanceInCents ??
        (result.card?.balanceInCents as number | undefined) ??
        Math.max(0, (identifiedCustomer.balanceInCents ?? 0) - totalCents);

      setNfcPaidBalance(newBalance);
      setIdentifiedCustomer((prev) => (prev ? { ...prev, balanceInCents: newBalance } : prev));
      setPaymentStep("paid");
      toast.success("Pagamento aprovado!");

      setCart([]);
      setCustomerName("");
      setCartOpen(false);
      setNfcConfirmOpen(false);
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? "").toLowerCase();
      let friendly = "Não foi possível concluir o pagamento com saldo NFC.";
      if (msg.includes("insuf") || msg.includes("balance"))
        friendly = "Saldo insuficiente no cartão.";
      else if (msg.includes("block")) friendly = "Cartão bloqueado. Procure um operador.";
      else if (msg.includes("not found") || msg.includes("404"))
        friendly = "Cartão não encontrado.";
      else if (msg.includes("already") || msg.includes("paid"))
        friendly = "Este pedido já foi pago.";
      toast.error(friendly);
      setPaymentStep("operator");
      setConfirmation((prev) => (prev ? { ...prev, error: friendly } : prev));
      setNfcConfirmOpen(false);
    } finally {
      setNfcPaying(false);
    }
  };

  if (loading) {
    return <PublicChannelLoading />;
  }

  if (error || !menu) {
    return (
      <PublicChannelError
        message={error ?? "Evento não encontrado"}
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
          setShowCategoryPicker(true);
        }}
      />
    );
  }

  if (showCategoryPicker && hasAnyProducts) {
    const visibleCategories = menu.categories
      .map((c) => ({ cat: c, count: productsByCat[c.id]?.length ?? 0 }))
      .filter((c) => c.count > 0);
    return (
      <TotemCategoryPicker
        eventName={event?.name ?? ""}
        categories={visibleCategories}
        hasNfcIdentified={!!identifiedCustomer}
        onPickCategory={(id) => {
          setActiveCat(id);
          setShowCategoryPicker(false);
          // Scroll to the chosen category after the catalog mounts
          setTimeout(() => {
            const el = document.getElementById(`cat-${id}`);
            if (el) {
              const offset = 160;
              const bodyRect = document.body.getBoundingClientRect().top;
              const elementRect = el.getBoundingClientRect().top;
              window.scrollTo({ top: elementRect - bodyRect - offset, behavior: "smooth" });
            }
          }, 80);
        }}
        onOpenNfc={openNfcModal}
      />
    );
  }

  return (
    <div
      className={`min-h-dvh bg-background flex flex-col overflow-x-hidden ${isKioskMode ? "kiosk-mode select-none" : ""}`}
      style={{
        ["--brand-primary" as string]: primary,
        ["--brand-secondary" as string]: secondary,
        overscrollBehavior: "none",
      }}
    >
      {/* Header padronizado (canal público) */}
      <PublicChannelHeader event={event}>
        {menu.categories.length > 0 && (
          <nav className="border-t border-border/40 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto overflow-x-auto no-scrollbar touch-pan-x">
              <div className="flex gap-2 py-2.5 px-4">
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
                          const offset = 160;
                          const bodyRect = document.body.getBoundingClientRect().top;
                          const elementRect = el.getBoundingClientRect().top;
                          const elementPosition = elementRect - bodyRect;
                          window.scrollTo({ top: elementPosition - offset, behavior: "smooth" });
                        }
                      }}
                      className="whitespace-nowrap px-5 py-2.5 rounded-full text-sm sm:text-base font-bold transition-all active:scale-95 flex-shrink-0"
                      style={
                        isActive
                          ? { background: "var(--brand-primary)", color: "#FFFFFF" }
                          : { background: "rgba(127,127,127,0.15)", color: "var(--brand-fg)" }
                      }
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        )}
      </PublicChannelHeader>

      {/* Menu Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-4 pb-40">
        {/* NFC Identification Card */}
        {!identifiedCustomer ? (
          <button
            onClick={openNfcModal}
            className="w-full mb-6 rounded-3xl p-5 flex items-center gap-4 text-left shadow-lg transition-all active:scale-[0.99] hover:shadow-xl animate-in fade-in slide-in-from-top-2 duration-500 border border-white/10"
            style={{
              background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
              color: "#fff",
            }}
          >
            <div className="size-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0 shadow-inner">
              <Nfc className="size-8" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">
                Identificação NFC
              </div>
              <div className="text-lg font-black leading-tight">Aproxime seu cartão</div>
              <div className="text-xs font-medium opacity-85 mt-0.5">
                Identificação rápida e segura
              </div>
            </div>
            <div
              className="px-4 py-2.5 rounded-full bg-white/95 text-xs font-black uppercase tracking-wider whitespace-nowrap"
              style={{ color: primary }}
            >
              Identificar
            </div>
          </button>
        ) : (
          <div
            className="w-full mb-6 rounded-3xl p-5 flex items-center gap-4 shadow-lg animate-in fade-in zoom-in-95 duration-300 border border-emerald-200"
            style={{ background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)" }}
          >
            <div className="size-16 rounded-2xl bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <BadgeCheck className="size-8 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-0.5">
                Cliente identificado
              </div>
              <div className="text-lg font-black leading-tight text-emerald-950 truncate">
                {identifiedCustomer.name}
              </div>
              <div className="text-xs font-bold text-emerald-800 mt-0.5 flex items-center gap-2">
                <span>{identifiedCustomer.code}</span>
                <span className="opacity-40">•</span>
                <span className="inline-flex items-center gap-1">
                  <Nfc className="size-3" /> NFC
                </span>
              </div>
            </div>
            <button
              onClick={clearIdentifiedCustomer}
              className="size-10 rounded-full bg-white/70 hover:bg-white flex items-center justify-center text-emerald-800 transition-colors"
              aria-label="Remover identificação"
            >
              <X className="size-5" />
            </button>
          </div>
        )}

        {!hasAnyProducts ? (
          <div className="text-center py-20 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-muted size-24 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShoppingCart className="size-10 text-muted-foreground opacity-50" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Nenhum produto disponível</h2>
            <p className="text-muted-foreground max-w-xs mx-auto">
              No momento não há itens disponíveis para compra. Por favor, verifique mais tarde.
            </p>
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
              primary={primary}
              secondary={secondary}
              isKioskMode={isKioskMode}
            />
          ))
        )}
      </main>

      {/* Always-visible bottom cart bar - Refined for Totem Vertical */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t shadow-[0_-8px_30px_rgba(0,0,0,0.12)] bg-white pb-safe">
        <div
          className={`max-w-6xl mx-auto px-4 ${isKioskMode ? "py-6" : "py-4"} flex items-center gap-3`}
        >
          <button
            onClick={() => setCartOpen(true)}
            className={`flex items-center gap-3 px-4 ${isKioskMode ? "py-5" : "py-4"} rounded-2xl font-semibold text-left transition-all active:scale-95 bg-gray-50 hover:bg-gray-100`}
            style={{ color: primary }}
            aria-label="Ver carrinho"
          >
            <div className="relative">
              <ShoppingCart className={isKioskMode ? "size-10" : "size-8"} />
              {cartHasItems && (
                <span
                  className={`absolute -top-2 -right-2 text-[10px] font-black rounded-full ${isKioskMode ? "size-6" : "size-5"} flex items-center justify-center shadow-sm`}
                  style={{ background: secondary, color: primary }}
                >
                  {totalItems}
                </span>
              )}
            </div>
            <div className="leading-tight">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                Total
              </div>
              <div className={`font-black ${isKioskMode ? "text-2xl" : "text-xl"}`}>
                {formatBRL(totalCents)}
              </div>
            </div>
          </button>

          <Button
            onClick={() => {
              if (!cartHasItems) {
                toast.error("Adicione itens ao pedido");
                return;
              }
              setCartOpen(true);
            }}
            disabled={!cartHasItems}
            className={`flex-1 ${isKioskMode ? "h-20 text-2xl" : "h-16 text-xl"} font-black rounded-2xl shadow-lg transition-all active:scale-[0.98] active:shadow-md`}
            style={{ background: secondary, color: primary }}
          >
            Finalizar
          </Button>
        </div>
      </div>

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
          identifiedCustomer={identifiedCustomer}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          pixAvailable={isPixEnabled(event)}
        />
      </Sheet>

      {/* NFC Reading overlay (auto, no interaction) */}
      <Dialog
        open={nfcReading}
        onOpenChange={() => {
          /* not closable manually */
        }}
      >
        <DialogContent className="w-[min(92vw,420px)] max-w-[420px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div
            className="p-10 text-center"
            style={{
              background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
              color: "#fff",
            }}
          >
            <div className="relative mx-auto mb-5 size-28 flex items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-white/15 animate-ping" />
              <span className="absolute inset-2 rounded-full bg-white/10" />
              <div className="relative size-24 rounded-full bg-white/20 backdrop-blur flex items-center justify-center shadow-inner">
                <Nfc className="size-12 animate-pulse" />
              </div>
            </div>
            <DialogTitle className="text-white text-2xl font-black">Lendo cartão…</DialogTitle>
            <DialogDescription className="text-white/85 text-sm font-medium mt-1">
              Mantenha o cartão próximo ao leitor
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      {/* NFC Auto error overlays (no manual modal needed) */}
      <Dialog
        open={!nfcOpen && nfcBlocked}
        onOpenChange={(o) => {
          if (!o) setNfcBlocked(false);
        }}
      >
        <DialogContent className="w-[min(92vw,420px)] max-w-[420px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-8 text-center bg-gradient-to-br from-red-500 to-red-600 text-white">
            <div className="size-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4 shadow-inner animate-in zoom-in duration-300">
              <ShieldAlert className="size-12" />
            </div>
            <DialogTitle className="text-white text-2xl font-black">Cartão bloqueado</DialogTitle>
            <DialogDescription className="text-white/85 text-sm font-medium mt-1">
              Procure a equipe do evento.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!nfcOpen && nfcNotFound}
        onOpenChange={(o) => {
          if (!o) setNfcNotFound(false);
        }}
      >
        <DialogContent className="w-[min(92vw,420px)] max-w-[420px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
          <div className="p-8 text-center bg-gradient-to-br from-amber-500 to-amber-600 text-white">
            <div className="size-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4 shadow-inner animate-in zoom-in duration-300">
              <AlertTriangle className="size-12" />
            </div>
            <DialogTitle className="text-white text-2xl font-black">
              Cartão não cadastrado
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm font-medium mt-1">
              Verifique com a equipe do evento.
            </DialogDescription>
          </div>
        </DialogContent>
      </Dialog>

      {/* NFC Identification Modal */}
      <Dialog
        open={nfcOpen}
        onOpenChange={(o) => {
          if (!nfcLoading) setNfcOpen(o);
        }}
      >
        <DialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (document.activeElement as HTMLElement | null)?.blur();
          }}
          className="w-[min(92vw,440px)] sm:max-w-[440px] max-h-[calc(100vh-48px)] overflow-y-auto rounded-[28px] p-0 border-none shadow-2xl"
        >
          <div
            className="p-6 pb-4"
            style={{
              background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
              color: "#fff",
            }}
          >
            <div className="size-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-3 shadow-inner">
              <Nfc className="size-8" />
            </div>
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="text-white text-2xl font-black">
                Identificar Cliente
              </DialogTitle>
              <DialogDescription className="text-white/85 text-sm font-medium">
                Aproxime o cartão do leitor ou informe o UID manualmente.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="p-6 space-y-4">
            {nfcBlocked ? (
              <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 flex items-start gap-3 animate-in fade-in zoom-in-95 duration-200">
                <ShieldAlert className="size-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-black text-red-900">Cartão bloqueado</div>
                  <div className="text-sm text-red-800 font-medium mt-1">
                    Procure a equipe do evento para liberar este cartão.
                  </div>
                </div>
              </div>
            ) : nfcNotFound ? (
              <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 flex items-start gap-3">
                  <AlertTriangle className="size-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-black text-amber-900">Cartão não cadastrado</div>
                    <div className="text-sm text-amber-800 font-medium mt-1">
                      Verifique o UID ou procure a equipe do evento.
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setNfcOpen(false)}
                  className="w-full h-12 rounded-2xl font-bold"
                >
                  Continuar sem identificação
                </Button>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                UID do cartão
              </label>
              <Input
                value={nfcUid}
                onChange={(e) => {
                  setNfcUid(e.target.value);
                  setNfcError(null);
                  setNfcNotFound(false);
                  setNfcBlocked(false);
                }}
                placeholder="Aproxime o cartão ou digite o UID"
                inputMode="text"
                className="h-14 text-lg font-bold rounded-xl border-2 focus-visible:ring-primary/20 font-mono tracking-wider"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleNfcIdentify();
                }}
              />
              {nfcError && (
                <p className="text-xs text-destructive font-bold flex items-center gap-1 ml-1">
                  <X className="size-3" /> {nfcError}
                </p>
              )}
            </div>

            <Button
              onClick={handleNfcIdentify}
              disabled={nfcLoading || !nfcUid.trim()}
              className="w-full h-14 text-base font-black rounded-2xl shadow-md transition-all active:scale-[0.98]"
              style={{ background: primary, color: "#fff" }}
            >
              {nfcLoading ? (
                <>
                  <Loader2 className="size-5 animate-spin mr-2" /> Identificando…
                </>
              ) : (
                <>
                  <Nfc className="size-5 mr-2" /> Identificar
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* NFC Success Modal */}
      <Dialog open={nfcSuccess} onOpenChange={setNfcSuccess}>
        <DialogContent className="w-[min(92vw,440px)] sm:max-w-[440px] max-h-[calc(100vh-48px)] overflow-y-auto rounded-[28px] p-0 border-none shadow-2xl">
          <div className="p-8 text-center bg-gradient-to-br from-emerald-500 to-emerald-600 text-white">
            <div className="size-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4 shadow-inner animate-in zoom-in duration-300">
              <BadgeCheck className="size-12" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-widest mb-3">
              <CheckCircle2 className="size-3" /> Identificado
            </div>
            <DialogTitle className="text-white text-3xl font-black">
              Olá, {identifiedCustomer?.name?.split(" ")[0] ?? "Cliente"} 👋
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm font-medium mt-1">
              Cartão reconhecido com sucesso.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-muted/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                  Cartão
                </div>
                <div className="font-black text-lg font-mono">{identifiedCustomer?.code}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                  Tipo
                </div>
                <div className="font-black text-lg capitalize">
                  {identifiedCustomer?.type === "CUSTOMER"
                    ? "Cliente"
                    : (identifiedCustomer?.type ?? "—").toLowerCase()}
                </div>
              </div>
            </div>

            <Button
              onClick={() => {
                setNfcSuccess(false);
                setNfcOpen(false);
              }}
              className="w-full h-14 text-base font-black rounded-2xl shadow-md transition-all active:scale-[0.98]"
              style={{ background: primary, color: "#fff" }}
            >
              Continuar Pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          onConfirm={() => sendOrder(true)}
          primary={primary}
          secondary={secondary}
          isKioskMode={isKioskMode}
        />
      </Dialog>

      {/* NFC payment confirmation */}
      <Dialog
        open={nfcConfirmOpen}
        onOpenChange={(o) => {
          if (!nfcPaying) setNfcConfirmOpen(o);
        }}
      >
        <DialogContent className="w-[min(92vw,440px)] sm:max-w-[440px] rounded-[28px] p-0 border-none shadow-2xl overflow-hidden">
          <div className="p-6 bg-gradient-to-br from-purple-600 to-purple-700 text-white">
            <div className="size-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mb-3">
              <CreditCard className="size-7" />
            </div>
            <DialogTitle className="text-white text-2xl font-black">
              Confirmar pagamento
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm font-medium">
              Pagamento com saldo do cartão NFC.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl bg-muted/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                  Cliente
                </div>
                <div className="font-bold text-sm truncate">{identifiedCustomer?.name ?? "—"}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                  Valor
                </div>
                <div className="font-black text-lg">{formatBRL(totalCents)}</div>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                  Saldo atual
                </div>
                <div className="font-bold text-base">
                  {formatBRL(identifiedCustomer?.balanceInCents ?? 0)}
                </div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 border border-emerald-200">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700 mb-1">
                  Saldo após
                </div>
                <div className="font-black text-base text-emerald-700">
                  {formatBRL(Math.max(0, (identifiedCustomer?.balanceInCents ?? 0) - totalCents))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                disabled={nfcPaying}
                onClick={() => setNfcConfirmOpen(false)}
                className="flex-1 h-14 font-black rounded-2xl"
              >
                Cancelar
              </Button>
              <Button
                disabled={nfcPaying}
                onClick={submitNfcPayment}
                className="flex-1 h-14 font-black rounded-2xl text-white"
                style={{ background: "#7c3aed" }}
              >
                {nfcPaying ? (
                  <>
                    <Loader2 className="size-5 animate-spin mr-2" /> Pagando…
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
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
                Pedido #{confirmation.number} — {formatBRL(confirmation.totalInCents || 0)}
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
                      ? "⚠ Menos de 1 minuto restante"
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
                    toast.success("Código PIX copiado!");
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
                ) : !confirmation.pix ? (
                  <CheckCircle2 className={isKioskMode ? "size-16" : "size-12"} />
                ) : (
                  <Clock className={isKioskMode ? "size-16" : "size-12"} />
                )}
              </div>

              <h2 className="text-4xl font-black mb-4 leading-tight" style={{ color: primary }}>
                {paymentStep === "pix_manual"
                  ? "Pague com PIX Manual"
                  : paymentStep === "operator"
                    ? "Pagamento pendente"
                    : paymentStep === "paid"
                      ? "Pagamento confirmado"
                      : "Pedido recebido!"}
              </h2>

              <p className="text-xl text-muted-foreground max-w-sm mx-auto mb-8 font-medium">
                {paymentStep === "loading"
                  ? "Preparando pagamento..."
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
                          ? nfcPaidBalance !== null
                            ? "bg-purple-100 text-purple-700"
                            : "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {paymentStep === "paid"
                        ? nfcPaidBalance !== null
                          ? "NFC pago"
                          : "Pago"
                        : "Pagamento pendente"}
                    </div>
                  </div>
                  {paymentStep === "paid" && nfcPaidBalance !== null && (
                    <div className="col-span-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-1">
                        Saldo restante no cartão
                      </div>
                      <div className="text-2xl font-black text-purple-700">
                        {formatBRL(nfcPaidBalance)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

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
                              toast.success("Código PIX copiado!");
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

                  {paymentStep === "pix_manual" && confirmation.manualPix && (
                    <div className="space-y-6">
                      <h3
                        className="text-2xl font-black mb-2 flex items-center gap-2"
                        style={{ color: primary }}
                      >
                        <QrCode className="size-6" />
                        Pague com PIX Manual
                      </h3>

                      <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl mb-4">
                        PIX automático indisponível no momento. Use o PIX manual abaixo.
                      </div>

                      <div className="space-y-4">
                        {confirmation.manualPix.pixKey && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-2">
                              Chave PIX
                            </div>
                            <div className="flex gap-2">
                              <Input
                                value={confirmation.manualPix.pixKey}
                                readOnly
                                className="h-12 font-mono text-base font-bold bg-muted/30 border-none"
                              />
                              <Button
                                variant="secondary"
                                className="h-12 w-12 p-0 rounded-xl"
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    confirmation.manualPix?.pixKey || "",
                                  );
                                  toast.success("Chave PIX copiada!");
                                }}
                              >
                                <Copy className="size-5" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {confirmation.manualPix.receiverName && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1">
                              Recebedor
                            </div>
                            <div className="font-bold text-lg">
                              {confirmation.manualPix.receiverName}
                            </div>
                          </div>
                        )}

                        {confirmation.manualPix.city && (
                          <div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-black mb-1">
                              Cidade
                            </div>
                            <div className="font-bold text-lg">{confirmation.manualPix.city}</div>
                          </div>
                        )}

                        {confirmation.manualPix.instructions && (
                          <div
                            className="p-4 bg-muted/50 rounded-2xl text-sm font-medium border-l-4"
                            style={{ borderColor: secondary }}
                          >
                            {confirmation.manualPix.instructions}
                          </div>
                        )}
                      </div>

                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-800 text-sm font-bold flex gap-3">
                        <Clock className="size-5 flex-shrink-0" />
                        <p>
                          Após pagar, apresente o comprovante ao operador. Seu pedido será preparado
                          após a confirmação.
                        </p>
                      </div>
                    </div>
                  )}

                  {paymentStep === "operator" && (
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
                        Pagamento pendente
                      </h3>
                      <p className="text-muted-foreground font-medium">
                        Procure um operador para realizar o pagamento e liberar seu pedido.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
                {(!confirmation.pix || paymentStep === "paid") && (
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

              {(!confirmation.pix || paymentStep === "paid") && (
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

function CategorySection({
  category,
  products,
  onAdd,
  cart,
  inc,
  dec,
  primary,
  secondary,
  isKioskMode,
}: {
  category: PublicCategory;
  products: PublicProduct[];
  onAdd: (p: PublicProduct) => void;
  cart: CartItem[];
  inc: (id: string) => void;
  dec: (id: string) => void;
  primary: string;
  secondary: string;
  isKioskMode: boolean;
}) {
  if (products.length === 0) return null;
  return (
    <section id={`cat-${category.id}`} className="mb-8 scroll-mt-24 last:mb-32">
      <h2
        className="text-xl font-black mb-1 px-1 flex items-center gap-2"
        style={{ color: primary }}
      >
        <span className="w-1.5 h-6 rounded-full" style={{ background: secondary }}></span>
        {category.name}
      </h2>
      {category.description && (
        <p className="text-muted-foreground mb-4 text-xs px-1 pl-4.5 font-medium leading-relaxed">
          {category.description}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4">
        {products.map((p) => {
          const item = cart.find((c) => c.product.id === p.id);
          const img = resolveAssetUrl(p.imageUrl);
          return (
            <div
              key={p.id}
              className="bg-card rounded-3xl border shadow-sm overflow-hidden flex transition-all active:scale-[0.98]"
            >
              <div className="w-28 h-28 sm:w-36 sm:h-36 relative overflow-hidden bg-muted flex-shrink-0">
                <ProductImage
                  src={img}
                  alt={p.name}
                  size="sm"
                  rounded="rounded-none"
                  className="h-full w-full object-cover"
                />
                {item && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="bg-white px-2 py-0.5 rounded-full shadow-lg">
                      <span className="font-black text-[10px]" style={{ color: primary }}>
                        {item.quantity}x
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col justify-between min-w-0">
                <div className="pr-1">
                  <h3 className="font-bold text-base leading-tight truncate">{p.name}</h3>
                  {p.description && (
                    <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-tight">
                      {p.description}
                    </p>
                  )}
                </div>

                <div className="flex items-end justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-black text-lg" style={{ color: primary }}>
                      {formatBRL(getPrice(p))}
                    </span>
                  </div>

                  {item ? (
                    <div
                      className="flex items-center gap-1 rounded-full p-1 shadow-sm"
                      style={{ background: secondary }}
                    >
                      <button
                        onClick={() => dec(p.id)}
                        className={`${isKioskMode ? "size-12" : "size-10"} rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90`}
                        style={{ color: primary }}
                        aria-label="Diminuir"
                      >
                        <Minus className={isKioskMode ? "size-6" : "size-5"} />
                      </button>
                      <span
                        className={`font-black ${isKioskMode ? "text-xl w-10" : "text-base w-7"} text-center`}
                        style={{ color: primary }}
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => inc(p.id)}
                        className={`${isKioskMode ? "size-12" : "size-10"} rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90`}
                        style={{ color: primary }}
                        aria-label="Aumentar"
                      >
                        <Plus className={isKioskMode ? "size-6" : "size-5"} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAdd(p)}
                      className={`${isKioskMode ? "h-12 px-6 text-sm" : "h-10 px-4 text-xs"} rounded-xl flex items-center gap-1.5 font-black shadow-md transition-all active:scale-95`}
                      style={{ background: primary, color: "#fff" }}
                    >
                      <Plus className="size-4" />
                      Adicionar
                    </button>
                  )}
                </div>
              </div>
            </div>
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
  identifiedCustomer,
  paymentMethod,
  setPaymentMethod,
  pixAvailable,
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
  identifiedCustomer: NfcIdentifiedCustomer | null;
  paymentMethod: "PIX" | "NFC";
  setPaymentMethod: (m: "PIX" | "NFC") => void;
  pixAvailable: boolean;
}) {
  const empty = cart.length === 0;
  const balanceCents = identifiedCustomer?.balanceInCents ?? 0;
  const hasBalanceEnough = !!identifiedCustomer && balanceCents >= totalCents;
  const nfcDisabled = !identifiedCustomer;

  // Auto-fallback: if user picked NFC but card unidentified, revert to PIX
  useEffect(() => {
    if (paymentMethod === "NFC" && !identifiedCustomer && pixAvailable) {
      setPaymentMethod("PIX");
    }
  }, [paymentMethod, identifiedCustomer, pixAvailable, setPaymentMethod]);
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
            <SheetTitle className="text-white text-2xl font-black">Meu Pedido</SheetTitle>
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
              const img = resolveAssetUrl(c.product.imageUrl);
              return (
                <div
                  key={c.product.id}
                  className="bg-muted/30 p-4 rounded-3xl flex gap-4 items-center border border-transparent hover:border-muted-foreground/10 transition-colors"
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
                        {formatBRL(getPrice(c.product) * c.quantity)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-sm border">
                        <button
                          onClick={() => dec(c.product.id)}
                          className="size-10 rounded-full flex items-center justify-center active:bg-muted transition-colors"
                          aria-label="Diminuir"
                        >
                          <Minus className="size-5" />
                        </button>
                        <span className="font-black w-8 text-center text-lg">{c.quantity}</span>
                        <button
                          onClick={() => inc(c.product.id)}
                          className="size-10 rounded-full flex items-center justify-center active:bg-muted transition-colors"
                          aria-label="Aumentar"
                        >
                          <Plus className="size-5" />
                        </button>
                      </div>

                      <button
                        onClick={() => remove(c.product.id)}
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
            placeholder="Ex: João Silva"
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

        {identifiedCustomer && (
          <div
            className={`rounded-2xl p-4 border-2 ${
              hasBalanceEnough ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`size-9 rounded-full flex items-center justify-center ${
                    hasBalanceEnough ? "bg-emerald-500" : "bg-amber-500"
                  } text-white`}
                >
                  <CreditCard className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Cartão NFC conectado
                  </div>
                  <div className="font-bold truncate text-sm">{identifiedCustomer.name}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Saldo
                </div>
                <div
                  className={`font-black text-lg ${hasBalanceEnough ? "text-emerald-700" : "text-amber-700"}`}
                >
                  {formatBRL(balanceCents)}
                </div>
              </div>
            </div>
            {!hasBalanceEnough && (
              <p className="text-xs text-amber-700 font-semibold mt-2">
                Saldo insuficiente para este pedido.
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
            Forma de pagamento
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("PIX")}
              disabled={!pixAvailable}
              className={`rounded-2xl border-2 p-3 text-left transition-all ${
                paymentMethod === "PIX"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-muted bg-white"
              } ${!pixAvailable ? "opacity-40 cursor-not-allowed" : "active:scale-[0.98]"}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                PIX
              </div>
              <div className="text-sm font-bold mt-0.5">Pagar via PIX</div>
            </button>
            <button
              type="button"
              onClick={() => !nfcDisabled && setPaymentMethod("NFC")}
              disabled={nfcDisabled}
              className={`rounded-2xl border-2 p-3 text-left transition-all ${
                paymentMethod === "NFC" ? "border-purple-500 bg-purple-50" : "border-muted bg-white"
              } ${nfcDisabled ? "opacity-50 cursor-not-allowed" : "active:scale-[0.98]"}`}
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-purple-700">
                Saldo NFC
              </div>
              <div className="text-sm font-bold mt-0.5">
                {nfcDisabled ? "Aproxime seu cartão" : "Usar saldo do cartão"}
              </div>
            </button>
          </div>
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
            (paymentMethod === "NFC" && (!identifiedCustomer || balanceCents < totalCents))
          }
          className={`w-full ${isKioskMode ? "h-20 text-2xl" : "h-16 text-xl"} font-black rounded-2xl shadow-lg transition-all active:scale-[0.98]`}
          style={
            paymentMethod === "NFC"
              ? { background: "#7c3aed", color: "#fff" }
              : { background: secondary, color: primary }
          }
        >
          {submitting ? (
            <>
              <Loader2 className="size-5 animate-spin mr-2" /> Enviando…
            </>
          ) : paymentMethod === "NFC" ? (
            "Pagar com Saldo NFC"
          ) : (
            "Confirmar Pedido"
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
      toast.success("Chave PIX copiada!");
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
              <Loader2 className="size-5 animate-spin" /> Enviando…
            </>
          ) : (
            "Aguardar Confirmação"
          )}
        </Button>
      </div>
    </DialogContent>
  );
}
