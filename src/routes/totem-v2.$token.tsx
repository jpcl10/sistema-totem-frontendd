import { createFileRoute } from "@tanstack/react-router";

import { TotemV2App } from "@/totem-v2/totem-v2-components";

export const Route = createFileRoute("/totem-v2/$token")({
  component: TotemV2Route,
});

function TotemV2Route() {
  const { token } = Route.useParams();

  return <TotemV2App token={token} />;
}
