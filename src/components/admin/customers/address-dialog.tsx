import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { handleApiError } from "@/lib/api-error";
import {
  createCustomerAddress,
  updateCustomerAddress,
  type CustomerAddress,
} from "@/lib/customers-api";

export function AddressDialog({
  open,
  onOpenChange,
  customerId,
  address,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId: string;
  address?: CustomerAddress | null;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const editing = !!address;
  const [label, setLabel] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [reference, setReference] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLabel(address?.label ?? "");
      setRecipientName(address?.recipientName ?? "");
      setStreet(address?.street ?? "");
      setNumber(address?.number ?? "");
      setComplement(address?.complement ?? "");
      setNeighborhood(address?.neighborhood ?? "");
      setCity(address?.city ?? "");
      setState(address?.state ?? "");
      setPostalCode(address?.postalCode ?? "");
      setReference(address?.reference ?? "");
      setIsDefault(address?.isDefault ?? false);
    }
  }, [open, address]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!street.trim()) {
      toast.error("Informe o logradouro.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        label: label.trim() || null,
        recipientName: recipientName.trim() || null,
        street: street.trim(),
        number: number.trim() || null,
        complement: complement.trim() || null,
        neighborhood: neighborhood.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postalCode: postalCode.trim() || null,
        reference: reference.trim() || null,
        isDefault,
      };
      if (editing && address) {
        await updateCustomerAddress(token, customerId, address.id, payload);
        toast.success("Endereço atualizado");
      } else {
        await createCustomerAddress(token, customerId, payload);
        toast.success("Endereço criado");
      }
      onSaved();
    } catch (e2) {
      toast.error(handleApiError(e2));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar endereço" : "Novo endereço"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Rótulo</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Casa, Trabalho…" />
            </div>
            <div>
              <Label>Destinatário</Label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <Label>Logradouro</Label>
              <Input value={street} onChange={(e) => setStreet(e.target.value)} required />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Complemento</Label>
            <Input value={complement} onChange={(e) => setComplement(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Bairro</Label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div>
              <Label>UF</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} maxLength={2} />
            </div>
          </div>
          <div>
            <Label>Referência</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isDefault} onCheckedChange={setIsDefault} id="addr-default" />
            <Label htmlFor="addr-default" className="cursor-pointer">
              Endereço padrão
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
