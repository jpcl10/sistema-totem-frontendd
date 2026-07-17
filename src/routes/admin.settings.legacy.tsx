import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/settings/legacy")({
  beforeLoad: ({ search }) => {
    const tab = typeof (search as { tab?: unknown }).tab === "string"
      ? (search as { tab: string }).tab
      : "";

    if (tab === "pagamentos") {
      throw redirect({ to: "/admin/settings/payments" });
    }
    if (tab === "impressao") {
      throw redirect({ to: "/admin/settings/printing" });
    }
    if (tab === "totem") {
      throw redirect({ to: "/admin/devices" });
    }
    if (tab === "operacional") {
      throw redirect({ to: "/admin/settings/organization" });
    }

    throw redirect({ to: "/admin/settings/organization" });
  },
});
