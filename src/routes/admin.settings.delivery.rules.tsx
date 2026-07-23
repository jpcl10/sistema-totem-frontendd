import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import { ArrowLeft, Plus } from "lucide-react";
import { AdminLayout } from "@/components/admin-layout";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { SettingsSection } from "@/components/admin/settings/SettingsSection";
import { StoreScope } from "@/components/admin/settings/StoreScope";
import { useSelectedStore } from "@/hooks/use-selected-store";
import { Button } from "@/components/ui/button";
import { DeliveryRulesTable } from "@/components/admin/settings/DeliveryRulesTable";
import {
  DeliveryRuleDialog,
  type DeliveryRuleFormValues,
} from "@/components/admin/settings/DeliveryRuleDialog";
import {
  useDeliveryFeeRules,
  useCreateDeliveryFeeRule,
  useUpdateDeliveryFeeRule,
  useDeleteDeliveryFeeRule,
} from "@/hooks/use-store-settings";
import type { DeliveryFeeRule } from "@/lib/settings-api";

const searchSchema = z.object({
  storeId: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/admin/settings/delivery/rules")({
  validateSearch: zodValidator(searchSchema),
  component: DeliveryRulesPage,
});

function DeliveryRulesPage() {
  const { storeId: urlStoreId } = Route.useSearch();
  const scope = useSelectedStore(urlStoreId || null);

  return (
    <AdminLayout
      title="Regras de taxa"
      subtitle="Fixas ou por bairro, com taxa e estimativa de entrega."
    >
      <SettingsLayout>
        <StoreScope scope={scope}>
          {(storeId) => <DeliveryRulesInner storeId={storeId} />}
        </StoreScope>
      </SettingsLayout>
    </AdminLayout>
  );
}

function DeliveryRulesInner({ storeId }: { storeId: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryFeeRule | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DeliveryFeeRule | null>(null);

  const rulesQ = useDeliveryFeeRules(storeId);
  const createM = useCreateDeliveryFeeRule(storeId);
  const updateM = useUpdateDeliveryFeeRule(storeId);
  const deleteM = useDeleteDeliveryFeeRule(storeId);

  useEffect(() => {
    if (rulesQ.error) {
      toast.error("Não foi possível carregar as regras de taxa.");
    }
  }, [rulesQ.error]);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (rule: DeliveryFeeRule) => {
    setEditing(rule);
    setDialogOpen(true);
  };

  const submitting = createM.isPending || updateM.isPending;

  const handleSubmit = async (values: DeliveryRuleFormValues) => {
    try {
      if (editing) {
        await updateM.mutateAsync({
          ruleId: editing.id,
          body: {
            name: values.name.trim(),
            type: values.type,
            neighborhood: values.neighborhood,
            feeInCents: values.feeInCents,
            estimatedMinutes: values.estimatedMinutes,
            minimumOrderInCents: values.minimumOrderInCents,
            freeDeliveryAboveInCents: values.freeDeliveryAboveInCents,
            active: values.active,
            sortOrder: values.sortOrder,
          },
        });
        toast.success("Regra atualizada com sucesso.");
      } else {
        await createM.mutateAsync({
          name: values.name.trim(),
          type: values.type,
          neighborhood: values.neighborhood,
          feeInCents: values.feeInCents,
          estimatedMinutes: values.estimatedMinutes,
          minimumOrderInCents: values.minimumOrderInCents,
          freeDeliveryAboveInCents: values.freeDeliveryAboveInCents,
          active: values.active,
          sortOrder: values.sortOrder,
        });
        toast.success("Regra criada com sucesso.");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Não foi possível salvar a regra.");
    }
  };

  const handleDelete = async (rule: DeliveryFeeRule) => {
    setPendingDelete(rule);
    try {
      await deleteM.mutateAsync(rule.id);
      toast.success("Regra removida com sucesso.");
    } catch {
      toast.error("Não foi possível remover a regra.");
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm">
          <Link
            to="/admin/settings/delivery"
            search={{ storeId } as never}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Link>
        </Button>
        <Button onClick={openCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Nova regra
        </Button>
      </div>

      <SettingsSection
        title="Regras de taxa"
        description="Bairros têm precedência sobre regras fixas."
      >
        <DeliveryRulesTable
          rules={rulesQ.data?.rules ?? []}
          loading={rulesQ.isLoading || !!pendingDelete}
          onCreate={openCreate}
          onEdit={openEdit}
          onDelete={handleDelete}
        />
      </SettingsSection>

      <DeliveryRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={handleSubmit}
        submitting={submitting}
      />
    </div>
  );
}
