import { Search, Clock, Sparkles, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CatalogSettings } from "@/lib/catalog-settings-api";

interface Props {
  settings: CatalogSettings;
}

const MOCK_CATEGORIES = [
  { name: "Pizzas", count: 8 },
  { name: "Bebidas", count: 12 },
  { name: "Sobremesas", count: 5 },
  { name: "Combos", count: 4, isCombo: true },
];

const MOCK_PRODUCTS = [
  {
    id: "1",
    name: "Pizza Margherita",
    description: "Molho de tomate, muçarela de búfala, manjericão fresco.",
    priceInCents: 4990,
    imageUrl:
      "https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400",
    tag: "Recomendado" as const,
    available: true,
    prepTime: "25-35 min",
  },
  {
    id: "2",
    name: "Pizza Pepperoni",
    description: "Molho artesanal, pepperoni curado e muçarela.",
    priceInCents: 5490,
    imageUrl:
      "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=400",
    tag: "Promoção" as const,
    available: true,
    prepTime: "25-35 min",
  },
  {
    id: "3",
    name: "Coca-Cola 2L",
    description: "Refrigerante gelado, garrafa 2 litros.",
    priceInCents: 1290,
    imageUrl:
      "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400",
    tag: "Novo" as const,
    available: false,
    prepTime: "5 min",
  },
  {
    id: "4",
    name: "Brownie de Chocolate",
    description: "Brownie quentinho com sorvete de creme.",
    priceInCents: 1890,
    imageUrl:
      "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400",
    tag: null,
    available: true,
    prepTime: "10 min",
  },
];

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function CatalogSettingsPreview({ settings }: Props) {
  const { display, category, product, layout, highlight } = settings;

  // Filter categories based on showCombos
  const categories = MOCK_CATEGORIES.filter(
    (c) => display.showCombos || !c.isCombo,
  );

  const visible = MOCK_PRODUCTS.filter(
    (p) => display.showUnavailableProducts || p.available,
  ).slice(0, Math.max(1, product.maxProductsPerSection));

  const gridCls =
    layout === "GRID"
      ? "grid grid-cols-2 gap-2"
      : layout === "COMPACT"
        ? "flex flex-col gap-1.5"
        : "flex flex-col gap-2.5";

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow-soft)]">
      {/* Device chrome */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border/60 bg-muted/40 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-2 text-[10px] text-muted-foreground">
          preview do cardápio
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Banner */}
        {highlight.bannerActive && (
          <div className="bg-gradient-to-r from-primary/25 via-primary/10 to-transparent px-4 py-3 text-xs font-medium text-primary">
            🔥 Banner promocional ativo
          </div>
        )}

        {/* Header msg */}
        {highlight.headerMessage && (
          <div className="border-b border-border/60 bg-muted/30 px-4 py-2 text-center text-[11px] text-muted-foreground">
            {highlight.headerMessage}
          </div>
        )}

        {/* Store header */}
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold">Sua Loja</p>
          <p className="text-[11px] text-muted-foreground">
            Aberto agora
            {display.showPreparationTime ? " · 30-45 min" : ""}
          </p>
        </div>

        {/* Search + Categories (sticky when enabled) */}
        <div
          className={cn(
            category.stickyCategories &&
              "sticky top-0 z-10 bg-background/95 backdrop-blur",
          )}
        >
          {category.enableSearch && (
            <div className="border-b border-border/60 px-4 py-2">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                <span className="truncate">
                  {category.searchPlaceholder || "Buscar..."}
                </span>
              </div>
            </div>
          )}

          <div
            className={cn(
              "border-b border-border/60 px-4 py-2",
              category.horizontalScroll
                ? "flex gap-2 overflow-x-auto"
                : "flex flex-col gap-1",
            )}
          >
            {categories.map((c, i) => (
              <span
                key={c.name}
                className={cn(
                  "rounded-full px-3 py-1 text-[11px]",
                  category.horizontalScroll ? "shrink-0" : "self-start",
                  i === 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {c.name}
                {category.showProductCount && (
                  <span className="ml-1 opacity-70">·{c.count}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Products */}
        <div className="p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {categories[0]?.name ?? "Produtos"}
          </p>
          <div className={gridCls}>
            {visible.map((p) => (
              <PreviewCard key={p.id} product={p} layout={layout} settings={settings} />
            ))}
          </div>
        </div>

        {/* Footer msg */}
        {highlight.footerMessage && (
          <div className="border-t border-border/60 bg-muted/30 px-4 py-2 text-center text-[11px] text-muted-foreground">
            {highlight.footerMessage}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewCard({
  product,
  layout,
  settings,
}: {
  product: (typeof MOCK_PRODUCTS)[number];
  layout: CatalogSettings["layout"];
  settings: CatalogSettings;
}) {
  const { display, product: prod } = settings;
  const imgUrl = display.showProductImages
    ? product.imageUrl || prod.defaultProductImageUrl
    : null;
  const unavailable = !product.available;

  const tagBadge =
    display.showAddons &&
    product.tag &&
    ((product.tag === "Recomendado" && prod.highlightRecommended) ||
      (product.tag === "Novo" && prod.highlightNew) ||
      (product.tag === "Promoção" && prod.highlightPromos)) ? (
      <span
        className={cn(
          "rounded px-1 text-[9px] font-semibold",
          product.tag === "Promoção"
            ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
            : product.tag === "Novo"
              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
              : "bg-primary/15 text-primary",
        )}
      >
        {product.tag}
      </span>
    ) : null;

  const unavailableBadge =
    unavailable && prod.showUnavailableBadge ? (
      <span className="rounded bg-destructive/15 px-1 text-[9px] font-semibold text-destructive">
        Indisponível
      </span>
    ) : null;

  const Img = ({ className }: { className: string }) =>
    imgUrl ? (
      <img
        src={imgUrl}
        alt=""
        loading={prod.lazyLoadImages ? "lazy" : "eager"}
        className={cn(className, unavailable && "opacity-40 grayscale")}
      />
    ) : display.showProductImages ? (
      <div
        className={cn(
          className,
          "flex items-center justify-center bg-muted text-muted-foreground",
        )}
      >
        <ImageOff className="h-4 w-4" />
      </div>
    ) : null;

  if (layout === "COMPACT") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-card px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-xs font-medium">{product.name}</p>
          {tagBadge}
          {unavailableBadge}
        </div>
        {display.showPrices && (
          <span className="shrink-0 text-xs font-semibold">
            {formatBRL(product.priceInCents)}
          </span>
        )}
      </div>
    );
  }

  if (layout === "LIST") {
    return (
      <div className="flex gap-3 rounded-md border border-border/60 bg-card p-2">
        <Img className="h-16 w-16 shrink-0 rounded-md object-cover" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-medium">{product.name}</p>
            {tagBadge}
          </div>
          {display.showProductDescription && (
            <p className="line-clamp-2 text-[10px] text-muted-foreground">
              {product.description}
            </p>
          )}
          <div className="mt-1 flex items-center justify-between gap-2">
            {display.showPrices ? (
              <p className="text-xs font-semibold text-primary">
                {formatBRL(product.priceInCents)}
              </p>
            ) : (
              <span />
            )}
            {display.showPreparationTime && (
              <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {product.prepTime}
              </span>
            )}
          </div>
          {unavailableBadge}
        </div>
      </div>
    );
  }

  // GRID
  return (
    <div className="relative overflow-hidden rounded-md border border-border/60 bg-card">
      <Img className="h-20 w-full object-cover" />
      {unavailable && prod.showUnavailableBadge && (
        <div className="absolute inset-x-0 top-0 flex items-center justify-center bg-background/70 py-0.5 text-[9px] font-semibold text-destructive backdrop-blur">
          Indisponível
        </div>
      )}
      <div className="p-2">
        <div className="flex items-start justify-between gap-1">
          <p className="min-w-0 flex-1 truncate text-xs font-medium">
            {product.name}
          </p>
          {tagBadge}
        </div>
        {display.showProductDescription && (
          <p className="line-clamp-1 text-[10px] text-muted-foreground">
            {product.description}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between">
          {display.showPrices ? (
            <span className="text-xs font-semibold text-primary">
              {formatBRL(product.priceInCents)}
            </span>
          ) : (
            <span />
          )}
          {display.showPreparationTime && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <Sparkles className="h-2.5 w-2.5" />
              {product.prepTime}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
