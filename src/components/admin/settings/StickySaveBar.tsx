import { Loader2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatUpdatedAt(iso: string | null | undefined): string {
  if (!iso) return "Última atualização indisponível";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Última atualização indisponível";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  if (sameDay) return `Última atualização: hoje às ${hh}:${mm}`;
  return `Última atualização: ${d.toLocaleDateString("pt-BR")} às ${hh}:${mm}`;
}

export function StickySaveBar({
  visible,
  saving,
  onSave,
  onCancel,
  message = "Alterações não salvas",
  disabled,
  updatedAt,
}: {
  visible: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  message?: string;
  disabled?: boolean;
  updatedAt?: string | null;
}) {
  if (!visible) return null;
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 -mx-6 mt-6 border-t border-border bg-card/95 px-6 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur",
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        "pb-[calc(env(safe-area-inset-bottom,0)+0.75rem)]",
      )}
      role="region"
      aria-label="Ações do formulário"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{message}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatUpdatedAt(updatedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Descartar
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || disabled}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar
        </Button>
      </div>
    </div>
  );
}
