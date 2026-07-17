import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/admin/empty-state";

interface PageEmptyProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; href?: string };
  className?: string;
  children?: ReactNode;
}

/** Alias over `EmptyState` — same visuals, canonical name for page-level use. */
export function PageEmpty(props: PageEmptyProps) {
  return <EmptyState {...props} />;
}
