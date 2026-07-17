import { useMemo, useState } from "react";
import { Loader2, Plus, Tags, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import {
  attachCustomerInterest,
  detachCustomerInterest,
  type Interest,
} from "@/lib/customers-api";

export function InterestsSection({
  customerId,
  linked,
  available,
  onChanged,
}: {
  customerId: string;
  linked: Interest[];
  available: Interest[];
  onChanged: () => void;
}) {
  const { token } = useAuth();
  const [adding, setAdding] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const linkedIds = useMemo(() => new Set(linked.map((l) => l.id)), [linked]);
  const options = available.filter((i) => !linkedIds.has(i.id));

  const attach = async () => {
    if (!token || !adding) return;
    setBusy(true);
    try {
      await attachCustomerInterest(token, customerId, adding, "MANUAL");
      setAdding("");
      onChanged();
    } catch (e) {
      toast.error(handleApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const detach = async (interestId: string) => {
    if (!token) return;
    try {
      await detachCustomerInterest(token, customerId, interestId);
      onChanged();
    } catch (e) {
      toast.error(handleApiError(e));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={adding} onValueChange={setAdding}>
          <SelectTrigger className="max-w-xs">
            <SelectValue placeholder="Selecione um interesse" />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem value="__none" disabled>
                Nenhum disponível
              </SelectItem>
            ) : (
              options.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button onClick={attach} disabled={!adding || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Vincular
        </Button>
      </div>

      {linked.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            <Tags className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhum interesse vinculado.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-2">
          {linked.map((i) => (
            <Badge key={i.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
              {i.name}
              <button
                type="button"
                onClick={() => detach(i.id)}
                className="ml-1 rounded-sm p-0.5 hover:bg-destructive/20"
                aria-label={`Remover ${i.name}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
