import { useEffect, useRef, useState } from "react";
import { Loader2, Search, UserRound, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listCustomers, type Customer } from "@/lib/customers-api";

type Props = {
  token: string;
  value: {
    id: string | null;
    name: string;
    phone: string;
  };
  onChange: (v: { id: string | null; name: string; phone: string }) => void;
};

/**
 * Compact customer picker used inside NewOrderDrawer.
 * - Phone-first search (min 4 digits) with debounce.
 * - When a match is found, the operator can reuse it in one click.
 * - Otherwise, name + phone are captured inline; NO customer is
 *   created here — the sale endpoint handles that server-side.
 */
export function CustomerPhoneSearch({ token, value, onChange }: Props) {
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (value.id) return; // already linked → don't re-search
    const digits = value.phone.replace(/\D/g, "");
    if (timer.current) clearTimeout(timer.current);
    if (digits.length < 4) {
      setResults([]);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const res = await listCustomers(token, {
          phone: digits,
          limit: 5,
          active: true,
        });
        setResults(res.data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setDirty(true);
      }
    }, 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value.phone, value.id, token]);

  const unlink = () =>
    onChange({ id: null, name: value.name, phone: value.phone });

  if (value.id) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2">
        <UserRound className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{value.name || "Cliente"}</div>
          <div className="truncate text-[11px] text-muted-foreground">{value.phone}</div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground"
          onClick={unlink}
          aria-label="Desvincular"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder="Telefone (11) 90000-0000"
          className="h-9 pl-8"
          inputMode="tel"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {results.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() =>
                onChange({
                  id: c.id,
                  name: c.name ?? "",
                  phone: c.phone ?? value.phone,
                })
              }
              className={cn(
                "flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/40",
              )}
            >
              <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {c.phone}
                </div>
              </div>
              <span className="text-[10px] font-semibold uppercase text-primary">
                Reutilizar
              </span>
            </button>
          ))}
        </div>
      )}

      {dirty && !loading && results.length === 0 && value.phone.replace(/\D/g, "").length >= 4 && (
        <>
          <div className="text-[11px] text-muted-foreground">
            Nenhum cliente encontrado. Informe o nome para seguir:
          </div>
          <Input
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
            placeholder="Nome do cliente"
            className="h-9"
          />
        </>
      )}
    </div>
  );
}
