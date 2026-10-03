"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cambiarVista } from "@/app/(app)/acciones-vista";

/**
 * La barra fija de "ver como" (ticket 172): avisa que la sesión está suplantando a un
 * closer y que todo es SOLO LECTURA, con un botón para salir. Se muestra solo cuando la
 * sesión efectiva trae `suplantadoPor` (lo decide el servidor en el layout).
 *
 * "Salir" llama `cambiarVista("todo")` —que corre con el rol REAL (ticket 172), así que
 * funciona aunque la vista esté suplantando— y luego `router.refresh()`, porque la vista
 * cambia lo que TODA pantalla proyecta y `revalidatePath` no refresca la actual
 * (AGENTS.md).
 *
 * Sin colores a mano (sistema "Tinta", docs/structure.md §9): usa los tokens del acento
 * morado (`bg-marca-suave`, `text-marca`) y un `Button` del sistema.
 *
 * NO es sticky (ticket 177): la cabecera de cada pantalla (`PageShell`) ya es `sticky
 * top-0`, y una barra sticky encima se montaba sobre ella al hacer scroll. Siendo un aviso
 * normal del flujo, se desplaza con la página y deja que la cabecera se fije sola.
 */
export function BarraSuplantacion({ nombre }: { nombre: string }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  function salir() {
    iniciar(async () => {
      await cambiarVista("todo");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-marca-suave px-4 py-2 text-sm text-marca">
      <span className="flex items-center gap-2">
        <Eye className="size-4 shrink-0" aria-hidden />
        <span>
          Estás viendo como <span className="font-medium">{nombre}</span>: solo lectura.
        </span>
      </span>
      <Button variant="outline" size="sm" onClick={salir} disabled={pendiente}>
        Salir
      </Button>
    </div>
  );
}
