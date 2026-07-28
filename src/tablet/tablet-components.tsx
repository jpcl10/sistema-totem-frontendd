import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Minus, Plus, Printer, ShoppingCart, XCircle } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { resolveAssetUrl } from "@/lib/auth";
import {
  createTabletEventOrder,
  getTabletOrderStatus,
  prepareTabletPixPayment,
  resolveTabletContext,
  retryTabletPrintJob,
  type TabletContext,
} from "@/lib/tablet-api";
import type { TotemV2OptionGroup, TotemV2Product } from "@/lib/totem-v2-api";

type TabletStep =
  | "WELCOME"
  | "CATALOG"
  | "PRODUCT"
  | "CART"
  | "PAYMENT_METHOD"
  | "PIX_PAYMENT"
  | "CARD_PAYMENT"
  | "PRINTING"
  | "SUCCESS"
  | "ERROR";

interface CartItem {
  key: string;
  product: TotemV2Product;
  quantity: number;
  selectedOptions: Array<{
    optionGroupId: string;
    optionIds: string[];
  }>;
}

function money(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function itemOptionsTotal(product: TotemV2Product, selectedOptions: CartItem["selectedOptions"]) {
  const selected = new Set(selectedOptions.flatMap((option) => option.optionIds));
  return (product.optionGroups ?? []).reduce(
    (total, group) => total + group.options.reduce((sum, option) => sum + (selected.has(option.id) ? option.priceDeltaInCents : 0), 0),
    0,
  );
}

function cartItemTotal(item: CartItem) {
  return (item.product.priceInCents + itemOptionsTotal(item.product, item.selectedOptions)) * item.quantity;
}

function cartTotal(cart: CartItem[]) {
  return cart.reduce((total, item) => total + cartItemTotal(item), 0);
}

function cartCount(cart: CartItem[]) {
  return cart.reduce((count, item) => count + item.quantity, 0);
}

function optionLabel(product: TotemV2Product, selectedOptions: CartItem["selectedOptions"]) {
  const parts: string[] = [];
  for (const selection of selectedOptions) {
    const group = product.optionGroups?.find((g) => g.id === selection.optionGroupId);
    if (!group) continue;
    const names = group.options.filter((option) => selection.optionIds.includes(option.id)).map((option) => option.name);
    if (names.length) parts.push(`${group.name}: ${names.join(", ")}`);
  }
  return parts;
}

export function TabletApp({ token }: { token: string }) {
  const [context, setContext] = useState<TabletContext | null>(null);
  const [step, setStep] = useState<TabletStep>("WELCOME");
  const [selectedProduct, setSelectedProduct] = useState<TotemV2Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | number | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    let alive = true;
    resolveTabletContext(token)
      .then((resolved) => {
        if (!alive) return;
        setContext(resolved);
        setStep(resolved.tablet.requireWelcome ? "WELCOME" : "CATALOG");
      })
      .catch(() => {
        if (!alive) return;
        setError("Tablet nao autorizado ou configuracao indisponivel.");
        setStep("ERROR");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (step !== "SUCCESS" || !context) return;
    const timeout = window.setTimeout(() => resetSession(), context.tablet.autoResetSeconds * 1000);
    return () => window.clearTimeout(timeout);
  }, [context, step]);

  useEffect(() => {
    if (step !== "PIX_PAYMENT" || !orderId) return;
    const interval = window.setInterval(async () => {
      const status = await getTabletOrderStatus(orderId);
      if (status?.paymentStatus === "PAID" || status?.paymentStatus === "NOT_REQUIRED") {
        setOrderNumber(status.orderNumber ?? orderNumber);
        setStep("PRINTING");
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [orderId, orderNumber, step]);

  useEffect(() => {
    if (step !== "PRINTING" || !orderId) return;
    const interval = window.setInterval(async () => {
      const status = await getTabletOrderStatus(orderId);
      if (status?.orderNumber) setOrderNumber(status.orderNumber);
      const printJobs = status?.printJobs ?? [];
      if (printJobs.length === 0) return;
      if (printJobs.some((job) => job.status === "ERROR" || job.status === "CANCELLED")) {
        setError("Nao foi possivel imprimir. Chame um operador.");
        setStep("ERROR");
        return;
      }
      if (printJobs.every((job) => ["PRINTED", "COMPLETED"].includes(job.status))) {
        setStep("SUCCESS");
      }
    }, 2000);
    return () => window.clearInterval(interval);
  }, [orderId, step]);

  function resetSession() {
    setCart([]);
    setSelectedProduct(null);
    setOrderId(null);
    setOrderNumber(null);
    setQrCode(null);
    setExpiresAt(null);
    setError(null);
    setStep(context?.tablet.requireWelcome === false ? "CATALOG" : "WELCOME");
    busyRef.current = false;
  }

  function addToCart(product: TotemV2Product, quantity: number, selectedOptions: CartItem["selectedOptions"]) {
    const key = JSON.stringify({ productId: product.id, selectedOptions });
    setCart((current) => {
      const existing = current.find((item) => item.key === key);
      if (existing) {
        return current.map((item) => item.key === key ? { ...item, quantity: item.quantity + quantity } : item);
      }
      return [...current, { key, product, quantity, selectedOptions }];
    });
    setSelectedProduct(null);
    setStep("CATALOG");
  }

  async function createOrder(paymentMethod: "PIX" | "CARD") {
    if (!context || busyRef.current || cart.length === 0) return null;
    busyRef.current = true;
    try {
      const order = await createTabletEventOrder({
        token,
        organizationSlug: context.organizationSlug,
        eventSlug: context.eventSlug,
        paymentMethod,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions,
        })),
      });
      setOrderId(order.id);
      setOrderNumber(order.orderNumber ?? null);
      return order;
    } catch {
      setError("Nao foi possivel criar o pedido.");
      setStep("ERROR");
      busyRef.current = false;
      return null;
    }
  }

  async function startPix() {
    const order = await createOrder("PIX");
    if (!order) return;
    try {
      const payment = await prepareTabletPixPayment(order.id);
      const code = payment.qrCode ?? payment.paymentTransaction?.pixCopyPaste ?? payment.paymentTransaction?.qrCode ?? null;
      if (!code) throw new Error("missing qr code");
      setQrCode(code);
      setExpiresAt(payment.expiresAt ?? null);
      setStep("PIX_PAYMENT");
    } catch {
      setError("Nao foi possivel gerar o QR Code PIX.");
      setStep("ERROR");
      busyRef.current = false;
    }
  }

  async function retryFailedPrint() {
    if (!orderId) return;
    const status = await getTabletOrderStatus(orderId);
    const failed = status?.printJobs?.find((job) => job.status === "ERROR" || job.status === "CANCELLED");
    if (!failed) return;
    await retryTabletPrintJob(token, orderId, failed.id);
    setError(null);
    setStep("PRINTING");
  }

  if (!context && step !== "ERROR") {
    return <TabletShell><div className="tb-status">Carregando tablet...</div></TabletShell>;
  }

  switch (step) {
    case "WELCOME":
      return <TabletWelcomeScreen context={context!} onStart={() => setStep("CATALOG")} />;
    case "CATALOG":
      return <TabletCatalogScreen context={context!} cart={cart} onProduct={(product) => { setSelectedProduct(product); setStep("PRODUCT"); }} onCart={() => setStep("CART")} />;
    case "PRODUCT":
      return <TabletProductScreen product={selectedProduct!} onBack={() => setStep("CATALOG")} onAdd={addToCart} />;
    case "CART":
      return <TabletCartScreen cart={cart} setCart={setCart} onBack={() => setStep("CATALOG")} onPay={() => setStep("PAYMENT_METHOD")} />;
    case "PAYMENT_METHOD":
      return <TabletPaymentMethodScreen context={context!} total={cartTotal(cart)} onBack={() => setStep("CART")} onPix={startPix} onCard={async () => { await createOrder("CARD"); setStep("CARD_PAYMENT"); }} />;
    case "PIX_PAYMENT":
      return <TabletPixScreen qrCode={qrCode!} total={cartTotal(cart)} orderNumber={orderNumber} expiresAt={expiresAt} onCancel={resetSession} />;
    case "CARD_PAYMENT":
      return <TabletCardScreen orderNumber={orderNumber} onBack={() => { busyRef.current = false; setStep("PAYMENT_METHOD"); }} />;
    case "PRINTING":
      return <TabletPrintingScreen orderNumber={orderNumber} />;
    case "SUCCESS":
      return <TabletSuccessScreen orderNumber={orderNumber} />;
    case "ERROR":
      return <TabletErrorScreen message={error ?? "Erro inesperado."} onRetryPrint={retryFailedPrint} onReset={resetSession} />;
  }
}

function TabletShell({ children }: { children: React.ReactNode }) {
  return <main className="tb-app">{children}</main>;
}

function TabletWelcomeScreen({ context, onStart }: { context: TabletContext; onStart: () => void }) {
  return (
    <TabletShell>
      <section className="tb-welcome">
        {context.bannerUrl && <img className="tb-welcome-banner" src={resolveAssetUrl(context.bannerUrl)} alt="" />}
        {context.logoUrl && <img className="tb-logo" src={resolveAssetUrl(context.logoUrl)} alt={context.displayName} />}
        <h1>{context.displayName}</h1>
        <p>Toque para comecar</p>
        <button className="tb-primary tb-xl" onClick={onStart}>Comecar pedido</button>
      </section>
    </TabletShell>
  );
}

function TabletCatalogScreen({ context, cart, onProduct, onCart }: { context: TabletContext; cart: CartItem[]; onProduct: (product: TotemV2Product) => void; onCart: () => void }) {
  return (
    <TabletShell>
      <header className="tb-header">
        {context.logoUrl && <img src={resolveAssetUrl(context.logoUrl)} alt="" />}
        <div>
          <strong>{context.displayName}</strong>
          <span>Escolha seus produtos</span>
        </div>
      </header>
      <div className="tb-catalog">
        {context.catalog.categories.map((category) => (
          <section key={category.id}>
            <h2>{category.name}</h2>
            <div className="tb-grid">
              {category.products.map((product) => (
                <button className="tb-product-card" key={product.id} onClick={() => onProduct(product)}>
                  <ProductImage product={product} />
                  <span className="tb-product-name">{product.name}</span>
                  {product.description && <span className="tb-product-desc">{product.description}</span>}
                  <strong>{money(product.priceInCents)}</strong>
                  <span className="tb-add">Adicionar</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {cart.length > 0 && (
        <button className="tb-cart-bar" onClick={onCart}>
          <ShoppingCart size={28} />
          <span>{cartCount(cart)} itens</span>
          <strong>{money(cartTotal(cart))}</strong>
          <em>Ver pedido</em>
        </button>
      )}
    </TabletShell>
  );
}

function ProductImage({ product }: { product: TotemV2Product }) {
  if (!product.imageUrl) return <div className="tb-image-placeholder">{product.name.slice(0, 1)}</div>;
  return <img className="tb-product-image" src={resolveAssetUrl(product.imageUrl)} alt={product.name} />;
}

function TabletProductScreen({ product, onBack, onAdd }: { product: TotemV2Product; onBack: () => void; onAdd: (product: TotemV2Product, quantity: number, selectedOptions: CartItem["selectedOptions"]) => void }) {
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const selectedOptions = useMemo(() => Object.entries(selected).map(([optionGroupId, optionIds]) => ({ optionGroupId, optionIds })), [selected]);
  const total = (product.priceInCents + itemOptionsTotal(product, selectedOptions)) * quantity;

  function toggle(group: TotemV2OptionGroup, optionId: string) {
    setSelected((current) => {
      const values = current[group.id] ?? [];
      const exists = values.includes(optionId);
      const next = exists ? values.filter((id) => id !== optionId) : [...values, optionId].slice(group.maxSelections > 0 ? -group.maxSelections : undefined);
      return { ...current, [group.id]: next };
    });
  }

  return (
    <TabletShell>
      <button className="tb-back" onClick={onBack}><ArrowLeft /> Voltar</button>
      <section className="tb-product-detail">
        <ProductImage product={product} />
        <div>
          <h1>{product.name}</h1>
          {product.description && <p>{product.description}</p>}
          <strong>{money(product.priceInCents)}</strong>
        </div>
      </section>
      {(product.optionGroups ?? []).map((group) => (
        <section className="tb-options" key={group.id}>
          <h2>{group.name}</h2>
          <div>
            {group.options.map((option) => (
              <button className={(selected[group.id] ?? []).includes(option.id) ? "selected" : ""} key={option.id} onClick={() => toggle(group, option.id)}>
                <span>{option.name}</span>
                {option.priceDeltaInCents > 0 && <strong>+ {money(option.priceDeltaInCents)}</strong>}
              </button>
            ))}
          </div>
        </section>
      ))}
      <footer className="tb-product-footer">
        <div className="tb-qty">
          <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus /></button>
          <strong>{quantity}</strong>
          <button onClick={() => setQuantity(quantity + 1)}><Plus /></button>
        </div>
        <button className="tb-primary" onClick={() => onAdd(product, quantity, selectedOptions)}>Adicionar {money(total)}</button>
      </footer>
    </TabletShell>
  );
}

function TabletCartScreen({ cart, setCart, onBack, onPay }: { cart: CartItem[]; setCart: React.Dispatch<React.SetStateAction<CartItem[]>>; onBack: () => void; onPay: () => void }) {
  return (
    <TabletShell>
      <button className="tb-back" onClick={onBack}><ArrowLeft /> Voltar</button>
      <section className="tb-panel">
        <h1>Meu pedido</h1>
        {cart.map((item) => (
          <article className="tb-cart-item" key={item.key}>
            <div>
              <strong>{item.quantity}x {item.product.name}</strong>
              {optionLabel(item.product, item.selectedOptions).map((label) => <span key={label}>{label}</span>)}
            </div>
            <div>
              <strong>{money(cartItemTotal(item))}</strong>
              <button onClick={() => setCart((current) => current.filter((entry) => entry.key !== item.key))}>Remover</button>
            </div>
          </article>
        ))}
        <div className="tb-total"><span>Total</span><strong>{money(cartTotal(cart))}</strong></div>
        <button className="tb-primary tb-xl" disabled={cart.length === 0} onClick={onPay}>Escolher pagamento</button>
      </section>
    </TabletShell>
  );
}

function TabletPaymentMethodScreen({ context, total, onBack, onPix, onCard }: { context: TabletContext; total: number; onBack: () => void; onPix: () => void; onCard: () => void }) {
  return (
    <TabletShell>
      <button className="tb-back" onClick={onBack}><ArrowLeft /> Voltar</button>
      <section className="tb-panel tb-pay-method">
        <h1>Pagamento</h1>
        <p>{money(total)}</p>
        <button disabled={!context.paymentMethods.pix} onClick={onPix}>PIX</button>
        <button disabled={!context.paymentMethods.card} onClick={onCard}>Cartao</button>
      </section>
    </TabletShell>
  );
}

function TabletPixScreen({ qrCode, total, orderNumber, expiresAt, onCancel }: { qrCode: string; total: number; orderNumber: string | number | null; expiresAt: string | null; onCancel: () => void }) {
  return (
    <TabletShell>
      <section className="tb-pix">
        <h1>Pagamento PIX</h1>
        <QRCodeCanvas value={qrCode} size={360} includeMargin />
        <strong>{money(total)}</strong>
        {orderNumber && <span>Pedido #{orderNumber}</span>}
        {expiresAt && <small>Valido ate {new Date(expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>}
        <p>Aguardando aprovacao do pagamento...</p>
        <button onClick={onCancel}>Cancelar</button>
      </section>
    </TabletShell>
  );
}

function TabletCardScreen({ orderNumber, onBack }: { orderNumber: string | number | null; onBack: () => void }) {
  return (
    <TabletShell>
      <section className="tb-status">
        <h1>Realize o pagamento na maquininha</h1>
        {orderNumber && <p>Pedido #{orderNumber}</p>}
        <p>Chame um operador para confirmar o pagamento antes da impressao.</p>
        <button onClick={onBack}>Voltar</button>
      </section>
    </TabletShell>
  );
}

function TabletPrintingScreen({ orderNumber }: { orderNumber: string | number | null }) {
  return (
    <TabletShell>
      <section className="tb-status">
        <Printer size={84} />
        <h1>Pagamento aprovado</h1>
        <p>Imprimindo sua ficha...</p>
        {orderNumber && <strong>Pedido #{orderNumber}</strong>}
      </section>
    </TabletShell>
  );
}

function TabletSuccessScreen({ orderNumber }: { orderNumber: string | number | null }) {
  return (
    <TabletShell>
      <section className="tb-status">
        <CheckCircle2 size={96} />
        <h1>Retire sua ficha</h1>
        {orderNumber && <strong>Pedido #{orderNumber}</strong>}
      </section>
    </TabletShell>
  );
}

function TabletErrorScreen({ message, onRetryPrint, onReset }: { message: string; onRetryPrint: () => void; onReset: () => void }) {
  return (
    <TabletShell>
      <section className="tb-status tb-error">
        <XCircle size={88} />
        <h1>Atencao</h1>
        <p>{message}</p>
        <div>
          <button onClick={onRetryPrint}>Tentar impressao</button>
          <button onClick={onReset}>Inicio</button>
        </div>
      </section>
    </TabletShell>
  );
}
