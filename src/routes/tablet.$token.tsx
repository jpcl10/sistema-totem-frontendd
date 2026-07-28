import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { PublicChannelError } from "@/components/public/PublicChannelError";
import { PublicChannelLoading } from "@/components/public/PublicChannelLoading";
import { resolveTabletContext, type TabletContext } from "@/lib/tablet-api";
import { PublicMenuPage } from "./e.$slug";

export const Route = createFileRoute("/tablet/$token")({
  component: TabletRoute,
});

function TabletRoute() {
  const { token } = Route.useParams();
  const [context, setContext] = useState<TabletContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    resolveTabletContext(token)
      .then((nextContext) => {
        if (!alive) return;
        setContext(nextContext);
      })
      .catch(() => {
        if (!alive) return;
        setError("Tablet não autorizado ou dispositivo inativo.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (loading) return <PublicChannelLoading />;

  if (error || !context?.organizationSlug || !context?.eventSlug) {
    return (
      <PublicChannelError
        message={error ?? "Token do tablet não possui evento vinculado."}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <PublicMenuPage
      organizationSlug={context.organizationSlug}
      eventSlug={context.eventSlug}
      deviceToken={token}
      forceExperienceContext="TABLET"
    />
  );
}
