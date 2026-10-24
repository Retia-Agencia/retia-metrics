import { and, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Alcance } from "@/lib/queries/dashboard";
import { filtroLlamadas, llamadaOcurrio, llamadaYaDebiaOcurrir } from "@/lib/queries/metricas-filtros";
import { vigente } from "@/lib/queries/vigente";

export interface ShowPorCita {
  citasDelDia: number;
  citasQueYaDebianOcurrir: number;
  realizadas: number;
  porcentaje: number | null;
}

/**
 * El show del reporte diario: llamadas ocurridas / citas del día que ya debían ocurrir.
 * Es deliberadamente distinto de la tasa por deal de `tasas-del-grupo.ts`.
 */
export async function showPorCitaDelRango(
  alcance: Alcance,
  ahora: Date,
  db: Db = dbDeLaApp,
): Promise<ShowPorCita> {
  const [fila] = await db.select({
    citasDelDia: sql<number>`count(*)::int`,
    citasQueYaDebianOcurrir: sql<number>`count(*) filter (where ${llamadaYaDebiaOcurrir(ahora)})::int`,
    realizadas: sql<number>`count(*) filter (where ${llamadaOcurrio()} and ${llamadaYaDebiaOcurrir(ahora)})::int`,
  }).from(calls).where(and(filtroLlamadas(alcance, db), vigente(calls)));
  const citasDelDia = fila?.citasDelDia ?? 0;
  const citasQueYaDebianOcurrir = fila?.citasQueYaDebianOcurrir ?? 0;
  const realizadas = fila?.realizadas ?? 0;
  return {
    citasDelDia,
    citasQueYaDebianOcurrir,
    realizadas,
    porcentaje: citasQueYaDebianOcurrir === 0 ? null : realizadas / citasQueYaDebianOcurrir,
  };
}
