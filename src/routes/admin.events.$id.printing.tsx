import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/events/$id/printing")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/settings/printing",
      search: { eventId: params.id },
    });
  },
});
