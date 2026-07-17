import { useEffect, useState } from "react";
import { Loader2, MapPin, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { handleApiError } from "@/lib/api-error";
import {
  createCustomerAddress,
  listCustomerAddresses,
  type CustomerAddress,
} from "@/lib/customers-api";

export type PickedDelivery = {
  address: string;
  number: string;
  neighborhood: string;
  complement?: string;
  reference?: string;
};

type Props = {
  token: string;
  customerId: string;
  selectedAddressId: string | null;
  onChange: (
    value:
      | { mode: "saved"; addressId: string; delivery: PickedDelivery }
      | { mode: "new"; delivery: PickedDelivery }
      | { mode: "none" },
  ) => void;
};

function toDelivery(a: CustomerAddress): PickedDelivery {
  return {
    address: a.street,
    number: a.number ?? "",
    neighborhood: a.neighborhood ?? "",
    complement: a.complement ?? undefined,
    reference: a.reference ?? undefined,
  };
}

/**
 * Address picker for admin-authenticated flows (Venda Manual da Loja).
 *
 * Contract:
 * - Lists /customers/:id/addresses.
 * - Selecting a saved address emits { mode: "saved", addressId, delivery }
 *   so the caller can send customerAddressId AND display the values. The
 *   payload builder is expected to omit `delivery` when `addressId` is set
 *   (see online-store-api → createStoreManualSale).
 * - "+ Novo endereço" opens an inline form and POSTs to
 *   /customers/:id/addresses. On success the new address is auto-selected.
 */
export function CustomerAddressPicker({
  token,
  customerId,
  selectedAddressId,
  onChange,
}: Props) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PickedDelivery>({
    address: "",
    number: "",
    neighborhood: "",
    complement: "",
    reference: "",
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCustomerAddresses(token, customerId)
      .then((rows) => {
        if (cancelled) return;
        const active = rows.filter((a) => a.active !== false);
        setAddresses(active);
        // Auto-select default (or first) address on load.
        if (active.length > 0 && !selectedAddressId) {
          const def = active.find((a) => a.isDefault) ?? active[0];
          onChange({
            mode: "saved",
            addressId: def.id,
            delivery: toDelivery(def),
          });
        }
      })
      .catch(() => {
        if (!cancelled) setAddresses([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, customerId]);

  async function saveNew() {
    if (!draft.address.trim() || !draft.number.trim() || !draft.neighborhood.trim()) {
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomerAddress(token, customerId, {
        street: draft.address.trim(),
        number: draft.number.trim(),
        neighborhood: draft.neighborhood.trim(),
        complement: draft.complement?.trim() || null,
        reference: draft.reference?.trim() || null,
      });
      setAddresses((prev) => [...prev, created]);
      setCreating(false);
      setDraft({ address: "", number: "", neighborhood: "", complement: "", reference: "" });
      onChange({
        mode: "saved",
        addressId: created.id,
        delivery: toDelivery(created),
      });
    } catch (e) {
      handleApiError(e, "Não foi possível salvar o endereço.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando endereços…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {addresses.length === 0 && !creating && (
        <div className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
          Nenhum endereço cadastrado.
        </div>
      )}

      {addresses.map((a) => {
        const active = selectedAddressId === a.id && !creating;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() =>
              onChange({ mode: "saved", addressId: a.id, delivery: toDelivery(a) })
            }
            className={cn(
              "flex w-full items-start gap-2 rounded-xl border p-3 text-left text-sm transition",
              active
                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                : "border-border bg-card hover:border-primary/40",
            )}
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              {a.label && (
                <div className="truncate text-[11px] font-bold uppercase tracking-wide text-primary">
                  {a.label}
                </div>
              )}
              <div className="truncate font-semibold">
                {a.street}
                {a.number ? `, ${a.number}` : ""}
              </div>
              {a.neighborhood && (
                <div className="truncate text-xs text-muted-foreground">
                  {a.neighborhood}
                  {a.complement ? ` · ${a.complement}` : ""}
                </div>
              )}
            </div>
          </button>
        );
      })}

      {!creating ? (
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-3.5 w-3.5" /> Novo endereço
        </Button>
      ) : (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wide text-primary">
              Novo endereço
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => setCreating(false)}
              aria-label="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input
            placeholder="Endereço"
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            className="h-9"
          />
          <div className="grid grid-cols-[100px_1fr] gap-2">
            <Input
              placeholder="Nº"
              value={draft.number}
              onChange={(e) => setDraft((d) => ({ ...d, number: e.target.value }))}
              className="h-9"
            />
            <Input
              placeholder="Bairro"
              value={draft.neighborhood}
              onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))}
              className="h-9"
            />
          </div>
          <Input
            placeholder="Complemento (opcional)"
            value={draft.complement ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, complement: e.target.value }))}
            className="h-9"
          />
          <Input
            placeholder="Referência (opcional)"
            value={draft.reference ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, reference: e.target.value }))}
            className="h-9"
          />
          <Button
            type="button"
            className="w-full"
            disabled={
              saving ||
              !draft.address.trim() ||
              !draft.number.trim() ||
              !draft.neighborhood.trim()
            }
            onClick={saveNew}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar endereço"}
          </Button>
        </div>
      )}
    </div>
  );
}
