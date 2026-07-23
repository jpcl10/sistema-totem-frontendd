import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useOrganization } from "@/contexts/organization-context";

export function OrgBreadcrumb({ pageTitle: _pageTitle }: { pageTitle: string }) {
  const { isImpersonating, organizationName } = useOrganization();

  // Only render the breadcrumb when a SUPER_ADMIN is impersonating another
  // organization. For a regular ADMIN, the organization name should NOT
  // appear above every page title (visual noise / duplication).
  if (!isImpersonating) return null;


  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-xs text-muted-foreground"
    >
      {isImpersonating && (
        <>
          <Link to="/super-admin" className="hover:text-foreground">
            Superadministrador
          </Link>
          <ChevronRight className="h-3 w-3" />
        </>
      )}
      {organizationName && <span className="text-foreground/80">{organizationName}</span>}
    </nav>
  );
}
