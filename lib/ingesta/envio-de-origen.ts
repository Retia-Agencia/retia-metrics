import { eq } from "drizzle-orm";
import { leads, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * El envío de origen de un deal que NO abre la ingesta (ADR 0060 punto 3): lo abre un humano
 * o la migración, y su origen es **el envío más reciente del lead en ese momento**; sin
 * ninguno, nulo, y la pantalla dice "sin envío de origen", nunca un canal por defecto.
 *
 * La pregunta es UNA y vive aquí (la regla de `AGENTS.md`: si dos lugares responden la misma
 * pregunta, la respuesta vive en un módulo): el importador del 078 y el alta manual del 115.
 * El deal que abre la ingesta no pasa por aquí: su origen es el envío que disparó la regla.
 */

export type EnvioCandidato = Pick<typeof submissions.$inferSelect, "id" | "fechaEnvio" | "posicionEnHoja">;

/**
 * El más reciente de los envíos de UN lead. Mismo orden que `resumirEnvios`: la fecha manda y
 * un envío sin fecha nunca le gana a uno fechado (🩸 el placeholder de los parciales); a igual
 * fecha, o sin fecha, decide la posición en la hoja. El id desempata al final para que el
 * resultado no dependa del orden en que la base devolvió las filas.
 */
export function envioMasReciente(envios: readonly EnvioCandidato[]): string | null {
  let mejor: EnvioCandidato | null = null;
  for (const e of envios) if (mejor === null || comparar(e, mejor) > 0) mejor = e;
  return mejor?.id ?? null;
}

function comparar(a: EnvioCandidato, b: EnvioCandidato): number {
  const fa = a.fechaEnvio?.getTime() ?? null;
  const fb = b.fechaEnvio?.getTime() ?? null;
  if (fa !== fb) {
    if (fa === null) return -1;
    if (fb === null) return 1;
    return fa - fb;
  }
  const porPosicion = (a.posicionEnHoja ?? 0) - (b.posicionEnHoja ?? 0);
  if (porPosicion !== 0) return porPosicion;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * El envío más reciente de cada lead del programa, en UNA lectura (la migración abre cientos de
 * deals). La frontera la da el lead: solo envíos colgados de un lead de ESTE programa. Un lead
 * sin envíos no aparece en el mapa: su origen es nulo.
 */
export async function enviosDeOrigenPorLead(db: Db, programId: string): Promise<Map<string, string>> {
  const filas = await db
    .select({
      leadId: submissions.leadId,
      id: submissions.id,
      fechaEnvio: submissions.fechaEnvio,
      posicionEnHoja: submissions.posicionEnHoja,
    })
    .from(submissions)
    .innerJoin(leads, eq(submissions.leadId, leads.id))
    .where(eq(leads.programId, programId));

  const porLead = new Map<string, EnvioCandidato[]>();
  for (const f of filas) {
    if (f.leadId === null) continue;
    porLead.set(f.leadId, [...(porLead.get(f.leadId) ?? []), f]);
  }
  const origen = new Map<string, string>();
  for (const [leadId, envios] of porLead) {
    const id = envioMasReciente(envios);
    if (id) origen.set(leadId, id);
  }
  return origen;
}
