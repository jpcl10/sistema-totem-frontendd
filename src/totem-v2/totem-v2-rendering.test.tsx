import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  TotemV2StepView,
  type TotemV2CartItem,
  type TotemStep,
} from "./totem-v2-components";
import type {
  TotemV2Context,
  TotemV2PaymentPreparation,
  TotemV2Product,
} from "@/lib/totem-v2-api";

const product: TotemV2Product = {
  id: "product-1",
  name: "Produto teste",
  description: "Descricao teste",
  imageUrl: "/uploads/produto.png",
  priceInCents: 2500,
};

const context: TotemV2Context = {
  deviceId: "device-1",
  organizationId: "org-1",
  organizationSlug: "org",
  contextType: "EVENT",
  eventId: "event-1",
  eventSlug: "evento",
  storeId: null,
  storeSlug: null,
  displayName: "Evento teste",
  bannerUrl: null,
  logoUrl: null,
  paymentMethods: {
    pix: true,
    card: true,
  },
  printing: {
    enabled: true,
    autoPrintEnabled: true,
    defaultPrinterDeviceId: "printer-1",
    paperSize: "80mm",
  },
  catalog: {
    categories: [
      {
        id: "cat-1",
        name: "Categoria",
        products: [product],
      },
    ],
  },
};

const cart: TotemV2CartItem[] = [
  {
    id: "cart-1",
    product,
    quantity: 1,
    selectedOptions: {},
    unitPriceInCents: 2500,
  },
];

const payment: TotemV2PaymentPreparation = {
  paymentStep: "pix_automatic",
  qrCode: "00020101021226880014br.gov.bcb.pix",
  expiresAt: new Date(Date.now() + 300000).toISOString(),
};

function noop() {}

function render(step: TotemStep, overrides: Partial<React.ComponentProps<typeof TotemV2StepView>> = {}) {
  return renderToStaticMarkup(
    <TotemV2StepView
      step={step}
      context={context}
      activeCategoryId="cat-1"
      cart={cart}
      selectedProduct={product}
      busy={false}
      currentOrder={{ id: "order-1", orderNumber: 123 }}
      payment={payment}
      error={null}
      onCategoryChange={noop}
      onProduct={noop}
      onProductBack={noop}
      onAddProduct={noop}
      onCart={noop}
      onCatalog={noop}
      onQuantity={noop}
      onPayment={noop}
      onPix={noop}
      onCard={noop}
      onCancelPayment={noop}
      onPaid={noop}
      onReset={noop}
      {...overrides}
    />,
  );
}

function count(html: string, testId: string) {
  return (html.match(new RegExp(`data-testid="${testId}"`, "g")) ?? []).length;
}

test("catalog renders without product, cart or pix screens", () => {
  const html = render("CATALOG");

  assert.equal(count(html, "totem-catalog-screen"), 1);
  assert.equal(count(html, "totem-product-card"), 1);
  assert.equal(count(html, "totem-cart-bar"), 1);
  assert.equal(count(html, "totem-product-screen"), 0);
  assert.equal(count(html, "totem-cart-screen"), 0);
  assert.equal(count(html, "totem-pix-screen"), 0);
});

test("product renders as one full screen and does not include catalog", () => {
  const html = render("PRODUCT");

  assert.equal(count(html, "totem-product-screen"), 1);
  assert.equal(count(html, "totem-product-image"), 1);
  assert.equal(count(html, "totem-product-name"), 1);
  assert.equal(count(html, "totem-catalog-screen"), 0);
  assert.equal(count(html, "totem-product-card"), 0);
  assert.equal(count(html, "totem-category-tabs"), 0);
  assert.equal(count(html, "totem-cart-bar"), 0);
});

test("cart renders without catalog or pix", () => {
  const html = render("CART");

  assert.equal(count(html, "totem-cart-screen"), 1);
  assert.equal(count(html, "totem-catalog-screen"), 0);
  assert.equal(count(html, "totem-product-card"), 0);
  assert.equal(count(html, "totem-category-tabs"), 0);
  assert.equal(count(html, "totem-pix-screen"), 0);
});

test("pix renders qr once without catalog, products or cart bar", () => {
  const html = render("PIX_PAYMENT");

  assert.equal(count(html, "totem-pix-screen"), 1);
  assert.equal(count(html, "totem-pix-qr"), 1);
  assert.equal(count(html, "totem-catalog-screen"), 0);
  assert.equal(count(html, "totem-product-card"), 0);
  assert.equal(count(html, "totem-category-tabs"), 0);
  assert.equal(count(html, "totem-cart-screen"), 0);
  assert.equal(count(html, "totem-cart-bar"), 0);
});
