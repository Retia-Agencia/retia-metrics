import { and, count, eq, gte, isNotNull, isNull, lt, max } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { estadosDeLlegadaDelPrograma, motivoSinEstado } from "@/lib/ingesta/estados-llegada";

/**
 * La salud de una fuente de leads (ticket 107): ¿sigue recibiendo envios?
 *
 * Todo se CALCULA desde `submissions` y `sobres_crudos`, nada se guarda (ADR 0024):
 * una bandera de "fuente marcada" envejeceria, y la pregunta la contesta el
 * historial de envios. Por eso "volvio" tampoco es un estado guardado: es que el
 * hueco entre los dos ultimos envios supero el umbral, y se ve mientras el ultimo
 * envio sea reciente.
 *
 * Se mira el `created_at` del envio (cuando llego al CRM) y no `fecha_envio` (lo que
 * dice el formulario): la pregunta es si el webhook sigue entregando.
 *
 * La usa `/ajustes/fuentes` hoy y la pantalla de salud del 110 despues: una pregunta,
 * un modulo.
 */

export type EstadoDeFuente = "al_dia" | "volvio" | "sin_respuestas" | "muerta" | "sin_envios";

export interface DatosDeSalud {
  umbralSinRespuestaHoras: number;
  umbralMuertaHoras: number;
  /** El envio mas reciente de la fuente; nulo si nunca recibio uno. */
  ultimo: Date | null;
  /** El anterior al mas reciente; nulo si recibio uno o ninguno. */
  penultimo: Date | null;
  /** Sobres crudos que fallaron y nadie reproceso: una fuente que recibe y no procesa esta igual de rota. */
  sobresPendientes: number;
  /**
   * Envios de las ultimas `HORAS_SIN_ESTADO` horas sin un Estado que el programa reconozca
   * (ADR 0061 punto 5, ticket 117): completos vacios o desconocidos, y parciales con un valor
   * desconocido. El parcial vacio (el del WhatsApp) no cuenta: llega asi a proposito. 🩸 El 29-sep el Typeform
   * de un programa dejo de mandar `estado` y la fuente seguia "al dia": recibir no es procesar
   * bien, y esto lo vuelve visible el mismo dia.
   */
  sinEstado: number;
}

/** La ventana del conteo de "sin estado": lo reciente, para que un arreglo se note al dia siguiente. */
export const HORAS_SIN_ESTADO = 24;

export interface SaludDeFuente {
  estado: EstadoDeFuente;
  /** Si la app tiene que llamar la atencion sobre la fuente. */
  marcada: boolean;
  sobresPendientes: number;
  sinEstado: number;
}

const HORA_MS = 3_600_000;

export function saludDeFuente(d: DatosDeSalud, ahora: Date = new Date()): SaludDeFuente {
  const { sobresPendientes, sinEstado } = d;
  if (!d.ultimo) return { estado: "sin_envios", marcada: true, sobresPendientes, sinEstado };

  const silencio = (ahora.getTime() - d.ultimo.getTime()) / HORA_MS;
  let estado: EstadoDeFuente;
  if (silencio >= d.umbralMuertaHoras) estado = "muerta";
  else if (silencio >= d.umbralSinRespuestaHoras) estado = "sin_respuestas";
  else if (d.penultimo && (d.ultimo.getTime() - d.penultimo.getTime()) / HORA_MS >= d.umbralSinRespuestaHoras) {
    estado = "volvio";
  } else estado = "al_dia";

  const silenciosa = estado === "sin_respuestas" || estado === "muerta";
  return { estado, marcada: silenciosa || sobresPendientes > 0 || sinEstado > 0, sobresPendientes, sinEstado };
}

export interface SaludDeFuenteConDatos extends SaludDeFuente, DatosDeSalud {
  sourceId: string;
  nombre: string;
  programId: string;
  programaNombre: string;
}

/**
 * La salud de cada fuente ACTIVA. Una inactiva no recibe a proposito: marcarla
 * seria ruido. Lecturas agrupadas que se unen en memoria (AGENTS.md: nada de
 * subconsultas correlacionadas en plantillas `sql`).
 *
 * El penultimo envio se lee con UNA consulta simple por fuente activa, y no con una
 * subconsulta: hay una sola fuente activa por programa (ADR 0039), asi que son tantas
 * consultas como programas, y el guardian de vigencia (con razon) no deja pasar un
 * `.from()` sobre un alias que no puede resolver.
 */
export async function saludDeFuentes(db: Db = dbDeLaApp, ahora: Date = new Date()): Promise<SaludDeFuenteConDatos[]> {
  const desde = new Date(ahora.getTime() - HORAS_SIN_ESTADO * HORA_MS);
  const [fuentes, filasUltimo, filasSobres, recientes] = await Promise.all([
    db
      .select({
        sourceId: sources.id,
        nombre: sources.nombre,
        programId: sources.programId,
        programaNombre: programs.nombre,
        umbralSinRespuestaHoras: sources.umbralSinRespuestaHoras,
        umbralMuertaHoras: sources.umbralMuertaHoras,
      })
      .from(sources)
      .innerJoin(programs, eq(programs.id, sources.programId))
      .where(eq(sources.activo, true))
      .orderBy(programs.nombre, sources.orden),
    db
      .select({ sourceId: submissions.sourceId, ultimo: max(submissions.createdAt) })
      .from(submissions)
      .groupBy(submissions.sourceId),
    db
      .select({ sourceId: sobresCrudos.sourceId, pendientes: count() })
      .from(sobresCrudos)
      .where(and(isNotNull(sobresCrudos.error), isNull(sobresCrudos.reprocesadoEn)))
      .groupBy(sobresCrudos.sourceId),
    db
      .select({ sourceId: submissions.sourceId, esParcial: submissions.esParcial, calificacion: submissions.calificacion, n: count() })
      .from(submissions)
      .where(gte(submissions.createdAt, desde))
      .groupBy(submissions.sourceId, submissions.esParcial, submissions.calificacion),
  ]);

  const fecha = (v: Date | string | null | undefined) => (v ? new Date(v) : null);
  const ultimoDe = new Map(filasUltimo.map((f) => [f.sourceId, fecha(f.ultimo)]));
  const penultimoDe = new Map(
    await Promise.all(
      fuentes.map(async (f) => {
        const ultimo = ultimoDe.get(f.sourceId);
        if (!ultimo) return [f.sourceId, null] as const;
        const [fila] = await db
          .select({ penultimo: max(submissions.createdAt) })
          .from(submissions)
          .where(and(eq(submissions.sourceId, f.sourceId), lt(submissions.createdAt, ultimo)));
        return [f.sourceId, fecha(fila?.penultimo)] as const;
      }),
    ),
  );
  const sobresDe = new Map(filasSobres.map((f) => [f.sourceId, Number(f.pendientes)]));
  // Que Estados reconoce cada programa lo dice su tabla: una lectura por programa activo.
  const estadosDe = new Map(
    await Promise.all(
      [...new Set(fuentes.map((f) => f.programId))].map(
        async (id) => [id, await estadosDeLlegadaDelPrograma(db, id)] as const,
      ),
    ),
  );
  const programaDe = new Map(fuentes.map((f) => [f.sourceId, f.programId]));
  const sinEstadoDe = new Map<string, number>();
  for (const r of recientes) {
    const programId = programaDe.get(r.sourceId);
    if (!programId) continue;
    // El parcial del WhatsApp llega sin Estado a proposito; un parcial CON un valor que el
    // programa no tiene (el previo al Calendly mal escrito) si es un formulario roto.
    if (r.esParcial && r.calificacion === null) continue;
    if (motivoSinEstado(r.calificacion, estadosDe.get(programId) ?? new Map()) === null) continue;
    sinEstadoDe.set(r.sourceId, (sinEstadoDe.get(r.sourceId) ?? 0) + Number(r.n));
  }

  return fuentes.map((f) => {
    const datos: DatosDeSalud = {
      umbralSinRespuestaHoras: f.umbralSinRespuestaHoras,
      umbralMuertaHoras: f.umbralMuertaHoras,
      ultimo: ultimoDe.get(f.sourceId) ?? null,
      penultimo: penultimoDe.get(f.sourceId) ?? null,
      sobresPendientes: sobresDe.get(f.sourceId) ?? 0,
      sinEstado: sinEstadoDe.get(f.sourceId) ?? 0,
    };
    return { ...f, ...datos, ...saludDeFuente(datos, ahora) };
  });
}
