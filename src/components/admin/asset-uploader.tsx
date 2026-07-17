import { useRef, useState } from "react";
import { Loader2, Upload, Trash2, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { resolveAssetUrl } from "@/lib/auth";
import { uploadImage } from "@/lib/events-api";
import { handleApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

export interface AssetUploaderProps {
  label: string;
  description?: string;
  token: string | null;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  accept?: string;
  maxSizeMb?: number;
  aspect?: "square" | "wide" | "tall";
  disabled?: boolean;
}

/**
 * Generic image asset field.
 *
 * Reuses the existing POST /uploads/images pipeline via `uploadImage`
 * from events-api — this is a thin wrapper, not a re-implementation.
 */
export function AssetUploader({
  label,
  description,
  token,
  value,
  onChange,
  accept = "image/*",
  maxSizeMb = 5,
  aspect = "square",
  disabled,
}: AssetUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file?: File) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`Imagem muito grande (máx. ${maxSizeMb}MB)`);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(token, file);
      onChange(url);
      toast.success("Imagem enviada");
    } catch (err) {
      handleApiError(err, "Falha ao enviar imagem");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const boxCls = cn(
    "relative flex items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted/30",
    aspect === "square" && "h-24 w-24",
    aspect === "wide" && "h-24 w-full max-w-[280px]",
    aspect === "tall" && "h-32 w-24",
  );

  return (
    <div className="space-y-2">
      <div>
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div className="flex items-center gap-3">
        <div className={boxCls}>
          {value ? (
            <img src={resolveAssetUrl(value)} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={pick}
            disabled={disabled || uploading || !token}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {value ? "Trocar" : "Enviar"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => onChange(null)}
              disabled={disabled || uploading}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remover
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
