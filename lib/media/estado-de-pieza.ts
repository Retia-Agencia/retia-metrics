import { and, eq, gte, isNotNull, isNull, lt, type SQL } from "drizzle-orm";
import { piezas } from "@/lib/db/schema";

/**
 * UNA respuesta a "¿en que estado esta esta pieza?" (ticket 321). El estado se DERIVA, no se
 * guarda: publicada si tiene `publicada_en`; si no, siempre visible si es permanente; si no,
 * atrasada o programada segun su fecha contra hoy (Bogota, `hoyEnBogota()`).
 *
 * Dos lugares la necesitan y no pueden discrepar: la insignia de cada fila (`estadoDePieza`, en
 * memoria) y el filtro de la lista (`condicionDeEstado`, en SQL). `tests/lista-de-piezas.test.ts`
 * compara las dos contra las mismas filas.
 */
export const ESTADOS_DE_PIEZA = ["programada", "atrasada", "publicada", "fija"] as const;
export type EstadoDePieza = (typeof ESTADOS_DE_PIEZA)[number];

export function esEstadoDePieza(valor: unknown): valor is EstadoDePieza {
  return typeof valor === "string" && (ESTADOS_DE_PIEZA as readonly string[]).includes(valor);
}

export function estadoDePieza(
  p: { publicadaEn: Date | null; permanente: boolean; fechaPublicacion: string | null },
  hoy: string,
): EstadoDePieza {
  if (p.publicadaEn !== null) return "publicada";
  if (p.permanente) return "fija";
  return p.fechaPublicacion !== null && p.fechaPublicacion < hoy ? "atrasada" : "programada";
}

export function condicionDeEstado(estado: EstadoDePieza, hoy: string): SQL | undefined {
  switch (estado) {
    case "publicada":
      return isNotNull(piezas.publicadaEn);
    case "fija":
      return and(isNull(piezas.publicadaEn), eq(piezas.permanente, true));
    case "atrasada":
      return and(isNull(piezas.publicadaEn), eq(piezas.permanente, false), lt(piezas.fechaPublicacion, hoy));
    case "programada":
      return and(isNull(piezas.publicadaEn), eq(piezas.permanente, false), gte(piezas.fechaPublicacion, hoy));
  }
}
