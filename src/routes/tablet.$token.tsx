import { createFileRoute } from "@tanstack/react-router";

import { TabletApp } from "@/tablet/tablet-components";
import "@/tablet/tablet.css";

export const Route = createFileRoute("/tablet/$token")({
  component: TabletRoute,
});

function TabletRoute() {
  const { token } = Route.useParams();

  return <TabletApp token={token} />;
}
