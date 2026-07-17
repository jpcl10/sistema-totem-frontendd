import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { PublicEvent } from "@/lib/public-api";
import { usePublicEventBranding } from "./public-branding";
import { PublicChannelStatusBadge } from "./PublicChannelStatusBadge";

interface Props {
  event: PublicEvent | null | undefined;
  onBack?: () => void;
  /** Slot à direita para ações contextuais (ex.: botão de carrinho). */
  actions?: ReactNode;
  /** Status operacional opcional; só renderiza quando fornecido. */
  openNow?: boolean;
  /** Slot embaixo do header (ex.: tabs de categoria da rota atual). */
  children?: ReactNode;
}

/**
 * Header padronizado para telas internas do canal público (Totem/cardápio).
 * Aplica branding normalizado e mantém identidade curta:
 * voltar · logo/nome · ações. Não repete banner nem mensagem da Home.
 */
export function PublicChannelHeader({ event, onBack, actions, openNow, children }: Props) {
  const branding = usePublicEventBranding(event);

  return (
    <header
      className="sticky top-0 z-30 flex-shrink-0 border-b border-border/40 shadow-sm backdrop-blur"
      style={{
        ...branding.cssVars,
        background: "var(--brand-bg)",
        color: "var(--brand-fg)",
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:py-4">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="shrink-0 text-[color:var(--brand-fg)] hover:bg-white/10"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        {branding.showLogo && branding.logoUrl ? (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95 p-1 shadow-sm sm:h-12 sm:w-12">
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="max-h-full max-w-full object-contain"
              draggable={false}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-black leading-tight tracking-tight sm:text-xl">
            {branding.name}
          </h1>
          {typeof openNow === "boolean" && (
            <div className="mt-1">
              <PublicChannelStatusBadge openNow={openNow} />
            </div>
          )}
        </div>

        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {children}
    </header>
  );
}
