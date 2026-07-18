import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  MapPin,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  ArrowLeft,
  Clock,
  Flame,
  Sparkles,
  Tag,
  UtensilsCrossed,
  ChevronRight,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resolveAssetUrl } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";
import { qk } from "@/lib/query-keys";
import {
  getPublicStore,
  getPublicStoreCustomerByPhone,
  createPublicStoreOrder,
  type PublicStore,
  type PublicStoreProduct,
  type PublicStoreCategory,
  type PublicPaymentMethod,
  type PublicOrderCreated,
  type PublicCustomer,
  type PublicCustomerAddress,
  type PublicProductOptionGroup,
  type PublicProductOption,
} from "@/lib/public-api";



export const Route = createFileRoute("/p/$slug")({
  component: PublicStorePage,
  head: ({ params }) => ({
    meta: [
      { title: `Cardápio · ${params.slug}` },
      { name: "description", content: "Faça seu pedido online direto pelo cardápio." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

interface CartLineSelectedOption {
  optionGroupId: string;
  optionIds: string[];
  displayOptions: {
    groupName: string;
    optionName: string;
    priceDeltaInCents: number;
  }[];
}

interface CartLine {
  key: string;
  product: PublicStoreProduct;
  basePriceInCents: number;
  quantity: number;
  notes?: string;
  selectedOptions: CartLineSelectedOption[];
  selectedFlavorProductIds: string[];
  displayFlavors: {
    id: string;
    name: string;
    priceInCents: number;
  }[];
  /** base + sum of all option priceDeltaInCents (visual only). */
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


function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function digits(s: string) {
  return s.replace(/\D+/g, "");
}

function parseBRLToCents(input: string): number {
  const clean = input.replace(/[^\d,.]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = Number(clean);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

/** Extract loose optional fields (badges, delivery time) without breaking types. */
function pick<T = unknown>(obj: Record<string, unknown> | undefined | null, ...keys: string[]): T | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && v !== "") return v as T;
  }
  return undefined;
}

function productBadges(p: PublicStoreProduct): { label: string; tone: "hot" | "promo" | "new" }[] {
  const raw = p as unknown as Record<string, unknown>;
  const out: { label: string; tone: "hot" | "promo" | "new" }[] = [];
  if (pick<boolean>(raw, "bestSeller", "isBestSeller", "isPopular", "popular")) {
    out.push({ label: "Mais vendido", tone: "hot" });
  }
  const original = pick<number>(raw, "originalPriceInCents", "oldPriceInCents", "compareAtPriceInCents");
  if (
    pick<boolean>(raw, "isPromo", "onSale", "promo") ||
    (typeof original === "number" && original > p.priceInCents)
  ) {
    out.push({ label: "Promoção", tone: "promo" });
  }
  if (pick<boolean>(raw, "isNew", "novo")) {
    out.push({ label: "Novo", tone: "new" });
  }
  const extra = pick<string>(raw, "badge", "tag");
  if (typeof extra === "string" && !out.find((b) => b.label === extra)) {
    out.push({ label: extra, tone: "new" });
  }
  return out;
}

const checkoutSchema = z
  .object({
    customerName: z.string().trim().min(2, "Informe seu nome").max(120),
    customerPhone: z
      .string()
      .transform((v) => digits(v))
      .refine((v) => v.length >= 10 && v.length <= 13, "WhatsApp inválido"),
    fulfillment: z.enum(["DELIVERY", "PICKUP"]),
    deliveryAddress: z.string().trim().max(200).optional().or(z.literal("")),
    deliveryNumber: z.string().trim().max(20).optional().or(z.literal("")),
    deliveryNeighborhood: z.string().trim().max(120).optional().or(z.literal("")),
    deliveryComplement: z.string().trim().max(120).optional().or(z.literal("")),
    deliveryReference: z.string().trim().max(200).optional().or(z.literal("")),
    paymentMethod: z.enum(["PIX", "CARD_ON_DELIVERY", "CASH"]),
    changeFor: z.string().optional(),
    notes: z.string().trim().max(500).optional().or(z.literal("")),
  })
  .superRefine((v, ctx) => {
    if (v.fulfillment !== "DELIVERY") return;
    if (!v.deliveryAddress || v.deliveryAddress.trim().length < 2)
      ctx.addIssue({ code: "custom", path: ["deliveryAddress"], message: "Informe o endereço" });
    if (!v.deliveryNumber || v.deliveryNumber.trim().length < 1)
      ctx.addIssue({ code: "custom", path: ["deliveryNumber"], message: "Informe o número" });
    if (!v.deliveryNeighborhood || v.deliveryNeighborhood.trim().length < 2)
      ctx.addIssue({ code: "custom", path: ["deliveryNeighborhood"], message: "Informe o bairro" });
  });

function PublicStorePage() {
  const { slug } = Route.useParams();
  const queryClient = useQueryClient();

  const q = useQuery({
    queryKey: qk.publicStore.bySlug(slug),
    queryFn: () => getPublicStore(slug),
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const [cart, setCart] = useState<CartLine[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [addingProduct, setAddingProduct] = useState<PublicStoreProduct | null>(null);
  const [addNotes, setAddNotes] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successOrder, setSuccessOrder] = useState<PublicOrderCreated | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const store = q.data?.store;
  const categories = useMemo<PublicStoreCategory[]>(() => {
    const list = q.data?.categories ?? [];
    return [...list].sort(
      (a, b) =>
        (a.sortOrder ?? a.order ?? 0) - (b.sortOrder ?? b.order ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }, [q.data]);
  const products = useMemo<PublicStoreProduct[]>(() => {
    return (q.data?.products ?? []).filter((p) => p.active !== false);
  }, [q.data]);

  const isOpen = useMemo(() => {
    if (!store) return false;
    if (typeof store.operation?.acceptingOrders === "boolean") return store.operation.acceptingOrders;
    if (typeof store.acceptingOrders === "boolean") return store.acceptingOrders;
    return false;
  }, [store]);

  const openStatusMessage = useMemo(() => {
    if (!store) return "Carregando";
    if (isOpen) return store.openStatusMessage || store.operation?.statusMessage || "Aberto agora";
    const nextOpening = store.operation?.nextOpeningAt ?? store.nextOpeningAt;
    if (nextOpening) {
      const label = new Date(nextOpening).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Fechado · Abre às ${label}`;
    }
    return store.operation?.statusMessage || store.openStatusMessage || "Fechado";
  }, [isOpen, store]);

  // Resolved branding (all fields optional — fall back to previous behavior).
  const branding = useMemo(() => {
    const s = (store ?? {}) as PublicStore;
    return {
      primary: s.primaryColor || null,
      secondary: s.secondaryColor || null,
      background: s.backgroundColor || null,
      theme: (s.theme as string) || "SYSTEM",
      logoUrl: s.logoUrl || null,
      lightLogoUrl: s.lightLogoUrl || null,
      darkLogoUrl: s.darkLogoUrl || null,
      bannerUrl: s.bannerUrl || null,
      bannerDesktopUrl: s.bannerDesktopUrl || null,
      bannerMobileUrl: s.bannerMobileUrl || null,
      defaultProductImageUrl: s.defaultProductImageUrl || null,
      socialImageUrl: s.socialImageUrl || null,
    };
  }, [store]);

  // Apply theme to the document root while this page is mounted.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const prev = root.classList.contains("dark");
    const apply = (dark: boolean) => root.classList.toggle("dark", dark);
    let mql: MediaQueryList | null = null;
    let onChange: ((e: MediaQueryListEvent) => void) | null = null;
    if (branding.theme === "DARK") apply(true);
    else if (branding.theme === "LIGHT") apply(false);
    else {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
      apply(mql.matches);
      onChange = (e) => apply(e.matches);
      mql.addEventListener("change", onChange);
    }
    return () => {
      if (mql && onChange) mql.removeEventListener("change", onChange);
      root.classList.toggle("dark", prev);
    };
  }, [branding.theme]);

  // Track viewport for banner variants.
  const [isDesktopVp, setIsDesktopVp] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 640px)");
    const set = () => setIsDesktopVp(mql.matches);
    set();
    mql.addEventListener("change", set);
    return () => mql.removeEventListener("change", set);
  }, []);

  // Social image (og:image) — updated client-side when store loads.
  useEffect(() => {
    if (typeof document === "undefined" || !branding.socialImageUrl) return;
    const url = resolveAssetUrl(branding.socialImageUrl) ?? branding.socialImageUrl;
    const setMeta = (attr: "property" | "name", key: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", url);
    };
    setMeta("property", "og:image");
    setMeta("name", "twitter:image");
  }, [branding.socialImageUrl]);

  const deliveryTime = useMemo(() => {
    const raw = (store ?? {}) as Record<string, unknown>;
    const min = pick<number | string>(raw, "deliveryTimeMin", "estimatedTimeMin", "prepTimeMin");
    const max = pick<number | string>(raw, "deliveryTimeMax", "estimatedTimeMax", "prepTimeMax");
    if (min && max) return `${min}–${max} min`;
    if (min) return `~${min} min`;
    const label = pick<string>(raw, "deliveryTime", "estimatedTime");
    return label ?? "30–60 min";
  }, [store]);

  const productsByCategory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const map = new Map<string, PublicStoreProduct[]>();
    for (const c of categories) map.set(c.id, []);
    const noCat: PublicStoreProduct[] = [];
    for (const p of products) {
      if (term && !p.name.toLowerCase().includes(term) && !(p.description ?? "").toLowerCase().includes(term)) continue;
      if (p.categoryId && map.has(p.categoryId)) map.get(p.categoryId)!.push(p);
      else noCat.push(p);
    }
    // Sort products within each category by sortOrder then name.
    const cmp = (a: PublicStoreProduct, b: PublicStoreProduct) =>
      (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
    for (const list of map.values()) list.sort(cmp);
    noCat.sort(cmp);
    return { map, noCat };
  }, [products, categories, search]);


  // Highlight active category based on scroll
  const stickyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (categories.length === 0) return;
    const opts = { rootMargin: "-140px 0px -60% 0px", threshold: 0 };
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const id = (e.target as HTMLElement).id.replace(/^cat-/, "");
          setActiveCategory(id);
        }
      }
    }, opts);
    for (const c of categories) {
      const el = document.getElementById(`cat-${c.id}`);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [categories]);

  const totalItems = cart.reduce((s, l) => s + l.quantity, 0);
  const subtotal = cart.reduce((s, l) => s + l.unitPriceInCents * l.quantity, 0);

  function addToCart(
    product: PublicStoreProduct,
    notes: string,
    selectedOptions: CartLineSelectedOption[],
    selectedFlavorProductIds: string[],
    displayFlavors: { id: string; name: string; priceInCents: number }[],
    quantity: number,
  ) {
    setCart((prev) => {
      const trimmed = notes.trim();
      const optSig = JSON.stringify(
        selectedOptions.map((s) => ({ g: s.optionGroupId, o: [...s.optionIds].sort() })),
      );
      const flavorSig = JSON.stringify(selectedFlavorProductIds.slice().sort());
      const idx = prev.findIndex(
        (l) =>
          l.product.id === product.id &&
          (l.notes ?? "") === trimmed &&
          JSON.stringify(l.selectedFlavorProductIds.slice().sort()) === flavorSig &&
          JSON.stringify(
            l.selectedOptions.map((s) => ({ g: s.optionGroupId, o: [...s.optionIds].sort() })),
          ) === optSig,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity };
        return next;
      }
      const deltaSum = selectedOptions.reduce(
        (acc, s) => acc + s.displayOptions.reduce((a, o) => a + (o.priceDeltaInCents ?? 0), 0),
        0,
      );
      const basePriceInCents =
        displayFlavors.length === 2
          ? Math.max(...displayFlavors.map((flavor) => flavor.priceInCents))
          : product.priceInCents;
      return [
        ...prev,
        {
          key: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          product,
          basePriceInCents,
          quantity,
          notes: trimmed || undefined,
          selectedOptions,
          selectedFlavorProductIds,
          displayFlavors,
          unitPriceInCents: basePriceInCents + deltaSum,
        },
      ];
    });
    toast.success("Adicionado ao carrinho");
  }


  function updateQty(key: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLineNotes(key: string, notes: string) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, notes } : l)));
  }

  async function submitOrder(
    form: z.infer<typeof checkoutSchema>,
    extras: { customerId?: string; customerAddressId?: string } = {},
  ) {

    if (cart.length === 0) return;

    // Fase 2A guardrails — block checkout when the store is closed or the
    // subtotal is below the configured minimum. Values come exclusively from
    // GET /public/stores/:slug (operation + orderRules); we never invent them.
    const op = store?.operation;
    const rules = store?.orderRules;
    const ff = store?.fulfillment;
    if (op) {
      if (op.onlineOrderingEnabled === false) {
        toast.error("Pedidos online estão desativados no momento.");
        return;
      }
      if (op.acceptingOrders === false || op.openNow === false) {
        toast.error(op.closedMessage ?? "A loja está fechada no momento.");
        return;
      }
    }
    // Guardrail: never POST DELIVERY when the backend says delivery is off.
    if (form.fulfillment === "DELIVERY" && ff && ff.delivery === false) {
      toast.error("Esta loja não está aceitando entregas no momento.");
      setCheckoutOpen(true);
      return;
    }
    if (form.fulfillment === "PICKUP" && ff && ff.pickup === false) {
      toast.error("Esta loja não está aceitando retirada no momento.");
      return;
    }
    if (rules && rules.minimumOrderInCents > 0 && subtotal < rules.minimumOrderInCents) {
      const min = (rules.minimumOrderInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
      toast.error(`Pedido mínimo de ${min} não atingido.`);
      return;
    }

    setSubmitting(true);

    try {
      const changeCents =
        form.paymentMethod === "CASH" && form.changeFor
          ? parseBRLToCents(form.changeFor)
          : undefined;

      const isDelivery = form.fulfillment === "DELIVERY";
      const created = await createPublicStoreOrder(slug, {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerId: extras.customerId,
        customerAddressId: isDelivery ? extras.customerAddressId : undefined,
        fulfillment: form.fulfillment,
        deliveryAddress: isDelivery ? form.deliveryAddress || undefined : undefined,
        deliveryNumber: isDelivery ? form.deliveryNumber || undefined : undefined,
        deliveryNeighborhood: isDelivery ? form.deliveryNeighborhood || undefined : undefined,
        deliveryComplement: isDelivery ? form.deliveryComplement || undefined : undefined,
        deliveryReference: isDelivery ? form.deliveryReference || undefined : undefined,
        paymentMethod: form.paymentMethod,
        changeForInCents: changeCents && changeCents > 0 ? changeCents : undefined,
        notes: form.notes || orderNotes.trim() || undefined,
        items: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          notes: l.notes,
          selectedFlavorProductIds: l.selectedFlavorProductIds,
          selectedOptions: l.selectedOptions.length > 0
            ? l.selectedOptions.map((s) => ({
                optionGroupId: s.optionGroupId,
                optionIds: s.optionIds,
              }))
            : undefined,
        })),

      });
      setSuccessOrder(created);
      setCheckoutOpen(false);
      setCartOpen(false);
      setCart([]);
      setOrderNotes("");
    } catch (err) {
      // Detect the DELIVERY_DISABLED backend error explicitly so we can
      // route the user back to the fulfillment/entrega step instead of
      // silently switching to PICKUP.
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: unknown }).code)
          : "";
      if (code === "STORE_CLOSED") {
        setCheckoutOpen(true);
        await queryClient.invalidateQueries({ queryKey: qk.publicStore.bySlug(slug) });
        toast.error("O estabelecimento esta fechado no momento. Seu carrinho foi mantido.");
      } else if (code === "DELIVERY_DISABLED") {
        toast.error(
          "Esta loja não está aceitando entregas no momento. Escolha retirada no balcão.",
        );
        // Reopen the checkout sheet — cart is preserved.
        setCheckoutOpen(true);
      } else {
        toast.error(handleApiError(err, "Não foi possível enviar o pedido."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (q.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (q.isError || !store) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-sm rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm font-medium text-foreground">Loja indisponível</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Verifique o link ou tente novamente em instantes.
          </p>
        </div>
      </div>
    );
  }

  const themeIsDark =
    branding.theme === "DARK" ||
    (branding.theme === "SYSTEM" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  const bannerCandidate = isDesktopVp
    ? branding.bannerDesktopUrl ?? branding.bannerUrl
    : branding.bannerMobileUrl ?? branding.bannerUrl;
  const banner = bannerCandidate ? (resolveAssetUrl(bannerCandidate) ?? bannerCandidate) : null;
  const logoCandidate =
    (themeIsDark ? branding.darkLogoUrl : branding.lightLogoUrl) ?? branding.logoUrl;
  const logo = logoCandidate ? (resolveAssetUrl(logoCandidate) ?? logoCandidate) : null;
  const defaultProductImg = branding.defaultProductImageUrl
    ? (resolveAssetUrl(branding.defaultProductImageUrl) ?? branding.defaultProductImageUrl)
    : null;

  // Expose branding as CSS variables — components already using --primary/--secondary
  // via Tailwind tokens keep working; explicit brand consumers can use --brand-*.
  const brandStyle: React.CSSProperties = {
    ...(branding.primary ? ({ ["--brand-primary" as string]: branding.primary } as React.CSSProperties) : {}),
    ...(branding.secondary ? ({ ["--brand-secondary" as string]: branding.secondary } as React.CSSProperties) : {}),
    ...(branding.background ? { backgroundColor: branding.background } : {}),
  };

  const brandGradient = branding.primary
    ? `linear-gradient(135deg, ${branding.primary} 0%, ${branding.secondary ?? branding.primary} 55%, ${branding.background ?? branding.secondary ?? branding.primary} 100%)`
    : "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow, var(--primary))) 100%)";

  return (
    <div
      className="min-h-screen bg-background pb-40"
      style={brandStyle}
    >
      {/* Hero — compact banner with overlaid logo */}
      <header className="relative">
        <div className="relative h-40 w-full overflow-hidden sm:h-56 md:h-60">
          {banner ? (
            <>
              <img
                src={banner}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
            </>
          ) : (
            <>
              <div
                className="h-full w-full"
                style={{ backgroundImage: brandGradient }}
              />
              <div className="absolute inset-0 backdrop-blur-[2px]" />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            </>
          )}
        </div>

        <div className="mx-auto -mt-10 max-w-4xl px-3 sm:-mt-14 sm:px-6">
          <div className="flex items-center gap-3 sm:items-end sm:gap-4">
            <div className="relative shrink-0">
              {logo ? (
                <img
                  src={logo}
                  alt={store.name}
                  className="h-20 w-20 rounded-xl border-[3px] border-background bg-card object-cover shadow-xl ring-1 ring-border/40 min-[390px]:h-24 min-[390px]:w-24 sm:h-28 sm:w-28 sm:rounded-2xl sm:border-4"
                  loading="eager"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-xl border-[3px] border-background bg-gradient-to-br from-primary to-primary-glow text-2xl font-black text-primary-foreground shadow-xl min-[390px]:h-24 min-[390px]:w-24 sm:h-28 sm:w-28 sm:rounded-2xl sm:border-4 sm:text-3xl">
                  {store.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-0.5 sm:pb-1.5">
              <h1 className="line-clamp-2 break-words text-xl font-black leading-tight tracking-tight text-foreground min-[390px]:text-2xl sm:text-3xl">
                {store.name}
              </h1>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] sm:gap-x-2 sm:text-xs">
                <span
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold sm:gap-1.5 sm:px-2 ${
                    isOpen
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-400"
                  }`}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {isOpen && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                        isOpen ? "bg-emerald-500" : "bg-rose-500"
                      }`}
                    />
                  </span>
                  {openStatusMessage}
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" /> {deliveryTime}
                </span>
                {store.city && (
                  <span
                    className="inline-flex min-w-0 basis-full items-center gap-1 text-muted-foreground sm:basis-auto"
                    title={`${store.city}${store.state ? ` · ${store.state}` : ""}`}
                  >
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">
                      {store.city}
                      {store.state ? ` · ${store.state}` : ""}
                    </span>
                  </span>
                )}
              </div>
              {store.description && (
                <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground sm:text-sm">
                  {store.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Sticky search + categories */}
      <div
        ref={stickyRef}
        className="sticky top-0 z-30 mt-4 border-b border-border/60 bg-background/90 backdrop-blur-xl"
      >
        <div className="mx-auto max-w-4xl px-4 py-2.5 sm:px-6">
          <div className="relative mx-auto max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar pizzas, bebidas, salgados…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-full border-border/60 bg-muted/50 pl-11 pr-4 text-sm shadow-sm focus-visible:bg-background"
            />
          </div>
          {categories.length > 0 && (
            <div className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              {categories.map((c) => {
                const active = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setActiveCategory(c.id);
                      const el = document.getElementById(`cat-${c.id}`);
                      if (el) {
                        const y = el.getBoundingClientRect().top + window.scrollY - 110;
                        window.scrollTo({ top: y, behavior: "smooth" });
                      }
                    }}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                      active
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "bg-card text-muted-foreground ring-1 ring-border/60 hover:text-foreground"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Menu */}
      <main className="mx-auto mt-4 max-w-4xl space-y-8 px-4 sm:px-6">

        {categories.length === 0 && products.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">Cardápio em preparação</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Volte em instantes para conferir as novidades.
            </p>
          </div>
        )}

        {categories.map((c) => {
          const list = productsByCategory.map.get(c.id) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={c.id} id={`cat-${c.id}`} className="scroll-mt-32">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-lg font-black tracking-tight text-foreground">
                  {c.name}
                </h2>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {list.length} {list.length === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="space-y-3">
                {list.map((p) => (
                  <ProductCard key={p.id} product={p} fallbackImageUrl={defaultProductImg} onAdd={() => setAddingProduct(p)} />
                ))}
              </div>
            </section>
          );
        })}

        {productsByCategory.noCat.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-black tracking-tight text-foreground">
              Outros
            </h2>
            <div className="space-y-3">
              {productsByCategory.noCat.map((p) => (
                <ProductCard key={p.id} product={p} fallbackImageUrl={defaultProductImg} onAdd={() => setAddingProduct(p)} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Floating cart bar (iFood-style) */}
      {totalItems > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 pt-3 pb-safe">
          <div className="mx-auto max-w-3xl">
            <button
              onClick={() => setCartOpen(true)}
              className="group flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-primary-glow px-4 py-3.5 text-primary-foreground shadow-2xl shadow-primary/40 ring-1 ring-primary/30 transition active:scale-[0.99]"
            >
              <span className="relative">
                <ShoppingBag className="h-6 w-6" />
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1 text-[10px] font-bold text-primary shadow">
                  {totalItems}
                </span>
              </span>
              <span className="flex-1 text-left text-sm font-bold">Ver carrinho</span>
              <span className="text-base font-black">{brl(subtotal)}</span>
              <ChevronRight className="h-5 w-5 opacity-80" />
            </button>
          </div>
        </div>
      )}

      {/* Product modal */}
      <Dialog
        open={!!addingProduct}
        onOpenChange={(open) => {
          if (!open) {
            setAddingProduct(null);
            setAddNotes("");
          }
        }}
      >
        <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
          <VisuallyHidden>
            <DialogTitle>
              {addingProduct?.name ?? "Personalizar produto"}
            </DialogTitle>
            <DialogDescription>
              Personalize as opções do produto e adicione ao carrinho.
            </DialogDescription>
          </VisuallyHidden>
          {addingProduct && (
            <ProductModalBody
              product={addingProduct}
              notes={addNotes}
              setNotes={setAddNotes}
              isOpen={isOpen}
              fallbackImageUrl={defaultProductImg}
              onAdd={(selectedOptions, selectedFlavorProductIds, displayFlavors, qty) => {
                addToCart(addingProduct, addNotes, selectedOptions, selectedFlavorProductIds, displayFlavors, qty);
                setAddingProduct(null);
                setAddNotes("");
              }}
            />
          )}
        </DialogContent>
      </Dialog>


      {/* Cart sheet */}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/60 pb-3">
            <SheetTitle className="text-base font-black">Seu carrinho</SheetTitle>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto py-4">
            {cart.length === 0 && (
              <div className="py-16 text-center">
                <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Carrinho vazio</p>
              </div>
            )}
            {cart.map((l) => (
              <div key={l.key} className="rounded-2xl border border-border/70 bg-card p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{l.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {brl(l.unitPriceInCents)}
                    </p>
                    {l.displayFlavors.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {l.displayFlavors.map((flavor, index) => (
                          <li key={`${l.key}-flavor-${index}`} className="text-[11px] text-muted-foreground">
                            <span className="font-semibold">1/2</span> {flavor.name}
                          </li>
                        ))}
                      </ul>
                    )}
                    {l.selectedOptions.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {l.selectedOptions.flatMap((s) =>
                          s.displayOptions.map((d, i) => (
                            <li key={`${s.optionGroupId}-${i}`} className="text-[11px] text-muted-foreground">
                              <span className="font-semibold">{d.groupName}:</span> {d.optionName}
                              {d.priceDeltaInCents > 0 ? ` (+${brl(d.priceDeltaInCents)})` : ""}
                            </li>
                          )),
                        )}
                      </ul>
                    )}
                  </div>
                  <button
                    onClick={() => removeLine(l.key)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <Textarea
                  value={l.notes ?? ""}
                  onChange={(e) => updateLineNotes(l.key, e.target.value)}
                  placeholder="Observação do item"
                  rows={1}
                  maxLength={200}
                  className="mt-2 text-xs"
                />
                <div className="mt-2 flex items-center justify-between">
                  <div className="inline-flex items-center rounded-full bg-muted">
                    <button
                      onClick={() => updateQty(l.key, -1)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      aria-label="Diminuir"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-6 text-center text-sm font-bold">
                      {l.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(l.key, +1)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      aria-label="Aumentar"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-sm font-black text-primary">
                    {brl(l.unitPriceInCents * l.quantity)}
                  </span>
                </div>
              </div>
            ))}

            {cart.length > 0 && (
              <div>
                <Label htmlFor="order-notes" className="text-xs font-semibold">
                  Observação do pedido (opcional)
                </Label>
                <Textarea
                  id="order-notes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Ex.: interfone quebrado, deixar na portaria…"
                  rows={2}
                  maxLength={500}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          {cart.length > 0 && (
            <div className="border-t border-border/60 pt-4">
              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-lg font-black">{brl(subtotal)}</span>
              </div>
              <Button
                size="lg"
                className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow text-base font-bold shadow-lg shadow-primary/30"
                disabled={!isOpen}
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
              >
                {isOpen ? "Continuar" : "Loja fechada"}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Checkout */}
      <CheckoutSheet
        slug={slug}
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        subtotal={subtotal}
        submitting={submitting}
        fulfillment={store.fulfillment}
        onSubmit={submitOrder}
      />


      {/* Success */}
      <Dialog open={!!successOrder} onOpenChange={(o) => !o && setSuccessOrder(null)}>
        <DialogContent className="max-w-md overflow-hidden p-0">
          <VisuallyHidden>
            <DialogTitle>Pedido recebido</DialogTitle>
            <DialogDescription>
              Confirmação do pedido com número, itens e forma de pagamento.
            </DialogDescription>
          </VisuallyHidden>
          {successOrder && <SuccessScreen order={successOrder} storeName={store.name} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductCard({
  product,
  onAdd,
  fallbackImageUrl = null,
}: {
  product: PublicStoreProduct;
  onAdd: () => void;
  fallbackImageUrl?: string | null;
}) {
  const soldOut = product.soldOut === true;
  const badges = productBadges(product);
  const raw = product as unknown as Record<string, unknown>;
  const original = pick<number>(raw, "originalPriceInCents", "oldPriceInCents", "compareAtPriceInCents");
  const resolved = product.imageUrl ? (resolveAssetUrl(product.imageUrl) ?? product.imageUrl) : null;
  const img = resolved ?? fallbackImageUrl;

  return (
    <button
      onClick={onAdd}
      disabled={soldOut}
      className="group relative flex w-full items-stretch gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-3 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md disabled:opacity-60"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        {badges.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1">
            {badges.map((b) => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          </div>
        )}
        <p className="line-clamp-1 text-[15px] font-bold text-foreground">
          {product.name}
        </p>
        {product.description && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-baseline gap-2 pt-2">
          <span className="text-base font-black text-primary">
            {brl(product.priceInCents)}
          </span>
          {typeof original === "number" && original > product.priceInCents && (
            <span className="text-xs text-muted-foreground line-through">
              {brl(original)}
            </span>
          )}
        </div>
      </div>
      <div className="relative shrink-0">
        <div className="relative h-24 w-24 overflow-hidden rounded-xl bg-gradient-to-br from-muted to-muted/50 sm:h-28 sm:w-28">
          {img ? (
            <img
              src={img}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/50">
              <UtensilsCrossed className="h-8 w-8" />
            </div>
          )}
          {soldOut && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 text-[10px] font-bold uppercase tracking-wide text-foreground">
              Esgotado
            </div>
          )}
        </div>
        <span
          aria-hidden
          className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-lg shadow-primary/40 ring-2 ring-background transition group-hover:scale-110 group-active:scale-95"
        >
          <Plus className="h-4 w-4" strokeWidth={3} />
        </span>
      </div>
    </button>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "hot" | "promo" | "new" }) {
  const map = {
    hot: "bg-orange-500/15 text-orange-600 ring-orange-500/30",
    promo: "bg-rose-500/15 text-rose-600 ring-rose-500/30",
    new: "bg-primary/15 text-primary ring-primary/30",
  } as const;
  const icon = tone === "hot" ? <Flame className="h-3 w-3" /> : tone === "promo" ? <Tag className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${map[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

function ProductModalBody({
  product,
  notes,
  setNotes,
  isOpen,
  onAdd,
  fallbackImageUrl = null,
}: {
  product: PublicStoreProduct;
  notes: string;
  setNotes: (v: string) => void;
  isOpen: boolean;
  onAdd: (
    selectedOptions: CartLineSelectedOption[],
    selectedFlavorProductIds: string[],
    displayFlavors: { id: string; name: string; priceInCents: number }[],
    qty: number,
  ) => void;
  fallbackImageUrl?: string | null;
}) {
  const [qty, setQty] = useState(1);
  const badges = productBadges(product);
  const raw = product as unknown as Record<string, unknown>;
  const original = pick<number>(raw, "originalPriceInCents", "oldPriceInCents", "compareAtPriceInCents");
  const resolved = product.imageUrl ? (resolveAssetUrl(product.imageUrl) ?? product.imageUrl) : null;
  const img = resolved ?? fallbackImageUrl;

  const groups = useMemo(() => sortedGroups(product.optionGroups), [product.optionGroups]);
  const flavorProducts = useMemo(
    () => [...(product.halfAndHalfFlavors ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [product.halfAndHalfFlavors],
  );
  const acceptsHalfAndHalf =
    product.supportsHalfAndHalf || product.acceptsHalfAndHalf || product.pricingRule === "MAX_SELECTED_FLAVOR";
  const [pizzaMode, setPizzaMode] = useState<"WHOLE" | "HALF_AND_HALF">("WHOLE");
  const [secondFlavorId, setSecondFlavorId] = useState("");
  // Selected option IDs per group.
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const g of groups) init[g.id] = [];
    return init;
  });
  useEffect(() => {
    setPizzaMode("WHOLE");
    setSecondFlavorId("");
    const init: Record<string, string[]> = {};
    for (const g of groups) init[g.id] = [];
    setSelectedByGroup(init);
  }, [product.id]);

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

  // Sum of price deltas for currently selected options.
  const deltaTotal = useMemo(() => {
    let sum = 0;
    for (const g of groups) {
      const ids = selectedByGroup[g.id] ?? [];
      for (const id of ids) {
        const opt = g.options.find((o) => o.id === id);
        if (opt) sum += opt.priceDeltaInCents ?? 0;
      }
    }
    return sum;
  }, [groups, selectedByGroup]);

  const secondFlavor = useMemo(
    () => flavorProducts.find((flavor) => flavor.id === secondFlavorId) ?? null,
    [flavorProducts, secondFlavorId],
  );
  const displayFlavors = useMemo(
    () =>
      pizzaMode === "HALF_AND_HALF" && secondFlavor
        ? [
            { id: product.id, name: product.name, priceInCents: product.priceInCents },
            { id: secondFlavor.id, name: secondFlavor.name, priceInCents: secondFlavor.priceInCents },
          ]
        : [],
    [pizzaMode, product.id, product.name, product.priceInCents, secondFlavor],
  );
  const flavorBasePrice =
    acceptsHalfAndHalf && pizzaMode === "HALF_AND_HALF" && secondFlavor
      ? Math.max(product.priceInCents, secondFlavor.priceInCents)
      : product.priceInCents;
  const previewUnitPrice = flavorBasePrice + deltaTotal;

  // Validation: required groups need >= minSelections; all groups <= maxSelections.
  const validation = useMemo(() => {
    if (acceptsHalfAndHalf && pizzaMode === "HALF_AND_HALF" && !secondFlavor) {
      return { ok: false, reason: "Escolha o segundo sabor" };
    }
    for (const g of groups) {
      const ids = selectedByGroup[g.id] ?? [];
      const min = g.required ? Math.max(1, g.minSelections || 1) : (g.minSelections || 0);
      if (ids.length < min) return { ok: false, reason: `Selecione pelo menos ${min} em "${g.name}"` };
    }
    return { ok: true, reason: null as string | null };
  }, [acceptsHalfAndHalf, groups, pizzaMode, secondFlavor, selectedByGroup]);

  function handleAdd() {
    if (!validation.ok) {
      toast.error(validation.reason ?? "Complete as opções obrigatórias");
      return;
    }
    const payload: CartLineSelectedOption[] = groups
      .map((g) => {
        const ids = selectedByGroup[g.id] ?? [];
        if (ids.length === 0) return null;
        const displayOptions = ids.map((id) => {
          const opt = g.options.find((o) => o.id === id);
          return {
            groupName: g.name,
            optionName: opt?.name ?? "",
            priceDeltaInCents: opt?.priceDeltaInCents ?? 0,
          };
        });
        return { optionGroupId: g.id, optionIds: ids, displayOptions };
      })
      .filter((v): v is CartLineSelectedOption => v !== null);
    onAdd(
      payload,
      pizzaMode === "HALF_AND_HALF" && secondFlavor ? [secondFlavor.id] : [],
      displayFlavors,
      qty,
    );
  }

  return (
    <div className="flex flex-col max-h-[90vh]">
      <div className="relative h-56 w-full flex-shrink-0 overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        {img ? (
          <img src={img} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
            <UtensilsCrossed className="h-16 w-16" />
          </div>
        )}
        {badges.length > 0 && (
          <div className="absolute left-3 top-3 flex flex-wrap gap-1">
            {badges.map((b) => (
              <Badge key={b.label} tone={b.tone}>
                {b.label}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-4 overflow-y-auto p-5">
        <div>
          <h2 className="text-xl font-black tracking-tight">{product.name}</h2>
          {product.description && (
            <p className="mt-1 text-sm text-muted-foreground">{product.description}</p>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-black text-primary">{brl(previewUnitPrice)}</span>
          {typeof original === "number" && original > product.priceInCents && (
            <span className="text-sm text-muted-foreground line-through">{brl(original)}</span>
          )}
        </div>

        {acceptsHalfAndHalf && (
          <div className="rounded-xl border border-border/60 bg-muted/30">
            <div className="border-b border-border/50 px-3 py-2">
              <p className="text-sm font-bold">Como você quer sua pizza?</p>
              <p className="text-[11px] text-muted-foreground">
                O valor da pizza meio a meio será o do sabor de maior preço.
              </p>
            </div>
            <div className="space-y-3 p-3">
              <RadioGroup
                value={pizzaMode}
                onValueChange={(value) => setPizzaMode(value as "WHOLE" | "HALF_AND_HALF")}
                className="grid gap-2 sm:grid-cols-2"
              >
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background p-3 text-sm">
                  <RadioGroupItem value="WHOLE" id={`whole-${product.id}`} />
                  <span>Pizza inteira</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/60 bg-background p-3 text-sm">
                  <RadioGroupItem value="HALF_AND_HALF" id={`half-${product.id}`} />
                  <span>Meio a meio</span>
                </label>
              </RadioGroup>

              {pizzaMode === "HALF_AND_HALF" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="mb-2 text-xs font-bold text-muted-foreground">Primeira metade</p>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-medium">{product.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{brl(product.priceInCents)}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/60 bg-background p-3">
                    <p className="mb-2 text-xs font-bold text-muted-foreground">Segunda metade</p>
                    <Select value={secondFlavorId} onValueChange={setSecondFlavorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um sabor" />
                      </SelectTrigger>
                      <SelectContent>
                        {flavorProducts.map((flavor) => (
                          <SelectItem key={flavor.id} value={flavor.id}>
                            {flavor.name} - {brl(flavor.priceInCents)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {groups.map((g) => {
          const selected = selectedByGroup[g.id] ?? [];
          const max = Math.max(1, g.maxSelections || 1);
          const single = max === 1;
          return (
            <div key={g.id} className="rounded-xl border border-border/60 bg-muted/30">
              <div className="flex items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{g.name}</p>
                  {g.description && (
                    <p className="text-[11px] text-muted-foreground">{g.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {g.required ? "Obrigatório" : "Opcional"}
                    {max > 1 ? ` · escolha até ${max}` : ""}
                  </p>
                </div>
                {g.required && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    OBRIGATÓRIO
                  </span>
                )}
              </div>
              <ul className="divide-y divide-border/50">
                {sortedOptions(g.options).map((opt) => {
                  const active = selected.includes(opt.id);
                  const disabled = !active && selected.length >= max && !single;
                  const linkedImg = opt.linkedProduct?.imageUrl
                    ? (resolveAssetUrl(opt.linkedProduct.imageUrl) ?? opt.linkedProduct.imageUrl)
                    : null;
                  return (
                    <li key={opt.id}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => toggleOption(g, opt.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                          active ? "bg-primary/5" : "hover:bg-muted/60"
                        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                      >
                        {linkedImg && (
                          <img
                            src={linkedImg}
                            alt=""
                            className="h-10 w-10 flex-shrink-0 rounded-lg object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{opt.name}</p>
                          {opt.priceDeltaInCents > 0 && (
                            <p className="text-xs text-muted-foreground">+ {brl(opt.priceDeltaInCents)}</p>
                          )}
                        </div>
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border ${
                            single ? "rounded-full" : "rounded-md"
                          } ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                          aria-hidden
                        >
                          {active && (single ? <span className="h-2 w-2 rounded-full bg-primary-foreground" /> : <span className="text-[10px] font-black">✓</span>)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <div>
          <Label htmlFor="add-notes" className="text-xs font-semibold">
            Observação (opcional)
          </Label>
          <Textarea
            id="add-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: sem cebola, ponto da carne…"
            rows={2}
            maxLength={200}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <div className="inline-flex items-center rounded-full bg-muted">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="p-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Diminuir"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-8 text-center text-sm font-black">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="p-2.5 text-muted-foreground hover:text-foreground"
              aria-label="Aumentar"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <Button
            size="lg"
            disabled={!isOpen || product.soldOut === true || !validation.ok}
            onClick={handleAdd}
            className="h-12 flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-glow font-bold shadow-lg shadow-primary/30"
          >
            {!isOpen
              ? "Loja fechada"
              : product.soldOut
                ? "Esgotado"
                : `Adicionar · ${brl(previewUnitPrice * qty)}`}
          </Button>
        </div>
      </div>
    </div>
  );
}


function CheckoutSheet({
  slug,
  open,
  onOpenChange,
  subtotal,
  submitting,
  fulfillment: ffOptions,
  onSubmit,
}: {
  slug: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subtotal: number;
  submitting: boolean;
  fulfillment?: import("@/lib/public-api").PublicStoreFulfillmentOptions;
  onSubmit: (
    data: z.infer<typeof checkoutSchema>,
    extras: { customerId?: string; customerAddressId?: string },
  ) => void;
}) {

  // Fulfillment availability derived exclusively from the backend contract
  // (PublicStoreFulfillmentOptions on GET /public/stores/:slug). When the
  // block is absent (older backend), assume both channels are available and
  // let the server reject with DELIVERY_DISABLED / PICKUP_DISABLED.
  const deliveryAllowed = ffOptions ? ffOptions.delivery !== false : true;
  const pickupAllowed = ffOptions ? ffOptions.pickup !== false : true;
  const noChannel = !deliveryAllowed && !pickupAllowed;

  const initialFulfillment: "DELIVERY" | "PICKUP" = deliveryAllowed
    ? "DELIVERY"
    : "PICKUP";

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    fulfillment: initialFulfillment as "DELIVERY" | "PICKUP",
    deliveryAddress: "",
    deliveryNumber: "",
    deliveryNeighborhood: "",
    deliveryComplement: "",
    deliveryReference: "",
    paymentMethod: "PIX" as PublicPaymentMethod,
    changeFor: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState<PublicCustomer | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [editingAddress, setEditingAddress] = useState(false);
  const [debouncedPhone, setDebouncedPhone] = useState("");

  // Keep fulfillment in sync when the backend availability flips (e.g. store
  // toggles delivery off while the sheet is open). Never silently switch
  // during submit — only when the option becomes strictly unavailable.
  useEffect(() => {
    if (form.fulfillment === "DELIVERY" && !deliveryAllowed && pickupAllowed) {
      setForm((prev) => ({ ...prev, fulfillment: "PICKUP" }));
    } else if (form.fulfillment === "PICKUP" && !pickupAllowed && deliveryAllowed) {
      setForm((prev) => ({ ...prev, fulfillment: "DELIVERY" }));
    }
  }, [deliveryAllowed, pickupAllowed, form.fulfillment]);

  useEffect(() => {
    if (!open) {
      setErrors({});
      setStep(0);
      setCustomer(null);
      setSelectedAddressId(null);
      setEditingAddress(false);
      setDebouncedPhone("");
    }
  }, [open]);

  // Debounce the phone before hitting the lookup endpoint.
  useEffect(() => {
    const d = digits(form.customerPhone);
    if (d.length < 10) {
      setDebouncedPhone("");
      return;
    }
    const t = setTimeout(() => setDebouncedPhone(d), 500);
    return () => clearTimeout(t);
  }, [form.customerPhone]);

  // Phone-based customer lookup.
  //
  // The backend response (GET /public/stores/:slug/customers/by-phone) shape
  // consumed here is PublicCustomer { id, name, phone, addresses[] }.
  //
  // Privacy contract:
  //  - We DO hydrate the internal form field `customerName` from the response
  //    so the zod schema (`customerName: min(2)`) passes and the POST body
  //    carries a real name — otherwise "Informe seu nome" blocks checkout
  //    even after the customer was matched.
  //  - We DO NOT surface the name in the UI beyond a neutral "Encontramos
  //    seus endereços salvos" message. No greeting, no email, no document,
  //    no order history. The single source of truth for the name in the
  //    payload is `form.customerName` — no shadow state.
  //
  // TODO(otp): Protect GET /public/stores/:slug/customers/by-phone with OTP
  // (or equivalent phone-ownership verification) before scaling to production.
  const lookupQuery = useQuery({
    queryKey: qk.publicStore.customerLookup(slug, debouncedPhone),
    queryFn: () => getPublicStoreCustomerByPhone(slug, debouncedPhone),
    enabled: !!debouncedPhone,
    staleTime: 30_000,
    retry: false,
  });

  // Sync lookup result into local state. When the phone changes to a
  // different customer / no customer, roll back to the "new customer" flow:
  // clear customer, saved-address selection, and any name that we had
  // hydrated from a previous lookup (so we never reuse another person's name).
  const hydratedNameRef = useRef<string | null>(null);
  useEffect(() => {
    if (!debouncedPhone) {
      setCustomer(null);
      setSelectedAddressId(null);
      if (hydratedNameRef.current !== null) {
        setForm((prev) => ({ ...prev, customerName: "" }));
        hydratedNameRef.current = null;
      }
      return;
    }
    if (lookupQuery.data) {
      setCustomer(lookupQuery.data);
      const name = lookupQuery.data.name?.trim();
      if (name && form.customerName.trim().length === 0) {
        setForm((prev) => ({ ...prev, customerName: name }));
        hydratedNameRef.current = name;
      }
    } else if (lookupQuery.isFetched) {
      setCustomer(null);
      setSelectedAddressId(null);
      if (hydratedNameRef.current !== null) {
        setForm((prev) => ({ ...prev, customerName: "" }));
        hydratedNameRef.current = null;
      }
    }
    // Intentionally omit form.customerName — we only hydrate on lookup transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPhone, lookupQuery.data, lookupQuery.isFetched]);

  const lookupState: "idle" | "loading" | "found" | "notFound" = !debouncedPhone
    ? "idle"
    : lookupQuery.isFetching
      ? "loading"
      : customer
        ? "found"
        : "notFound";



  function applyAddress(a: PublicCustomerAddress) {
    setForm((prev) => ({
      ...prev,
      deliveryAddress: a.address ?? "",
      deliveryNumber: a.number ?? "",
      deliveryNeighborhood: a.neighborhood ?? "",
      deliveryComplement: a.complement ?? "",
      deliveryReference: a.reference ?? "",
    }));
  }

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
    // Typing into any delivery field invalidates the "reuse saved address"
    // link — we must not send customerAddressId together with a hand-edited
    // address, so we drop the selection as soon as the user diverges.
    if (
      k === "deliveryAddress" ||
      k === "deliveryNumber" ||
      k === "deliveryNeighborhood" ||
      k === "deliveryComplement" ||
      k === "deliveryReference"
    ) {
      if (selectedAddressId) setSelectedAddressId(null);
    }
  }

  function validateStep(s: number): boolean {
    const errs: Record<string, string> = {};
    if (s === 0) {
      if (digits(form.customerPhone).length < 10) errs.customerPhone = "WhatsApp inválido";
      if (form.customerName.trim().length < 2) errs.customerName = "Informe seu nome";
    } else if (s === 1 && form.fulfillment === "DELIVERY") {
      if (form.deliveryAddress.trim().length < 2) errs.deliveryAddress = "Informe o endereço";
      if (form.deliveryNumber.trim().length < 1) errs.deliveryNumber = "Nº";
      if (form.deliveryNeighborhood.trim().length < 2) errs.deliveryNeighborhood = "Informe o bairro";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function next() {
    if (validateStep(step)) setStep((s) => (Math.min(2, s + 1) as 0 | 1 | 2));
  }

  function submit() {
    if (noChannel) {
      toast.error("Esta loja não está aceitando pedidos no momento.");
      return;
    }
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const iss of parsed.error.issues) {
        const p = iss.path[0];
        if (typeof p === "string") errs[p] = iss.message;
      }
      setErrors(errs);
      if (errs.customerName || errs.customerPhone) setStep(0);
      else if (errs.deliveryAddress || errs.deliveryNumber || errs.deliveryNeighborhood) setStep(1);
      else setStep(2);
      return;
    }
    setErrors({});
    const isDelivery = parsed.data.fulfillment === "DELIVERY";
    const usingSaved =
      isDelivery &&
      !!customer && !!selectedAddressId && !editingAddress &&
      customer.addresses.some((a) => a.id === selectedAddressId);
    onSubmit(parsed.data, {
      customerId: customer?.id,
      // Only forward the address id when the user hasn't diverged from the
      // saved values — never send both a fresh address + customerAddressId.
      customerAddressId: usingSaved ? selectedAddressId ?? undefined : undefined,
    });
  }


  const stepLabels = [
    "Identificação",
    form.fulfillment === "PICKUP" ? "Retirada" : "Entrega",
    "Pagamento",
  ];
  const hasSavedSelected =
    !!customer && !!selectedAddressId && !editingAddress &&
    customer.addresses.some((a) => a.id === selectedAddressId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 pb-3">
          <SheetTitle className="flex items-center gap-2 text-base font-black">
            <button
              onClick={() => (step === 0 ? onOpenChange(false) : setStep((s) => (s - 1) as 0 | 1 | 2))}
              className="rounded-lg p-1 hover:bg-accent"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            Finalizar pedido
          </SheetTitle>
          <div className="mt-2 flex items-center gap-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    i < step
                      ? "bg-primary text-primary-foreground"
                      : i === step
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span
                  className={`truncate text-[11px] font-semibold ${
                    i === step ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {i < stepLabels.length - 1 && (
                  <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          {step === 0 && (
            <>
              <Field label="WhatsApp" error={errors.customerPhone}>
                <div className="relative">
                  <Input
                    inputMode="tel"
                    value={form.customerPhone}
                    onChange={(e) => set("customerPhone", e.target.value)}
                    placeholder="(11) 99999-9999"
                    maxLength={20}
                  />
                  {lookupState === "loading" && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Vamos usar seu WhatsApp para lembrar seus dados nas próximas compras.
                </p>
              </Field>

              {lookupState === "found" && customer && (
                <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <p className="text-sm font-bold">
                      Encontramos seus endereços salvos
                    </p>

                  </div>
                  {customer.addresses.length > 0 ? (
                    <>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Seus endereços
                      </p>
                      <div className="space-y-2">
                        {customer.addresses.map((a) => {
                          const active = selectedAddressId === a.id && !editingAddress;
                          return (
                            <button
                              key={a.id}
                              type="button"
                              onClick={() => {
                                setSelectedAddressId(a.id);
                                setEditingAddress(false);
                                applyAddress(a);
                              }}
                              className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition ${
                                active
                                  ? "border-primary bg-background shadow-sm ring-2 ring-primary/20"
                                  : "border-border/60 bg-background hover:border-primary/40"
                              }`}
                            >
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                              <div className="min-w-0 flex-1">
                                {a.label && (
                                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                                    {a.label}
                                  </p>
                                )}
                                <p className="truncate text-sm font-semibold">
                                  {a.address}
                                  {a.number ? `, ${a.number}` : ""}
                                </p>
                                {a.neighborhood && (
                                  <p className="truncate text-xs text-muted-foreground">
                                    {a.neighborhood}
                                    {a.complement ? ` · ${a.complement}` : ""}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Ainda não temos endereços salvos. Vamos cadastrar agora.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAddressId(null);
                      setEditingAddress(true);
                      setForm((prev) => ({
                        ...prev,
                        deliveryAddress: "",
                        deliveryNumber: "",
                        deliveryNeighborhood: "",
                        deliveryComplement: "",
                        deliveryReference: "",
                      }));
                    }}
                    className="w-full rounded-xl border border-dashed border-border/70 bg-background px-3 py-2 text-xs font-bold text-primary hover:bg-primary/5"
                  >
                    + Adicionar novo endereço
                  </button>
                </div>
              )}

              {lookupState === "notFound" && (
                <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    Primeira vez por aqui? Complete seu cadastro rápido abaixo — sem senha.
                  </p>
                </div>
              )}

              <Field label="Nome" error={errors.customerName}>
                <Input
                  value={form.customerName}
                  onChange={(e) => set("customerName", e.target.value)}
                  maxLength={120}
                  placeholder="Como podemos te chamar?"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              {/* Fulfillment channel — driven exclusively by
                  store.fulfillment (delivery / pickup) from
                  GET /public/stores/:slug. */}
              <div>
                <Label className="mb-2 block text-sm font-bold">Como você quer receber?</Label>
                {noChannel ? (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    Esta loja não está aceitando pedidos no momento.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!deliveryAllowed}
                      onClick={() => set("fulfillment", "DELIVERY")}
                      className={`rounded-2xl border p-3 text-left text-sm transition ${
                        form.fulfillment === "DELIVERY"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border/60 bg-card hover:border-primary/40"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <p className="font-bold">Entrega</p>
                      <p className="text-xs text-muted-foreground">
                        {deliveryAllowed ? "Entregamos no seu endereço" : "Indisponível no momento"}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={!pickupAllowed}
                      onClick={() => set("fulfillment", "PICKUP")}
                      className={`rounded-2xl border p-3 text-left text-sm transition ${
                        form.fulfillment === "PICKUP"
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border/60 bg-card hover:border-primary/40"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      <p className="font-bold">Retirada</p>
                      <p className="text-xs text-muted-foreground">
                        {pickupAllowed ? "Buscar no balcão" : "Indisponível no momento"}
                      </p>
                    </button>
                  </div>
                )}
              </div>

              {form.fulfillment === "DELIVERY" && (
                hasSavedSelected ? (
                  <div className="rounded-2xl border border-border/70 bg-card p-4">
                    <div className="flex items-start gap-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">
                          {form.deliveryAddress}
                          {form.deliveryNumber ? `, ${form.deliveryNumber}` : ""}
                        </p>
                        {form.deliveryNeighborhood && (
                          <p className="text-xs text-muted-foreground">{form.deliveryNeighborhood}</p>
                        )}
                        {form.deliveryComplement && (
                          <p className="text-xs text-muted-foreground">
                            Complemento: {form.deliveryComplement}
                          </p>
                        )}
                        {form.deliveryReference && (
                          <p className="text-xs text-muted-foreground">
                            Ref: {form.deliveryReference}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => setEditingAddress(true)}
                    >
                      Alterar endereço
                    </Button>
                  </div>
                ) : (
                  <>
                    <Field label="Endereço" error={errors.deliveryAddress}>
                      <Input
                        value={form.deliveryAddress}
                        onChange={(e) => set("deliveryAddress", e.target.value)}
                        maxLength={200}
                        placeholder="Rua / Avenida"
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Número" error={errors.deliveryNumber} className="col-span-1">
                        <Input
                          value={form.deliveryNumber}
                          onChange={(e) => set("deliveryNumber", e.target.value)}
                          maxLength={20}
                        />
                      </Field>
                      <Field label="Bairro" error={errors.deliveryNeighborhood} className="col-span-2">
                        <Input
                          value={form.deliveryNeighborhood}
                          onChange={(e) => set("deliveryNeighborhood", e.target.value)}
                          maxLength={120}
                        />
                      </Field>
                    </div>
                    <Field label="Complemento (opcional)">
                      <Input
                        value={form.deliveryComplement}
                        onChange={(e) => set("deliveryComplement", e.target.value)}
                        maxLength={120}
                        placeholder="Apto, bloco…"
                      />
                    </Field>
                    <Field label="Ponto de referência (opcional)">
                      <Input
                        value={form.deliveryReference}
                        onChange={(e) => set("deliveryReference", e.target.value)}
                        maxLength={200}
                      />
                    </Field>
                  </>
                )
              )}

              {form.fulfillment === "PICKUP" && !noChannel && (
                <div className="rounded-2xl border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
                  Você vai retirar o pedido no balcão da loja. Confirmaremos o
                  horário pelo WhatsApp.
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <Label className="mb-2 block text-sm font-bold">Forma de pagamento</Label>
                <RadioGroup
                  value={form.paymentMethod}
                  onValueChange={(v) => set("paymentMethod", v as PublicPaymentMethod)}
                  className="space-y-2"
                >
                  <PaymentOption value="PIX" label="PIX" desc="Pague pelo app do banco" />
                  <PaymentOption
                    value="CARD_ON_DELIVERY"
                    label="Cartão na entrega"
                    desc="Débito ou crédito na maquininha"
                  />
                  <PaymentOption value="CASH" label="Dinheiro" desc="Pagamento em espécie" />
                </RadioGroup>
              </div>

              {form.paymentMethod === "CASH" && (
                <Field label="Troco para quanto? (opcional)">
                  <Input
                    inputMode="decimal"
                    value={form.changeFor}
                    onChange={(e) => set("changeFor", e.target.value)}
                    placeholder="Ex.: 50,00"
                    maxLength={12}
                  />
                </Field>
              )}

              <Field label="Observação do pedido (opcional)">
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  maxLength={500}
                />
              </Field>
            </>
          )}
        </div>

        <div className="border-t border-border/60 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-black">{brl(subtotal)}</span>
          </div>
          {step < 2 ? (
            <Button
              size="lg"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow font-bold shadow-lg shadow-primary/30"
              onClick={next}
            >
              Continuar
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="lg"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow font-bold shadow-lg shadow-primary/30"
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…
                </>
              ) : (
                "Enviar pedido"
              )}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}


function Field({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PaymentOption({
  value,
  label,
  desc,
}: {
  value: PublicPaymentMethod;
  label: string;
  desc: string;
}) {
  return (
    <label
      htmlFor={`pay-${value}`}
      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-card p-3.5 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:shadow-sm"
    >
      <RadioGroupItem id={`pay-${value}`} value={value} />
      <div className="flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </label>
  );
}

function SuccessScreen({ order, storeName }: { order: PublicOrderCreated; storeName: string }) {
  const number = order.orderNumber ?? order.code ?? order.id.slice(0, 8);
  const paymentLabel: Record<string, string> = {
    PIX: "PIX",
    CARD_ON_DELIVERY: "Cartão na entrega",
    CASH: "Dinheiro",
  };
  return (
    <div className="flex flex-col">
      <div className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-glow px-6 py-10 text-center text-primary-foreground">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
        <div className="relative">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30 backdrop-blur">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h2 className="text-xl font-black">Pedido recebido!</h2>
          <p className="mt-1 text-sm opacity-90">{storeName} recebeu seu pedido.</p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-black ring-1 ring-white/20 backdrop-blur">
            Pedido <span className="font-mono">#{number}</span>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm">
          {order.paymentMethod && (
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground">Pagamento</span>
              <span className="font-bold">
                {paymentLabel[order.paymentMethod] ?? order.paymentMethod}
              </span>
            </div>
          )}
          {order.items && order.items.length > 0 && (
            <div className="mt-1 space-y-2 border-t border-border/60 pt-3">
              {order.items.map((it, i) => (
                <div key={it.id ?? i} className="text-xs">
                  <div className="flex justify-between">
                    <span className="truncate font-medium">
                      {it.quantity ?? 1}× {it.productName ?? it.name ?? "Item"}
                    </span>
                    <span className="ml-2 shrink-0 font-semibold">
                      {brl(it.totalInCents ?? (it.unitPriceInCents ?? 0) * (it.quantity ?? 1))}
                    </span>
                  </div>
                  {Array.isArray(it.options) && it.options.length > 0 && (
                    <ul className="mt-1 space-y-0.5 pl-3 text-[11px] text-muted-foreground">
                      {it.options.map((op, j) => (
                        <li key={j} className="flex justify-between gap-2">
                          <span className="truncate">
                            {op.groupName ? `${op.groupName}: ` : "+ "}
                            {op.optionName}
                          </span>
                          {typeof op.priceDeltaInCents === "number" && op.priceDeltaInCents > 0 && (
                            <span className="shrink-0">+ {brl(op.priceDeltaInCents)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {it.notes && (
                    <p className="mt-1 pl-3 text-[11px] italic text-muted-foreground">
                      obs.: {it.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {typeof order.totalInCents === "number" && (
            <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
              <span className="font-bold">Total</span>
              <span className="text-base font-black text-primary">{brl(order.totalInCents)}</span>
            </div>
          )}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Em breve entraremos em contato via WhatsApp para confirmar.
          <br />
          Na próxima compra, vamos lembrar seus dados pelo WhatsApp.
        </p>

        <Button
          className="h-12 w-full rounded-xl bg-gradient-to-r from-primary to-primary-glow font-bold shadow-lg shadow-primary/30"
          onClick={() => window.location.reload()}
        >
          Fazer outro pedido
        </Button>
      </div>
    </div>
  );
}
