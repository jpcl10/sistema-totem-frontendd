import { MoreVertical, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProductImage } from "@/components/ProductImage";
import { resolveAssetUrl } from "@/lib/auth";
import { formatCurrencyFromCents } from "@/lib/utils";
import type { CatalogProduct } from "@/lib/catalog-api";
import type { ProductCounts } from "@/lib/catalog-helpers";
import { SectorBadge, StatusDot } from "./catalog-ui";

function ProductMeta({
  categoryName,
  counts,
  product,
}: {
  categoryName: string;
  counts: ProductCounts;
  product: CatalogProduct;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
      <span className="rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-medium">
        {categoryName}
      </span>
      <span className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5">
        {counts.groups} {counts.groups === 1 ? "grupo" : "grupos"}
      </span>
      <span className="rounded-md border border-border/60 bg-muted/30 px-1.5 py-0.5">
        {counts.options} {counts.options === 1 ? "opção" : "opções"}
      </span>
      {(product.supportsHalfAndHalf || product.pricingRule === "MAX_SELECTED_FLAVOR") && (
        <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-medium text-primary">
          Meio a meio
        </span>
      )}
      {product.category?.sector && <SectorBadge sector={product.category.sector} />}
    </div>
  );
}

function ProductActions({
  active,
  onEdit,
  onToggle,
  compact,
  productName,
}: {
  active: boolean;
  onEdit: () => void;
  onToggle: () => void;
  compact?: boolean;
  productName: string;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <Button
        variant="outline"
        size="sm"
        className={compact ? "h-8 text-xs" : "h-7 flex-1 text-[11px]"}
        onClick={onEdit}
        aria-label={`Editar ${productName}`}
      >
        <Pencil className={compact ? "h-3.5 w-3.5" : "mr-1 h-3 w-3"} />
        {!compact && "Editar"}
        {compact && <span className="hidden sm:inline">Editar</span>}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label={`Mais ações em ${productName}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onToggle}>
            <Power className="mr-2 h-4 w-4" />
            {active ? "Desativar" : "Ativar"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ProductCard({
  product,
  categoryName,
  active,
  counts,
  onEdit,
  onToggle,
}: {
  product: CatalogProduct;
  categoryName: string;
  active: boolean;
  counts: ProductCounts;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const img = resolveAssetUrl(product.imageUrl);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border/70 bg-card transition-all hover:border-border hover:shadow-[var(--shadow-soft)]">
      <div className="relative aspect-[5/3] overflow-hidden bg-muted/40">
        <ProductImage src={img} alt={product.name} size="lg" rounded="rounded-none" hoverZoom />
        <div className="absolute left-2 top-2">
          <StatusDot active={active} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-semibold text-foreground" title={product.name}>
            {product.name}
          </h4>
          <p className="text-sm font-bold text-primary">
            {formatCurrencyFromCents(product.priceInCents)}
          </p>
        </div>
        <ProductMeta categoryName={categoryName} counts={counts} product={product} />
        <div className="mt-1">
          <ProductActions
            active={active}
            onEdit={onEdit}
            onToggle={onToggle}
            productName={product.name}
            compact
          />
        </div>
      </div>
    </div>
  );
}

export function ProductRow({
  product,
  categoryName,
  active,
  counts,
  onEdit,
  onToggle,
}: {
  product: CatalogProduct;
  categoryName: string;
  active: boolean;
  counts: ProductCounts;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const img = resolveAssetUrl(product.imageUrl);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3">
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted/40">
        <ProductImage src={img} alt={product.name} size="sm" rounded="rounded-none" />
      </div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="truncate text-sm font-semibold text-foreground" title={product.name}>
            {product.name}
          </h4>
          <StatusDot active={active} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-primary">
            {formatCurrencyFromCents(product.priceInCents)}
          </span>
          <ProductMeta categoryName={categoryName} counts={counts} product={product} />
        </div>
      </div>
      <ProductActions
        active={active}
        onEdit={onEdit}
        onToggle={onToggle}
        productName={product.name}
        compact
      />
    </div>
  );
}
