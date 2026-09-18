"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  guardarCloserIdPropioAccion,
  type ResultadoAccion,
} from "@/app/(app)/perfil/acciones";

/**
 * Perfil propio (ticket 031). Muestra la identidad del usuario y su `closerId`.
 *
 * - Si `puedeEditar` (lo decide el servidor con `esAdministrador` sobre el rol de
 *   vista), aparece un campo editable y un boton de guardar. La mutacion es una server
 *   action que REENFORZA `esAdministrador` y escribe siempre sobre la propia fila
 *   (el id sale de la sesion, no de aca): esconder el input no es seguridad.
 * - Si no, se ve en modo LECTURA con la indicacion de a quien pedir el cambio.
 *
 * Tras guardar se llama `router.refresh()`: `revalidatePath` no refresca la pantalla
 * que acaba de escribir (AGENTS.md).
 */
export function PerfilPropio({
  nombre,
  email,
  closerId,
  puedeEditar,
}: {
  nombre: string;
  email: string;
  closerId: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [valor, setValor] = useState(closerId ?? "");

  const claseInput =
    "h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

  function guardar() {
    startTransition(async () => {
      const res: ResultadoAccion = await guardarCloserIdPropioAccion({ closerId: valor });
      if (res.ok) {
        toast.success("closer_id actualizado");
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: res.error });
      }
    });
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Nombre: </span>
            {nombre}
          </p>
          <p className="truncate">
            <span className="text-muted-foreground">Correo: </span>
            {email}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">closer_id</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Es el nombre con el que apareces en la columna Closer de la BBDD. Con él se
            cruzan tus llamadas, ventas y abonos.
          </p>

          {puedeEditar ? (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                guardar();
              }}
            >
              <label className="block space-y-1">
                <span className="text-muted-foreground">Tu closer_id</span>
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  maxLength={80}
                  className={claseInput}
                  aria-label="Tu closer_id"
                  placeholder="Ej: Andrea"
                />
              </label>
              <div className="flex justify-end">
                <Button type="submit" size="sm" disabled={pendiente}>
                  Guardar
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-1">
              <p>
                <span className="text-muted-foreground">Tu closer_id: </span>
                {closerId ? (
                  <span className="font-medium">{closerId}</span>
                ) : (
                  <span className="text-muted-foreground">sin asignar</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Solo un administrador puede cambiarlo. Pídeselo a tu gerente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
