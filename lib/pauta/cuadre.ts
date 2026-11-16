import { and, eq, gte, lte, sql } from "drizzle-orm";
import {
  cuadresPauta,
  cuentasPublicitarias,
  gastoPauta,
  pautaObjetos,
  programs,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { sumarDias } from "@/lib/dias-habiles";
import type { TokensMeta } from "@/lib/integraciones";
import { gastoDiarioDeCuenta } from "./meta-api";
import { mensajeSeguroDePauta, type FetchMeta } from "./sincronizar";

// ponytail: una unidad cubre el redondeo diario de Meta sin esconder pérdidas reales.
export const TOLERANCIA_CUADRE = 1;
const PRIMER_DIA_CUADRE = "2026-10-08";

export interface ResumenCuadrePauta {
  cuentas: number;
  dias: number;
  descuadres: number;
  errores: string[];
}

export interface DescuadreDePauta {
  cuentaId: string;
  idMeta: string;
  moneda: string;
  programaNombre: string;
  fecha: string;
  gastoMeta: string;
  gastoCrm: string;
}

function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  for (let fecha = desde; fecha <= hasta; fecha = sumarDias(fecha, 1)) dias.push(fecha);
  return dias;
}

export async function cuadrarPauta(
  db: Db,
  args: { tokens: TokensMeta; hoy: string; f?: FetchMeta },
): Promise<ResumenCuadrePauta> {
  const desde = [sumarDias(args.hoy, -30), PRIMER_DIA_CUADRE].sort().at(-1)!;
  const hasta = sumarDias(args.hoy, -1);
  const dias = diasEntre(desde, hasta);
  const cuentas = (await db.select().from(cuentasPublicitarias))
    .filter((cuenta) => args.tokens.has(cuenta.programId));
  const resultados = await Promise.allSettled(cuentas.map(async (cuenta) => {
    const token = args.tokens.get(cuenta.programId)!;
    const [gastoMeta, gastosCrm] = await Promise.all([
      gastoDiarioDeCuenta(cuenta.idMeta, desde, hasta, token, args.f),
      db.select({
        fecha: gastoPauta.fecha,
        monto: sql<string>`coalesce(sum(${gastoPauta.monto}), 0)::numeric(14,2)`,
      }).from(gastoPauta).innerJoin(
        pautaObjetos,
        eq(gastoPauta.pautaObjetoId, pautaObjetos.id),
      ).where(and(
        eq(gastoPauta.origen, "meta_api"),
        eq(pautaObjetos.cuentaId, cuenta.id),
        gte(gastoPauta.fecha, desde),
        lte(gastoPauta.fecha, hasta),
      )).groupBy(gastoPauta.fecha),
    ]);
    const crmPorDia = new Map(gastosCrm.map((fila) => [fila.fecha, fila.monto]));
    const valores = dias.map((fecha) => ({
      cuentaId: cuenta.id,
      fecha,
      gastoMeta: gastoMeta.get(fecha) ?? "0",
      gastoCrm: crmPorDia.get(fecha) ?? "0",
    }));
    if (valores.length > 0) {
      await db.insert(cuadresPauta).values(valores).onConflictDoUpdate({
        target: [cuadresPauta.cuentaId, cuadresPauta.fecha],
        set: {
          gastoMeta: sql`excluded.gasto_meta`,
          gastoCrm: sql`excluded.gasto_crm`,
          revisadoEn: sql`now()`,
        },
      });
    }
    return valores.filter((fila) =>
      Math.abs(Number(fila.gastoMeta) - Number(fila.gastoCrm)) > TOLERANCIA_CUADRE).length;
  }));
  const errores: string[] = [];
  let descuadres = 0;
  resultados.forEach((resultado, indice) => {
    if (resultado.status === "fulfilled") descuadres += resultado.value;
    else errores.push(`${cuentas[indice].nombre}: ${mensajeSeguroDePauta(resultado.reason, args.tokens)}`);
  });
  return {
    cuentas: cuentas.length,
    dias: dias.length * (cuentas.length - errores.length),
    descuadres,
    errores,
  };
}

export async function descuadresRecientesDePauta(db: Db, ahora: Date): Promise<DescuadreDePauta[]> {
  return db.select({
    cuentaId: cuadresPauta.cuentaId,
    idMeta: cuentasPublicitarias.idMeta,
    moneda: cuentasPublicitarias.moneda,
    programaNombre: programs.nombre,
    fecha: cuadresPauta.fecha,
    gastoMeta: cuadresPauta.gastoMeta,
    gastoCrm: cuadresPauta.gastoCrm,
  }).from(cuadresPauta)
    .innerJoin(cuentasPublicitarias, eq(cuadresPauta.cuentaId, cuentasPublicitarias.id))
    .innerJoin(programs, eq(cuentasPublicitarias.programId, programs.id))
    .where(and(
      sql`abs(${cuadresPauta.gastoMeta} - ${cuadresPauta.gastoCrm}) > ${TOLERANCIA_CUADRE}`,
      gte(cuadresPauta.revisadoEn, new Date(ahora.getTime() - 36 * 3_600_000)),
    ));
}
