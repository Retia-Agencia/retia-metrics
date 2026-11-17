import type { CortePauta } from "@/lib/queries/atribucion-de-pauta";

export const NIVELES_DE_CORTE = [
  { id: "cuenta_meta", etiqueta: "Cuenta de Meta", resumen: "Cuenta" },
  { id: "campana", etiqueta: "Campaña", resumen: "Campaña" },
  { id: "conjunto", etiqueta: "Conjunto", resumen: "Conjunto" },
  { id: "anuncio", etiqueta: "Anuncio", resumen: "Anuncio" },
] as const;

export interface OpcionDeCorte {
  id: string;
  nivel: CortePauta["nivel"];
  nombre: string;
  idMeta: string;
}
export interface CorteResuelto extends CortePauta {
  uuid: string;
  nombre: string;
  etiqueta: string;
}

/** Las opciones ya pertenecen exclusivamente al programa de la ruta. No acepta un UUID de otro nivel. */
export function resolverCorteDePauta(
  opciones: readonly OpcionDeCorte[], nivel: string | string[] | undefined, id: string | string[] | undefined,
): CorteResuelto | null {
  if (typeof nivel !== "string" || typeof id !== "string") return null;
  const opcion = opciones.find((o) => o.id === id && o.nivel === nivel);
  const tipo = NIVELES_DE_CORTE.find((n) => n.id === nivel);
  return opcion && tipo ? { nivel: opcion.nivel, id: opcion.idMeta, uuid: opcion.id,
    nombre: opcion.nombre, etiqueta: `${tipo.resumen} · ${opcion.nombre}` } : null;
}

export const ROTULO_DIAGNOSTICO_SIN_CORTE = "Todo el programa en el periodo: este diagnóstico no sigue «Ver solo».";
export const ROTULO_TABLA_SIN_CORTE = "La tabla todavía muestra todo el programa: «Ver solo» llega aquí en la siguiente entrega.";
export const ROTULO_COSTO_NO_DISPONIBLE = "No disponible para este corte: el detalle de hoy se guarda por campaña";
