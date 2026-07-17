import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Banknote,
  CreditCard,
  Gift,
  Loader2,
  Minus,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProductImage } from "@/components/ProductImage";
import { cn } from "@/lib/utils";
import {
  listEventCatalogProducts,
  listCatalogCategories,
  type EventCatalogProduct,
  type CatalogCategory,
} from "@/lib/catalog-api";
import { createManualSale, type ManualSalePaymentMethod } from "@/lib/orders-api";
import { handleApiError } from "@/lib/api-error";

type ProductItem = {
  id: string;
  name: string;
  imageUrl?: string;
  priceInCents: number;
  categoryId?: string;
  soldOut?: boolean;
  active: boolean;
};

type CategoryItem = { id: string; name: string };

function normalizeProduct(ep: EventCatalogProduct): ProductItem {
  const cp = ep.catalogProduct ?? ep.product;
  const cat = cp?.catalogCategory ?? cp?.category;
  return {
    id: ep.id,
    name: cp?.name ?? ep.name ?? "Sem nome",
    imageUrl: cp?.imageUrl ?? ep.imageUrl,
    priceInCents: ep.priceInCents ?? 0,
    categoryId: cat?.id ?? cp?.catalogCategoryId ?? cp?.categoryId,
    soldOut: ep.soldOut === true,
    active: ep.active !== false && (ep.status ?? "ACTIVE").toUpperCase() !== "INACTIVE",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  token: string;
  onCreated?: () => void;
};

type CartLine = { product: ProductItem; quantity: number };

const PAYMENT_METHODS: {
  key: ManualSalePaymentMethod;
  label: string;
  icon: typeof Banknote;
  hint?: string;
}[] = [
  { key: "CASH", label: "Dinheiro", icon: Banknote },
  { key: "CREDIT_CARD", label: "Crédito", icon: CreditCard },
  { key: "DEBIT_CARD", label: "Débito", icon: CreditCard },
  { key: "PIX_MANUAL", label: "PIX Manual", icon: QrCode, hint: "Pedido fica pendente até confirmação" },
  { key: "COURTESY", label: "Cortesia", icon: Gift },
  { key: "NFC_BALANCE", label: "NFC / Cashless", icon: Wallet },
  { key: "OTHER", label: "Outro", icon: MoreHorizontal },
];

function priceCents(p: ProductItem): number {
  return p.priceInCents ?? 0;
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ManualSaleDrawer({ open, onOpenChange, eventId, token, onCreated }: Props) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string>("ALL");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<ManualSalePaymentMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCart([]);
    setCustomerName("");
    setPaymentMethod(null);
    setSearch("");
    setCategoryId("ALL");
  }, [open]);

  useEffect(() => {
    if (!open || !eventId || !token) return;
    setLoadingCatalog(true);
    Promise.all([listEventCatalogProducts(token, eventId), listCatalogCategories(token)])
      .then(([eps, cats]) => {
        const normalized = eps.map(normalizeProduct).filter((p) => p.active && !p.soldOut);
        setProducts(normalized);
        setCategories(cats.map((c: CatalogCategory) => ({ id: c.id, name: c.name })));
      })
      .catch((e) => toast.error(handleApiError(e, "Falha ao carregar catálogo do evento.")))
      .finally(() => setLoadingCatalog(false));
  }, [open, eventId, token]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId !== "ALL" && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return (p.name ?? "").toLowerCase().includes(q);
    });
  }, [products, search, categoryId]);

  const addToCart = (p: ProductItem) => {
    setCart((prev) => {
      const idx = prev.findIndex((l) => l.product.id === p.id);
      if (idx === -1) return [...prev, { product: p, quantity: 1 }];
      const next = prev.slice();
      next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
      return next;
    });
  };

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  };

  const removeLine = (id: string) => setCart((prev) => prev.filter((l) => l.product.id !== id));

  const totalItems = cart.reduce((sum, l) => sum + l.quantity, 0);
  const totalCents = cart.reduce((sum, l) => sum + priceCents(l.product) * l.quantity, 0);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "";

  const handleSubmit = async () => {
    if (cart.length === 0) {
      toast.error("Adicione ao menos um produto.");
      return;
    }
    if (!paymentMethod) {
      toast.error("Selecione uma forma de pagamento.");
      return;
    }
    const paymentStatus = paymentMethod === "PIX_MANUAL" ? "PENDING" : "PAID";
    setSubmitting(true);
    try {
      const order = await createManualSale(token, eventId, {
        customerName: customerName.trim() || undefined,
        paymentMethod,
        paymentStatus,
        items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
      });
      const label =
        (order.number ?? order.orderNumber ?? order.code) !== undefined
          ? `#${order.number ?? order.orderNumber ?? order.code}`
          : `#${order.id.slice(-6).toUpperCase()}`;
      const methodLabel = PAYMENT_METHODS.find((m) => m.key === paymentMethod)?.label ?? paymentMethod;
      toast.success(
        paymentStatus === "PAID"
          ? `Venda ${label} paga e enviada para produção.`
          : `Venda ${label} criada — aguardando pagamento.`,
        { description: `${methodLabel} • ${brl(totalCents)}` },
      );
      onOpenChange(false);
      onCreated?.();
    } catch (e) {
      toast.error(handleApiError(e, "Não foi possível criar a venda."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-none md:w-[820px] md:max-w-[90vw]"
      >
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <SheetTitle className="flex items-center gap-2 text-lg">
                <ShoppingCart className="h-5 w-5" /> Nova venda
              </SheetTitle>
              <SheetDescription>Lançamento manual de pedido (balcão / operador).</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1fr_340px]">
          {/* LEFT — catalog */}
          <div className="flex min-h-0 flex-col border-r border-border">
            <div className="space-y-3 border-b border-border p-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar produto..."
                  className="h-10 pl-9"
                />
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCategoryId("ALL")}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition",
                      categoryId === "ALL"
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Todos
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategoryId(c.id)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        categoryId === c.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                {loadingCatalog && (
                  <div className="col-span-full flex items-center justify-center py-12 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando produtos...
                  </div>
                )}
                {!loadingCatalog && filteredProducts.length === 0 && (
                  <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                    Nenhum produto encontrado.
                  </div>
                )}
                {!loadingCatalog &&
                  filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => addToCart(p)}
                      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left transition hover:border-primary/40 hover:shadow-md"
                    >
                      <ProductImage src={p.imageUrl} alt={p.name} size="md" rounded="rounded-none" hoverZoom />
                      <div className="flex flex-1 flex-col gap-1 p-2.5">
                        <div className="line-clamp-2 text-sm font-medium leading-tight">{p.name}</div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {categoryName(p.categoryId ?? "")}
                        </div>
                        <div className="mt-auto text-sm font-semibold text-primary">
                          {brl(priceCents(p))}
                        </div>
                      </div>
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT — cart + payment */}
          <div className="flex min-h-0 flex-col bg-muted/30">
            <div className="border-b border-border px-4 py-3">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cliente (opcional)
              </label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Cliente Balcão"
                className="mt-1 h-9"
              />
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-2 p-4">
                {cart.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    Toque em um produto para adicionar.
                  </div>
                ) : (
                  cart.map((l) => (
                    <div
                      key={l.product.id}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
                    >
                      <ProductImage
                        src={l.product.imageUrl}
                        alt={l.product.name}
                        size="xs"
                        rounded="rounded-md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{l.product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {brl(priceCents(l.product))} · {brl(priceCents(l.product) * l.quantity)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => changeQty(l.product.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-semibold">{l.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => changeQty(l.product.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeLine(l.product.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="border-t border-border bg-background px-4 py-3">
              <div className="mb-3 grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = paymentMethod === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setPaymentMethod(m.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition",
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card hover:border-primary/40",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {paymentMethod === "PIX_MANUAL" && (
                <div className="mb-3 rounded-md border border-amber-400/40 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  PIX manual: o pedido ficará pendente até confirmação.
                </div>
              )}

              <div className="mb-3 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {totalItems} {totalItems === 1 ? "item" : "itens"}
                </span>
                <span className="text-lg font-bold tracking-tight">{brl(totalCents)}</span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                >
                  <X className="mr-1 h-4 w-4" /> Cancelar
                </Button>
                <Button
                  className="flex-[2]"
                  onClick={handleSubmit}
                  disabled={submitting || cart.length === 0 || !paymentMethod}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Criando...
                    </>
                  ) : (
                    <>Criar venda • {brl(totalCents)}</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
