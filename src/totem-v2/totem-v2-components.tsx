import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowLeft, CheckCircle2, Minus, Plus, ShoppingCart, XCircle } from "lucide-react";

import { resolveAssetUrl } from "@/lib/auth";
import {
  createTotemV2EventOrder,
  getTotemV2OrderStatus,
  prepareTotemV2Payment,
  resolveTotemV2Context,
  type TotemV2Context,
  type TotemV2OptionGroup,
  type TotemV2PaymentPreparation,
  type TotemV2Product,
} from "@/lib/totem-v2-api";

import "./totem-v2.css";

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

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);
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

  const resetTotemSession = () => {
    if (resetTimersRef.current) clearTimeout(resetTimersRef.current);
    setCart([]);
    setSelectedProduct(null);
    setCurrentOrder(null);
    setPayment(null);
    setError(null);
    setBusy(false);
    setStep("CATALOG");
  };

  useEffect(() => {
    let active = true;
    setBusy(true);
    resolveTotemV2Context(token)
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
    setBusy(true);
    setError(null);
    setStep("PIX_PAYMENT");
    try {
      const order = await createTotemV2EventOrder({
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
      const preparation = await prepareTotemV2Payment(order.id, "PIX");
      setPayment(preparation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel gerar o PIX.");
      setStep("ERROR");
    } finally {
      setBusy(false);
    }
  };

  const startCardPayment = async () => {
    setStep("CARD_PAYMENT");
  };

  const markSuccess = () => {
    setStep("SUCCESS");
    resetTimersRef.current = setTimeout(resetTotemSession, 5000);
  };

  if (busy && step === "WELCOME") {
    return <TotemV2Shell context={context}><WelcomeScreen /></TotemV2Shell>;
  }

  if (!context && step !== "ERROR") {
    return <TotemV2Shell context={null}><WelcomeScreen /></TotemV2Shell>;
  }

  switch (step) {
    case "CATALOG":
      return (
        <TotemV2Shell context={context}>
          <CatalogScreen
            context={context!}
            activeCategoryId={activeCategoryId}
            onCategoryChange={setActiveCategoryId}
            onProduct={(product) => {
              setSelectedProduct(product);
              setStep("PRODUCT");
            }}
            cart={cart}
            onCart={() => setStep("CART")}
          />
        </TotemV2Shell>
      );
    case "PRODUCT":
      return selectedProduct ? (
        <TotemV2Shell context={context}>
          <ProductScreen
            product={selectedProduct}
            onBack={() => setStep("CATALOG")}
            onAdd={addToCart}
          />
        </TotemV2Shell>
      ) : null;
    case "CART":
      return (
        <TotemV2Shell context={context}>
          <CartScreen
            cart={cart}
            onBack={() => setStep("CATALOG")}
            onQuantity={updateCartQuantity}
            onPayment={() => setStep("PAYMENT_METHOD")}
          />
        </TotemV2Shell>
      );
    case "PAYMENT_METHOD":
      return (
        <TotemV2Shell context={context}>
          <PaymentMethodScreen
            context={context!}
            totalInCents={cartTotal(cart)}
            onBack={() => setStep("CART")}
            onPix={startPixPayment}
            onCard={startCardPayment}
          />
        </TotemV2Shell>
      );
    case "PIX_PAYMENT":
      return (
        <TotemV2Shell context={context}>
          <PixPaymentScreen
            busy={busy}
            order={currentOrder}
            payment={payment}
            totalInCents={cartTotal(cart)}
            onCancel={resetTotemSession}
            onPaid={markSuccess}
          />
        </TotemV2Shell>
      );
    case "CARD_PAYMENT":
      return (
        <TotemV2Shell context={context}>
          <CardPaymentScreen onCancel={resetTotemSession} />
        </TotemV2Shell>
      );
    case "SUCCESS":
      return (
        <TotemV2Shell context={context}>
          <SuccessScreen onDone={resetTotemSession} />
        </TotemV2Shell>
      );
    case "ERROR":
    default:
      return (
        <TotemV2Shell context={context}>
          <ErrorScreen message={error ?? "Erro inesperado."} onReset={resetTotemSession} />
        </TotemV2Shell>
      );
  }
}

function TotemV2Shell({ context, children }: { context: TotemV2Context | null; children: React.ReactNode }) {
  return (
    <main className="tv2-root">
      <TotemV2Header context={context} />
      {children}
    </main>
  );
}

export function TotemV2Header({ context }: { context: TotemV2Context | null }) {
  return (
    <header className="tv2-header">
      {context?.logoUrl ? <img className="tv2-logo" src={resolveAssetUrl(context.logoUrl)} alt="" /> : null}
      <div className="tv2-header-text">
        <strong>{context?.displayName ?? "Totem V2"}</strong>
        <span>Autoatendimento</span>
      </div>
    </header>
  );
}

function WelcomeScreen() {
  return (
    <section className="tv2-screen tv2-centered">
      <div className="tv2-loader" />
      <h1>Carregando totem</h1>
    </section>
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
    <section className="tv2-screen tv2-catalog-screen">
      <TotemV2CategoryTabs categories={categories} activeId={active?.id ?? null} onChange={onCategoryChange} />
      <TotemV2ProductList products={active?.products ?? []} onProduct={onProduct} />
      <TotemV2CartBar cart={cart} onCart={onCart} />
    </section>
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
    <nav className="tv2-tabs" aria-label="Categorias">
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
    <div className="tv2-product-grid">
      {products.map((product) => (
        <button key={product.id} type="button" className="tv2-product-card" onClick={() => onProduct(product)}>
          {product.imageUrl ? <img className="tv2-product-image" src={resolveAssetUrl(product.imageUrl)} alt="" /> : null}
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
    <footer className="tv2-cart-bar">
      <span>{cartCount(cart)} itens</span>
      <strong>{money(cartTotal(cart))}</strong>
      <button type="button" onClick={onCart}>
        <ShoppingCart size={24} />
        Ver pedido
      </button>
    </footer>
  );
}

export function TotemV2ProductModal({
  product,
  onBack,
  onAdd,
}: {
  product: TotemV2Product;
  onBack: () => void;
  onAdd: (product: TotemV2Product, quantity: number, selectedOptions: SelectedOptions) => void;
}) {
  return <ProductScreen product={product} onBack={onBack} onAdd={onAdd} />;
}

function ProductScreen({
  product,
  onBack,
  onAdd,
}: {
  product: TotemV2Product;
  onBack: () => void;
  onAdd: (product: TotemV2Product, quantity: number, selectedOptions: SelectedOptions) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});
  const valid = isSelectionValid(product, selectedOptions);
  const total = (product.priceInCents + selectedOptionPrice(product, selectedOptions)) * quantity;

  return (
    <section className="tv2-screen tv2-product-screen">
      <button type="button" className="tv2-back" onClick={onBack}>
        <ArrowLeft size={24} />
        Voltar
      </button>
      <div className="tv2-product-detail">
        {product.imageUrl ? <img className="tv2-detail-image" src={resolveAssetUrl(product.imageUrl)} alt="" /> : null}
        <div className="tv2-detail-body">
          <h1>{product.name}</h1>
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
    </section>
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
  cart,
  onBack,
  onQuantity,
  onPayment,
}: {
  cart: CartItem[];
  onBack: () => void;
  onQuantity: (id: string, quantity: number) => void;
  onPayment: () => void;
}) {
  return (
    <section className="tv2-screen tv2-cart-screen">
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
    </section>
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
    <section className="tv2-screen tv2-payment-method-screen">
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
    </section>
  );
}

export function TotemV2PaymentScreen(props: Parameters<typeof PixPaymentScreen>[0]) {
  return <PixPaymentScreen {...props} />;
}

function PixPaymentScreen({
  busy,
  order,
  payment,
  totalInCents,
  onCancel,
  onPaid,
}: {
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
    <section className="tv2-screen tv2-pix-screen">
      <h1>Pague com PIX</h1>
      <div className="tv2-pix-meta">
        <span>Pedido {order?.orderNumber ? `#${order.orderNumber}` : ""}</span>
        <strong>{money(totalInCents)}</strong>
      </div>
      <div className="tv2-qr-box">
        {busy || !qr ? <div className="tv2-loader" /> : <QRCodeSVG value={qr} className="tv2-qr-code" />}
      </div>
      <p className="tv2-countdown">
        {remaining === null ? "Gerando cobranca..." : `Tempo restante: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
      </p>
      <button type="button" className="tv2-secondary" onClick={onCancel}>
        Cancelar
      </button>
    </section>
  );
}

function CardPaymentScreen({ onCancel }: { onCancel: () => void }) {
  return (
    <section className="tv2-screen tv2-card-screen">
      <h1>Aproxime ou insira o cartao</h1>
      <p>Aguardando integracao com terminal.</p>
      <button type="button" className="tv2-secondary" onClick={onCancel}>
        Cancelar
      </button>
    </section>
  );
}

export function TotemV2SuccessScreen({ onDone }: { onDone: () => void }) {
  return <SuccessScreen onDone={onDone} />;
}

function SuccessScreen({ onDone }: { onDone: () => void }) {
  return (
    <section className="tv2-screen tv2-centered">
      <CheckCircle2 className="tv2-success-icon" />
      <h1>Pagamento confirmado</h1>
      <p>Pedido enviado para impressao.</p>
      <button type="button" className="tv2-primary" onClick={onDone}>
        Novo pedido
      </button>
    </section>
  );
}

function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <section className="tv2-screen tv2-centered">
      <XCircle className="tv2-error-icon" />
      <h1>Nao foi possivel continuar</h1>
      <p>{message}</p>
      <button type="button" className="tv2-primary" onClick={onReset}>
        Reiniciar
      </button>
    </section>
  );
}
