import { createFileRoute, Navigate, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { authStorage } from "@/lib/auth";
import { useAuth } from "@/lib/auth-context";

/**
 * Centralized guard for every /admin/* route.
 *
 * - `beforeLoad` rejeita requisições sem token e redireciona para /admin/login
 *   preservando o destino original em `search.redirect`.
 * - O role check espera o AuthProvider re-derivar o perfil (não persistido em
 *   localStorage por hardening XSS).
 * - /admin/login é isento.
 *
 * IMPORTANTE: não usar `useEffect` chamando `signOut()` aqui. Ele corre com a
 * propagação de estado após o login e apaga o token recém-salvo, causando
 * loop login → dashboard → login. O `<Navigate>` renderizado abaixo já cobre
 * o caso legítimo sem tocar em storage.
 */
export const Route = createFileRoute("/admin")({
  beforeLoad: ({ location }) => {
    if (location.pathname.startsWith("/admin/login")) return;

    const token = authStorage.getToken();
    if (!token) {
      throw redirect({
        to: "/admin/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AdminRouteGate,
});

function AdminRouteGate() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isLoginRoute = pathname.startsWith("/admin/login");

  if (isLoginRoute) {
    return <Outlet />;
  }

  if (loading) {
    if (import.meta.env.DEV) console.info("[guard] loading");
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando permissões…
      </div>
    );
  }

  // Só redireciona quando temos certeza: loading terminou e user é null.
  if (user === null) {
    if (import.meta.env.DEV) console.info("[guard] no user → /admin/login");
    return <Navigate to="/admin/login" replace />;
  }

  const role = (user.role || "").toUpperCase();
  if (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "OPERATOR") {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
