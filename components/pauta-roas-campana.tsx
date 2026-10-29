"use client";

import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * La fila de una campaña del ROAS: toda la fila abre un diálogo con sus conjuntos y anuncios, en vez de
 * desplegarlos dentro de la tabla. Un clic en un enlace de la fila (una cifra) sigue yendo a su lista.
 */
export function FilaDeCampana({ nombre, detalle, children }: { nombre: string; detalle: ReactNode; children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  return <>
    <tr className="cursor-pointer" onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) setAbierto(true); }}>
      {children}
    </tr>
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-6xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="pr-8 break-words">{nombre}</DialogTitle>
          <DialogDescription>Conjuntos y anuncios de la campaña.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">{detalle}</div>
      </DialogContent>
    </Dialog>
  </>;
}
