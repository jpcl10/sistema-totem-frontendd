import { Link } from "@tanstack/react-router";
import { Building2, Eye, ShieldCheck, X, MapPin } from "lucide-react";
import { useOrganization } from "@/contexts/organization-context";
import { moduleLabel } from "@/lib/organization-modules";
import { resolveAssetUrl } from "@/lib/auth";

export function OrgBanner() {
  const {
    organization,
    organizationName,
    organizationSlug,
    organizationModules,
    isImpersonating,
    exitImpersonation,
  } = useOrganization();

  if (!isImpersonating) return null;

  const logo = resolveAssetUrl(organization?.logoUrl as string | undefined);
  const status =
    organization?.status ?? (organization?.active === false ? "INATIVA" : "ATIVA");
  const initials = (organizationName ?? "?")
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();

  return (
    <div className="border-b border-primary/20 bg-primary/5">
      <div className="flex flex-wrap items-center gap-3 px-6 py-2">
        <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border border-border bg-card text-primary">
          {logo ? (
            <img src={logo} alt={organizationName ?? ""} className="h-full w-full object-cover" />
          ) : initials ? (
            <span className="text-xs font-semibold text-primary">{initials}</span>
          ) : (
            <Building2 className="h-4 w-4" />
          )}
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
          <ShieldCheck className="h-3 w-3" /> Super Admin
        </span>

        <span className="truncate text-sm font-semibold text-foreground">
          {organizationName ?? "—"}
        </span>

        {organizationSlug && (
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {organizationSlug}
          </code>
        )}

        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
            status.toString().toUpperCase().includes("INATIV")
              ? "bg-muted text-muted-foreground"
              : status.toString().toUpperCase().includes("TRIAL")
                ? "bg-amber-500/15 text-amber-600"
                : "bg-emerald-500/15 text-emerald-600"
          }`}
        >
          {status}
        </span>

        {organization?.city && (
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" /> {organization.city}
            {organization.state ? ` · ${organization.state}` : ""}
          </span>
        )}

        <div className="hidden flex-wrap gap-1 md:flex">
          {organizationModules.slice(0, 6).map((m) => (
            <span
              key={m}
              className="inline-flex items-center rounded border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary"
            >
              {moduleLabel(m)}
            </span>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            to="/super-admin/organizations"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent"
          >
            <Eye className="h-3.5 w-3.5" /> Trocar
          </Link>
          <button
            onClick={() => {
              void exitImpersonation();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" /> Sair
          </button>
        </div>
      </div>
    </div>
  );
}
