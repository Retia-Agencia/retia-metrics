"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  desmarcarOnboardedAccion,
  marcarOnboardedAccion,
} from "@/app/(app)/p/[programa]/deals/[id]/acciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * La celda de Onboarding de la lista de Students (ticket 145): marca y desmarca el
 * onboarding de un estudiante sin entrar a la ficha del deal. Reusa las server actions de
 * la ficha (`marcarOnboardedAccion` / `desmarcarOnboardedAccion`), ya abiertas al customer
 * success; QUIÉN puede sobre ESTE deal lo decide el servidor (la reja de `marcaOnboarding`
 * más el dueño o quien administra), no que el botón aparezca. Un rechazo se dice con el
 * mensaje del servidor.
 *
 * Se le muestra a todo rol que pasa `marcaOnboarding` (la página decide); los datos entran
 * por props. Es cliente a propósito: hace `router.refresh()` tras escribir, porque
 * `revalidatePath` no refresca la pantalla que acaba de escribir (AGENTS.md).
 */
export function OnboardingCelda({
  dealId,
  fechaOnboarding,
}: {
  dealId: string;
  /** La fecha del onboarding ya formateada en Bogotá, o `null` si no está onboarded. */
  fechaOnboarding: string | null;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  function correr(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(exito);
        router.refresh();
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  }

  if (fechaOnboarding) {
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant="exito">
          <span className="cifra">{fechaOnboarding}</span>
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          disabled={pendiente}
          onClick={() => correr(() => desmarcarOnboardedAccion({ dealId }), "Onboarding desmarcado.")}
        >
          Quitar
        </Button>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant="alerta">Sin onboarding</Badge>
      <Button
        size="sm"
        variant="secondary"
        disabled={pendiente}
        onClick={() => correr(() => marcarOnboardedAccion({ dealId }), "Onboarding marcado.")}
      >
        Marcar
      </Button>
    </span>
  );
}
