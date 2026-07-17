import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Order } from "@/lib/orders-api";
import { orderLabel } from "./helpers";

export function CancelOrderDialog({
  order,
  reason,
  onReasonChange,
  busy,
  onClose,
  onConfirm,
}: {
  order: Order | null;
  reason: string;
  onReasonChange: (v: string) => void;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={!!order}
      onOpenChange={(o: boolean) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Cancelar pedido {order ? orderLabel(order) : ""}
          </DialogTitle>
          <DialogDescription>
            Informe o motivo do cancelamento. O estoque dos itens será devolvido
            automaticamente e o pedido permanecerá no histórico.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="cancel-reason"
          >
            Motivo
          </label>
          <Textarea
            id="cancel-reason"
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              onReasonChange(e.target.value)
            }
            placeholder="Ex.: cliente desistiu, item indisponível..."
            rows={4}
            disabled={busy}
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Voltar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={busy || !reason.trim()}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Confirmar cancelamento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
