import { and, count, eq, gte, isNotNull, isNull, lt, max } from "drizzle-orm";
import { MEDIOS_PAGOS, normalizarUtm } from "@/lib/atribucion/canal";
import { emparejar } from "@/lib/atribucion/emparejar";
import { columnasUtmDelEnvio, esMacro, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { db as dbDeLaApp } from "@/lib/db";
import { programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { arbolDePauta } from "@/lib/pauta/arbol";

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
 * La usa la tab Programa hoy y la pantalla de salud del 110 despues: una pregunta,
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
   * Envios COMPLETOS de las ultimas `HORAS_SIN_CALIDAD` horas sin `lead_quality` (ADR 0069,
   * ticket 117 fase 2). Desde el 0069 la etapa de entrada sale de la calidad, y un formulario
   * que deja de mandarla manda a TODOS sus leads a Registrado sin un solo error. 🩸 Es el mismo
   * agujero del 29-sep, cuando el Typeform de un programa dejo de mandar `estado` y la fuente
   * seguia "al dia": recibir no es procesar bien. Un parcial no cuenta: puede llegar antes de
   * que el formulario calcule la calidad.
   */
  sinCalidad: number;
  /** La ultima lectura por API; nula cuando esta fuente no se lee por la API de Form30x. */
  lecturaApi: { leidaEn: Date | null } | null;
}

export interface DatosDeTraza {
  pagos: number;
  pagosSinId: number;
  pagosIdDesconocido: number;
  trazaRota: boolean;
}

/** La ventana del conteo de "sin calidad": lo reciente, para que un arreglo se note al dia siguiente. */
export const HORAS_SIN_CALIDAD = 24;
/** Evita marcar por una muestra demasiado pequena de envios pagos. */
export const MIN_PAGOS_TRAZA = 5;
/** Cuatro turnos perdidos del cron de 30 min (ADR 0093 punto 3); ningun runner se da por confiable. */
export const HORAS_LECTURA_FORM30X_VIEJA = 2;

export interface SaludDeFuente {
  estado: EstadoDeFuente;
  /** Si la app tiene que llamar la atencion sobre la fuente. */
  marcada: boolean;
  sobresPendientes: number;
  sinCalidad: number;
  lecturaApi: DatosDeSalud["lecturaApi"];
  lecturaVieja: boolean;
  pagos: number;
  pagosSinId: number;
  pagosIdDesconocido: number;
  trazaRota: boolean;
}

const HORA_MS = 3_600_000;

export function saludDeFuente(
  d: DatosDeSalud & Partial<DatosDeTraza>,
  ahora: Date = new Date(),
): SaludDeFuente {
  const { sobresPendientes, sinCalidad, lecturaApi } = d;
  const pagos = d.pagos ?? 0;
  const pagosSinId = d.pagosSinId ?? 0;
  const pagosIdDesconocido = d.pagosIdDesconocido ?? 0;
  const trazaRota = pagos >= MIN_PAGOS_TRAZA && pagosSinId * 2 > pagos;
  const traza = { pagos, pagosSinId, pagosIdDesconocido, trazaRota };
  const lecturaVieja =
    lecturaApi !== null &&
    (lecturaApi.leidaEn === null ||
      ahora.getTime() - lecturaApi.leidaEn.getTime() >= HORAS_LECTURA_FORM30X_VIEJA * HORA_MS);
  if (!d.ultimo) {
    return { estado: "sin_envios", marcada: true, sobresPendientes, sinCalidad, lecturaApi, lecturaVieja, ...traza };
  }

  const silencio = (ahora.getTime() - d.ultimo.getTime()) / HORA_MS;
  let estado: EstadoDeFuente;
  if (silencio >= d.umbralMuertaHoras) estado = "muerta";
  else if (silencio >= d.umbralSinRespuestaHoras) estado = "sin_respuestas";
  else if (d.penultimo && (d.ultimo.getTime() - d.penultimo.getTime()) / HORA_MS >= d.umbralSinRespuestaHoras) {
    estado = "volvio";
  } else estado = "al_dia";

  const silenciosa = estado === "sin_respuestas" || estado === "muerta";
  return {
    estado,
    marcada: silenciosa || sobresPendientes > 0 || sinCalidad > 0 || lecturaVieja || trazaRota,
    sobresPendientes,
    sinCalidad,
    lecturaApi,
    lecturaVieja,
    ...traza,
  };
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
  const desde = new Date(ahora.getTime() - HORAS_SIN_CALIDAD * HORA_MS);
  const [fuentes, filasUltimo, filasSobres, recientesSinCalidad, enviosRecientes] = await Promise.all([
    db
      .select({
        sourceId: sources.id,
        nombre: sources.nombre,
        programId: sources.programId,
        programaNombre: programs.nombre,
        umbralSinRespuestaHoras: sources.umbralSinRespuestaHoras,
        umbralMuertaHoras: sources.umbralMuertaHoras,
        proveedor: sources.proveedor,
        form30xFormId: sources.form30xFormId,
        form30xLeidoEn: sources.form30xLeidoEn,
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
      .select({ sourceId: submissions.sourceId, n: count() })
      .from(submissions)
      .where(and(gte(submissions.createdAt, desde), eq(submissions.esParcial, false), isNull(submissions.leadQuality)))
      .groupBy(submissions.sourceId),
    db
      .select({ sourceId: submissions.sourceId, ...columnasUtmDelEnvio })
      .from(submissions)
      .where(gte(submissions.createdAt, desde)),
  ]);

  const programas = [...new Set(fuentes.map((fuente) => fuente.programId))];
  const arboles = new Map(await Promise.all(programas.map(async (programId) =>
    [programId, await arbolDePauta(db, programId)] as const
  )));
  const programaPorFuente = new Map(fuentes.map((fuente) => [fuente.sourceId, fuente.programId]));
  const trazaDe = new Map<string, Omit<DatosDeTraza, "trazaRota">>();
  for (const envio of enviosRecientes) {
    const programId = programaPorFuente.get(envio.sourceId);
    if (!programId) continue;
    const utms = utmsDelEnvio(envio);
    const medium = normalizarUtm(utms.medium);
    if (!MEDIOS_PAGOS.some((medio) => medio === medium)) continue;
    const conteo = trazaDe.get(envio.sourceId) ?? { pagos: 0, pagosSinId: 0, pagosIdDesconocido: 0 };
    conteo.pagos += 1;
    const tieneId = [utms.idsMeta.adId, utms.id, utms.idsMeta.adsetId, utms.idsMeta.campaignId]
      .some((id) => id !== null && id.trim() !== "" && !esMacro(id));
    if (!tieneId) conteo.pagosSinId += 1;
    else if (emparejar(utms, arboles.get(programId)!).avisos.includes("anuncio_desconocido")) {
      conteo.pagosIdDesconocido += 1;
    }
    trazaDe.set(envio.sourceId, conteo);
  }

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
  const sinCalidadDe = new Map(recientesSinCalidad.map((r) => [r.sourceId, Number(r.n)]));

  return fuentes.map((f) => {
    const { proveedor, form30xFormId, form30xLeidoEn, ...fuente } = f;
    const lecturaApi =
      proveedor === "form30x" && form30xFormId?.trim()
        ? { leidaEn: fecha(form30xLeidoEn) }
        : null;
    const datos: DatosDeSalud = {
      umbralSinRespuestaHoras: f.umbralSinRespuestaHoras,
      umbralMuertaHoras: f.umbralMuertaHoras,
      ultimo: ultimoDe.get(f.sourceId) ?? null,
      penultimo: penultimoDe.get(f.sourceId) ?? null,
      sobresPendientes: sobresDe.get(f.sourceId) ?? 0,
      sinCalidad: sinCalidadDe.get(f.sourceId) ?? 0,
      lecturaApi,
    };
    const traza = trazaDe.get(f.sourceId) ?? { pagos: 0, pagosSinId: 0, pagosIdDesconocido: 0 };
    return { ...fuente, ...datos, ...saludDeFuente({ ...datos, ...traza }, ahora) };
  });
}
