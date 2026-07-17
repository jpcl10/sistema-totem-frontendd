import * as React from "react";
import { resolveAssetUrl } from "@/lib/auth";
import { ImageOff } from "lucide-react";

interface EventLogoProps {
  src?: string | null;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-12 w-12 text-[12px]",
  lg: "h-20 w-20 text-[16px]",
  xl: "h-32 w-32 text-[20px]",
};

export function EventLogo({ src, alt, className = "", size = "md" }: EventLogoProps) {
  const [error, setError] = React.useState(false);
  const resolvedSrc = src ? resolveAssetUrl(src) : undefined;

  if (!resolvedSrc || error) {
    return (
      <div 
        className={`flex items-center justify-center rounded-xl bg-muted text-muted-foreground border border-border shrink-0 ${sizeClasses[size]} ${className}`}
        title={alt}
      >
        <ImageOff className="opacity-50" size={size === "sm" ? 14 : size === "md" ? 18 : 24} />
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      onError={() => setError(true)}
      className={`rounded-xl object-cover border border-border shrink-0 bg-card ${sizeClasses[size]} ${className}`}
    />
  );
}
