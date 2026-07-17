import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CallScreenLayoutProps = {
  children: ReactNode;
  backgroundColor?: string | null;
  textColor?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  className?: string;
};

function hexToRgba(hex: string | null | undefined, alpha: number, fallback: string) {
  if (!hex) return fallback;
  const value = hex.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(value);
  const full = /^#([0-9a-f]{6})$/i.exec(value);
  const rgb = short
    ? short[1].split("").map((part) => Number.parseInt(part + part, 16))
    : full
      ? [0, 2, 4].map((start) => Number.parseInt(full[1].slice(start, start + 2), 16))
      : null;
  if (!rgb) return fallback;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function CallScreenLayout({
  children,
  backgroundColor,
  textColor,
  primaryColor,
  secondaryColor,
  className,
}: CallScreenLayoutProps) {
  const style: CSSProperties & Record<string, string> = {
    "--call-background": backgroundColor ?? "#020617",
    "--call-text": textColor ?? "#f8fafc",
    "--call-primary": primaryColor ?? "#ea580c",
    "--call-secondary": secondaryColor ?? "#0f172a",
    backgroundColor: backgroundColor ?? "#020617",
    color: textColor ?? "#f8fafc",
    backgroundImage: [
      `linear-gradient(180deg, ${hexToRgba(primaryColor, 0.18, "rgba(15, 23, 42, 0.18)")}, ${hexToRgba(
        backgroundColor,
        0.96,
        "rgba(2, 6, 23, 0.96)",
      )})`,
      `radial-gradient(circle at top left, ${hexToRgba(primaryColor, 0.18, "rgba(234, 88, 12, 0.18)")} 0%, transparent 36%)`,
      `radial-gradient(circle at top right, ${hexToRgba(secondaryColor, 0.18, "rgba(15, 23, 42, 0.18)")} 0%, transparent 32%)`,
    ].join(", "),
  };

  return (
    <div
      className={cn("min-h-screen overflow-hidden bg-slate-950 text-slate-50", className)}
      style={style}
    >
      <div className="min-h-screen bg-[linear-gradient(180deg,rgba(2,6,23,0.08),rgba(2,6,23,0.46))]">
        {children}
      </div>
    </div>
  );
}

