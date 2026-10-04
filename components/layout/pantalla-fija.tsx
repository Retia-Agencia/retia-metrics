import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PantallaFija({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>{children}</div>;
}
