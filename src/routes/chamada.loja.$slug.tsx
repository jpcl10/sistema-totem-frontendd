import { createFileRoute } from "@tanstack/react-router";
import { CallScreenScreen } from "@/components/call-screen/CallScreenScreen";

export const Route = createFileRoute("/chamada/loja/$slug")({
  component: CallScreenStorePage,
});

function CallScreenStorePage() {
  const { slug } = Route.useParams();
  return <CallScreenScreen type="STORE" slug={slug} />;
}

