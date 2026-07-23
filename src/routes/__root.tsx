import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AuthProvider } from "@/lib/auth-context";
import { OrganizationProvider } from "@/contexts/organization-context";
import { getPublicApiRequestDiagnostics } from "@/lib/public-api";

const TITLE_MAP: Array<[RegExp, string]> = [
  [/^\/admin\/login/, "Login"],
  [/^\/admin\/dashboard/, "Visão geral"],
  [/^\/admin\/orders/, "Pedidos"],
  [/^\/admin\/online-orders/, "Pedidos"],
  [/^\/admin\/catalog/, "Catálogo"],
  [/^\/admin\/customers\/[^/]+/, "Cliente"],
  [/^\/admin\/customers/, "Clientes"],
  [/^\/admin\/events\/[^/]+/, "Evento"],
  [/^\/admin\/events/, "Eventos"],
  [/^\/admin\/devices/, "Dispositivos"],
  [/^\/admin\/printers|^\/admin\/print-queue/, "Impressão"],
  [/^\/admin\/nfc-cards/, "Cartões NFC"],
  [/^\/admin\/online-menu/, "Cardápio digital"],
  [/^\/admin\/public-links/, "Links públicos"],
  [/^\/admin\/financeiro/, "Financeiro"],
  [/^\/admin\/activities/, "Atividades"],
  [/^\/admin\/settings/, "Configurações"],
  [/^\/super-admin\/organizations/, "Organizações"],
  [/^\/super-admin\/users/, "Usuários"],
  [/^\/super-admin\/modules/, "Módulos"],
  [/^\/super-admin\/plans/, "Planos"],
  [/^\/super-admin\/settings/, "Configurações"],
  [/^\/super-admin/, "Superadministrador"],
  [/^\/unauthorized/, "Acesso negado"],
];

function titleFor(pathname: string): string {
  for (const [re, label] of TITLE_MAP) if (re.test(pathname)) return `${label} · Defumar`;
  return "Defumar";
}

function DocumentTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (typeof document !== "undefined") document.title = titleFor(pathname);
  }, [pathname]);
  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Não encontramos o conteúdo solicitado.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (import.meta.env.DEV) {
    const diagnostics = getPublicApiRequestDiagnostics(error);
    /* eslint-disable no-console */
    console.groupCollapsed("[Route Error] Nao foi possivel carregar esta pagina");
    console.error(error);
    console.info("Endpoint:", diagnostics?.endpoint ?? "desconhecido");
    console.info("Metodo:", diagnostics?.method ?? "desconhecido");
    console.info("Status HTTP:", diagnostics?.status ?? "sem resposta HTTP");
    console.info("Mensagem da API:", diagnostics?.apiMessage ?? error.message);
    console.info("Payload enviado:", diagnostics?.payload ?? null);
    console.info("Slug do evento:", diagnostics?.eventSlug ?? null);
    console.info("Slug da organizacao:", diagnostics?.organizationSlug ?? null);
    console.info("Stack completa:", error.stack ?? "Stack indisponivel");
    console.groupEnd();
    /* eslint-enable no-console */
  } else {
    console.error(error);
  }
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Não foi possível concluir esta operação. Tente novamente ou volte ao início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Voltar ao início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrganizationProvider>
          <DocumentTitle />
          <Outlet />
        </OrganizationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
