import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingCart, XCircle } from "lucide-react";

import type {
  TotemV2Context,
  TotemV2OptionGroup,
  TotemV2PaymentPreparation,
  TotemV2Product,
} from "@/lib/totem-v2-api";

export type TotemStep =
  | "WELCOME"
  | "CATALOG"
  | "PRODUCT"
  | "CART"
  | "PAYMENT_METHOD"
  | "PIX_PAYMENT"
  | "CARD_PAYMENT"
  | "SUCCESS"
  | "ERROR";

type SelectedOptions = Record<string, string[]>;

interface CartItem {
  id: string;
  product: TotemV2Product;
  quantity: number;
  selectedOptions: SelectedOptions;
  unitPriceInCents: number;
}

export type TotemV2CartItem = CartItem;

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
}

function resolveTotemV2AssetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  return trimmed;
}

function selectedOptionPrice(product: TotemV2Product, selectedOptions: SelectedOptions) {
  let total = 0;
  for (const group of product.optionGroups ?? []) {
    const optionIds = selectedOptions[group.id] ?? [];
    for (const option of group.options) {
      if (optionIds.includes(option.id)) total += option.priceDeltaInCents ?? 0;
    }
  }
  return total;
}

function normalizeSelectedOptions(product: TotemV2Product, selectedOptions: SelectedOptions) {
  return (product.optionGroups ?? [])
    .map((group) => ({
      optionGroupId: group.id,
      optionIds: selectedOptions[group.id] ?? [],
    }))
    .filter((group) => group.optionIds.length > 0);
}

function isSelectionValid(product: TotemV2Product, selectedOptions: SelectedOptions) {
  for (const group of product.optionGroups ?? []) {
    const count = selectedOptions[group.id]?.length ?? 0;
    if (group.required && count < Math.max(1, group.minSelections ?? 1)) return false;
    if (count < (group.minSelections ?? 0)) return false;
    if (group.maxSelections > 0 && count > group.maxSelections) return false;
  }
  return true;
}

function cartTotal(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.unitPriceInCents * item.quantity, 0);
}

function cartCount(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + item.quantity, 0);
}

export function TotemV2App({ token }: { token: string }) {
  const [step, setStep] = useState<TotemStep>("WELCOME");
  const [context, setContext] = useState<TotemV2Context | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<TotemV2Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentOrder, setCurrentOrder] = useState<{ id: string; orderNumber?: number | string } | null>(null);
  const [payment, setPayment] = useState<TotemV2PaymentPreparation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const resetTimersRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    console.info("[TOTEM_V2_STEP]", step);
  }, [step]);

  const clearPaymentState = () => {
    if (resetTimersRef.current) clearTimeout(resetTimersRef.current);
    setSelectedProduct(null);
    setCurrentOrder(null);
    setPayment(null);
    setError(null);
    setBusy(false);
  };

  const resetTotemSession = () => {
    clearPaymentState();
    setCart([]);
    setStep("CATALOG");
  };

  const goToCatalog = () => {
    setSelectedProduct(null);
    setError(null);
    setStep("CATALOG");
  };

  const openProduct = (product: TotemV2Product) => {
    clearPaymentState();
    setSelectedProduct(product);
    setStep("PRODUCT");
  };

  const openCart = () => {
    clearPaymentState();
    setStep("CART");
  };

  const selectPaymentMethod = () => {
    setSelectedProduct(null);
    setPayment(null);
    setCurrentOrder(null);
    setError(null);
    setStep("PAYMENT_METHOD");
  };

  const cancelPayment = () => {
    clearPaymentState();
    setStep("CART");
  };

  useEffect(() => {
    let active = true;
    setBusy(true);
    import("@/lib/totem-v2-api")
      .then((api) => api.resolveTotemV2Context(token))
      .then((resolved) => {
        if (!active) return;
        setContext(resolved);
        setActiveCategoryId(resolved.catalog.categories[0]?.id ?? null);
        setStep(resolved.contextType === "EVENT" ? "CATALOG" : "ERROR");
        if (resolved.contextType !== "EVENT") {
          setError("Totem V2 MVP aceita apenas dispositivos vinculados a evento.");
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Nao foi possivel abrir o Totem V2.");
        setStep("ERROR");
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
      if (resetTimersRef.current) clearTimeout(resetTimersRef.current);
    };
  }, [token]);

  const addToCart = (product: TotemV2Product, quantity: number, selectedOptions: SelectedOptions) => {
    const unitPriceInCents = product.priceInCents + selectedOptionPrice(product, selectedOptions);
    const id = `${product.id}:${JSON.stringify(selectedOptions)}`;
    setCart((current) => {
      const existing = current.find((item) => item.id === id);
      if (existing) {
        return current.map((item) =>
          item.id === id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }
      return [...current, { id, product, quantity, selectedOptions, unitPriceInCents }];
    });
    setSelectedProduct(null);
    setStep("CATALOG");
  };

  const updateCartQuantity = (id: string, nextQuantity: number) => {
    setCart((current) =>
      current
        .map((item) => item.id === id ? { ...item, quantity: nextQuantity } : item)
        .filter((item) => item.quantity > 0),
    );
  };

  const startPixPayment = async () => {
    if (!context?.eventSlug || context.contextType !== "EVENT") return;
    const api = await import("@/lib/totem-v2-api");
    setSelectedProduct(null);
    setCurrentOrder(null);
    setPayment(null);
    setBusy(true);
    setError(null);
    setStep("PIX_PAYMENT");
    try {
      const order = await api.createTotemV2EventOrder({
        token,
        organizationSlug: context.organizationSlug,
        eventSlug: context.eventSlug,
        paymentMethod: "PIX",
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          selectedOptions: normalizeSelectedOptions(item.product, item.selectedOptions),
        })),
      });
      setCurrentOrder({ id: order.id, orderNumber: order.orderNumber });
      const preparation = await api.prepareTotemV2Payment(order.id, "PIX");
      setPayment(preparation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel gerar o PIX.");
      setStep("ERROR");
    } finally {
      setBusy(false);
    }
  };

  const startCardPayment = () => {
    clearPaymentState();
    setStep("CARD_PAYMENT");
  };

  const markSuccess = () => {
    setStep("SUCCESS");
    resetTimersRef.current = setTimeout(resetTotemSession, 5000);
  };

  return (
    <TotemV2StepView
      step={!context && step !== "ERROR" ? "WELCOME" : step}
      context={context}
      activeCategoryId={activeCategoryId}
      cart={cart}
      selectedProduct={selectedProduct}
      busy={busy}
      currentOrder={currentOrder}
      payment={payment}
      error={error}
      onCategoryChange={setActiveCategoryId}
      onProduct={openProduct}
      onProductBack={goToCatalog}
      onAddProduct={addToCart}
      onCart={openCart}
      onCatalog={goToCatalog}
      onQuantity={updateCartQuantity}
      onPayment={selectPaymentMethod}
      onPix={startPixPayment}
      onCard={startCardPayment}
      onCancelPayment={cancelPayment}
      onPaid={markSuccess}
      onReset={resetTotemSession}
    />
  );
}

export function TotemV2StepView({
  step,
  context,
  activeCategoryId,
  cart,
  selectedProduct,
  busy,
  currentOrder,
  payment,
  error,
  onCategoryChange,
  onProduct,
  onProductBack,
  onAddProduct,
  onCart,
  onCatalog,
  onQuantity,
  onPayment,
  onPix,
  onCard,
  onCancelPayment,
  onPaid,
  onReset,
}: {
  step: TotemStep;
  context: TotemV2Context | null;
  activeCategoryId: string | null;
  cart: CartItem[];
  selectedProduct: TotemV2Product | null;
  busy: boolean;
  currentOrder: { id: string; orderNumber?: number | string } | null;
  payment: TotemV2PaymentPreparation | null;
  error: string | null;
  onCategoryChange: (id: string) => void;
  onProduct: (product: TotemV2Product) => void;
  onProductBack: () => void;
  onAddProduct: (product: TotemV2Product, quantity: number, selectedOptions: SelectedOptions) => void;
  onCart: () => void;
  onCatalog: () => void;
  onQuantity: (id: string, quantity: number) => void;
  onPayment: () => void;
  onPix: () => void;
  onCard: () => void;
  onCancelPayment: () => void;
  onPaid: () => void;
  onReset: () => void;
}) {
  switch (step) {
    case "WELCOME":
      return <WelcomeScreen />;
    case "CATALOG":
      return context ? (
        <CatalogScreen
          context={context}
          activeCategoryId={activeCategoryId}
          onCategoryChange={onCategoryChange}
          onProduct={onProduct}
          cart={cart}
          onCart={onCart}
        />
      ) : <WelcomeScreen />;
    case "PRODUCT":
      return selectedProduct ? (
        <ProductScreen
          context={context}
          product={selectedProduct}
          onBack={onProductBack}
          onAdd={onAddProduct}
        />
      ) : <ErrorScreen message="Produto nao selecionado." onReset={onCatalog} />;
    case "CART":
      return (
        <CartScreen
          context={context}
          cart={cart}
          onBack={onCatalog}
          onQuantity={onQuantity}
          onPayment={onPayment}
        />
      );
    case "PAYMENT_METHOD":
      return context ? (
        <PaymentMethodScreen
          context={context}
          totalInCents={cartTotal(cart)}
          onBack={onCart}
          onPix={onPix}
          onCard={onCard}
        />
      ) : <ErrorScreen message="Contexto do totem nao carregado." onReset={onReset} />;
    case "PIX_PAYMENT":
      return (
        <PixPaymentScreen
          context={context}
          busy={busy}
          order={currentOrder}
          payment={payment}
          totalInCents={cartTotal(cart)}
          onCancel={onCancelPayment}
          onPaid={onPaid}
        />
      );
    case "CARD_PAYMENT":
      return <CardPaymentScreen context={context} onCancel={onCancelPayment} />;
    case "SUCCESS":
      return <SuccessScreen context={context} onDone={onReset} />;
    case "ERROR":
    default:
      return <ErrorScreen message={error ?? "Erro inesperado."} onReset={onReset} />;
  }
}

function ScreenLifecycleLog({ name }: { name: string }) {
  useEffect(() => {
    console.info("[MOUNT]", name);
    return () => console.info("[UNMOUNT]", name);
  }, [name]);

  return null;
}

export function TotemV2Header({ context }: { context: TotemV2Context | null }) {
  return (
    <header className="tv2-header">
      {context?.logoUrl ? <img className="tv2-logo" src={resolveTotemV2AssetUrl(context.logoUrl)} alt="" /> : null}
      <div className="tv2-header-text">
        <strong>{context?.displayName ?? "Totem V2"}</strong>
        <span>Autoatendimento</span>
      </div>
    </header>
  );
}

function WelcomeScreen() {
  return (
    <main className="tv2-root tv2-screen tv2-centered" data-testid="totem-welcome-screen">
      <ScreenLifecycleLog name="WelcomeScreen" />
      <div className="tv2-loader" />
      <h1>Carregando totem</h1>
    </main>
  );
}

function CatalogScreen({
  context,
  activeCategoryId,
  onCategoryChange,
  onProduct,
  cart,
  onCart,
}: {
  context: TotemV2Context;
  activeCategoryId: string | null;
  onCategoryChange: (id: string) => void;
  onProduct: (product: TotemV2Product) => void;
  cart: CartItem[];
  onCart: () => void;
}) {
  const categories = context.catalog.categories;
  const active = categories.find((category) => category.id === activeCategoryId) ?? categories[0];

  return (
    <main className="tv2-root tv2-screen tv2-catalog-screen" data-testid="totem-catalog-screen">
      <ScreenLifecycleLog name="CatalogScreen" />
      <TotemV2Header context={context} />
      <TotemV2CategoryTabs categories={categories} activeId={active?.id ?? null} onChange={onCategoryChange} />
      <TotemV2ProductList products={active?.products ?? []} onProduct={onProduct} />
      <TotemV2CartBar cart={cart} onCart={onCart} />
    </main>
  );
}

export function TotemV2CategoryTabs({
  categories,
  activeId,
  onChange,
}: {
  categories: Array<{ id: string; name: string }>;
  activeId: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="tv2-tabs" aria-label="Categorias" data-testid="totem-category-tabs">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={category.id === activeId ? "tv2-tab tv2-tab-active" : "tv2-tab"}
          onClick={() => onChange(category.id)}
        >
          {category.name}
        </button>
      ))}
    </nav>
  );
}

export function TotemV2ProductList({
  products,
  onProduct,
}: {
  products: TotemV2Product[];
  onProduct: (product: TotemV2Product) => void;
}) {
  if (products.length === 0) {
    return <div className="tv2-empty">Nenhum produto disponivel nesta categoria.</div>;
  }

  return (
    <div className="tv2-product-grid" data-testid="totem-product-list">
      {products.map((product) => (
        <button key={product.id} type="button" className="tv2-product-card" data-testid="totem-product-card" onClick={() => onProduct(product)}>
          {product.imageUrl ? <img className="tv2-product-image" src={resolveTotemV2AssetUrl(product.imageUrl)} alt="" /> : null}
          <span className="tv2-product-info">
            <strong>{product.name}</strong>
            {product.description ? <small>{product.description}</small> : null}
            <b>{money(product.priceInCents)}</b>
          </span>
          <span className="tv2-add-button">Adicionar</span>
        </button>
      ))}
    </div>
  );
}

export function TotemV2CartBar({ cart, onCart }: { cart: CartItem[]; onCart: () => void }) {
  if (cart.length === 0) return null;
  return (
    <footer className="tv2-cart-bar" data-testid="totem-cart-bar">
      <span>{cartCount(cart)} itens</span>
      <strong>{money(cartTotal(cart))}</strong>
      <button type="button" onClick={onCart}>
        <ShoppingCart size={24} />
        Ver pedido
      </button>
    </footer>
  );
}

function ProductScreen({
  context,
  product,
  onBack,
  onAdd,
}: {
  context: TotemV2Context | null;
  product: TotemV2Product;
  onBack: () => void;
  onAdd: (product: TotemV2Product, quantity: number, selectedOptions: SelectedOptions) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});
  const valid = isSelectionValid(product, selectedOptions);
  const total = (product.priceInCents + selectedOptionPrice(product, selectedOptions)) * quantity;

  return (
    <main className="tv2-root tv2-screen tv2-product-screen" data-testid="totem-product-screen">
      <ScreenLifecycleLog name="ProductScreen" />
      <TotemV2Header context={context} />
      <button type="button" className="tv2-back" onClick={onBack}>
        <ArrowLeft size={24} />
        Voltar
      </button>
      <div className="tv2-product-detail">
        {product.imageUrl ? <img className="tv2-detail-image" data-testid="totem-product-image" src={resolveTotemV2AssetUrl(product.imageUrl)} alt="" /> : null}
        <div className="tv2-detail-body">
          <h1 data-testid="totem-product-name">{product.name}</h1>
          {product.description ? <p>{product.description}</p> : null}
          {(product.optionGroups ?? []).map((group) => (
            <OptionGroupPicker
              key={group.id}
              group={group}
              value={selectedOptions[group.id] ?? []}
              onChange={(optionIds) => setSelectedOptions((current) => ({ ...current, [group.id]: optionIds }))}
            />
          ))}
          <div className="tv2-quantity-row">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))}>
              <Minus size={24} />
            </button>
            <strong>{quantity}</strong>
            <button type="button" onClick={() => setQuantity((value) => value + 1)}>
              <Plus size={24} />
            </button>
          </div>
          <button type="button" className="tv2-primary" disabled={!valid} onClick={() => onAdd(product, quantity, selectedOptions)}>
            Adicionar {money(total)}
          </button>
        </div>
      </div>
    </main>
  );
}

function OptionGroupPicker({
  group,
  value,
  onChange,
}: {
  group: TotemV2OptionGroup;
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const max = group.maxSelections || 1;
  const toggle = (optionId: string) => {
    if (max === 1) {
      onChange(value.includes(optionId) ? [] : [optionId]);
      return;
    }
    if (value.includes(optionId)) {
      onChange(value.filter((id) => id !== optionId));
      return;
    }
    if (value.length < max) {
      onChange([...value, optionId]);
    }
  };

  return (
    <div className="tv2-option-group">
      <h2>{group.name}</h2>
      <span>{group.required ? "Obrigatorio" : "Opcional"}</span>
      <div className="tv2-option-list">
        {group.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={value.includes(option.id) ? "tv2-option tv2-option-selected" : "tv2-option"}
            onClick={() => toggle(option.id)}
          >
            <strong>{option.name}</strong>
            {option.priceDeltaInCents ? <small>+ {money(option.priceDeltaInCents)}</small> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TotemV2CartScreen(props: Parameters<typeof CartScreen>[0]) {
  return <CartScreen {...props} />;
}

function CartScreen({
  context,
  cart,
  onBack,
  onQuantity,
  onPayment,
}: {
  context: TotemV2Context | null;
  cart: CartItem[];
  onBack: () => void;
  onQuantity: (id: string, quantity: number) => void;
  onPayment: () => void;
}) {
  return (
    <main className="tv2-root tv2-screen tv2-cart-screen" data-testid="totem-cart-screen">
      <ScreenLifecycleLog name="CartScreen" />
      <TotemV2Header context={context} />
      <button type="button" className="tv2-back" onClick={onBack}>
        <ArrowLeft size={24} />
        Voltar
      </button>
      <h1>Meu pedido</h1>
      <div className="tv2-cart-list">
        {cart.map((item) => (
          <div key={item.id} className="tv2-cart-item">
            <div>
              <strong>{item.product.name}</strong>
              <span>{money(item.unitPriceInCents)}</span>
            </div>
            <div className="tv2-cart-qty">
              <button type="button" onClick={() => onQuantity(item.id, item.quantity - 1)}>
                <Minus size={22} />
              </button>
              <b>{item.quantity}</b>
              <button type="button" onClick={() => onQuantity(item.id, item.quantity + 1)}>
                <Plus size={22} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="tv2-cart-total">
        <span>Total</span>
        <strong>{money(cartTotal(cart))}</strong>
      </div>
      <button type="button" className="tv2-primary" disabled={cart.length === 0} onClick={onPayment}>
        Escolher pagamento
      </button>
    </main>
  );
}

function PaymentMethodScreen({
  context,
  totalInCents,
  onBack,
  onPix,
  onCard,
}: {
  context: TotemV2Context;
  totalInCents: number;
  onBack: () => void;
  onPix: () => void;
  onCard: () => void;
}) {
  return (
    <main className="tv2-root tv2-screen tv2-payment-method-screen" data-testid="totem-payment-method-screen">
      <ScreenLifecycleLog name="PaymentMethodScreen" />
      <TotemV2Header context={context} />
      <button type="button" className="tv2-back" onClick={onBack}>
        <ArrowLeft size={24} />
        Voltar
      </button>
      <h1>Escolha o pagamento</h1>
      <p className="tv2-payment-total">{money(totalInCents)}</p>
      <div className="tv2-payment-buttons">
        <button type="button" disabled={!context.paymentMethods.pix} onClick={onPix}>PIX</button>
        <button type="button" disabled={!context.paymentMethods.card} onClick={onCard}>Cartao</button>
      </div>
    </main>
  );
}

export function TotemV2PaymentScreen(props: Parameters<typeof PixPaymentScreen>[0]) {
  return <PixPaymentScreen {...props} />;
}

function PixPaymentScreen({
  context,
  busy,
  order,
  payment,
  totalInCents,
  onCancel,
  onPaid,
}: {
  context: TotemV2Context | null;
  busy: boolean;
  order: { id: string; orderNumber?: number | string } | null;
  payment: TotemV2PaymentPreparation | null;
  totalInCents: number;
  onCancel: () => void;
  onPaid: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const paidRef = useRef(false);

  useEffect(() => {
    if (!payment?.expiresAt) return;
    const tick = () => {
      const diff = Math.max(0, Math.ceil((new Date(payment.expiresAt!).getTime() - Date.now()) / 1000));
      setRemaining(diff);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [payment?.expiresAt]);

  useEffect(() => {
    if (!order?.id) return;
    const timer = window.setInterval(async () => {
      if (paidRef.current) return;
      const { getTotemV2OrderStatus } = await import("@/lib/totem-v2-api");
      const status = await getTotemV2OrderStatus(order.id);
      if (status?.paymentStatus === "PAID") {
        paidRef.current = true;
        onPaid();
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [order?.id, onPaid]);

  const qr = payment?.qrCode ?? payment?.paymentTransaction?.qrCode ?? payment?.paymentTransaction?.pixCopyPaste;

  return (
    <main className="tv2-root tv2-screen tv2-pix-screen" data-testid="totem-pix-screen">
      <ScreenLifecycleLog name="PixPaymentScreen" />
      <TotemV2Header context={context} />
      <section className="tv2-pix-main">
        <h1>Pague com PIX</h1>
        <div className="tv2-pix-meta">
          <span>Pedido {order?.orderNumber ? `#${order.orderNumber}` : ""}</span>
          <strong>{money(totalInCents)}</strong>
        </div>
        <p className="tv2-countdown">
          {remaining === null ? "Gerando cobranca..." : `Tempo restante: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
        </p>
        <div className="tv2-qr-box" data-testid="totem-pix-qr">
          {busy || !qr ? <div className="tv2-loader" /> : <QRCodeSVG value={qr} className="tv2-qr-code" />}
        </div>
      </section>
      <footer className="tv2-pix-footer">
        <button type="button" className="tv2-secondary" onClick={onCancel}>
          Cancelar
        </button>
      </footer>
    </main>
  );
}

function CardPaymentScreen({ context, onCancel }: { context: TotemV2Context | null; onCancel: () => void }) {
  return (
    <main className="tv2-root tv2-screen tv2-card-screen" data-testid="totem-card-screen">
      <ScreenLifecycleLog name="CardPaymentScreen" />
      <TotemV2Header context={context} />
      <h1>Aproxime ou insira o cartao</h1>
      <p>Aguardando integracao com terminal.</p>
      <button type="button" className="tv2-secondary" onClick={onCancel}>
        Cancelar
      </button>
    </main>
  );
}

export function TotemV2SuccessScreen({ onDone }: { onDone: () => void }) {
  return <SuccessScreen onDone={onDone} />;
}

function SuccessScreen({ context, onDone }: { context: TotemV2Context | null; onDone: () => void }) {
  return (
    <main className="tv2-root tv2-screen tv2-centered" data-testid="totem-success-screen">
      <ScreenLifecycleLog name="SuccessScreen" />
      <TotemV2Header context={context} />
      <CheckCircle2 className="tv2-success-icon" />
      <h1>Pagamento confirmado</h1>
      <p>Pedido enviado para impressao.</p>
      <button type="button" className="tv2-primary" onClick={onDone}>
        Novo pedido
      </button>
    </main>
  );
}

function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <main className="tv2-root tv2-screen tv2-centered" data-testid="totem-error-screen">
      <ScreenLifecycleLog name="ErrorScreen" />
      <XCircle className="tv2-error-icon" />
      <h1>Nao foi possivel continuar</h1>
      <p>{message}</p>
      <button type="button" className="tv2-primary" onClick={onReset}>
        Reiniciar
      </button>
    </main>
  );
}
