import { and, eq, gte, isNotNull, lte, max, min, or } from "drizzle-orm";
import { gastoPauta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { fecha } from "@/lib/format";
import { sumarDias } from "@/lib/rangos";

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

export function diaCubierto(dia: string, cobertura: CoberturaDeGasto): boolean {
  return cobertura.primerDia !== null && cobertura.ultimoDia !== null
    && cobertura.primerDia <= dia && dia <= cobertura.ultimoDia;
}

export function motivoDeGasto(cobertura: CoberturaDeGasto): string {
  if (cobertura.primerDia === null) return "Sin gasto de Meta cargado";
  if (cobertura.diasSinFila.some((dia) => dia < cobertura.primerDia!)) {
    return `Gasto de Meta desde el ${fecha(cobertura.primerDia)}`;
  }
  if (cobertura.ultimoDia !== null && cobertura.diasSinFila.some((dia) => dia > cobertura.ultimoDia!)) {
    return `Gasto de Meta hasta el ${fecha(cobertura.ultimoDia)}`;
  }
  return `Gasto de Meta desde el ${fecha(cobertura.primerDia)}`;
}
