"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { anularRegistroAccion } from "@/app/(app)/personas/acciones";

/**
 * Boton de anular con su motivo (ticket 029, ADR 0026). Lo usan el historial de la
 * persona y la lista de ventas de `/mi-dia`.
 *
 * El motivo es obligatorio y se pide en el momento, no despues: sin motivo no hay
 * anulacion (ADR 0026 punto 6), y el `required` del input evita el viaje al servidor
 * para lo que ya se sabe. La validacion de verdad sigue estando en el servidor y en
 * el CHECK de la base; esto solo ahorra el viaje.
 *
 * **El boton se muestra siempre, y a proposito.** Un closer que intente anular lo de
 * otro recibe un mensaje que le dice a quien pedirselo. La alternativa —calcular
 * aca si puede— pondria la regla del ADR 0026 punto 6 en dos sitios, y el dia que
 * cambie uno el otro miente. La seguridad la da el servidor; esto es la UI.
 */
export function AnularRegistro({
  tipo,
  id,
  queEs,
  texto = "Anular",
  alAnular,
}: {
  tipo: "llamada" | "venta" | "abono";
  id: string;
  /** Como se nombra en la pregunta de confirmacion: "esta venta", "este abono". */
  queEs: string;
  /**
   * Texto del boton. Por defecto "Anular", pero una venta con abonos tiene TRES
   * botones apilados —uno por abono y el suyo— y todos decian lo mismo: el de abajo
   * se lleva la venta entera por delante y parecia uno mas de la lista. El texto los
   * separa.
   */
  texto?: string;
  /** Se llama cuando la anulacion salio bien, ademas del refresco de la ruta. */
  alAnular?: () => void;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendiente, startTransition] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await anularRegistroAccion({ tipo, id, motivo });
      if (res.ok) {
        toast.success(res.mensaje);
        setAbierto(false);
        setMotivo("");
        // `revalidatePath` en el servidor NO alcanza: la pantalla se queda con el
        // payload que ya tenia y sigue mostrando el abono sin tachar y el total
        // viejo. Verificado en el navegador el 18-sep — la escritura estaba bien y
        // la pantalla mentia, que es peor que fallar. `router.refresh()` vuelve a
        // pedir el arbol de servidor de la ruta actual.
        router.refresh();
        alAnular?.();
      } else {
        toast.error("No se pudo anular", { description: res.error });
      }
    });
  }

  if (!abierto) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="text-muted-foreground hover:text-destructive"
        onClick={() => setAbierto(true)}
      >
        {texto}
      </Button>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-2 space-y-2 rounded-md border border-dashed p-3">
      <p className="text-sm">
        Anular {queEs}. Deja de contar en todas las cifras, pero se sigue viendo aquí.
      </p>
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        required
        autoFocus
        placeholder="¿Por qué se anula?"
        aria-label="Motivo de la anulación"
        className="h-8 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="destructive" disabled={pendiente}>
          {pendiente ? "Anulando…" : "Anular"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pendiente}
          onClick={() => setAbierto(false)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
