import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Minus,
  Pencil,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { ProductImage } from "@/components/ProductImage";
import { cn } from "@/lib/utils";
import {
  getOnlineStoreDetail,
  type OnlineCategory,
  type OnlineProduct,
} from "@/lib/online-store-api";
import { listCatalogProductOptionGroups } from "@/lib/catalog-api";
import type { ManualSalePaymentMethod } from "@/lib/orders-api";
import { StoreOrderStrategy } from "@/lib/order-strategies";
import { handleApiError } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import { qk } from "@/lib/query-keys";
import {
  ProductCustomizeDialog,
  type CustomizeOptionGroup,
  type CustomizeProduct,
  type SelectedOptionMap,
} from "@/components/admin/orders/product-customize-dialog";
import { CustomerPhoneSearch } from "@/components/admin/orders/customer-phone-search";
import {
  CustomerAddressPicker,
  type PickedDelivery,
} from "@/components/admin/orders/customer-address-picker";


type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  storeName?: string;
  token: string;
  onCreated?: () => void;
};

/**
 * A cart line captures everything needed by the manual-sale contract:
 * selectedOptions in `{ optionGroupId, optionIds }` shape (backend
 * source of truth) plus a display estimate that never leaves the UI.
 */
type CartLine = {
  lineId: string;
  product: OnlineProduct & { optionGroups?: CustomizeOptionGroup[] };
  quantity: number;
  selectedOptions: Array<{ optionGroupId: string; optionIds: string[] }>;
  selectedMap: SelectedOptionMap;
  notes: string;
  addonsCents: number; // display estimate
};

type Step = "cart" | "charge";

const PAYMENT_METHODS: {
  key: ManualSalePaymentMethod;
  label: string;
  icon: typeof Banknote;
}[] = [
  { key: "CASH", label: "Dinheiro", icon: Banknote },
  { key: "PIX_MANUAL", label: "PIX", icon: QrCode },
  { key: "CREDIT_CARD", label: "Crédito (entrega)", icon: CreditCard },
  { key: "DEBIT_CARD", label: "Débito (entrega)", icon: CreditCard },
];

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function newLineId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function optionNameFor(
  product: { optionGroups?: CustomizeOptionGroup[] },
  groupId: string,
  optionId: string,
): string | undefined {
  const g = (product.optionGroups ?? []).find((gg) => gg.id === groupId);
  return g?.options?.find((o) => o.id === optionId)?.name;
}

/**
 * Shopify POS-style manual sale for an online store (channel=ADMIN).
 * Steps: build cart → charge. Handles required product customization,
 * customer phone lookup, cash quick chips + change, and Query cache
 * invalidation on success.
 *
 * Designed to be reusable — future PDV / Totem / Caixa surfaces can
 * mount the same drawer by swapping the OrderCreationStrategy.
 */
export function StoreManualSaleDrawer({
  open,
  onOpenChange,
  storeId,
  storeName,
  token,
  onCreated,
}: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const orgId = user?.organizationId;

  const [products, setProducts] = useState<
    (OnlineProduct & { optionGroups?: CustomizeOptionGroup[] })[]
  >([]);
  const [categories, setCategories] = useState<OnlineCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [step, setStep] = useState<Step>("cart");
  const [customer, setCustomer] = useState({ id: null as string | null, name: "", phone: "" });
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] =
    useState<ManualSalePaymentMethod>("CASH");
  const [cashReceived, setCashReceived] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [fulfillment, setFulfillment] = useState<"PICKUP" | "DELIVERY">("PICKUP");
  const [addressSelection, setAddressSelection] = useState<
    | { mode: "saved"; addressId: string; delivery: PickedDelivery }
    | { mode: "new"; delivery: PickedDelivery }
    | { mode: "none" }
  >({ mode: "none" });


  // Customization dialog state
  const [customizing, setCustomizing] = useState<{
    product: CartLine["product"];
    editingLineId?: string;
    initial?: {
      quantity?: number;
      selected?: SelectedOptionMap;
      notes?: string;
    };
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const focusSearch = () => {
    // schedule after render so focus lands after state updates
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  // Reset all state on open
  useEffect(() => {
    if (!open) return;
    setCart([]);
    setCustomer({ id: null, name: "", phone: "" });
    setNotes("");
    setPaymentMethod("CASH");
    setCashReceived("");
    setSearch("");
    setCategoryId("ALL");
    setStep("cart");
    setCustomizing(null);
    setFulfillment("PICKUP");
    setAddressSelection({ mode: "none" });
  }, [open]);

  // Unlink address when the customer changes.
  useEffect(() => {
    setAddressSelection({ mode: "none" });
  }, [customer.id]);

  useEffect(() => {
    if (!open || !storeId || !token) return;
    setLoading(true);
    getOnlineStoreDetail(token, storeId)
      .then((d) => {
        const nested = (d.categories ?? []).flatMap((c) => {
          const rec = c as unknown as { products?: OnlineProduct[] };
          return Array.isArray(rec.products)
            ? rec.products.map((p) => ({ ...p, categoryId: p.categoryId ?? c.id }))
            : [];
        });
        const merged: OnlineProduct[] = [...(d.products ?? []), ...nested];
        const seen = new Set<string>();
        const unique = merged.filter((p) => {
          if (!p?.id || seen.has(p.id)) return false;
          seen.add(p.id);
          return p.active !== false;
        });
        setProducts(unique as (OnlineProduct & { optionGroups?: CustomizeOptionGroup[] })[]);
        setCategories((d.categories ?? []).filter((c) => c.active !== false));
      })
      .catch((e) =>
        handleApiError(e, "Não foi possível carregar o catálogo da loja."),
      )
      .finally(() => setLoading(false));
  }, [open, storeId, token]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== "ALL" && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return (p.name ?? "").toLowerCase().includes(q);
    });
  }, [products, search, categoryId]);

  /* --------------------------- Cart operations --------------------------- */

  const addSimple = (p: (typeof products)[number]) => {
    setCart((prev) => {
      // Match plain lines (no options) to bump quantity.
      const idx = prev.findIndex(
        (l) => l.product.id === p.id && l.selectedOptions.length === 0,
      );
      if (idx !== -1) {
        const next = prev.slice();
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          lineId: newLineId(),
          product: p,
          quantity: 1,
          selectedOptions: [],
          selectedMap: {},
          notes: "",
          addonsCents: 0,
        },
      ];
    });
    focusSearch();
  };

  /**
   * Fetch option groups on demand. Online-store detail endpoint does not
   * embed option groups, so we hydrate from the catalog before deciding
   * whether the product needs customization. Prevents 400s where the
   * backend requires an option group that the UI never rendered.
   */
  const groupsCache = useRef<Map<string, CustomizeOptionGroup[]>>(new Map());

  const resolveOptionGroups = async (
    p: (typeof products)[number],
  ): Promise<CustomizeOptionGroup[]> => {
    if (Array.isArray(p.optionGroups)) return p.optionGroups;
    const catalogId = (p as { catalogProductId?: string }).catalogProductId ?? p.id;
    const cached = groupsCache.current.get(catalogId);
    if (cached) {
      p.optionGroups = cached;
      return cached;
    }
    try {
      const groups = (await listCatalogProductOptionGroups(token, catalogId)) as CustomizeOptionGroup[];
      groupsCache.current.set(catalogId, groups);
      p.optionGroups = groups;
      // Reflect on state so the UI badge/edit affordance updates.
      setProducts((prev) =>
        prev.map((it) => (it.id === p.id ? { ...it, optionGroups: groups } : it)),
      );
      return groups;
    } catch {
      groupsCache.current.set(catalogId, []);
      return [];
    }
  };

  const handleProductClick = async (p: (typeof products)[number]) => {
    const groups = await resolveOptionGroups(p);
    const needs =
      groups.some((g) => g.required === true || (g.minSelections ?? 0) > 0) ||
      groups.length > 0; // if there are any groups, offer the dialog
    if (needs) {
      setCustomizing({ product: { ...p, optionGroups: groups } });
      return;
    }
    addSimple(p);
  };

  const editLine = (line: CartLine) => {
    setCustomizing({
      product: line.product,
      editingLineId: line.lineId,
      initial: {
        quantity: line.quantity,
        selected: line.selectedMap,
        notes: line.notes,
      },
    });
  };

  const handleCustomizeConfirm = (result: {
    quantity: number;
    selectedOptions: Array<{ optionGroupId: string; optionIds: string[] }>;
    notes: string;
    addonsCents: number;
  }) => {
    if (!customizing) return;
    const { product, editingLineId } = customizing;
    const selectedMap: SelectedOptionMap = {};
    for (const g of result.selectedOptions) selectedMap[g.optionGroupId] = g.optionIds;

    setCart((prev) => {
      if (editingLineId) {
        return prev.map((l) =>
          l.lineId === editingLineId
            ? {
                ...l,
                quantity: result.quantity,
                selectedOptions: result.selectedOptions,
                selectedMap,
                notes: result.notes,
                addonsCents: result.addonsCents,
              }
            : l,
        );
      }
      return [
        ...prev,
        {
          lineId: newLineId(),
          product,
          quantity: result.quantity,
          selectedOptions: result.selectedOptions,
          selectedMap,
          notes: result.notes,
          addonsCents: result.addonsCents,
        },
      ];
    });
    setCustomizing(null);
    focusSearch();
  };

  const changeQty = (lineId: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  const removeLine = (lineId: string) =>
    setCart((prev) => prev.filter((l) => l.lineId !== lineId));

  const totalItems = cart.reduce((sum, l) => sum + l.quantity, 0);
  const estimateCents = cart.reduce(
    (sum, l) => sum + ((l.product.priceInCents ?? 0) + l.addonsCents) * l.quantity,
    0,
  );

  /* --------------------------- Charge helpers --------------------------- */

  const cashReceivedCents = Math.round(
    (parseFloat(cashReceived.replace(",", ".")) || 0) * 100,
  );
  const changeCents =
    paymentMethod === "CASH" && cashReceivedCents > estimateCents
      ? cashReceivedCents - estimateCents
      : 0;

  const addCash = (deltaCents: number) => {
    const base = cashReceivedCents > 0 ? cashReceivedCents : estimateCents;
    const next = base + deltaCents;
    setCashReceived((next / 100).toFixed(2).replace(".", ","));
  };
  const setCashExact = () => {
    setCashReceived((estimateCents / 100).toFixed(2).replace(".", ","));
  };

  /* --------------------------- Submit --------------------------- */

  const handleSubmit = async () => {
    if (!cart.length) {
      toast.error("Adicione ao menos um produto.");
      return;
    }
    if (fulfillment === "DELIVERY" && addressSelection.mode === "none") {
      toast.error("Selecione um endereço de entrega ou cadastre um novo.");
      return;
    }
    setSubmitting(true);
    try {
      const strategy = StoreOrderStrategy(storeId, storeName);
      // Never send both a fresh delivery block AND customerAddressId — see
      // online-store-api → createStoreManualSale.
      const savedAddressId =
        addressSelection.mode === "saved" ? addressSelection.addressId : undefined;
      const deliveryPayload =
        fulfillment === "DELIVERY" && addressSelection.mode !== "none" && !savedAddressId
          ? addressSelection.delivery
          : undefined;
      await strategy.createOrder(token, {
        items: cart.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          notes: l.notes || undefined,
          selectedOptions: l.selectedOptions.flatMap((g) =>
            g.optionIds.map((optionId) => ({
              optionId,
              groupId: g.optionGroupId,
            })),
          ),
        })),
        customerId: customer.id ?? undefined,
        customerName: customer.name.trim() || undefined,
        customerPhone: customer.phone.trim() || undefined,
        customerAddressId: savedAddressId,
        delivery: deliveryPayload,
        paymentMethod,
        cashReceived:
          paymentMethod === "CASH" && cashReceivedCents > 0
            ? cashReceivedCents
            : undefined,
        notes: notes.trim() || undefined,
        fulfillmentType: fulfillment,
      });

      toast.success("Pedido criado com sucesso.", {
        description: "O pedido aparecerá na central em instantes.",
      });
      // Invalidate unified orders — realtime socket will refresh anyway,
      // this is the polling-safe fallback.
      if (orgId) {
        void queryClient.invalidateQueries({ queryKey: qk.orders.all(orgId) });
      }
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      handleApiError(e, "Não foi possível criar o pedido.");
    } finally {
      setSubmitting(false);
    }
  };

  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? "";

  const quickCashChips = [1000, 2000, 5000];

  /* --------------------------- Render --------------------------- */

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-none md:w-[880px] md:max-w-[92vw]"
        >
          <SheetHeader className="shrink-0 border-b border-border bg-background px-5 py-3">
            <div className="flex items-center gap-2">
              {step === "charge" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setStep("cart")}
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <div className="min-w-0 flex-1">
                <SheetTitle className="flex items-center gap-2 text-base">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <span className="truncate">
                    {step === "cart"
                      ? `Novo pedido · ${storeName ?? "Loja"}`
                      : "Cobrar pedido"}
                  </span>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  {step === "cart"
                    ? "Toque para adicionar. Total confirmado pelo servidor."
                    : "Confirme forma de pagamento e finalize."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {step === "cart" ? (
            <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_360px]">
              {/* Catalog */}
              <div className="flex min-h-0 flex-col border-r border-border">
                <div className="shrink-0 space-y-3 border-b border-border p-3">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const first = filtered[0];
                      if (!first) return;
                      // Route through the same resolver so required option
                      // groups are always fetched before add-to-cart.
                      void handleProductClick(first).then(() => setSearch(""));
                    }}
                  >
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        ref={searchInputRef}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar produto… (Enter para adicionar)"
                        className="h-10 pl-9"
                        autoFocus
                      />
                    </div>
                  </form>
                  {categories.length > 0 && (
                    <ScrollArea className="w-full">
                      <div className="flex gap-1.5 pb-1">
                        <CategoryPill
                          active={categoryId === "ALL"}
                          onClick={() => setCategoryId("ALL")}
                        >
                          Todos
                        </CategoryPill>
                        {categories.map((c) => (
                          <CategoryPill
                            key={c.id}
                            active={categoryId === c.id}
                            onClick={() => setCategoryId(c.id)}
                          >
                            {c.name}
                          </CategoryPill>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
                <ScrollArea className="flex-1">
                  <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3">
                    {loading && (
                      <div className="col-span-full flex items-center justify-center py-16 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Carregando…
                      </div>
                    )}
                    {!loading && filtered.length === 0 && (
                      <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                        Nenhum produto encontrado.
                      </div>
                    )}
                    {!loading &&
                      filtered.map((p) => {
                        const qtyInCart = cart
                          .filter((l) => l.product.id === p.id)
                          .reduce((s, l) => s + l.quantity, 0);
                        const hasOptions = (p.optionGroups ?? []).length > 0;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleProductClick(p)}
                            className={cn(
                              "group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition",
                              qtyInCart > 0
                                ? "border-primary ring-2 ring-primary/20"
                                : "border-border hover:border-primary/40 hover:shadow-md",
                            )}
                          >
                            <ProductImage
                              src={p.imageUrl}
                              alt={p.name}
                              size="md"
                              rounded="rounded-none"
                              hoverZoom
                            />
                            {qtyInCart > 0 && (
                              <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground shadow">
                                {qtyInCart}
                              </span>
                            )}
                            {hasOptions && (
                              <span className="absolute left-2 top-2 rounded-full bg-background/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
                                Personalizar
                              </span>
                            )}
                            <div className="flex flex-1 flex-col gap-0.5 p-2.5">
                              <div className="line-clamp-2 text-sm font-medium leading-tight">
                                {p.name}
                              </div>
                              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {categoryName(p.categoryId ?? "")}
                              </div>
                              <div className="mt-auto text-sm font-semibold text-primary">
                                {brl(p.priceInCents ?? 0)}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </ScrollArea>
              </div>

              {/* Cart */}
              <div className="flex min-h-0 flex-col bg-muted/30">
                <div className="shrink-0 border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Carrinho · {totalItems}{" "}
                      {totalItems === 1 ? "item" : "itens"}
                    </div>
                    {cart.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setCart([])}
                      >
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-1.5 p-3">
                    {cart.length === 0 ? (
                      <div className="mt-8 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
                        <ShoppingBag className="h-8 w-8 text-muted-foreground/50" />
                        <div className="text-sm font-medium text-muted-foreground">
                          Carrinho vazio
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Toque em um produto para adicionar.
                        </div>
                      </div>
                    ) : (
                      cart.map((l) => (
                        <CartLineRow
                          key={l.lineId}
                          line={l}
                          onIncrement={() => changeQty(l.lineId, 1)}
                          onDecrement={() => changeQty(l.lineId, -1)}
                          onRemove={() => removeLine(l.lineId)}
                          onEdit={() => editLine(l)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>

                {/* Primary CTA */}
                <div className="shrink-0 border-t border-border bg-background p-3">
                  <Button
                    className="h-14 w-full text-base font-bold shadow-sm"
                    size="lg"
                    disabled={cart.length === 0}
                    onClick={() => setStep("charge")}
                  >
                    <span className="mr-2">Cobrar</span>
                    <span className="tabular-nums">{brl(estimateCents)}</span>
                  </Button>
                  <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
                    Total confirmado pelo servidor.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* --------------------------- Charge step --------------------------- */
            <ScrollArea className="min-h-0 flex-1">
              <div className="mx-auto flex max-w-xl flex-col gap-5 p-5">
                <div className="rounded-2xl border border-border bg-card p-5 text-center">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Total a cobrar
                  </div>
                  <div className="mt-1 text-4xl font-black tabular-nums">
                    {brl(estimateCents)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {totalItems} {totalItems === 1 ? "item" : "itens"}
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cliente
                  </div>
                  <CustomerPhoneSearch
                    token={token}
                    value={customer}
                    onChange={setCustomer}
                  />
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Entrega
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["PICKUP", "DELIVERY"] as const).map((f) => {
                      const active = fulfillment === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFulfillment(f)}
                          className={cn(
                            "rounded-xl border px-3 py-2 text-sm font-medium transition",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card hover:border-primary/40",
                          )}
                        >
                          {f === "PICKUP" ? "Retirada" : "Entrega"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {fulfillment === "DELIVERY" && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Endereço de entrega
                    </div>
                    {customer.id ? (
                      <CustomerAddressPicker
                        token={token}
                        customerId={customer.id}
                        selectedAddressId={
                          addressSelection.mode === "saved"
                            ? addressSelection.addressId
                            : null
                        }
                        onChange={setAddressSelection}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
                        Vincule um cliente para escolher ou cadastrar um endereço.
                      </div>
                    )}
                  </div>
                )}



                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Forma de pagamento
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((m) => {
                      const Icon = m.icon;
                      const active = paymentMethod === m.key;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setPaymentMethod(m.key)}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm font-medium transition",
                            active
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-card hover:border-primary/40",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 truncate">{m.label}</span>
                          {active && <CheckCircle2 className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {paymentMethod === "CASH" && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Valor recebido
                    </div>
                    <Input
                      inputMode="decimal"
                      placeholder="0,00"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      className="h-12 text-lg font-semibold tabular-nums"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <QuickChip onClick={setCashExact}>Valor exato</QuickChip>
                      {quickCashChips.map((v) => (
                        <QuickChip key={v} onClick={() => addCash(v)}>
                          +{brl(v)}
                        </QuickChip>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                      <span className="text-muted-foreground">Troco</span>
                      <span className="font-bold tabular-nums text-primary">
                        {brl(changeCents)}
                      </span>
                    </div>
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Observações do pedido
                  </div>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex.: entregar rápido, sem talheres"
                    rows={2}
                  />
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-border bg-background p-3">
                <div className="mx-auto flex max-w-xl gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep("cart")}
                    disabled={submitting}
                  >
                    <X className="mr-1 h-4 w-4" /> Voltar
                  </Button>
                  <Button
                    className="h-12 flex-[2] text-base font-bold"
                    onClick={handleSubmit}
                    disabled={submitting || cart.length === 0}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        Criando…
                      </>
                    ) : (
                      <>Finalizar · {brl(estimateCents)}</>
                    )}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </SheetContent>
      </Sheet>

      <ProductCustomizeDialog
        open={!!customizing}
        onOpenChange={(v) => !v && setCustomizing(null)}
        product={
          customizing
            ? {
                id: customizing.product.id,
                name: customizing.product.name,
                imageUrl: customizing.product.imageUrl,
                priceInCents: customizing.product.priceInCents ?? 0,
                optionGroups: customizing.product.optionGroups,
              } as CustomizeProduct
            : null
        }
        initial={customizing?.initial}
        onConfirm={handleCustomizeConfirm}
      />
    </>
  );
}

/* --------------------------- Subcomponents --------------------------- */

function CategoryPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function QuickChip({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:text-primary"
    >
      {children}
    </button>
  );
}

function CartLineRow({
  line,
  onIncrement,
  onDecrement,
  onRemove,
  onEdit,
}: {
  line: CartLine;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
  onEdit: () => void;
}) {
  const unitCents = (line.product.priceInCents ?? 0) + line.addonsCents;
  const optionLines = line.selectedOptions.flatMap((g) =>
    g.optionIds
      .map((id) => optionNameFor(line.product, g.optionGroupId, id))
      .filter((n): n is string => !!n),
  );
  const canEdit = (line.product.optionGroups ?? []).length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-2">
      <div className="flex items-start gap-2">
        <ProductImage
          src={line.product.imageUrl}
          alt={line.product.name}
          size="xs"
          rounded="rounded-md"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {line.quantity}× {line.product.name}
              </div>
              {optionLines.length > 0 && (
                <ul className="mt-0.5 space-y-0.5 text-[11px] leading-tight text-muted-foreground">
                  {optionLines.map((n, i) => (
                    <li key={`${line.lineId}-opt-${i}`}>· {n}</li>
                  ))}
                </ul>
              )}
              {line.notes && (
                <div className="mt-0.5 text-[11px] italic text-muted-foreground">
                  “{line.notes}”
                </div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-semibold tabular-nums">
                {(unitCents * line.quantity / 100).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
              {line.addonsCents > 0 && (
                <div className="text-[10px] text-muted-foreground tabular-nums">
                  base {(line.product.priceInCents ?? 0) / 100}·+
                  {(line.addonsCents / 100).toFixed(2).replace(".", ",")}
                </div>
              )}
            </div>
          </div>
          <div className="mt-1.5 flex items-center gap-0.5">
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={onDecrement}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="w-6 text-center text-sm font-semibold tabular-nums">
              {line.quantity}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-7 w-7"
              onClick={onIncrement}
            >
              <Plus className="h-3 w-3" />
            </Button>
            {canEdit && (
              <Button
                size="icon"
                variant="ghost"
                className="ml-1 h-7 w-7 text-muted-foreground hover:text-primary"
                onClick={onEdit}
                aria-label="Editar item"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label="Remover"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
