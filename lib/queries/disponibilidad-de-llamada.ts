import { porQueAunNoOcurrio } from "@/lib/deals/llamadas";

/** Proyección serializable que el servidor entrega a los componentes cliente. */
export function disponibilidadParaMarcarAtendida(fechaAgenda: Date | null, ahora: Date) {
  const mensajeNoPuedeMarcarAtendida = porQueAunNoOcurrio(fechaAgenda, ahora);
  return { puedeMarcarAtendida: mensajeNoPuedeMarcarAtendida == null, mensajeNoPuedeMarcarAtendida };
}
