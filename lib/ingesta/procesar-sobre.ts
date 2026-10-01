import { eq } from "drizzle-orm";
import { programs, sobresCrudos, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { normalizarEmail, type MapeoColumnas } from "@/lib/sheets/mapeo";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { resolverCitaDeEnvio } from "@/lib/calendly/resolver-cita";
import type { ResultadoCita } from "@/lib/ingesta/regla-de-deals";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import { mapeoWebhookDesdeFuente } from "@/lib/ingesta/mapeo-webhook";
import { PROVEEDORES } from "@/lib/ingesta/proveedores";
import type { ProveedorFormulario } from "@/lib/catalogo/fuentes-webhook";

/**
 * El procesamiento de un envio DESPUES de que la firma cuadro (ticket 110). Es lo que
 * antes vivia dentro de la ruta del webhook: adaptar el payload, resolver la cita de
 * Calendly e ingerir. Se saco a su propio modulo para que lo reusen DOS llamadores:
 *
 *  - la ruta del webhook, cuando llega un envio en vivo, y
 *  - la server action de reprocesar (ticket 110), que vuelve a correr el adaptador y la
 *    ingesta sobre un `sobre_crudo` con error ya guardado.
 *
 * Es la mitad "de negocio" de la caja negra (ADR 0058): la firma y la lectura del cuerpo
 * crudo se quedan en la ruta (un reproceso no re-verifica una firma: el cuerpo ya esta
 * en la base porque su firma cuadro una vez). Aqui NO se lee la firma ni se decide 401:
 * eso ya paso.
 *
 * Devuelve un `ResultadoProcesamiento` con lo que hace falta para (1) responder al
 * proveedor y (2) registrar la entrega en `entregas_webhook`: el motivo, el lead que
 * trajo y si hubo fallo. Nunca lanza: un fallo de la ingesta vuelve como
 * `motivo: "fallo_ingesta"`, no como excepcion, porque el proveedor no debe reintentar
 * por algo que el reintento no arregla.
 */

/** El motivo de un procesamiento (los 200 con firma buena). Los rechazos los pone la ruta. */
export type MotivoProcesado = "procesado" | "sin_correo" | "contenido_invalido" | "fallo_ingesta";

export interface ResultadoProcesamiento {
  motivo: MotivoProcesado;
  /** El lead que trajo el envio, si se creo o encontro uno. */
  leadId: string | null;
  /** Si el sobre se marca con error (todo lo que no es `procesado`). */
  error: string | null;
}

/** Los datos de la fuente que necesita el procesamiento (los lee el llamador). */
export interface FuenteParaProcesar {
  id: string;
  programId: string;
  proveedor: ProveedorFormulario;
  tzFechas: string;
  mapeoColumnas: MapeoColumnas | null;
}

/**
 * Resuelve la cita de Calendly de cada envio "Con Calendly" del lote, ANTES de la
 * transaccion de ingesta (una llamada HTTP dentro retiene una conexion del pooler,
 * AGENTS.md). El token del programa se lee con una consulta PROPIA: `listarProgramas`
 * lo oculta a proposito (ADR 0057). El token no se loguea ni sale en el resultado.
 */
async function resolverCitas(
  db: Db,
  programId: string,
  entradas: EntradaEnvio[],
): Promise<Map<string, ResultadoCita>> {
  const citas = new Map<string, ResultadoCita>();
  const conAgenda = entradas.filter((e) => e.linkAgenda);
  if (conAgenda.length === 0) return citas;

  const [programa] = await db
    .select({ calendlyToken: programs.calendlyToken })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  const token = programa?.calendlyToken ?? null;

  for (const entrada of conAgenda) {
    const correo = normalizarEmail(
      entrada.campos.correo ? entrada.columnas[entrada.campos.correo] : null,
    );
    if (!correo) continue;
    if (!token) {
      citas.set(correo, { estado: "error", mensaje: "el programa no tiene token de Calendly configurado." });
      continue;
    }
    citas.set(correo, await resolverCitaDeEnvio({ token, correo, linkAgenda: entrada.linkAgenda }));
  }
  return citas;
}

/**
 * Corre el adaptador y la ingesta sobre el cuerpo crudo de un sobre con firma buena.
 * NO lanza: traduce cada final a un motivo. El llamador decide que hacer con el sobre
 * (marcarlo con error o dejarlo procesado) y como registrar la entrega.
 *
 * El programa sale SIEMPRE de la fuente (`fuente.programId`), nunca del payload (T1,
 * frontera de programa, ADR 0043).
 */
export async function procesarSobre(
  db: Db,
  fuente: FuenteParaProcesar,
  cuerpo: string,
): Promise<ResultadoProcesamiento> {
  const plantilla = await plantillaDelPrograma(db, fuente.programId);
  const mapeo = mapeoWebhookDesdeFuente(fuente.mapeoColumnas, plantilla);

  let entrada: EntradaEnvio;
  try {
    entrada = PROVEEDORES[fuente.proveedor].adaptar(cuerpo, {
      sourceId: fuente.id,
      zona: fuente.tzFechas,
      mapeo,
    });
  } catch (error) {
    return { motivo: "contenido_invalido", leadId: null, error: mensajeDe(error) };
  }

  try {
    const citasPorCorreo = await resolverCitas(db, fuente.programId, [entrada]);
    const resultado = await ingerirEntradas(db, fuente.programId, [entrada], {
      aplicarReglaDeDeals: true,
      citasPorCorreo,
    });

    // Un envio COMPLETO con firma buena y sin correo entra como envio "sin lead": no es
    // un error de la ingesta, pero no hay lead que crear. Se marca el sobre y se reporta
    // con su motivo. Un PARCIAL sin correo es normal (empezo y se fue): queda procesado.
    if (!entrada.esParcial && resultado.enviosSinLead > 0) {
      return {
        motivo: "sin_correo",
        leadId: null,
        error: "Envio completo sin correo: no hay lead que crear.",
      };
    }

    // El lead que trajo, si lo hubo: es el que la regla de deals toco (trae `leadId`).
    const leadId = resultado.reglaDeDeals[0]?.leadId ?? null;
    return { motivo: "procesado", leadId, error: null };
  } catch (error) {
    return { motivo: "fallo_ingesta", leadId: null, error: mensajeDe(error) };
  }
}

/**
 * La plantilla de lead del programa, para combinar el mapeo. Si el programa no existe
 * queda nula y el mapeo cae a la fuente y al defecto (misma precedencia que la hoja).
 */
async function plantillaDelPrograma(db: Db, programId: string): Promise<MapeoColumnas | null> {
  const [programa] = await db
    .select({ plantillaLead: programs.plantillaLead })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  return (programa?.plantillaLead as MapeoColumnas | null) ?? null;
}

function mensajeDe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reprocesa un sobre con error (ticket 110): vuelve a correr `procesarSobre` sobre el
 * cuerpo ya guardado, marca `reprocesado_en` y ACTUALIZA `error` (nulo si esta vez
 * salio bien). Devuelve el resultado para que la server action registre una entrega
 * NUEVA. La verificacion de rol la hace la server action; aqui solo se toca la base.
 *
 * Un sobre sin error (ya procesado) no se reprocesa: devuelve `null`. Y uno que no
 * existe tambien: el llamador lo traduce a "nada que hacer".
 */
export interface Reproceso {
  resultado: ResultadoProcesamiento;
  sobreId: string;
  sourceId: string;
  programId: string;
}

export async function reprocesarSobre(db: Db, sobreId: string): Promise<Reproceso | null> {
  const [sobre] = await db
    .select({
      id: sobresCrudos.id,
      cuerpo: sobresCrudos.cuerpo,
      error: sobresCrudos.error,
      sourceId: sobresCrudos.sourceId,
    })
    .from(sobresCrudos)
    .where(eq(sobresCrudos.id, sobreId))
    .limit(1);
  if (!sobre || sobre.error === null) return null;
  // Un evento de Calendly (0039) no tiene fuente ni pasa por este adaptador: todavia no se
  // reprocesa desde la pantalla. Queda guardado con su error.
  if (sobre.sourceId === null) return null;

  const [fuente] = await db
    .select({
      id: sources.id,
      programId: sources.programId,
      proveedor: sources.proveedor,
      tzFechas: sources.tzFechas,
      mapeoColumnas: sources.mapeoColumnas,
    })
    .from(sources)
    .where(eq(sources.id, sobre.sourceId))
    .limit(1);
  if (!fuente?.proveedor) return null;

  const resultado = await procesarSobre(
    db,
    {
      id: fuente.id,
      programId: fuente.programId,
      proveedor: fuente.proveedor,
      tzFechas: fuente.tzFechas,
      mapeoColumnas: fuente.mapeoColumnas as MapeoColumnas | null,
    },
    sobre.cuerpo,
  );

  await db
    .update(sobresCrudos)
    .set({ error: resultado.error, reprocesadoEn: new Date() })
    .where(eq(sobresCrudos.id, sobre.id));

  return { resultado, sobreId: sobre.id, sourceId: fuente.id, programId: fuente.programId };
}
