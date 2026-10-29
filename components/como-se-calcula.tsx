"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function ComoSeCalcula({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="link" size="sm" />}>
        Cómo se calcula
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cómo se calcula</DialogTitle>
          <DialogDescription>Fuentes, fórmulas y datos que todavía pueden completar la lectura.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
