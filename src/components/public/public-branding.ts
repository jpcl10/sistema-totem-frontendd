import type { CSSProperties } from "react";
import { resolveAssetUrl } from "@/lib/auth";
import type { PublicEvent } from "@/lib/public-api";

export interface PublicEventBranding {
  name: string;
  welcomeMessage: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  bannerMobileUrl: string | null;
  defaultProductImageUrl: string | null;
  version: string | null;
  showLogo: boolean;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  cssVars: CSSProperties;
}

const TOKEN_PRIMARY = "hsl(var(--primary))";
const TOKEN_SECONDARY = "hsl(var(--secondary))";
const TOKEN_BG = "hsl(var(--background))";
const TOKEN_FG = "hsl(var(--foreground))";

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function isHex(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v.trim());
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function versionAssetUrl(url: string | null, version: string | null): string | null {
  const resolved = resolveAssetUrl(url ?? undefined);
  if (!resolved || !version) return resolved || null;
  if (/([?&])v=/.test(resolved)) return resolved;
  return `${resolved}${resolved.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

function expandHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  return h.slice(0, 6);
}

export function readableForeground(hex: string): string {
  if (!isHex(hex)) return TOKEN_FG;
  const full = expandHex(hex);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0F172A" : "#FFFFFF";
}

export function usePublicEventBranding(event: PublicEvent | null | undefined): PublicEventBranding {
  const name = event?.name?.trim() ?? "";
  const branding = event?.branding;
  const version = firstString(branding?.updatedAt, (event as Record<string, unknown> | undefined)?.updatedAt);
  const welcomeRaw = event?.totemWelcomeMessage;
  const welcomeMessage =
    typeof welcomeRaw === "string" && welcomeRaw.trim().length > 0 ? welcomeRaw.trim() : null;

  const showLogo = event?.totemShowLogo !== false;
  const logoUrl = showLogo
    ? versionAssetUrl(firstString(event?.logoUrl, branding?.logoUrl), version)
    : null;
  const bannerUrl = versionAssetUrl(firstString(event?.bannerUrl, branding?.bannerUrl), version);
  const bannerMobileUrl = versionAssetUrl(
    firstString(event?.bannerMobileUrl, branding?.bannerMobileUrl),
    version,
  );
  const defaultProductImageUrl = versionAssetUrl(
    firstString(event?.defaultProductImageUrl, branding?.defaultProductImageUrl),
    version,
  );

  const primaryCandidate = firstString(event?.primaryColor, branding?.primaryColor);
  const secondaryCandidate = firstString(event?.secondaryColor, branding?.secondaryColor);
  const backgroundCandidate = firstString(event?.totemBackgroundColor, branding?.backgroundColor);
  const primaryColor = isHex(primaryCandidate) ? primaryCandidate : TOKEN_PRIMARY;
  const secondaryColor = isHex(secondaryCandidate) ? secondaryCandidate : TOKEN_SECONDARY;
  const backgroundColor = isHex(backgroundCandidate) ? backgroundCandidate : TOKEN_BG;

  let textColor: string;
  if (isHex(event?.totemTextColor)) {
    textColor = event.totemTextColor;
  } else if (isHex(backgroundColor)) {
    textColor = readableForeground(backgroundColor);
  } else {
    textColor = TOKEN_FG;
  }

  const cssVars: CSSProperties = {
    ["--brand-primary" as string]: primaryColor,
    ["--brand-secondary" as string]: secondaryColor,
    ["--brand-bg" as string]: backgroundColor,
    ["--brand-fg" as string]: textColor,
  };

  return {
    name,
    welcomeMessage,
    logoUrl,
    bannerUrl,
    bannerMobileUrl,
    defaultProductImageUrl,
    version,
    showLogo: showLogo && !!logoUrl,
    primaryColor,
    secondaryColor,
    backgroundColor,
    textColor,
    cssVars,
  };
}
