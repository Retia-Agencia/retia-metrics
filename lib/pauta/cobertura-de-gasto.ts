import { and, eq, gte, isNotNull, lte, max, min, or } from "drizzle-orm";
import { gastoPauta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { fecha } from "@/lib/format";
import { sumarDias } from "@/lib/dias-habiles";

export interface CoberturaDeGasto {
  primerDia: string | null;
  ultimoDia: string | null;
  diasSinFila: string[];
}

const esGastoPaid = or(
  eq(gastoPauta.area, "paid"),
  isNotNull(gastoPauta.pautaObjetoId),
);

export async function coberturaDeGasto(
  db: Db,
  programId: string,
  rango: { desde: string; hasta: string },
): Promise<CoberturaDeGasto> {
  const delPrograma = and(eq(gastoPauta.programId, programId), esGastoPaid);
  const [[extremos], filas] = await Promise.all([
    db.select({ primerDia: min(gastoPauta.fecha), ultimoDia: max(gastoPauta.fecha) }).from(gastoPauta).where(delPrograma),
    db.selectDistinct({ dia: gastoPauta.fecha }).from(gastoPauta)
      .where(and(delPrograma, gte(gastoPauta.fecha, rango.desde), lte(gastoPauta.fecha, rango.hasta))),
  ]);
  const enRango = new Set(filas.map((fila) => fila.dia));
  const diasSinFila: string[] = [];
  for (let dia = rango.desde; dia <= rango.hasta; dia = sumarDias(dia, 1)) {
    if (!enRango.has(dia)) diasSinFila.push(dia);
  }
  return { primerDia: extremos?.primerDia ?? null, ultimoDia: extremos?.ultimoDia ?? null, diasSinFila };
}

/**
 * Un día está cubierto si cae entre el primer y el último gasto cargado Y tiene al menos una fila. Un hueco
 * en medio no es un cero: pudo ser un sync que no corrió (412 F; antes todo lo de en medio pasaba por cubierto
 * y un costo salía "COP 0" sobre días que nadie leyó). Meta no devuelve filas de un día sin entrega, así que una
 * pausa real también cuenta como hueco: el costo de esa ventana queda en "—" con el motivo, nunca en un 0.
 */
export function diaCubierto(dia: string, cobertura: CoberturaDeGasto): boolean {
  return cobertura.primerDia !== null && cobertura.ultimoDia !== null
    && cobertura.primerDia <= dia && dia <= cobertura.ultimoDia
    && !cobertura.diasSinFila.includes(dia);
}

export function motivoDeGasto(cobertura: CoberturaDeGasto): string {
  if (cobertura.primerDia === null) return "Sin gasto de Meta cargado";
  if (cobertura.diasSinFila.some((dia) => dia < cobertura.primerDia!)) {
    return `Gasto de Meta desde el ${fecha(cobertura.primerDia)}`;
  }
  if (cobertura.ultimoDia !== null && cobertura.diasSinFila.some((dia) => dia > cobertura.ultimoDia!)) {
    return `Gasto de Meta hasta el ${fecha(cobertura.ultimoDia)}`;
  }
  const hueco = cobertura.diasSinFila.find((dia) => dia >= cobertura.primerDia! && dia <= (cobertura.ultimoDia ?? dia));
  if (hueco) return `Sin gasto de Meta cargado el ${fecha(hueco)}`;
  return `Gasto de Meta desde el ${fecha(cobertura.primerDia)}`;
}
