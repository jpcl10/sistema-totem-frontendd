import type { PrintPayload } from "@/lib/print-queue";

function money(c: number) {
  return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  payload: PrintPayload;
  width?: "58mm" | "80mm";
}

/**
 * Realistic preview of an ESC/POS thermal receipt.
 * Monochrome, monospaced, compact — matches what an Epson/Elgin/Bematech
 * 58mm or 80mm printer would render.
 */
export function ThermalReceipt({ payload, width = "58mm" }: Props) {
  const cols = width === "58mm" ? 32 : 48;
  const widthPx = width === "58mm" ? 240 : 340;

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
        {payload.eventName}
      </div>
      <div className="text-center font-bold" style={{ marginTop: 2 }}>
        ── COMANDA {payload.sector === "BAR" ? "BAR" : "COZINHA"} ──
      </div>
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div>Pedido: <b>#{payload.orderNumber}</b></div>
      <div>Cliente: {payload.customerName}</div>
      <div>Data: {new Date(payload.createdAt).toLocaleString("pt-BR")}</div>
      <div>Status: {payload.status}</div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      {payload.items.map((it, idx) => (
        <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
          <div style={{ flex: 1, wordBreak: "break-word" }}>
            <b>{it.quantity}x</b> {it.name}
            {it.notes ? <div style={{ paddingLeft: 14, fontStyle: "italic" }}>obs: {it.notes}</div> : null}
          </div>
          <div style={{ whiteSpace: "nowrap" }}>{money(it.priceInCents * it.quantity)}</div>
        </div>
      ))}

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Subtotal setor</span>
        <b>{money(payload.totalInCents)}</b>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>Total pedido</span>
        <b>{money(payload.orderTotalInCents)}</b>
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div className="text-center" style={{ fontSize: 10, opacity: 0.7 }}>
        via {payload.sector} · {cols} cols · {width}
      </div>
      <div className="text-center" style={{ fontSize: 10, opacity: 0.5 }}>
        id: {payload.orderId.slice(-12)}
      </div>
    </div>
  );
}
