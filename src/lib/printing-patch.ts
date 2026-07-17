import type {
  EffectivePrintingSettings,
  OrganizationPrintingSettings,
  PrintingSector,
  PrintingSectorConfig,
  PrintingSource,
  PrintingSourceConfig,
  PrinterPaperSize,
  UpdatePrintingSettingsBody,
} from "./settings-api";

/**
 * Fase 2D — Estado de formulário para /admin/settings/printing.
 * Mapeia 1-para-1 com o contrato do backend em
 * docs/api/printing-settings-contracts.md — nenhuma abstração inventada.
 */
export interface PrintingFormState {
  printingEnabled: boolean;
  autoPrintEnabled: boolean;
  allowReprint: boolean;
  splitBySector: boolean;
  mergeCopies: boolean;

  defaultPrinterDeviceId: string | null;
  kitchenPrinterDeviceId: string | null;
  barPrinterDeviceId: string | null;
  expeditionPrinterDeviceId: string | null;

  paperSize: PrinterPaperSize;

  showLogo: boolean;
  showPrices: boolean;
  showQrCode: boolean;
  showPayment: boolean;
  showOrderSource: boolean;
  showOrderNotes: boolean;
  showItemNotes: boolean;
  showOptions: boolean;

  sources: Record<PrintingSource, PrintingSourceConfig>;
  sectors: Record<PrintingSector, PrintingSectorConfig>;

  [k: string]: unknown;
}

export const PRINTING_SOURCES: PrintingSource[] = [
  "ONLINE_STORE",
  "MANUAL_STORE",
  "EVENT",
  "MANUAL_EVENT",
  "TOTEM",
  "POS",
  "API",
  "WAITER",
];

export const PRINTING_SECTORS: PrintingSector[] = ["COOK", "BAR", "GENERAL"];

const DEFAULT_SOURCE: PrintingSourceConfig = {
  enabled: false,
  autoPrint: false,
  printMode: "FULL_ORDER",
};
const DEFAULT_SECTOR: PrintingSectorConfig = { enabled: false };

/**
 * Hidrata o estado do formulário a partir da resposta oficial.
 * Preferimos `effective` (sempre completo). Quando `settings` existe,
 * seus valores sobrescrevem, preservando IDs.
 */
export function hydratePrintingForm(response: {
  settings: OrganizationPrintingSettings | null;
  effective: EffectivePrintingSettings;
}): PrintingFormState {
  const eff = response.effective;
  const s = response.settings ?? {};
  const pick = <K extends keyof OrganizationPrintingSettings>(
    key: K,
    fallback: NonNullable<OrganizationPrintingSettings[K]>,
  ): NonNullable<OrganizationPrintingSettings[K]> =>
    (s[key] ?? eff[key] ?? fallback) as NonNullable<OrganizationPrintingSettings[K]>;

  const sources = {} as Record<PrintingSource, PrintingSourceConfig>;
  for (const k of PRINTING_SOURCES) {
    sources[k] = { ...DEFAULT_SOURCE, ...(eff.sources?.[k] ?? {}), ...(s.sources?.[k] ?? {}) };
  }
  const sectors = {} as Record<PrintingSector, PrintingSectorConfig>;
  for (const k of PRINTING_SECTORS) {
    sectors[k] = { ...DEFAULT_SECTOR, ...(eff.sectors?.[k] ?? {}), ...(s.sectors?.[k] ?? {}) };
  }

  const idOrNull = (k: keyof OrganizationPrintingSettings): string | null => {
    const v = (s[k] ?? eff[k]) as string | null | undefined;
    return v ?? null;
  };

  return {
    printingEnabled: pick("printingEnabled", false),
    autoPrintEnabled: pick("autoPrintEnabled", false),
    allowReprint: pick("allowReprint", true),
    splitBySector: pick("splitBySector", false),
    mergeCopies: pick("mergeCopies", false),

    defaultPrinterDeviceId: idOrNull("defaultPrinterDeviceId"),
    kitchenPrinterDeviceId: idOrNull("kitchenPrinterDeviceId"),
    barPrinterDeviceId: idOrNull("barPrinterDeviceId"),
    expeditionPrinterDeviceId: idOrNull("expeditionPrinterDeviceId"),

    paperSize: pick("paperSize", "80mm"),

    showLogo: pick("showLogo", true),
    showPrices: pick("showPrices", true),
    showQrCode: pick("showQrCode", false),
    showPayment: pick("showPayment", true),
    showOrderSource: pick("showOrderSource", true),
    showOrderNotes: pick("showOrderNotes", true),
    showItemNotes: pick("showItemNotes", true),
    showOptions: pick("showOptions", true),

    sources,
    sectors,
  };
}

const TOP_LEVEL_KEYS: readonly (keyof PrintingFormState & keyof UpdatePrintingSettingsBody)[] = [
  "printingEnabled",
  "autoPrintEnabled",
  "allowReprint",
  "splitBySector",
  "mergeCopies",
  "defaultPrinterDeviceId",
  "kitchenPrinterDeviceId",
  "barPrinterDeviceId",
  "expeditionPrinterDeviceId",
  "paperSize",
  "showLogo",
  "showPrices",
  "showQrCode",
  "showPayment",
  "showOrderSource",
  "showOrderNotes",
  "showItemNotes",
  "showOptions",
] as const;

/**
 * Constrói o PATCH parcial enviado ao backend, contendo APENAS os campos
 * que mudaram entre `snapshot` e `values`. Segue estritamente o contrato:
 * sem `printMode` no root; sem `printerDeviceIds`.
 */
export function buildPrintingPatch(
  snapshot: PrintingFormState,
  values: PrintingFormState,
): UpdatePrintingSettingsBody {
  const patch: UpdatePrintingSettingsBody = {};

  for (const key of TOP_LEVEL_KEYS) {
    if (snapshot[key] !== values[key]) {
      // TS: cada key é compatível entre form e body.
      (patch as Record<string, unknown>)[key] = values[key];
    }
  }

  const sourcesPatch: Partial<Record<PrintingSource, Partial<PrintingSourceConfig>>> = {};
  for (const k of PRINTING_SOURCES) {
    const before = snapshot.sources[k];
    const after = values.sources[k];
    const diff: Partial<PrintingSourceConfig> = {};
    if (before.enabled !== after.enabled) diff.enabled = after.enabled;
    if (before.autoPrint !== after.autoPrint) diff.autoPrint = after.autoPrint;
    if (before.printMode !== after.printMode) diff.printMode = after.printMode;
    if (Object.keys(diff).length > 0) sourcesPatch[k] = diff;
  }
  if (Object.keys(sourcesPatch).length > 0) patch.sources = sourcesPatch;

  const sectorsPatch: Partial<Record<PrintingSector, Partial<PrintingSectorConfig>>> = {};
  for (const k of PRINTING_SECTORS) {
    if (snapshot.sectors[k].enabled !== values.sectors[k].enabled) {
      sectorsPatch[k] = { enabled: values.sectors[k].enabled };
    }
  }
  if (Object.keys(sectorsPatch).length > 0) patch.sectors = sectorsPatch;

  return patch;
}

/* -------------------------------------------------------------------------- */
/* Assertions do client — executam em DEV para garantir que o PATCH gerado    */
/* nunca contém `printMode` no root nem `printerDeviceIds`.                   */
/* -------------------------------------------------------------------------- */

function baseState(overrides: Partial<PrintingFormState> = {}): PrintingFormState {
  const sources = {} as Record<PrintingSource, PrintingSourceConfig>;
  for (const k of PRINTING_SOURCES) sources[k] = { ...DEFAULT_SOURCE };
  const sectors = {} as Record<PrintingSector, PrintingSectorConfig>;
  for (const k of PRINTING_SECTORS) sectors[k] = { ...DEFAULT_SECTOR };
  return {
    printingEnabled: false,
    autoPrintEnabled: false,
    allowReprint: true,
    splitBySector: false,
    mergeCopies: false,
    defaultPrinterDeviceId: null,
    kitchenPrinterDeviceId: null,
    barPrinterDeviceId: null,
    expeditionPrinterDeviceId: null,
    paperSize: "80mm",
    showLogo: true,
    showPrices: true,
    showQrCode: false,
    showPayment: true,
    showOrderSource: true,
    showOrderNotes: true,
    showItemNotes: true,
    showOptions: true,
    sources,
    sectors,
    ...overrides,
  };
}

export function runPrintingPatchAssertions(): void {
  const snap = baseState();
  const assertNoBadKeys = (obj: Record<string, unknown>, label: string) => {
    if ("printMode" in obj) throw new Error(`[printing-patch] ${label}: printMode at root`);
    if ("printerDeviceIds" in obj)
      throw new Error(`[printing-patch] ${label}: printerDeviceIds present`);
  };

  // 1. toggle global
  let p = buildPrintingPatch(snap, baseState({ printingEnabled: true }));
  if (p.printingEnabled !== true) throw new Error("toggle global");
  assertNoBadKeys(p as unknown as Record<string, unknown>, "toggle global");

  // 2. device padrão
  p = buildPrintingPatch(snap, baseState({ defaultPrinterDeviceId: "dev_1" }));
  if (p.defaultPrinterDeviceId !== "dev_1") throw new Error("device padrão");
  assertNoBadKeys(p as unknown as Record<string, unknown>, "device padrão");

  // 3. remover device
  const withKitchen = baseState({ kitchenPrinterDeviceId: "dev_k" });
  p = buildPrintingPatch(withKitchen, baseState({ kitchenPrinterDeviceId: null }));
  if (p.kitchenPrinterDeviceId !== null) throw new Error("remover device");
  assertNoBadKeys(p as unknown as Record<string, unknown>, "remover device");

  // 4. origem TOTEM
  const nextTotem = baseState();
  nextTotem.sources.TOTEM = { enabled: true, autoPrint: true, printMode: "FULL_ORDER" };
  p = buildPrintingPatch(snap, nextTotem);
  if (!p.sources?.TOTEM || p.sources.TOTEM.printMode !== "FULL_ORDER")
    throw new Error("origem TOTEM");
  assertNoBadKeys(p as unknown as Record<string, unknown>, "origem TOTEM");

  // 5. origem ONLINE_STORE
  const nextOs = baseState();
  nextOs.sources.ONLINE_STORE = { enabled: true, autoPrint: false, printMode: "BY_SECTOR" };
  p = buildPrintingPatch(snap, nextOs);
  if (p.sources?.ONLINE_STORE?.printMode !== "BY_SECTOR") throw new Error("origem ONLINE_STORE");
  assertNoBadKeys(p as unknown as Record<string, unknown>, "origem ONLINE_STORE");

  // 6. setor COOK
  const nextCook = baseState();
  nextCook.sectors.COOK = { enabled: true };
  p = buildPrintingPatch(snap, nextCook);
  if (p.sectors?.COOK?.enabled !== true) throw new Error("setor COOK");
  if (Array.isArray(p.sectors)) throw new Error("sectors não pode ser array");
  assertNoBadKeys(p as unknown as Record<string, unknown>, "setor COOK");

  // 7. layout showOptions
  p = buildPrintingPatch(snap, baseState({ showOptions: false }));
  if (p.showOptions !== false) throw new Error("showOptions");
  assertNoBadKeys(p as unknown as Record<string, unknown>, "showOptions");

  // 8/9. patch cheio nunca traz printMode/printerDeviceIds no root
  p = buildPrintingPatch(
    snap,
    baseState({
      printingEnabled: true,
      defaultPrinterDeviceId: "d1",
      kitchenPrinterDeviceId: "d2",
      showOptions: false,
    }),
  );
  assertNoBadKeys(p as unknown as Record<string, unknown>, "patch cheio");
}

if (import.meta.env?.DEV) {
  try {
    runPrintingPatchAssertions();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
}
