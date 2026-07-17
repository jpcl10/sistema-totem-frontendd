# Fase 2D — Printing settings contracts

Contrato oficial de `OrganizationPrintingSettings` consumido pelo
frontend em `/admin/settings/printing`.

## Endpoints

- `GET /settings/printing` → `{ settings, effective, source }`
  - `settings`: `OrganizationPrintingSettings | null` (linha persistida ou `null`).
  - `effective`: `OrganizationPrintingSettings` **completo** (defaults + persistido)
    com `sources` e `sectors` sempre populados com todas as chaves.
  - `source`: `"ORGANIZATION_PRINTING_SETTINGS" | "DEFAULT"`.
- `PATCH /settings/printing` → `{ settings, effective }`. Aceita partial.
  - `xxxPrinterDeviceId: null` remove a impressora daquela função.
- `GET /settings/effective` → inclui `effective.printing`.
- `GET /devices` → lista de dispositivos (filtrar `type === "PRINTER" || "SK210"`).

## Enums

```ts
type PrintingSource =
  | "ONLINE_STORE" | "MANUAL_STORE" | "EVENT" | "MANUAL_EVENT"
  | "TOTEM" | "POS" | "API" | "WAITER";

type PrintingSector = "COOK" | "BAR" | "GENERAL";

type PrintMode = "FULL_ORDER" | "BY_SECTOR" | "BOTH";
type PaperSize = "58mm" | "80mm";
```

## Shape

```ts
interface OrganizationPrintingSettings {
  printingEnabled?: boolean;
  autoPrintEnabled?: boolean;
  allowReprint?: boolean;
  splitBySector?: boolean;
  mergeCopies?: boolean;

  defaultPrinterDeviceId?: string | null;
  kitchenPrinterDeviceId?: string | null;
  barPrinterDeviceId?: string | null;
  expeditionPrinterDeviceId?: string | null;

  paperSize?: PaperSize;

  showLogo?: boolean;
  showPrices?: boolean;
  showQrCode?: boolean;
  showPayment?: boolean;
  showOrderSource?: boolean;
  showOrderNotes?: boolean;
  showItemNotes?: boolean;
  showOptions?: boolean;

  sources?: Partial<Record<PrintingSource, {
    enabled: boolean;
    autoPrint: boolean;
    printMode: PrintMode;
  }>>;

  sectors?: Partial<Record<PrintingSector, { enabled: boolean }>>;
}
```

### Regras críticas

- **`printMode` NÃO existe no root.** Só em `sources.<PrintingSource>.printMode`.
- **`printerDeviceIds` não existe** — o vínculo é feito pelos quatro
  IDs individuais (`defaultPrinterDeviceId`, `kitchenPrinterDeviceId`,
  `barPrinterDeviceId`, `expeditionPrinterDeviceId`).
- `sources` e `sectors` são `Record`, nunca array.

## Exemplos de PATCH

Toggle global:
```json
{ "printingEnabled": true }
```

Trocar impressora da cozinha:
```json
{ "kitchenPrinterDeviceId": "cuid" }
```

Remover impressora da cozinha:
```json
{ "kitchenPrinterDeviceId": null }
```

Origem TOTEM:
```json
{ "sources": { "TOTEM": { "autoPrint": true, "printMode": "FULL_ORDER" } } }
```

Setor COOK:
```json
{ "sectors": { "COOK": { "enabled": true } } }
```

## Device (campos consumidos pela UI)

`id`, `name`, `code`, `type` (`PRINTER` ou `SK210`), `status`,
`authStatus`, `lastHeartbeatAt`, `storeId`, `eventId`, `metadata`.

Nunca expor `tokenHash` / `deviceSecretHash`.

## Hidratação

- Sempre partir de `response.effective` (garante todas as chaves de
  `sources`/`sectors`).
- Sobrescrever com `response.settings` quando existir.
- Após PATCH, resetar com a resposta completa (`effective`), nunca com o
  patch parcial.

## Invalidations após PATCH

- `qk.settings.printing(orgId)`
- `qk.settings.root(orgId)`
- `qk.settings.effective(orgId)`
