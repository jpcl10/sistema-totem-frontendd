import { createFileRoute } from "@tanstack/react-router";
import { PublicMenuPage } from "./e.$slug";

export const Route = createFileRoute("/e/$organizationSlug/$eventSlug")({
  component: CanonicalPublicMenuPage,
});

function CanonicalPublicMenuPage() {
  const { organizationSlug, eventSlug } = Route.useParams();
  return <PublicMenuPage organizationSlug={organizationSlug} eventSlug={eventSlug} />;
}
