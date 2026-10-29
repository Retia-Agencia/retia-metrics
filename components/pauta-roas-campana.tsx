"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PARAMETRO = "roas_campana";

/**
 * La fila de una campaña del ROAS: toda la fila abre un diálogo con sus conjuntos y anuncios, en vez de
 * desplegarlos dentro de la tabla. Un clic en un enlace de la fila (una cifra) sigue yendo a su lista.
 * El diálogo abierto vive en la URL (`roas_campana`): así la lista a la que se salta lo trae en su `desde`
 * y al volver el diálogo sigue abierto.
 */
export function FilaDeCampana({ id, nombre, detalle, children }: { id: string; nombre: string; detalle: ReactNode; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();
  const abierto = busqueda.get(PARAMETRO) === id;

  const fijar = (abrir: boolean) => {
    const q = new URLSearchParams(busqueda.toString());
    if (abrir) q.set(PARAMETRO, id);
    else q.delete(PARAMETRO);
    const query = q.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return <>
    <tr className="cursor-pointer" onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) fijar(true); }}>
      {children}
    </tr>
    <Dialog open={abierto} onOpenChange={fijar}>
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
