
export function getTotemUrl(slug: string) {
  return `/e/${slug}`;
}

export function getCallScreenUrl(slug: string) {
  return getEventCallScreenUrl(slug);
}

export function getEventCallScreenUrl(slug: string) {
  return `/chamada/evento/${slug}`;
}

export function getStoreCallScreenUrl(slug: string) {
  return `/chamada/loja/${slug}`;
}

export function openPublicUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}
