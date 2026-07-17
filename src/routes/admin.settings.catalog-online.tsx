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
  useCatalogSettings,
  useUpdateCatalogSettings,
} from "@/hooks/use-catalog-settings";
import { defaultCatalogSettings, type CatalogSettings } from "@/lib/catalog-settings-api";
import { CatalogDisplaySection } from "@/components/admin/settings/catalog/CatalogDisplaySection";
import { CatalogLayoutSection } from "@/components/admin/settings/catalog/CatalogLayoutSection";
import { CatalogCategorySection } from "@/components/admin/settings/catalog/CatalogCategorySection";
import { CatalogProductsSection } from "@/components/admin/settings/catalog/CatalogProductsSection";
import { CatalogOrganizationSection } from "@/components/admin/settings/catalog/CatalogOrganizationSection";
import { CatalogHighlightsSection } from "@/components/admin/settings/catalog/CatalogHighlightsSection";

import { CatalogSettingsPreview } from "@/components/admin/settings/catalog/CatalogSettingsPreview";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const searchSchema = z.object({
  storeId: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/admin/settings/catalog-online")({
  validateSearch: zodValidator(searchSchema),
  component: CatalogOnlineSettingsPage,
});

function CatalogOnlineSettingsPage() {
  const { storeId: urlStoreId } = Route.useSearch();
  const scope = useSelectedStore(urlStoreId || null);

  return (
    <AdminLayout
      title="Catálogo Online"
      subtitle="Controla como o cardápio público é apresentado aos clientes."
    >
      <SettingsLayout>
        <StoreScope scope={scope}>
          {(storeId) => <CatalogOnlineInner storeId={storeId} />}
        </StoreScope>
      </SettingsLayout>
    </AdminLayout>
  );
}

function CatalogOnlineInner({ storeId }: { storeId: string }) {
  const q = useCatalogSettings(storeId);
  const m = useUpdateCatalogSettings(storeId);

  const [state, setState] = useState<CatalogSettings | null>(null);
  const [initial, setInitial] = useState<CatalogSettings | null>(null);

  useEffect(() => {
    if (!q.data) return;
    const next: CatalogSettings = { ...defaultCatalogSettings, ...q.data.settings };
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

  const dirty = JSON.stringify(state) !== JSON.stringify(initial);

  const patch = <K extends keyof CatalogSettings>(
    key: K,
    partial: Partial<CatalogSettings[K]>,
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
      const res = await m.mutateAsync(state);
      toast.success("Configurações do catálogo salvas.");
      setInitial(res.settings);
      setState(res.settings);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  };

  const sections = (
    <div className="space-y-6">
      <CatalogDisplaySection
        value={state.display}
        onChange={(p) => patch("display", p)}
      />
      <CatalogLayoutSection
        value={state.layout}
        onChange={(v) => setState({ ...state, layout: v })}
      />
      <CatalogCategorySection
        value={state.category}
        onChange={(p) => patch("category", p)}
      />
      <CatalogProductsSection
        value={state.product}
        onChange={(p) => patch("product", p)}
      />
      <CatalogOrganizationSection
        productSort={state.productSort}
        categorySort={state.categorySort}
        onProductSort={(v) => setState({ ...state, productSort: v })}
        onCategorySort={(v) => setState({ ...state, categorySort: v })}
      />
      <CatalogHighlightsSection
        value={state.highlight}
        onChange={(p) => patch("highlight", p)}
      />
      
    </div>
  );

  return (
    <div className="pb-24">
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0">{sections}</div>

        {/* Desktop preview — protagonist */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Preview do cardápio
            </p>
            <div className="h-[calc(100vh-9rem)]">
              <CatalogSettingsPreview settings={state} />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Prévia ilustrativa. As alterações refletem em tempo real.
            </p>
          </div>
        </aside>
      </div>

      {/* Tablet: preview below sections */}
      <div className="mt-8 hidden md:block xl:hidden">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Preview
        </p>
        <div className="mx-auto h-[560px] max-w-md">
          <CatalogSettingsPreview settings={state} />
        </div>
      </div>

      {/* Mobile: accordion */}
      <div className="mt-6 md:hidden">
        <Accordion type="single" collapsible>
          <AccordionItem value="preview">
            <AccordionTrigger>Ver preview do cardápio</AccordionTrigger>
            <AccordionContent>
              <div className="h-[520px]">
                <CatalogSettingsPreview settings={state} />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <StickySaveBar
        visible={dirty}
        saving={m.isPending}
        onSave={onSave}
        onCancel={() => setState(initial)}
        updatedAt={q.data?.updatedAt ?? null}
      />
    </div>
  );
}
