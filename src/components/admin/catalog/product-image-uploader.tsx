import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/auth";
import { uploadImage } from "@/lib/events-api";
import { handleApiError } from "@/lib/api-error";

export function ProductImageUploader({
  token,
  value,
  onChange,
  disabled,
}: {
  token: string | null;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file?: File) => {
    if (!file || !token) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx. 5MB)");
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

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
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
        {value ? "Trocar imagem" : "Enviar imagem"}
      </Button>
      {value && (
        <img
          src={resolveAssetUrl(value)}
          alt=""
          className="h-10 w-10 rounded border border-border object-cover"
        />
      )}
    </div>
  );
}
