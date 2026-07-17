import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handleApiError, ApiError } from "@/lib/api-error";
import { useAuth } from "@/lib/auth-context";
import {
  markUnifiedOrderPayment,
  type Order,
  type UnifiedOrderDTO,
} from "@/lib/orders-api";
import { qk } from "@/lib/query-keys";
import { useOrgId } from "@/hooks/use-org-id";
import type { AdaptedOrder } from "./unified-adapter";
import { unifiedToKanbanOrder } from "./unified-adapter";
import {
  UNIVERSAL_PAYMENT_OPTIONS,
  mapUniversalPaymentMethod,
  type UniversalPaymentMethod,
} from "./payment-method-mapper";

import { orderLabel, totalCents } from "./helpers";

export function MarkPaymentDialog({
  order,
  onClose,
  onSuccess,
}: {
  order: Order | null;
  onClose: () => void;
  onSuccess: (updated: Order) => void;
}) {
  const { token } = useAuth();
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [method, setMethod] = useState<UniversalPaymentMethod>("PIX");
  const [amount, setAmount] = useState("");
  const [changeFor, setChangeFor] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (order) {
      const total = totalCents(order) / 100;
      setAmount(total.toFixed(2));
      setChangeFor("");
      setNotes("");
      setMethod("PIX");
    }
  }, [order]);

  const adapted = order as AdaptedOrder | null;
  const endpoint = adapted?.__unifiedActionEndpoints?.payment ?? null;
  const orderType = adapted?.__unifiedOrderType ?? null;
  const nativeId = adapted?.__unifiedNativeId ?? null;
  const canSubmit = !!endpoint || (!!orderType && !!nativeId);

  const handleSubmit = async () => {
    if (!token || !order || busy) return;
    if (!canSubmit) {
      toast.error(
        "Este pedido não expõe rota de pagamento. Recarregue a lista e tente novamente.",
      );
      return;
    }
    setBusy(true);
    try {
      const isCash = method === "CASH";
      const amountCents = amount
        ? Math.round(parseFloat(amount.replace(",", ".")) * 100)
        : undefined;
      const changeCents = changeFor
        ? Math.round(parseFloat(changeFor.replace(",", ".")) * 100)
        : null;

      const mappedMethod = mapUniversalPaymentMethod(orderType, method);
      if (!mappedMethod) {
        setBusy(false);
        toast.error("Forma de pagamento incompatível com este tipo de pedido.");
        return;
      }

      const dto = await markUnifiedOrderPayment(token, {
        endpoint,
        orderType: orderType ?? undefined,
        nativeId: nativeId ?? undefined,
        paymentStatus: "PAID",
        paymentMethod: mappedMethod,
        amountReceivedInCents: isCash ? amountCents : undefined,
        changeInCents: isCash ? changeCents : null,
      });

      // Ensure caller receives an already-adapted Order.
      const updated: AdaptedOrder = (() => {
        try {
          return unifiedToKanbanOrder(dto as UnifiedOrderDTO);
        } catch {
          return { ...(order as AdaptedOrder), paymentStatus: "PAID" };
        }
      })();

      queryClient.invalidateQueries({
        queryKey: qk.orders.unified(orgId),
      });
      queryClient.invalidateQueries({
        queryKey: qk.orders.detail(orgId, order.id),
      });

      toast.success("Pagamento confirmado.");
      onSuccess(updated);
      onClose();
      void notes; // reserved: backend does not accept payment notes here.
    } catch (e) {
      const status = e instanceof ApiError ? e.status : 0;
      if (status === 404) {
        toast.error("Este pedido não existe mais ou foi removido.");
        queryClient.invalidateQueries({ queryKey: qk.orders.unified(orgId) });
        onClose();
      } else if (status === 409) {
        const msg =
          e instanceof ApiError && e.message
            ? e.message
            : "O estado do pagamento foi alterado. Atualizamos o pedido.";
        toast.error(msg);
        queryClient.invalidateQueries({ queryKey: qk.orders.unified(orgId) });
      } else if (status === 403) {
        toast.error("Você não tem permissão para alterar este pedido.");
      } else if (status === 400) {
        handleApiError(
          e,
          "Não foi possível confirmar o pagamento com os dados informados.",
        );
      } else {
        handleApiError(e, "Não foi possível confirmar o pagamento.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Marcar pagamento - {order ? orderLabel(order) : ""}
          </DialogTitle>
          <DialogDescription>
            Confirme o recebimento do valor deste pedido.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="method">Forma de pagamento</Label>
            <Select
              value={method}
              onValueChange={(v) => setMethod(v as UniversalPaymentMethod)}
            >
              <SelectTrigger id="method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[100]">
                {UNIVERSAL_PAYMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Valor recebido (R$)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="change">Troco para (R$)</Label>
              <Input
                id="change"
                type="number"
                step="0.01"
                placeholder="Opcional"
                value={changeFor}
                onChange={(e) => setChangeFor(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Observação</Label>
            <Textarea
              id="notes"
              placeholder="Opcional"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={busy || !amount || !canSubmit}
            className="bg-primary text-primary-foreground"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirmar Pagamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
