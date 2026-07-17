import { createFileRoute } from "@tanstack/react-router";
import { CallScreenScreen } from "@/components/call-screen/CallScreenScreen";

export const Route = createFileRoute("/chamada/evento/$slug")({
  component: CallScreenEventPage,
});

function CallScreenEventPage() {
  const { slug } = Route.useParams();
  return <CallScreenScreen type="EVENT" slug={slug} />;
}

