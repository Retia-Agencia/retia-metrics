import { and, eq } from "drizzle-orm";
import { deals, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { porClaveDeDeal, ventasConDiaEn } from "@/lib/queries/metricas-filtros";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

/** Sin límite inferior a propósito: lo vendido antes de `fecha_inicio_ventas` cuenta (DA-2). */
const DESDE_SIEMPRE = "2000-01-01";

export interface VentaDeLaCohorte {
  dealId: string;
  /** El día (Bogotá) de su primera entrada a una etapa vendida. */
  dia: string;
}

/**
 * Las ventas de una cohorte entera hasta `hasta` ('YYYY-MM-DD', Bogotá), con el día de cada una. Es la
 * UNICA respuesta a "¿cuántas ventas lleva la cohorte?" (352, ADR 0115 N1): la usan Cupos, la meta de
 * hoy, la Proyección y las alertas. Sin límite inferior (DA-2, Mani 3-nov): una venta anterior al inicio
 * de ventas cuenta. Es venta quien hoy está en Abonado o Completo (DA-1): `ventasConDiaEn`.
 *
 * Con `claveCloser` devuelve solo la contribución de ese closer; la meta sigue siendo de la cohorte
 * (ADR 0023). Un closer con clave histórica se resuelve por el texto de `users.closerId` (ADR 0030).
 */
export async function ventasDeLaCohorte(
  db: Db,
  cohorteId: string,
  hasta: string,
  claveCloser?: string | null,
): Promise<VentaDeLaCohorte[]> {
  const vendidas = ventasConDiaEn(db, { desde: DESDE_SIEMPRE, hasta }).as("ventas_de_la_cohorte");
  const columnas = { dealId: vendidas.dealId, dia: vendidas.dia };
  // `vendidas` ya trae `vigente(deals)` adentro (`ventasConDiaEn`): `incluyendoAnulados` lo dice como en hechos/venta.
  // `vigente(deals)` va DENTRO de cada cadena: el guardián de vigencia lee cadena por cadena.
  const filas = claveCloser == null
    ? await db.select(columnas).from(vendidas)
        .innerJoin(deals, and(eq(deals.id, vendidas.dealId), vigente(deals)))
        .where(and(eq(deals.cohortId, cohorteId), incluyendoAnulados(vendidas)))
    : await db.select(columnas).from(vendidas)
        .innerJoin(deals, and(eq(deals.id, vendidas.dealId), vigente(deals)))
        .innerJoin(users, eq(users.id, deals.ownerUserId))
        .where(and(eq(deals.cohortId, cohorteId), porClaveDeDeal(claveCloser), incluyendoAnulados(vendidas)));
  return filas.map(({ dealId, dia }) => ({ dealId, dia: diaDeCalendario(dia) }));
}
