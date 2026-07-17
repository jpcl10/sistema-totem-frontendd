# Guello's Pizza — Frontend Go-Live Readiness

> Auditoria estática do frontend Defumar (sem alterações de código). Baseada no
> estado real dos arquivos em `src/` e nas rotas registradas em
> `src/routeTree.gen.ts`. Complementa o relatório backend (status NO-GO).
>
> **Veredito frontend:** **NO-GO** — bloqueadores em Dispositivos (sem escopo
> de loja), Impressão (dependente de tela legada de evento), Configurações
> mockadas (Catálogo Online e Checkout via `localStorage`) e Pagamentos
> (métodos exibidos sem suporte real).

---

## Resumo executivo

- **P0 (bloqueia produção):** 7
- **P1 (corrigir antes da abertura):** 9
- **P2 (pode entrar depois):** 6
- **Fluxos prontos:** login/guard, cardápio público (`/p/:slug`), Central de
  Pedidos (Kanban unificado + Socket.IO + polling), venda manual de loja
  (payload sem preço), Configurações Organização/Branding/Horários/Loja
  Online/Delivery.
- **Fluxos parciais:** Checkout público (exibe métodos sem MP real), Totem
  (Home/Header V2 refeitos, catálogo/carrinho/PIX ainda legados).
- **Fluxos mockados/localStorage:** Catálogo Online (`catalog-settings-api.ts`),
  Checkout (`checkout-settings-api.ts`). Não persistem no backend.
- **Configurações essenciais que não persistem:** printing/autoPrint por loja,
  método de pagamento aceito por loja, catálogo online (destaques/layout),
  checkout (fluxo/troco/pagamento por loja).
- **Guello's sem Totem:** **SIM** — pode ir ao ar sem Totem (loja delivery
  clássica). Totem só desbloqueia se houver dispositivo físico e catálogo
  configurado.
- **Frontend pronto para homologação:** **NÃO** para produção; **SIM** para
  homologação parcial das rotas P1 uma vez que os P0 sejam mitigados.
- **Primeira implementação recomendada:** habilitar `storeId` em
  `/admin/devices` (criar + listar) — desbloqueia toda a cadeia de impressão
  para loja.

---

## Estado atual (mapa)

| Área | Rota / Arquivo | Estado |
|---|---|---|
| Autenticação | `admin.tsx`, `admin.login.tsx`, `auth-context.tsx` | Pronto |
| Central | `admin.orders.tsx` (969 LOC) | Pronto |
| Venda Manual | `store-manual-sale-drawer.tsx`, `online-store-api.ts` | Pronto |
| Cardápio Público | `p.$slug.tsx` (1820 LOC) | Pronto |
| Checkout Público | `p.$slug.tsx` | Parcial (métodos de pagamento) |
| Settings Organização | `admin.settings.organization.tsx` | Pronto |
| Settings Branding | `admin.settings.branding.tsx` | Pronto |
| Settings Horários | `admin.settings.business-hours.tsx` | Pronto |
| Settings Loja Online | `admin.settings.online-orders.tsx` | Pronto |
| Settings Delivery | `admin.settings.delivery*.tsx` | Pronto |
| Settings Catálogo Online | `admin.settings.catalog-online.tsx` | **Mockado (localStorage)** |
| Settings Checkout | `admin.settings.checkout.tsx` | **Mockado (localStorage)** |
| Settings Impressão | `admin.settings.legacy.tsx` (apenas evento) | **Legado — sem escopo de loja** |
| Dispositivos | `admin.devices.tsx` (1540 LOC) | **Somente evento — sem `storeId`** |
| Print Queue | `admin.print-queue.tsx` (747 LOC) | Pronto |
| Totem | `e.$slug.tsx` (2674 LOC) | Parcial (V1 body + V2 Home/Header) |

---

## P0 — Bloqueia produção

### P0-1 · Dispositivos sem escopo de loja
- **Rota:** `/admin/devices`
- **Arquivo:** `src/routes/admin.devices.tsx`, `src/lib/devices-api.ts`
- **Evidência:** `rg storeId src/routes/admin.devices.tsx src/lib/devices-api.ts` retorna vazio; criação linka apenas `eventId` (linha 90: `eventId: ev?.id ?? p.eventId ?? null`); filtro por evento em 353/361/413.
- **Impacto:** Guello's é loja (`ONLINE_STORE`) e não tem device de impressora vinculável no frontend → sem impressão automática.
- **Correção:** Adicionar seletor `contextType` (STORE|EVENT) + campo `storeId` nas mutations e no filtro; DTOs do backend já suportam.
- **Esforço:** M · **Regressão:** Baixa (novo campo opcional).

### P0-2 · Impressão configurada apenas em tela legada de evento
- **Rota:** `/admin/settings/legacy?tab=printing` (herdada)
- **Arquivo:** `src/routes/admin.settings.legacy.tsx:94,118,160,356`
- **Evidência:** `printingEnabled` / `autoPrintEnabled` só existem no `EventSettings`; nenhuma tela do Centro de Configurações Fase 2 permite editar isso para `ONLINE_STORE`.
- **Impacto:** Impossível ativar autoprint da Guello's sem SQL manual.
- **Correção:** Nova página `admin.settings.printing.tsx` consumindo `PATCH /settings/printing` com escopo store.
- **Esforço:** M · **Regressão:** Baixa.

### P0-3 · Settings Catálogo Online mockadas em localStorage
- **Rota:** `/admin/settings/catalog-online`
- **Arquivo:** `src/lib/catalog-settings-api.ts:5-7`
- **Evidência:** `"adapter mockado por storeId ... substituir mockGet/mockPatch"`.
- **Impacto:** Layout/destaques configurados não sobrevivem a outro navegador nem afetam `/p/guellos-pizza`.
- **Correção:** Ligar em `GET/PATCH /settings/catalog` quando backend estiver pronto; senão remover do menu para evitar falsa expectativa.
- **Esforço:** S · **Regressão:** Baixa.

### P0-4 · Settings Checkout mockadas em localStorage
- **Rota:** `/admin/settings/checkout`
- **Arquivo:** `src/lib/checkout-settings-api.ts:5-7`
- **Evidência:** mesmo padrão `mockGet/mockPatch`.
- **Impacto:** Preferências de fluxo/troco/pagamento não persistem no backend.
- **Correção:** Idem P0-3.
- **Esforço:** S.

### P0-5 · Checkout público exibe métodos de pagamento sem suporte real
- **Rota:** `/p/guellos-pizza` → tela de pagamento
- **Arquivo:** `src/routes/p.$slug.tsx:166,1613-1622`
- **Evidência:** `z.enum(["PIX","CARD_ON_DELIVERY","CASH"])` hardcoded; nenhum filtro pelos métodos habilitados no backend (`payment-provider-settings`). MP não está listado (bom) mas PIX é exibido sem provider ativo.
- **Impacto:** Cliente escolhe PIX e não consegue pagar (backend NO-GO para PIX).
- **Correção:** Consumir `paymentMethods` de `GET /public/stores/:slug` e renderizar somente os habilitados. Enquanto backend não expõe, esconder PIX via feature flag.
- **Esforço:** S · **Regressão:** Baixa.

### P0-6 · Timezone não padronizado
- **Arquivo:** `src/routes/admin.settings.organization.tsx:61,251`
- **Evidência:** Default `America/Sao_Paulo` só no form vazio; nenhum outro ponto do frontend força tz para render de datas/SLA (`orders/helpers.ts` usa `new Date(...)` cru).
- **Impacto:** Cronômetro e “Entregues Hoje” podem divergir em navegadores fora de BRT.
- **Correção:** Consumir `organization.timezone` (já no DTO) e passar para `Intl.DateTimeFormat` nos formatters.
- **Esforço:** S.

### P0-7 · Rota `e.$slug.tsx` monolítica (2674 LOC) com Totem incompleto
- **Arquivo:** `src/routes/e.$slug.tsx`
- **Evidência:** `wc -l` = 2674; Home/Header V2 aplicados, mas `CartSheet`, produto e PIX ainda usam paleta/lógica legada (documentado no turn anterior).
- **Impacto:** Se a Guello's for ativar Totem, catálogo aparecerá inconsistente com o cardápio público.
- **Correção:** Considerar Totem fora do escopo do Go-Live inicial. Se necessário, promover Sprint 2 (Catálogo + Produto + Carrinho).
- **Esforço:** L · **Recomendação:** Go-Live sem Totem.

---

## P1 — Corrigir antes da abertura

1. **`admin.online-orders`** redireciona para `/admin/orders?origin=ONLINE` (`admin.online-orders.tsx`) — OK, mas o item já foi removido do menu. Confirmar que nenhum bookmark antigo quebra (é redirect; ok).
2. **Devices — `authStatus` e heartbeat**: UI mostra `lastHeartbeatAt` mas não há badge de "offline há X min" quando >90s (`admin.devices.tsx`).
3. **Print-queue reimpressão sem debounce visual**: botão pode ser clicado em duplicidade (`admin.print-queue.tsx`); adicionar `disabled` durante mutation.
4. **`p.$slug.tsx` sem idempotência real**: `submitting` local (linha ~1263), sem `idempotency-key` no header nem trava por hash de payload.
5. **Central — SLA usando `Date.now()` sem tz da org** (`orders/order-card.tsx`).
6. **Branding público**: cache de imagens não invalida ao salvar (`useQuery` da `p.$slug` com `staleTime` 30s). Emitir `settings-updated` via socket.
7. **Settings Horários — Exceções**: aceita ler, mas UI não expõe CRUD (`admin.settings.business-hours.tsx`).
8. **Delivery Rules — Empty state OK, mas sem import massivo** de bairros.
9. **`e.$slug.tsx` LOC**: extrair `CartSheet`, `PixPayment`, `Product*` para arquivos separados (dívida técnica que amplifica risco de regressão).

---

## P2 — Pode entrar depois

1. Bundle-analysis (nenhuma ferramenta configurada; `vite-bundle-visualizer` recomendado).
2. Lazy-load de imagens de produto (falta `loading="lazy"` em `ProductImage.tsx`).
3. Skeletons finos em `/admin/dashboard` (usa spinner genérico).
4. Log estruturado no cliente (`error-capture.ts` só ecoa `console.error`).
5. Auditoria de re-renders na Central com `why-did-you-render`.
6. Testes E2E (Playwright) para os 3 fluxos críticos.

---

## Autenticação e Tenant

- Guard central em `admin.tsx` funciona (redirect com `search.redirect`).
- `AuthProvider` (`auth-context.tsx`) re-hidrata perfil via `fetchProfile`; limpa sessão em erro (evita loop).
- `x-organization-id` injetado só para SUPER_ADMIN via `org-context.ts` (mirror legado ainda existe — P2).
- Trocar tenant faz `queryClient.clear()` + `router.invalidate()` + `disconnectSocket()` — OK.
- **Sem loop de login confirmado.** ADMIN/OPERATOR não recebem header de impersonação.

---

## Cardápio Público

- `p.$slug.tsx` consome `GET /public/stores/:slug` (branding, operation, fulfillment, orderRules, categorias, produtos).
- Não recalcula preço nem taxa oficial — subtotal é somatório de opções + base; validação final é do backend.
- Bloqueia finalização se `subtotal < minOrder` ou loja fechada (Fase 2A).
- **Divergência potencial P0:** delta de opções na UI usa `priceInCents` do adicional. Se backend recalcular diferente, o total exibido pode divergir do total oficial. Recomendação: exibir apenas subtotal informativo e usar `order.totals.totalInCents` da resposta ao confirmar.

---

## Checkout Público

- Payload em `p.$slug.tsx:440-450`: envia `paymentMethod`, `selectedOptions: [{ optionGroupId, optionIds }]`, `fulfillment`, dados do cliente. **Não envia `deliveryFeeInCents`** ✅.
- Tela de sucesso lê `order` retornado (linha 1754).
- Botão sem `disabled` explícito durante submit — P1.
- Métodos: PIX, CARD_ON_DELIVERY, CASH (P0-5).

---

## Central de Pedidos

- Kanban unificado 6 colunas (`orders/constants.ts`) — OK.
- `NEXT_STATUS` promove `READY→OUT_FOR_DELIVERY` só para delivery via `helpers.ts:nextStatusFor()` — OK.
- Socket.IO com fallback polling (linha 397/454 de `admin.orders.tsx`) — OK.
- Drawer mostra cliente/endereço/itens/opções/pagamento/total (Fase drawer concluída).
- Filtros alteram query key — OK.

---

## Venda Manual

- `store-manual-sale-drawer.tsx` + `online-store-api.ts:249,294` usa exatamente `{ optionGroupId, optionIds }`.
- Não envia preço.
- Invalidação de `qk.orders.unified` após submit — OK.

---

## Impressão

- `/admin/print-queue` mostra status, retry (sem debounce — P1).
- Autoprint depende de `EventSettings.autoPrintEnabled` — P0-2.
- Nenhuma tela de loja para configurar impressora — P0-1/P0-2.

---

## Configurações (persistência)

| Tela | Persiste | Notas |
|---|---|---|
| Organização | ✅ | `PATCH /settings/organization` |
| Branding | ✅ | patch parcial + refetch autoritativo |
| Horários | ✅ | grade completa, sem exceções (P1) |
| Loja Online | ✅ | Fase 2A |
| Delivery + Rules | ✅ | Fase 2A |
| Catálogo Online | ❌ | localStorage — P0-3 |
| Checkout | ❌ | localStorage — P0-4 |
| Impressão | ⚠️ | apenas legado/evento — P0-2 |
| Pagamentos | — | UI inexistente no Centro; existe em `super-admin` |

---

## Dispositivos

- Sem `storeId` (P0-1).
- Tipos suportados: TOTEM, SK210, PRINTER (linha 115-125).
- Regeneração de credenciais / heartbeat presentes.

---

## Totem

- Home/Header V2 aplicados; catálogo, produto, carrinho, PIX legados.
- Recomendação: **excluir do Go-Live da Guello's** (P0-7).

---

## Socket.IO e cache

- Singleton `getSocket()` respeita mudança de tenant (recria).
- `disconnectSocket()` em `switchOrganization`/`exitImpersonation`.
- Polling fallback em Central quando socket offline.
- **Gap:** eventos `settings-updated` / `branding-updated` não são emitidos → cardápio público não recarrega ao salvar branding sem F5 (P1).

---

## Erros e estados

- `context-errors.ts` centraliza redirects P0 (TENANT_CONTEXT_REQUIRED etc).
- `router.tsx` desabilita retry para 400/403.
- Faltam empty-states elegantes em `/admin/print-queue` e drawer venda manual (P2).

---

## Responsividade

Não foi executado Playwright nesta auditoria. Rotas com risco (revisar antes do Go-Live):
- `/admin/orders` em 1366 (Kanban 6 col × 300px → scroll horizontal já ativo).
- `/p/guellos-pizza` em 390 mobile (sticky categorias OK).
- `/e/:slug` em 1024/SK210 (Home OK; catálogo legado, risco visual).

---

## Performance e build

- `bunx tsgo --noEmit` executado — sem erros.
- Rotas grandes: `e.$slug.tsx` (2674), `p.$slug.tsx` (1820), `admin.devices.tsx` (1540) — candidatas a splitting (P2).
- Sem `loading="lazy"` em `ProductImage.tsx` (P2).
- Nenhum bundle analyzer instalado.

---

## Matriz de homologação

| # | Cenário | Rota | Pré-cond | Status esperado |
|---|---|---|---|---|
| 1 | Login admin | `/admin/login` | credencial válida | redirect `/admin/orders` |
| 2 | Cardápio desktop | `/p/guellos-pizza` | store aberta | branding + categorias |
| 3 | Cardápio mobile 390px | idem | idem | sticky categorias |
| 4 | Pizza sem borda | idem | produto pizza | subtotal = base |
| 5 | Pizza com borda | idem | grupo borda | subtotal = base + borda |
| 6 | Qtd 2 no carrinho | idem | 2× item | total = 2× linha |
| 7 | Delivery bairro atendido | checkout | rule ativa | taxa exibida do backend |
| 8 | Pickup | checkout | fulfillment=PICKUP | sem endereço |
| 9 | Dinheiro + troco | checkout | CASH | campo `changeFor` |
| 10 | Cartão na entrega | checkout | CARD_ON_DELIVERY | OK |
| 11 | Pedido < mínimo | checkout | subtotal < min | botão bloqueado |
| 12 | Loja fechada | qualquer hora | fora do turno | banner + botão bloqueado |
| 13 | Bairro não atendido | checkout | rule ausente | erro amigável |
| 14 | Venda manual loja | `/admin/orders` | drawer aberto | pedido criado, aparece Kanban |
| 15 | READY→OUT_FOR_DELIVERY | Central | delivery | 1 clique |
| 16 | READY→DELIVERED | Central | pickup | 1 clique |
| 17 | Impressão automática | Central | autoPrint on | job PRINTED |
| 18 | Reimpressão | print-queue | job final | novo PENDING |
| 19 | Impressora offline | print-queue | device off | badge ERROR |
| 20 | Totem home | `/e/:slug` | evento ativo | Home V2 |
| 21 | NFC identificação | Totem | pulseira | usuário reconhecido |
| 22 | F5 na Central | `/admin/orders` | dados carregados | mantém filtros/dados |
| 23 | 2 abas Central | idem | pedido novo | aparece nas duas |
| 24 | Socket offline | idem | derrubar ws | polling assume |

**Executar em homologação.** Cenários 7, 17, 18, 19, 20 dependem dos P0.

---

## Plano de execução

1. **P0-1 Devices scope Loja** (M) — desbloqueia impressão.
2. **P0-2 Settings Impressão de Loja** (M).
3. **P0-5 Métodos de pagamento reais no checkout** (S).
4. **P0-6 Timezone consumindo organização** (S).
5. **P0-3/P0-4 Ligar Catálogo/Checkout settings ou remover do menu** (S).
6. **P1** em paralelo (idempotência checkout, autoprint UI polish, exceções horários).
7. **Homologar** rodando a matriz.
8. **Deploy** com Totem escondido do menu para Guello's (feature flag por org).

---

## Critério de Go / No-Go

- **GO** somente quando:
  - P0-1..P0-6 resolvidos e homologados;
  - matriz cenários 1-19, 22-24 verdes;
  - Backend confirmado GO (impressão, timezone, delivery settings, MP);
  - Feature flag Totem = off para Guello's.
- **No-Go atual:** P0 abertos + dependências backend.

---

## Contadores

- **P0:** 7  ·  **P1:** 9  ·  **P2:** 6
- **Fluxos prontos:** login, Central, cardápio (subtotal informativo), venda manual de loja, 5 telas do Centro de Config.
- **Telas mockadas:** `admin.settings.catalog-online`, `admin.settings.checkout`.
- **Config essenciais sem persistência backend:** impressão de loja, catálogo online (destaques), checkout (fluxo).
- **Guello's sem Totem:** SIM.
- **Frontend pronto para homologação:** NÃO (produção); SIM (parcial, após P0-5/P0-6 e mitigações P0-3/P0-4).
- **Primeira implementação recomendada:** **P0-1 — habilitar `storeId` em `/admin/devices`.**
