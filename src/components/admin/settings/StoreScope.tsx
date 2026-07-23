import type { ReactNode } from "react";
import { Store } from "lucide-react";
import { PageLoading } from "@/components/admin/page/PageLoading";
import { PageError } from "@/components/admin/page/PageError";
import { PageEmpty } from "@/components/admin/page/PageEmpty";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { UseSelectedStoreResult } from "@/hooks/use-selected-store";
import { toFriendlyMessage } from "@/lib/api-error";

interface StoreScopeProps {
  scope: UseSelectedStoreResult;
  /** Rendered once a storeId is resolved. */
  children: (storeId: string) => ReactNode;
  /** Optional selector on top (also shown when multiple lojas). */
  showSelector?: boolean;
}

/**
 * Guards Loja Online / Delivery settings behind a resolved storeId.
 * Renders loading / empty / selector states with consistent visuals.
 * storeId is NEVER organizationId (backend contract).
 */
export function StoreScope({ scope, children, showSelector = true }: StoreScopeProps) {
  const { status, stores, storeId, select, error } = scope;

  if (status === "loading") return <PageLoading label="Carregando lojas…" />;
  if (status === "unauthenticated")
    return <PageError title="Sessão expirada" message="Entre novamente para acessar as configurações da loja." />;
  if (error)
    return (
      <PageError
        title="Não foi possível carregar as lojas"
        message={toFriendlyMessage(error, "Não foi possível carregar as lojas.")}
      />
    );
  if (status === "empty") {
    return (
      <PageEmpty
        icon={Store}
        title="Nenhuma loja cadastrada"
        description="Crie uma loja online antes de configurar loja online ou entrega."
        action={{ label: "Ir para loja online", href: "/admin/online-menu" }}
      />
    );
  }

  const needsPick = !storeId && stores.length > 1;

  return (
    <div className="space-y-4">
      {(showSelector || needsPick) && stores.length > 1 && (
        <div className="flex items-end gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <div className="min-w-[220px] flex-1">
            <Label className="mb-1 block text-xs">Loja</Label>
            <Select value={storeId ?? undefined} onValueChange={(v) => select(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma loja" />
              </SelectTrigger>
              <SelectContent>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {storeId ? (
        children(storeId)
      ) : (
        <PageEmpty
          icon={Store}
          title="Selecione uma loja"
          description="Escolha qual loja você deseja configurar acima."
        />
      )}
    </div>
  );
}
