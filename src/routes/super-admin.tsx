import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AccessDenied } from "@/components/super-admin-layout";

function SuperAdminGuard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const role = (user?.role || "").toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/admin/login", replace: true });
      return;
    }
    if (!isSuperAdmin) {
      navigate({ to: "/admin/dashboard", replace: true });
    }
  }, [loading, user, isSuperAdmin, navigate]);

  if (loading || !user) return null;
  if (!isSuperAdmin) return <AccessDenied />;
  return <Outlet />;
}

export const Route = createFileRoute("/super-admin")({
  component: SuperAdminGuard,
});
