import { UtensilsCrossed } from "lucide-react";
import { useEffect, useState } from "react";

type Size = "xs" | "sm" | "md" | "lg";

const heightClass: Record<Size, string> = {
  xs: "h-10 w-10",
  sm: "h-20 w-20",
  md: "h-40 w-full",
  lg: "aspect-square w-full",
};

const iconClass: Record<Size, string> = {
  xs: "h-5 w-5",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
};

export function ProductImage({
  src,
  alt,
  size = "lg",
  rounded = "rounded-xl",
  className = "",
  hoverZoom = false,
}: {
  src?: string | null;
  alt: string;
  size?: Size;
  rounded?: string;
  className?: string;
  hoverZoom?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = !!src && !failed;
  const initial = (alt || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-muted via-muted/70 to-muted/40 ${heightClass[size]} ${rounded} ${className}`}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={`h-full w-full object-cover object-center ${
            hoverZoom ? "transition-transform duration-300 group-hover:scale-105" : ""
          }`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground/80">
          <div className="flex items-center justify-center rounded-full bg-background/60 backdrop-blur-sm shadow-sm p-3">
            <UtensilsCrossed className={iconClass[size]} />
          </div>
          {(size === "lg" || size === "md") && (
            <span className="text-xs font-semibold uppercase tracking-wider opacity-70">
              {initial}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
