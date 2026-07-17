import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/events/$id/payments")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/admin/settings/payments",
      search: { contextType: "EVENT", eventId: params.id },
    });
  },
});
