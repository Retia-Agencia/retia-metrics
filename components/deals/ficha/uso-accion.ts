"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ResultadoFicha } from "@/app/(app)/p/[programa]/deals/[id]/acciones";

/**
 * Como la ficha corre una server action (ticket 074): en una transicion, avisa el resultado
 * y, si escribio, refresca la pantalla ACTUAL con `router.refresh()`. `revalidatePath` no
 * refresca la ruta que acaba de escribir (AGENTS.md); la accion ya invalido el Kanban.
 * Un rechazo se dice con el mensaje del servidor (que falta, por que no), no con un generico.
 */
export function useAccion() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  function correr<T extends object>(
    accion: () => Promise<ResultadoFicha<T>>,
    opciones: { exito: string | ((r: { ok: true } & T) => string); alExito?: () => void },
  ) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(typeof opciones.exito === "function" ? opciones.exito(r) : opciones.exito);
        opciones.alExito?.();
        router.refresh();
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  }

  return { pendiente, correr };
}
