import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

import { handleApiError } from "@/lib/api-error";
import { qk } from "@/lib/query-keys";
import {
  listCatalogProductOptionGroups,
  createCatalogProductOptionGroup,
  updateCatalogOptionGroup,
  setCatalogOptionGroupStatus,
  createCatalogOption,
  updateCatalogOption,
  setCatalogOptionStatus,
  type CatalogProduct,
  type CatalogProductOption,
  type CatalogProductOptionGroup,
} from "@/lib/catalog-api";

import { GroupForm } from "./catalog/option-groups/group-form";
import { OptionForm } from "./catalog/option-groups/option-form";
import { GroupRow } from "./catalog/option-groups/group-row";

interface Props {
  token: string | null;
  organizationId: string | null;
  productId: string;
  catalogProducts: CatalogProduct[];
  productPriceBaseInCents?: number;
}

export function CatalogOptionGroupsManager({
  token,
  organizationId,
  productId,
  catalogProducts,
  productPriceBaseInCents = 0,
}: Props) {
  const queryClient = useQueryClient();
  const queryKey = qk.catalog.productOptionGroups(organizationId, productId);

  const enabled = Boolean(token && organizationId && productId);
  const q = useQuery({
    queryKey,
    enabled,
    queryFn: () => listCatalogProductOptionGroups(token!, productId, organizationId),
    staleTime: 30_000,
  });

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openNewGroup, setOpenNewGroup] = useState(false);
  const [editingGroup, setEditingGroup] =
    useState<CatalogProductOptionGroup | null>(null);
  const [newOptionGroup, setNewOptionGroup] =
    useState<CatalogProductOptionGroup | null>(null);
  const [editingOption, setEditingOption] = useState<
    { option: CatalogProductOption; groupId: string } | null
  >(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({
      queryKey: qk.catalog.products(organizationId),
    });
  };

  const toggleGroupStatus = async (g: CatalogProductOptionGroup) => {
    if (!token || !organizationId) return;
    const next = !(g.active !== false);
    if (!next) {
      const ok = window.confirm(
        "Tem certeza de que deseja desativar este grupo de opções?\n\nEle deixará de aparecer em novos pedidos, mas pedidos antigos manterão seus registros.",
      );
      if (!ok) return;
    }
    try {
      await setCatalogOptionGroupStatus(token, g.id, next, organizationId);
      toast.success(next ? "Grupo ativado com sucesso." : "Grupo desativado com sucesso.");
      await invalidate();
    } catch (e) {
      handleApiError(e, "Não foi possível alterar o status do grupo.");
    }
  };

  const toggleOptionStatus = async (o: CatalogProductOption) => {
    if (!token || !organizationId) return;
    const next = !(o.active !== false);
    if (!next) {
      const ok = window.confirm(
        "Tem certeza de que deseja desativar esta opção?\n\nEla deixará de aparecer em novos pedidos.",
      );
      if (!ok) return;
    }
    try {
      await setCatalogOptionStatus(token, o.id, next, organizationId);
      toast.success(next ? "Opção ativada com sucesso." : "Opção desativada com sucesso.");
      await invalidate();
    } catch (e) {
      handleApiError(e, "Não foi possível alterar o status da opção.");
    }
  };

  const groups = useMemo(
    () =>
      [...(q.data ?? [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
      ),
    [q.data],
  );

  if (!enabled) {
    return (
      <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Sem organização ativa. Selecione uma organização para gerenciar grupos.
      </p>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Grupos e opções deste produto (aplicam-se a todos os eventos).
          </p>
          <Button size="sm" onClick={() => setOpenNewGroup(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar grupo
          </Button>
        </div>

        {q.isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...
          </div>
        ) : q.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4" />
            <span>{handleApiError(q.error, "Não foi possível carregar os grupos de opções.", { silent: true })}</span>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum grupo de opções cadastrado.
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <GroupRow
                key={g.id}
                group={g}
                isOpen={!!expanded[g.id]}
                onToggle={() =>
                  setExpanded((s) => ({ ...s, [g.id]: !s[g.id] }))
                }
                onAddOption={() => setNewOptionGroup(g)}
                onEditGroup={() => setEditingGroup(g)}
                onToggleGroupStatus={() => toggleGroupStatus(g)}
                onEditOption={(o) =>
                  setEditingOption({ option: o, groupId: g.id })
                }
                onToggleOptionStatus={toggleOptionStatus}
                catalogProducts={catalogProducts}
                productPriceBaseInCents={productPriceBaseInCents}
              />
            ))}
          </div>
        )}

        <Dialog open={openNewGroup} onOpenChange={setOpenNewGroup}>
          {openNewGroup && (
            <GroupForm
              title="Novo grupo de opções"
              token={token}
              initial={null}
              onCancel={() => setOpenNewGroup(false)}
              onSubmit={async (values) => {
                await createCatalogProductOptionGroup(
                  token!,
                  productId,
                  values,
                  organizationId,
                );
                toast.success("Grupo criado");
                setOpenNewGroup(false);
                await invalidate();
              }}
            />
          )}
        </Dialog>

        <Dialog
          open={!!editingGroup}
          onOpenChange={(o) => !o && setEditingGroup(null)}
        >
          {editingGroup && (
            <GroupForm
              title="Editar grupo de opções"
              token={token}
              initial={editingGroup}
              onCancel={() => setEditingGroup(null)}
              onSubmit={async (values) => {
                await updateCatalogOptionGroup(
                  token!,
                  editingGroup.id,
                  values,
                  organizationId,
                );
                toast.success("Grupo atualizado");
                setEditingGroup(null);
                await invalidate();
              }}
            />
          )}
        </Dialog>

        <Dialog
          open={!!newOptionGroup}
          onOpenChange={(o) => !o && setNewOptionGroup(null)}
        >
          {newOptionGroup && (
            <OptionForm
              title={`Nova opção em ${newOptionGroup.name}`}
              token={token}
              initial={null}
              catalogProducts={catalogProducts}
              onCancel={() => setNewOptionGroup(null)}
              onSubmit={async (values) => {
                await createCatalogOption(token!, newOptionGroup.id, values, organizationId);
                toast.success("Opção criada");
                setNewOptionGroup(null);
                await invalidate();
              }}
            />
          )}
        </Dialog>

        <Dialog
          open={!!editingOption}
          onOpenChange={(o) => !o && setEditingOption(null)}
        >
          {editingOption && (
            <OptionForm
              title="Editar opção"
              token={token}
              initial={editingOption.option}
              catalogProducts={catalogProducts}
              onCancel={() => setEditingOption(null)}
              onSubmit={async (values) => {
                await updateCatalogOption(
                  token!,
                  editingOption.option.id,
                  values,
                  organizationId,
                );
                toast.success("Opção atualizada");
                setEditingOption(null);
                await invalidate();
              }}
            />
          )}
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
