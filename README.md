# Defumar Events Platform — Frontend

> Painel administrativo multiempresa + cardápio digital público da Defumar
> Events. SaaS com SUPER_ADMIN, ADMIN/OPERATOR por organização, módulos
> por tenant e loja pública por slug.

---

## 1. Visão geral

### Objetivo
Interface única que atende três públicos:
- **SUPER_ADMIN** — gerencia organizações, módulos, planos, usuários globais.
- **ADMIN / OPERATOR** — opera a organização (eventos, pedidos, catálogo,
  financeiro, impressão, NFC, dispositivos).
- **Cliente final** — consome cardápio público e faz pedido sem login em
  `/p/:slug` ou `/e/:slug` (evento).

O frontend não implementa regras de negócio — consome uma API REST
(Node/Prisma) via HTTP/HTTPS e comunica em tempo real via Socket.IO.

### Arquitetura
```
┌─────────────────────────────────────────────────────────┐
│                     Browser (SPA Vite)                 │
│  React 19 · TanStack Router · TanStack Query · Tailwind │
└────────────┬───────────────────────────────┬────────────┘
             │ HTTPS (fetch + Bearer JWT)    │ WebSocket
             ▼                               ▼
      Backend REST API                 Socket.IO server
   (Prisma / Postgres / S3)          (eventos em tempo real)
```

- **SPA local** via Vite 7.
- **Multi-tenant por header/query**: SUPER_ADMIN impersona uma
  organização; todas as chamadas anexam `?organizationId=<id>`.
- **Módulos por organização** controlam sidebar, rotas e dashboard.

### Stack
| Camada | Tecnologia |
|---|---|
| UI | React 19 + JSX |
| Roteamento | TanStack Router v1 (file-based) |
| Data fetching | TanStack Query v5 |
| Estado global | Context API (`AuthProvider`, `OrganizationProvider`) |
| Estilo | Tailwind CSS v4 (via `src/styles.css`) |
| Componentes | shadcn/ui (Radix + variantes) |
| Ícones | lucide-react |
| Build | Vite 7 |
| Runtime | Vite SPA |
| Realtime | socket.io-client |
| Validação | zod |
| Data | date-fns |

---

## 2. Estrutura de pastas

```
src/
├── assets/                 Logos, favicons, backgrounds (JSON asset descriptors)
├── components/
│   ├── admin/              Layout admin: OrgBanner, Breadcrumb, EmptyState, ManualSaleDrawer
│   ├── event-settings/     Configurações por evento (PIX, totem, impressão, operação)
│   ├── nfc/                Drawer de cashless NFC
│   ├── ui/                 shadcn/ui (button, card, dialog, sheet, tabs, table, ...)
│   ├── admin-layout.tsx    Shell do painel admin (sidebar + header)
│   ├── super-admin-layout.tsx  Shell do painel super-admin
│   ├── EventLogo.tsx       Logo do evento
│   ├── ProductImage.tsx    Imagem com fallback
│   ├── PrintersManager.tsx Gerência de impressoras térmicas
│   └── ThermalReceipt.tsx  Recibo para impressão
├── contexts/
│   └── organization-context.tsx  Provider de organização ativa/impersonada
├── hooks/
│   ├── use-event-socket.ts Socket.IO por evento
│   └── use-mobile.tsx      Media query mobile
├── lib/
│   ├── auth.ts             API de login/perfil + storage
│   ├── auth-context.tsx    AuthProvider
│   ├── api-error.ts        `apiFetch` + `ApiError`
│   ├── org-context.ts      Storage de organização selecionada (SUPER_ADMIN)
│   ├── organization-api.ts Fetch da organização e módulos
│   ├── organization-modules.ts  ModuleKey, normalize, buildNavItems, moduleLabel
│   ├── require-module.ts   Hook de guard de rota por módulo
│   ├── events-api.ts       CRUD de eventos, métricas, financeiro
│   ├── orders-api.ts       Pedidos internos (evento)
│   ├── online-orders-api.ts Pedidos online (Kanban)
│   ├── online-store-api.ts Lojas online (admin)
│   ├── catalog-api.ts      Catálogo (categorias/produtos)
│   ├── nfc-cards-api.ts    Cartões NFC
│   ├── devices-api.ts      Dispositivos (totem, POS)
│   ├── printers-api.ts     Impressoras
│   ├── print-queue.ts      Fila de impressão
│   ├── payment-settings-api.ts  PIX/gateways
│   ├── audit-logs-api.ts   Auditoria
│   ├── public-api.ts       Endpoints públicos (loja + customer + pedido)
│   ├── public-event-urls.ts URLs públicas por evento
│   ├── socket.ts           Wrapper do Socket.IO
│   ├── super-admin-store.ts Cache local do super-admin
│   ├── audio-manager.ts    Sons de novos pedidos
│   ├── error-capture.ts    Captura global de erros
│   ├── error-page.ts       Utilitário de página de erro
│   └── utils.ts            `cn`, `formatCurrency`
├── routes/                 File-based routing (TanStack)
├── styles.css              Tailwind v4 + tokens semânticos
├── router.tsx              QueryClient + router
├── routeTree.gen.ts        (gerado, não editar)
├── server.ts               SSR handler (Cloudflare Worker)
└── start.ts                Client middleware
```

---

## 3. Rotas

Convenção TanStack: `arquivo.com.pontos.tsx` ↔ `/arquivo/com/pontos`.

### Públicas (sem login)
| Rota | Arquivo | Descrição |
|---|---|---|
| `/` | `routes/index.tsx` | Redirect → `/admin/login` |
| `/admin/login` | `admin.login.tsx` | Login (email + senha) |
| `/p/:slug` | `p.$slug.tsx` | Cardápio digital público (Guello's Pizza etc.) |
| `/e/:slug` | `e.$slug.tsx` | Cardápio público de **evento** |
| `/chamada/:slug` | `chamada.$slug.tsx` | Tela pública de chamada de pedidos |

### Admin (protegidas — requer JWT)
| Rota | Módulo requerido |
|---|---|
| `/admin/dashboard` | (nenhum — sempre visível) |
| `/admin/catalog` | `CATALOG` |
| `/admin/events` · `/admin/events/:id` | `EVENTS` |
| `/admin/orders` | `EVENTS` |
| `/admin/online-menu` | `ONLINE_ORDERS` |
| `/admin/online-orders` | `ONLINE_ORDERS` |
| `/admin/financeiro` | `FINANCE` |
| `/admin/print-queue` | `PRINTING` |
| `/admin/nfc-cards` | `NFC` |
| `/admin/devices` | `DEVICES` |
| `/admin/activities` | (sempre) |
| `/admin/settings` | (sempre) |

Guard: `useRequireModule("ONLINE_ORDERS")` — redireciona para
`/admin/dashboard` com toast se a organização não tem o módulo.

### Super Admin
| Rota | Arquivo |
|---|---|
| `/super-admin` | `super-admin.index.tsx` |
| `/super-admin/organizations` | criar/editar/impersonar |
| `/super-admin/modules` | toggle de módulos por organização |
| `/super-admin/plans` | planos |
| `/super-admin/users` | usuários globais |
| `/super-admin/settings` | configurações da plataforma |

---

## 4. Componentes principais

### `AdminLayout` (`components/admin-layout.tsx`)
Shell do painel: sidebar responsiva + header sticky + `OrgBanner` + main.
Recebe `title`, `subtitle`, `actions`, `children`. Constrói a navegação
via `buildNavItems(organizationModules)`.

### `OrganizationProvider` (`contexts/organization-context.tsx`)
Expõe:
- `organization`, `organizationId`, `organizationName`, `organizationSlug`
- `organizationModules: ModuleKey[]`
- `isSuperAdmin`, `isImpersonating`
- `switchOrganization(org)` — troca com `queryClient.clear()` + `router.invalidate()`
- `exitImpersonation()`
- `refreshOrganization()`

Chave da query: `["organization", effectiveOrgId, isSuperAdmin, !!impersonatedOrgId]`.

### `AuthProvider` (`lib/auth-context.tsx`)
`user`, `token`, `signIn`, `signOut`, `refreshProfile`. Persiste token e
usuário em `localStorage` (`admin_token`, `admin_user`). Só limpa sessão
em erro `UNAUTHORIZED / TOKEN_EXPIRED / FORBIDDEN`.

### Sidebar
Renderizada dentro de `AdminLayout`. Itens são gerados por
`buildNavItems` a partir dos módulos ativos.

### `OrgBreadcrumb` (`components/admin/breadcrumb.tsx`)
Mostra nome da organização apenas quando SUPER_ADMIN impersona.

### `OrgBanner` (`components/admin/org-banner.tsx`)
Uma linha compacta com logo, nome, slug, status, cidade, chips de módulos
e ações "Trocar/Sair" — só aparece na impersonação.

### Dashboard (`routes/admin.dashboard.tsx`)
Cabeçalhos por seção (Operação de Eventos / Pedidos Online).
Métricas com fallback: se `/events/:id/metrics` falhar, calcula a partir
de pedidos + financial-summary. `Promise.allSettled` isola blocos.

### Cardápio público (`routes/p.$slug.tsx`)
Componentes internos:
- **Hero** — banner, logo, status aberta/fechada com pulse, tempo estimado.
- **Busca + categorias sticky** com scroll-spy.
- **ProductCard** — badges "Mais vendido / Promoção / Novo", botão `+`.
- **ProductModal** — imagem grande, observações, quantidade.
- **FloatingCart** — barra fixa estilo iFood.
- **CheckoutSheet** — 3 etapas: Identificação (WhatsApp) → Entrega
  (endereços salvos) → Pagamento.
- **SuccessScreen** — número, itens, mensagem de retorno.

### shadcn/ui reutilizáveis
`button`, `card`, `dialog`, `sheet`, `tabs`, `table`, `badge`, `alert`,
`input`, `textarea`, `select`, `switch`, `separator`, `skeleton`,
`toast`/`sonner`, `dropdown-menu`, `command`.

---

## 5. Fluxos

### 5.1 Login
1. `POST /sessions` → recebe `{ token, user }`.
2. `authStorage.setToken/setUser` grava em `localStorage`.
3. `GET /users/profile` valida token.
4. `queryClient.clear()` + `router.invalidate()` para não vazar cache de
   sessão anterior.
5. Redireciona para `/admin/dashboard` ou `/super-admin`.

### 5.2 Troca de organização (SUPER_ADMIN)
1. Clica "Acessar" em `/super-admin/organizations`.
2. `setSelectedOrg({ id, name, slug })` grava em `localStorage`.
3. `switchOrganization`: `queryClient.clear()` + `router.invalidate()`.
4. Todas as chamadas de admin passam a anexar `?organizationId=<id>`
   automaticamente (via `apiFetch`).

### 5.3 Dashboard
- ONLINE_ORDERS puro: sem seletor de evento; mostra pedidos online.
- EVENTS: seletor de evento; `selectedId` é invalidado ao trocar de org.
- EVENTS + ONLINE_ORDERS: duas seções separadas.

### 5.4 Pedidos (evento)
`admin.orders.tsx`: Kanban `RECEIVED → PREPARING → READY → DELIVERED`.
Socket.IO atualiza em tempo real via `use-event-socket`.

### 5.5 Cardápio Digital
Cliente abre `/p/:slug`:
1. `GET /public/stores/:slug` (parser aceita `categories`,
   `catalogCategories`, `onlineCategories` — e mesmo aninhado em
   `store.*`, `onlineStore.*`, `data.*`).
2. Monta carrinho local.
3. Abre `CheckoutSheet`.

### 5.6 Checkout
1. **Identificação** — WhatsApp; `GET /public/customers/by-whatsapp/:phone`.
2. **Entrega** — lista endereços salvos ou coleta novo.
3. **Pagamento** — PIX, cartão na entrega, dinheiro (com troco).
4. `POST /public/stores/:slug/orders` — payload só com IDs, quantidades e
   notes; backend calcula totais.

### 5.7 Histórico / Clientes
Backend materializa Customer + CustomerAddress; frontend apenas consome.

---

## 6. API — integrações

Base URL configurada em `src/lib/auth.ts` (`API_BASE_URL`).
Todas as chamadas passam por `apiFetch` (`lib/api-error.ts`), que:
- injeta `Authorization: Bearer <token>`;
- anexa `?organizationId=<id>` quando SUPER_ADMIN impersona;
- transforma erros em `ApiError` tipado.

| Módulo | Arquivo | Endpoints principais |
|---|---|---|
| Auth | `auth.ts` | `POST /sessions`, `GET /users/profile` |
| Organização | `organization-api.ts` | `GET /super-admin/organizations/:id`, fallback `/users/profile` |
| Eventos | `events-api.ts` | `GET/POST/PATCH /events`, `/events/:id/metrics`, `/events/:id/financial-summary` |
| Pedidos evento | `orders-api.ts` | `/events/:id/orders`, transições de status |
| Pedidos online | `online-orders-api.ts` | `/online-stores/:id/orders` |
| Lojas online | `online-store-api.ts` | `/online-stores` |
| Catálogo | `catalog-api.ts` | `/catalog/categories`, `/catalog/products` |
| NFC | `nfc-cards-api.ts` | `/nfc-cards` |
| Dispositivos | `devices-api.ts` | `/devices` |
| Impressão | `printers-api.ts`, `print-queue.ts` | `/printers`, `/print-jobs` |
| Pagamentos | `payment-settings-api.ts` | `/payment-settings` |
| Auditoria | `audit-logs-api.ts` | `/audit-logs` |
| Público | `public-api.ts` | `GET /public/stores/:slug`, `GET /public/customers/by-whatsapp/:phone`, `POST /public/stores/:slug/orders` |
| Socket | `socket.ts` | `io(API_BASE_URL)` + rooms por evento/org |

---

## 7. Cache — TanStack Query

### Defaults globais (`src/router.tsx`)
```ts
{ staleTime: 30_000, gcTime: 300_000,
  refetchOnWindowFocus: false, retry: 1,
  mutations: { retry: 0 } }
```

### Convenções de queryKey
| Domínio | Key |
|---|---|
| Organização ativa | `["organization", effectiveOrgId, isSuperAdmin, !!impersonatedOrgId]` |
| Eventos | `["events", organizationId]` |
| Métricas de evento | `["event-metrics", eventId, period]` |
| Pedidos online | `["online-orders", organizationId, storeId, filters]` |
| Loja online (admin) | `["online-store", organizationId, storeId]` |
| Catálogo | `["catalog", organizationId, ...]` |
| Impressão | `["print-queue", organizationId]` |
| Super Admin orgs | `["super-admin","organizations"]` |

**Regra:** toda queryKey de dados por tenant inclui `organizationId` para
isolar cache entre organizações.

### Invalidação
Após mutação de módulos ou organização:
```ts
queryClient.invalidateQueries({ queryKey: ["super-admin","organizations"] });
queryClient.invalidateQueries({ queryKey: ["organization"] });
refreshOrganization();
```

### Troca de organização
`switchOrganization` faz `queryClient.clear()` + `router.invalidate()` —
não há vazamento entre tenants.

### Refresh em tempo real
`use-event-socket` escuta eventos e chama `invalidateQueries` nas keys
afetadas (pedidos, métricas).

---

## 8. Responsividade

- **Mobile first**. Breakpoints Tailwind padrão (`sm 640`, `md 768`,
  `lg 1024`, `xl 1280`).
- Sidebar: `hidden md:flex` — no mobile o header expõe apenas o botão
  Sair; menus renderizados via `Sheet` (drawer).
- Cardápio público: layout de 1 coluna em mobile, 2 no `md`, grid maior
  no `lg`. Carrinho fixo no rodapé em mobile.
- Tabelas de admin usam scroll horizontal (`overflow-x-auto`) e cards em
  telas muito estreitas.
- Modais viram `Sheet` full-screen no mobile (padrão shadcn).

---

## 9. Tema e Design System

### Tokens (em `src/styles.css`, via `@theme`)
Todas as cores, sombras e gradientes são **variáveis semânticas**:

```
--background, --foreground
--card, --card-foreground
--primary, --primary-foreground
--secondary, --muted, --accent
--destructive, --border, --input, --ring
--gradient-primary, --gradient-subtle
--shadow-soft
```

**Nunca** hardcode `bg-white`, `text-black` ou `#hex` em componentes —
sempre use classes semânticas (`bg-background`, `text-foreground`,
`bg-primary`, etc.) para não quebrar tema claro/escuro.

### Glassmorphism
Header e sidebar usam `bg-card/80 backdrop-blur` sobre gradientes suaves
(`--gradient-subtle`). Cards importantes usam `shadow-[var(--shadow-soft)]`.

### Tipografia
`Inter` (padrão), hierarquia via `tracking-tight` + `text-{sm,base,lg,xl}`.
Nunca serif.

### Componentes reutilizáveis
Todos derivam de shadcn/ui + variants (`cva`). `cn(...)` para merge de
classes. Ícones sempre em `h-4 w-4` na sidebar, `h-5 w-5` em conteúdo.

### Identidade Defumar
Roxo/azul primário + acentos gradiente. Assets em
`src/assets/*` (favicon, logos, background de login).

---

## 10. Melhorias pendentes

### Performance
- Paginação em `/events/:id/orders` (hoje o dashboard puxa tudo).
- Virtualização de listas grandes de pedidos/produtos.
- Lazy-load de rotas pesadas (`admin.print-queue`, `admin.online-menu`).
- Consolidar chamadas paralelas do dashboard em um endpoint agregado
  (dependência de backend).
- Adicionar `organizationId` na queryKey das rotas restantes que ainda
  não isolam explicitamente.

### UX
- Estados vazios ilustrados (hoje texto puro em várias telas).
- Toast global de "modo impersonação" mais visível.
- Undo em ações destrutivas (deletar produto, cancelar pedido).
- Persistir preferências de filtros por usuário.
- Suporte offline para o cardápio público (Service Worker).

### Acessibilidade
- Auditar contraste em cards com gradiente.
- `aria-label` em ícones-botão do carrinho e do checkout.
- Foco visível padronizado (`:focus-visible`).
- Navegação por teclado no Kanban de pedidos.
- Anúncios via `aria-live` para novos pedidos em tempo real.

### SEO (rotas públicas)
- `head()` por rota com `title`/`description`/`og:image` dinâmicos por
  loja/evento (hoje `/p/:slug` está `noindex`).
- Structured data `Restaurant` + `Menu` (JSON-LD) para `/p/:slug`.
- Sitemap dinâmico para lojas públicas ativas.
- Canonical tags.

### Dependências de backend
- `GET /organizations/me` para eliminar fallback via `/users/profile`.
- Endpoint agregado de métricas do dashboard.
- Webhooks/eventos padronizados para Socket.IO (namespaces por org).
- Endpoint público de resumo de pedidos online.

---

## 11. Scripts

```bash
bun install
bun run dev        # Vite dev server (http://localhost:5173)
bun run build      # build de produção (Cloudflare Worker)
bun run typecheck  # tsgo
```

## 12. Variaveis de ambiente

Frontend usa `.env` local e `.env.example` como referencia:

```env
VITE_API_URL="http://localhost:3333"
VITE_APP_URL="http://localhost:5173"
VITE_SOCKET_URL="http://localhost:3333"
```