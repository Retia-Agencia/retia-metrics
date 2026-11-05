import { and, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { calls } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Alcance } from "@/lib/queries/dashboard";
import { citaDebida, citaDebidaSinMarcar, citaNoCancelada, filtroLlamadas, llamadaOcurrio } from "@/lib/queries/metricas-filtros";
import { vigente } from "@/lib/queries/vigente";

export interface ShowPorCita {
  /** Las citas vivas del rango: las canceladas no entran (353). */
  citasDelDia: number;
  /** El denominador: citas vivas cuya hora ya pasó. */
  citasQueYaDebianOcurrir: number;
  realizadas: number;
  /** De esas, las que el closer todavía no marcó: un dato que falta, no un no show (ADR 0115 N3). */
  sinMarcar: number;
  /** Realizadas entre debidas; `null` si no hay citas debidas o NINGUNA tiene resultado (0,0 % sería mentira). */
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
    citasQueYaDebianOcurrir: sql<number>`count(*) filter (where ${citaDebida(ahora)})::int`,
    realizadas: sql<number>`count(*) filter (where ${llamadaOcurrio()} and ${citaDebida(ahora)})::int`,
    sinMarcar: sql<number>`count(*) filter (where ${citaDebidaSinMarcar(ahora)})::int`,
  }).from(calls).where(and(filtroLlamadas(alcance, db), citaNoCancelada(), vigente(calls)));
  const citasDelDia = fila?.citasDelDia ?? 0;
  const citasQueYaDebianOcurrir = fila?.citasQueYaDebianOcurrir ?? 0;
  const realizadas = fila?.realizadas ?? 0;
  const sinMarcar = fila?.sinMarcar ?? 0;
  return {
    citasDelDia,
    citasQueYaDebianOcurrir,
    realizadas,
    sinMarcar,
    // Si ninguna cita debida tiene resultado, el closer no ha marcado nada: no se dice 0,0 %, se dice "—".
    porcentaje: citasQueYaDebianOcurrir === 0 || sinMarcar === citasQueYaDebianOcurrir ? null : realizadas / citasQueYaDebianOcurrir,
  };
}
