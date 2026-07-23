
export function buildPublicEventUrl({
  organizationSlug,
  eventSlug,
  absoluteBaseUrl,
}: {
  organizationSlug: string;
  eventSlug: string;
  absoluteBaseUrl?: string | null;
}) {
  const path = `/e/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(eventSlug)}`;
  return absoluteBaseUrl ? `${absoluteBaseUrl.replace(/\/+$/, "")}${path}` : path;
}

export function getTotemUrl(eventSlug: string, organizationSlug?: string | null) {
  if (!organizationSlug) {
    return null;
  }

  return buildPublicEventUrl({ organizationSlug, eventSlug });
}

export function getCallScreenUrl(eventSlug: string, organizationSlug?: string | null) {
  return getEventCallScreenUrl(eventSlug, organizationSlug);
}

export function getEventCallScreenUrl(eventSlug: string, organizationSlug?: string | null) {
  if (organizationSlug) {
    return `/chamada/evento/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(eventSlug)}`;
  }

  return `/chamada/evento/${encodeURIComponent(eventSlug)}`;
}

export function getStoreCallScreenUrl(slug: string) {
  return `/chamada/loja/${slug}`;
}

export function openPublicUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
