import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin-layout";
import { SettingsLayout } from "@/components/admin/settings/SettingsLayout";
import { StoreScope } from "@/components/admin/settings/StoreScope";
import { StickySaveBar } from "@/components/admin/settings/StickySaveBar";
import { useSelectedStore } from "@/hooks/use-selected-store";
import {
  useCheckoutSettings,
  useUpdateCheckoutSettings,
} from "@/hooks/use-checkout-settings";
import {
  defaultCheckoutSettings,
  type CheckoutSettings,
} from "@/lib/checkout-settings-api";
import { CheckoutFlowSection } from "@/components/admin/settings/checkout/CheckoutFlowSection";
import { CheckoutCustomerSection } from "@/components/admin/settings/checkout/CheckoutCustomerSection";
import { CheckoutOrderSection } from "@/components/admin/settings/checkout/CheckoutOrderSection";
import { CheckoutPaymentSection } from "@/components/admin/settings/checkout/CheckoutPaymentSection";
import { CheckoutSummarySection } from "@/components/admin/settings/checkout/CheckoutSummarySection";
import { CheckoutConfirmationSection } from "@/components/admin/settings/checkout/CheckoutConfirmationSection";
import { CheckoutSettingsPreview } from "@/components/admin/settings/checkout/CheckoutSettingsPreview";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const searchSchema = z.object({
  storeId: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/admin/settings/checkout")({
  validateSearch: zodValidator(searchSchema),
  component: CheckoutSettingsPage,
});

function CheckoutSettingsPage() {
  const { storeId: urlStoreId } = Route.useSearch();
  const scope = useSelectedStore(urlStoreId || null);

  return (
    <AdminLayout
      title="Checkout"
      subtitle="Configure a experiência de finalização do pedido do cardápio digital."
    >
      <SettingsLayout>
        <StoreScope scope={scope}>
          {(storeId) => <CheckoutInner storeId={storeId} />}
        </StoreScope>
      </SettingsLayout>
    </AdminLayout>
  );
}

function CheckoutInner({ storeId }: { storeId: string }) {
  const q = useCheckoutSettings(storeId);
  const m = useUpdateCheckoutSettings(storeId);

  const [state, setState] = useState<CheckoutSettings | null>(null);
  const [initial, setInitial] = useState<CheckoutSettings | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const next: CheckoutSettings = {
      ...defaultCheckoutSettings,
      ...q.data,
      flow: { ...defaultCheckoutSettings.flow, ...q.data.flow },
      customer: { ...defaultCheckoutSettings.customer, ...q.data.customer },
      order: { ...defaultCheckoutSettings.order, ...q.data.order },
      payment: { ...defaultCheckoutSettings.payment, ...q.data.payment },
      change: { ...defaultCheckoutSettings.change, ...q.data.change },
      summary: { ...defaultCheckoutSettings.summary, ...q.data.summary },
      confirmation: {
        ...defaultCheckoutSettings.confirmation,
        ...q.data.confirmation,
      },
    };
    setState(next);
    setInitial(next);
  }, [q.data]);

  if (q.isLoading || !state || !initial) {
    return (
      <div className="space-y-6">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
          >
            <div className="mb-4 h-4 w-40 animate-pulse rounded bg-muted/60" />
            <div className="mb-6 h-3 w-64 animate-pulse rounded bg-muted/40" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-10 animate-pulse rounded-md bg-muted/40" />
              <div className="h-10 animate-pulse rounded-md bg-muted/40" />
              <div className="h-10 animate-pulse rounded-md bg-muted/40" />
              <div className="h-10 animate-pulse rounded-md bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (q.isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        Não foi possível carregar as configurações de checkout.
      </div>
    );
  }

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const patch = <K extends keyof CheckoutSettings>(
    key: K,
    partial: Partial<CheckoutSettings[K]>,
  ) => {
    setState((prev) =>
      prev
        ? {
            ...prev,
            [key]:
              typeof prev[key] === "object" && prev[key] !== null
                ? { ...(prev[key] as object), ...(partial as object) }
                : partial,
          }
        : prev,
    );
  };

  const onSave = async () => {
    try {
      await m.mutateAsync(state);
      toast.success("Configurações do checkout salvas com sucesso.");
      setInitial(state);
    } catch {
      toast.error("Não foi possível salvar as configurações do checkout.");
    }
  };

  const sections = (
    <div className="space-y-6">
      <CheckoutFlowSection value={state.flow} onChange={(p) => patch("flow", p)} />
      <CheckoutCustomerSection value={state.customer} onChange={(p) => patch("customer", p)} />
      <CheckoutOrderSection value={state.order} onChange={(p) => patch("order", p)} />
      <CheckoutPaymentSection
        payment={state.payment}
        change={state.change}
        onPaymentChange={(p) => patch("payment", p)}
        onChangeChange={(p) => patch("change", p)}
      />
      <CheckoutSummarySection value={state.summary} onChange={(p) => patch("summary", p)} />
      <CheckoutConfirmationSection
        value={state.confirmation}
        onChange={(p) => patch("confirmation", p)}
      />
    </div>
  );

  return (
    <div className="pb-24">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">{sections}</div>

        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview
            </p>
            <CheckoutSettingsPreview settings={state} />
            <p className="text-[10px] text-muted-foreground">
              Prévia ilustrativa. As alterações refletem em tempo real.
            </p>
          </div>
        </aside>
      </div>

      <div className="mt-8 hidden md:block xl:hidden">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </p>
        <div className="max-w-md">
          <CheckoutSettingsPreview settings={state} />
        </div>
      </div>

      <div className="mt-6 md:hidden">
        <Accordion type="single" collapsible>
          <AccordionItem value="preview">
            <AccordionTrigger>Ver preview do checkout</AccordionTrigger>
            <AccordionContent>
              <CheckoutSettingsPreview settings={state} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <StickySaveBar
        visible={dirty}
        saving={m.isPending}
        onSave={onSave}
        onCancel={() => setState(initial)}
      />
    </div>
  );
}
