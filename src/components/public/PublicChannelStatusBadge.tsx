import { Badge } from "@/components/ui/badge";

interface Props {
  /**
   * Estado operacional real. `undefined` = não conhecido/contratado.
   * Componente é opcional: só renderiza quando o backend forneceu o valor.
   */
  openNow?: boolean;
  message?: string | null;
}

/**
 * Badge "Aberto/Fechado" — só renderiza quando existe valor operacional real
 * no contrato. Não inferimos status a partir de `active`, `status` etc.
 */
export function PublicChannelStatusBadge({ openNow, message }: Props) {
  if (typeof openNow !== "boolean") return null;
  return (
    <Badge variant={openNow ? "default" : "destructive"} className="gap-1.5" aria-live="polite">
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${openNow ? "bg-emerald-400" : "bg-white"}`}
      />
      {openNow ? "Aberto" : "Fechado"}
      {message && <span className="hidden sm:inline opacity-80">· {message}</span>}
    </Badge>
  );
}
