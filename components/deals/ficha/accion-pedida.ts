"use client";

import { useEffect, useEffectEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AccionDeRespuesta } from "../pregunta-de-etapa";

/**
 * Una respuesta de la pregunta de la etapa que no es una flecha directa (ADR 0072): abre el
 * formulario que ya existe en su sección de la ficha. La ficha y el Kanban la piden igual,
 * por la URL (`?accion=abono#pago`), así no hay un segundo camino para registrar nada: la
 * llamada y el abono se escriben con sus formularios de siempre, y el motor mueve el deal
 * desde ahí. Las actividades abren su propio dialogo desde `useResponder`.
 */
export type AccionDeFicha = "agendar" | "reprogramar" | "fallida" | "abono";

const SECCION: Record<AccionDeFicha, string> = {
  agendar: "llamadas",
  reprogramar: "llamadas",
  fallida: "llamadas",
  abono: "pago",
};

/** El formulario que abre una respuesta, o `null` si la respuesta es una flecha. */
export function accionDeFicha(accion: AccionDeRespuesta): AccionDeFicha | null {
  switch (accion.tipo) {
    case "llamada":
      return accion.uso;
    case "abono":
      return "abono";
    default:
      return null;
  }
}

/** El enlace a la ficha con el formulario pedido. */
export function enlaceDeAccion(rutaDeLaFicha: string, accion: AccionDeFicha): string {
  return `${rutaDeLaFicha}?accion=${accion}#${SECCION[accion]}`;
}

/** El id del `Card` de cada sección, para que el enlace llegue a ella. */
export const ID_DE_SECCION = { llamadas: "llamadas", pago: "pago" } as const;

/**
 * Cuando la URL pide una de las acciones de `acepta`, llama a `alPedir` UNA vez, lleva la
 * vista a la sección y limpia el parámetro (así refrescar no vuelve a abrir el formulario).
 */
export function useAccionPedida(acepta: readonly AccionDeFicha[], alPedir: (accion: AccionDeFicha) => void) {
  const params = useSearchParams();
  const router = useRouter();
  const ruta = usePathname();
  const pedida = params.get("accion");
  const pedir = useEffectEvent((accion: AccionDeFicha) => alPedir(accion));
  const aceptadas = acepta.join(",");

  useEffect(() => {
    const accion = aceptadas.split(",").find((a) => a === pedida) as AccionDeFicha | undefined;
    if (!accion) return;
    pedir(accion);
    document.getElementById(SECCION[accion])?.scrollIntoView({ behavior: "smooth", block: "start" });
    router.replace(ruta, { scroll: false });
  }, [pedida, aceptadas, router, ruta]);
}
