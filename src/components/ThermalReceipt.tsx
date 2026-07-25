import type { PrintPayload } from "@/lib/print-queue";

function money(c: number) {
  const value = Number.isFinite(c) ? c : 0;
  return (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function text(value: unknown, fallback = "-") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function dateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString("pt-BR");
}

interface Props {
  payload: Partial<PrintPayload>;
  width?: "58mm" | "80mm";
}

/**
 * Realistic preview of an ESC/POS thermal receipt.
 * Monochrome, monospaced, compact, matching an Epson/Elgin/Bematech printer.
 */
export function ThermalReceipt({ payload, width = "58mm" }: Props) {
  const cols = width === "58mm" ? 32 : 48;
  const widthPx = width === "58mm" ? 240 : 340;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const sector = text(payload.sector, "KITCHEN");
  const orderId = text(payload.orderId, "");

  return (
    <div
      className="bg-white text-black shadow-md mx-auto"
      style={{
        width: widthPx,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
        fontSize: 12,
        lineHeight: 1.35,
        padding: 12,
        border: "1px dashed #000",
      }}
    >
      <div className="text-center font-bold uppercase tracking-wide" style={{ fontSize: 13 }}>
        {text(payload.eventName, "Defumar")}
      </div>
      <div className="text-center font-bold" style={{ marginTop: 2 }}>
        COMANDA {sector === "BAR" ? "BAR" : "COZINHA"}
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div>Pedido: <b>#{text(payload.orderNumber)}</b></div>
      <div>Cliente: {text(payload.customerName, "Cliente")}</div>
      <div>Data: {dateTime(payload.createdAt)}</div>
      <div>Status: {text(payload.status, "PENDING")}</div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {items.map((it, idx) => {
        const quantity = Number(it.quantity) || 1;
        const priceInCents = Number(it.priceInCents) || 0;
        return (
          <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
            <div style={{ flex: 1, wordBreak: "break-word" }}>
              <b>{quantity}x</b> {text(it.name, "Item")}
              {it.notes ? <div style={{ paddingLeft: 14, fontStyle: "italic" }}>obs: {it.notes}</div> : null}
            </div>
            <div style={{ whiteSpace: "nowrap" }}>{money(priceInCents * quantity)}</div>
          </div>
        );
      })}
      {items.length === 0 ? <div>Sem itens no payload.</div> : null}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Subtotal setor</span>
        <b>{money(Number(payload.totalInCents) || 0)}</b>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Total pedido</span>
        <b>{money(Number(payload.orderTotalInCents) || 0)}</b>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div className="text-center" style={{ fontSize: 10, opacity: 0.7 }}>
        via {sector} - {cols} cols - {width}
      </div>
      <div className="text-center" style={{ fontSize: 10, opacity: 0.5 }}>
        id: {orderId ? orderId.slice(-12) : "-"}
      </div>
    </div>
  );
}
