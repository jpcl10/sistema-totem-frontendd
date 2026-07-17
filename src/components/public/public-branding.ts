import type { CSSProperties } from "react";
import { resolveAssetUrl } from "@/lib/auth";
import type { PublicEvent } from "@/lib/public-api";

/**
 * Objeto normalizado de branding público para canais de evento (Totem, cardápio).
 * Consome apenas campos que existem em `PublicEvent` — não inventa DTOs.
 */
export interface PublicEventBranding {
  /** Nome do evento/estabelecimento. */
  name: string;
  /** Mensagem operacional/slogan configurada no backend. `null` se ausente. */
  welcomeMessage: string | null;
  /** Logo já resolvido em URL absoluta. `null` se ausente ou oculto. */
  logoUrl: string | null;
  /** Banner já resolvido em URL absoluta. `null` se ausente. */
  bannerUrl: string | null;
  /** Deve mostrar o logo (respeita `totemShowLogo`). */
  showLogo: boolean;
  /** Cor primária resolvida (hex configurada OU fallback via token do Design System). */
  primaryColor: string;
  /** Cor secundária resolvida. */
  secondaryColor: string;
  /** Cor de fundo do canal (do totem). Pode ser hex ou fallback via token. */
  backgroundColor: string;
  /** Cor de texto legível sobre `backgroundColor`. */
  textColor: string;
  /** CSS custom properties prontas para aplicar em `style`. */
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

function expandHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length === 3)
    return h
      .split("")
      .map((c) => c + c)
      .join("");
  return h.slice(0, 6);
}

/** Preto/branco conforme luminância percebida do hex informado. */
export function readableForeground(hex: string): string {
  if (!isHex(hex)) return TOKEN_FG;
  const full = expandHex(hex);
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0F172A" : "#FFFFFF";
}

/**
 * Hook puro (sem estado) que normaliza o branding de um `PublicEvent`.
 * Único lugar responsável por fallbacks, resolução de asset e contraste.
 */
export function usePublicEventBranding(event: PublicEvent | null | undefined): PublicEventBranding {
  const name = event?.name?.trim() ?? "";
  const welcomeRaw = event?.totemWelcomeMessage;
  const welcomeMessage =
    typeof welcomeRaw === "string" && welcomeRaw.trim().length > 0 ? welcomeRaw.trim() : null;

  const showLogo = event?.totemShowLogo !== false;
  const rawLogo = resolveAssetUrl(event?.logoUrl);
  const logoUrl = showLogo && rawLogo ? rawLogo : null;

  const rawBanner = resolveAssetUrl(event?.bannerUrl);
  const bannerUrl = rawBanner || null;

  const primaryColor = isHex(event?.primaryColor) ? (event!.primaryColor as string) : TOKEN_PRIMARY;
  const secondaryColor = isHex(event?.secondaryColor)
    ? (event!.secondaryColor as string)
    : TOKEN_SECONDARY;
  const backgroundColor = isHex(event?.totemBackgroundColor)
    ? (event!.totemBackgroundColor as string)
    : TOKEN_BG;

  // Cor de texto: prioriza campo configurado; senão, calcula contraste quando
  // o fundo for hex; senão, cai para o token de foreground.
  let textColor: string;
  if (isHex(event?.totemTextColor)) {
    textColor = event!.totemTextColor as string;
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
    showLogo: showLogo && !!logoUrl,
    primaryColor,
    secondaryColor,
    backgroundColor,
    textColor,
    cssVars,
  };
}
