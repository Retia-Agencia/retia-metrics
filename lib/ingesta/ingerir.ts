import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";
import { changeLog, leadContactos, leads, sources, submissions } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import type { Calificacion } from "./calificacion";
import { estadoDesdeTexto } from "./estado";
import { construirEnvio, type EntradaEnvio, type Envio } from "./envio";
import { envioMasReciente, type EnvioCandidato } from "./envio-de-origen";
import { aplicarReglaDeDeal, type AccionDeDeal, type ResultadoCita } from "./regla-de-deals";
import {
  resolverIdentidad,
  type ContactoConocido,
  type LeadRef,
  type PosibleDuplicado,
} from "./identidad";

/**
 * La escritura de la ingesta (tickets 048, 049 y 050): lo que entra por la puerta
 * (`construirEnvio`) y se decide en memoria (`resolverIdentidad`) aqui se guarda.
 * Es el UNICO lugar que escribe `submissions` y `lead_contactos`, y el unico que crea
 * leads desde un formulario. El webhook de Typeform y el traslado desde la hoja llaman
 * a esta misma funcion; si cada uno escribiera por su lado, habria dos reglas de
 * identidad y divergirian sin un error (ADR 0024).
 *
 * Todo corre en UNA transaccion: o entra el lote entero con sus leads y contactos, o
 * no entra nada. Un envio escrito sin su lead, o un lead sin su contacto, no se
 * nota en ninguna pantalla y rompe la identidad del siguiente envio.
 *
 * **Es idempotente.** La llave del envio es `(fuente, token, es_parcial)`: un
 * reintento del webhook, o la misma fila leida otra vez de la hoja, actualiza el
 * envio en vez de duplicarlo. Y el resumen del lead (fechas, aplicaciones, UTM,
 * telefono) se RECALCULA desde sus envios guardados, no se incrementa: correr dos
 * veces da lo mismo, y cuando llega la completa de una parcial el lead se corrige
 * solo (ADR 0036 punto 4: "el CRM recalcula cuando llega la hermana").
 *
 * Cada envio guarda el Estado que le puso el FORMULARIO (ADR 0054, enmienda del
 * 27-sep): el CRM no califica ni deduce, lo traduce con `estadoDesdeTexto`. Un envio
 * COMPLETO sin Estado, o con un valor que el CRM no reconoce, entra igual, sin
 * calificacion, y queda contado en `sinCalificar` con el motivo (error visible). Un
 * envio PARCIAL sin Estado no es error: un parcial nunca abre deal.
 *
 * Fuera de alcance, a proposito: el deal (ticket 052, espera al motor de etapas).
 */

/** Filas por viaje a la base (AGENTS.md: fila por fila no cabe en una funcion de Vercel). */
const TAMANO_DE_LOTE = 200;

export interface ResultadoIngesta {
  recibidas: number;
  /** Entradas que no llegaron a ser un envio (hoy: sin token). */
  rechazadas: { posicion: number | null; motivo: "sin_token" }[];
  /** Envios escritos, nuevos o actualizados. */
  envios: number;
  /** Envios guardados sin lead: sin correo y sin un telefono conocido. */
  enviosSinLead: number;
  leadsNuevos: number;
  leadsActualizados: number;
  contactosNuevos: number;
  /** Para el gerente (etapa 6): uniones por telefono y telefonos de otro lead. */
  posiblesDuplicados: PosibleDuplicado[];
  cambiosRegistrados: number;
  /** Envios COMPLETOS que entraron sin Estado reconocible, agrupados por motivo. */
  sinCalificar: { motivo: string; envios: number }[];
  /**
   * Lo que la regla de deals (ticket 052) hizo con cada lead tocado. Vacio cuando no se
   * pidio (`aplicarReglaDeDeals` en false: el traslado desde Sheets). Incluye los
   * re-envios de un deal avanzado, que NO mueven nada pero el owner tiene que ver, y la
   * `nota` de una cita de Calendly que no estaba vigente.
   */
  reglaDeDeals: { leadId: string; accion: AccionDeDeal; dealAbiertoId?: string; rechazo?: string; nota?: string }[];
}

export interface OpcionesIngesta {
  /** La corrida que origino la escritura, para la bitacora. Nulo para un webhook. */
  syncRunId?: string | null;
  /**
   * Si aplicar la regla de creacion y movimiento de deals (ticket 052) a cada lead
   * tocado. **Default `false`.** Lo pide el webhook (ticket 106); el traslado desde
   * Sheets NO, porque los leads viejos entran por el 080 con su estado de gestion, no
   * como ~2.400 deals iguales en Pendiente Setteo (decision de Mani del 24-sep).
   */
  aplicarReglaDeDeals?: boolean;
  /**
   * La cita de Calendly ya resuelta para cada lead con calificación `con_calendly`,
   * indexada por su correo NORMALIZADO (`leads.email_normalizado`). La resuelve el
   * llamador FUERA de esta transacción (una llamada HTTP dentro retiene una conexión
   * del pooler): el webhook la arma con `resolverCitaDeEnvio`. La regla solo la usa
   * cuando `aplicarReglaDeDeals` es true; un lead `con_calendly` sin entrada aquí se
   * trata como cita no encontrada (no va a Agendado sin fecha real).
   */
  citasPorCorreo?: Map<string, ResultadoCita>;
}

/** Un envio se identifica por fuente, token y parcialidad (`submissions_fuente_token_idx`). */
function llaveDeEnvio(e: { sourceId: string; token: string; esParcial: boolean }): string {
  return `${e.sourceId}\u0000${e.token}\u0000${e.esParcial ? "p" : "c"}`;
}

function llaveDeLead(lead: LeadRef): string {
  return lead.tipo === "existente" ? lead.leadId : `nuevo:${lead.correo}`;
}

function enLotes<T>(filas: T[]): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < filas.length; i += TAMANO_DE_LOTE) lotes.push(filas.slice(i, i + TAMANO_DE_LOTE));
  return lotes;
}

export async function ingerirEntradas(
  db: Db,
  programId: string,
  entradas: EntradaEnvio[],
  opciones: OpcionesIngesta = {},
): Promise<ResultadoIngesta> {
  const resultado: ResultadoIngesta = {
    recibidas: entradas.length,
    rechazadas: [],
    envios: 0,
    enviosSinLead: 0,
    leadsNuevos: 0,
    leadsActualizados: 0,
    contactosNuevos: 0,
    posiblesDuplicados: [],
    cambiosRegistrados: 0,
    sinCalificar: [],
    reglaDeDeals: [],
  };
  if (entradas.length === 0) return resultado;

  // El programa es una FRONTERA (ADR 0043): un envio de una fuente de otro programa no
  // se escribe aqui, ni aunque el llamador se equivoque. El programa sale de la fuente
  // registrada, nunca de un campo del formulario (T1).
  const idsDeFuente = [...new Set(entradas.map((e) => e.sourceId))];
  const propias = await db
    .select({ id: sources.id, nombre: sources.nombre })
    .from(sources)
    .where(and(eq(sources.programId, programId), inArray(sources.id, idsDeFuente)));
  if (propias.length !== idsDeFuente.length) {
    throw new ErrorDeApp("Hay envios de una fuente que no pertenece a este programa.", 422);
  }

  // 1. Construir. Dos versiones del mismo envio (una parcial que Typeform reescribio)
  // se funden: gana la de mayor posicion en la hoja, y entre las que no vienen de una
  // hoja, la que llego despues. Son versiones, no dos hechos.
  const porLlave = new Map<string, Envio>();
  const enOrden = entradas
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      if (a.e.posicion === b.e.posicion) return a.i - b.i;
      if (a.e.posicion === null) return 1;
      if (b.e.posicion === null) return -1;
      return a.e.posicion - b.e.posicion;
    });
  for (const { e } of enOrden) {
    const r = construirEnvio(e);
    if (!r.ok) {
      resultado.rechazadas.push({ posicion: r.posicion, motivo: r.motivo });
      continue;
    }
    porLlave.set(llaveDeEnvio(r.envio), r.envio);
  }
  const envios = [...porLlave.values()];
  if (envios.length === 0) return resultado;

  // 1b. El Estado de cada envio es el que trae del formulario (ya traducido en
  // `construirEnvio`). El CRM no califica: solo reporta lo que no reconoce. El puntaje
  // (ticket 070, decision del 29-sep) tambien lo TRAE el formulario, no lo calcula el
  // CRM (decision A8): es el `e.puntaje` que el adaptador leyo de la variable de score, o
  // null si la fuente no la nombra o el valor no era numero. `versionPuntaje` sigue nulo:
  // no hay pesos del CRM que versionar (el formulario es quien pondera).
  type Nota = { calificacion: Calificacion | null; puntaje: number | null; versionPuntaje: number | null };
  const notaDe = new Map<string, Nota>();
  const motivos = new Map<string, number>();
  const contar = (motivo: string) => motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
  for (const e of envios) {
    notaDe.set(llaveDeEnvio(e), { calificacion: e.estado, puntaje: e.puntaje, versionPuntaje: null });
    // Un COMPLETO sin Estado reconocible es un error visible; un PARCIAL sin Estado no
    // (un parcial nunca abre deal, y marcarlo llenaria el reporte con los parciales).
    if (e.estado === null && !e.esParcial) {
      const r = estadoDesdeTexto(e.estadoHoja);
      if (r.calificacion === null) contar(r.motivo);
    }
  }
  resultado.sinCalificar = [...motivos].map(([motivo, n]) => ({ motivo, envios: n }));

  return (db as { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> }).transaction(
    async (tx) => {
      // 2. Lo que el programa ya sabe de estas personas.
      const conocidos = await contactosConocidos(tx, programId, envios);

      // 3. Decidir de quien es cada envio. La llave del envio va en `token` porque la
      // parcial y la completa comparten el token de Typeform.
      const identidad = resolverIdentidad(
        envios.map((e) => ({
          token: llaveDeEnvio(e),
          posicion: e.posicionEnHoja,
          correo: e.identidad.correo,
          telefono: e.identidad.telefono,
        })),
        conocidos,
      );
      resultado.posiblesDuplicados = identidad.posiblesDuplicados;

      // 4. Los leads nuevos. Lo que el INSERT devuelve es lo que creo; si otro webhook
      // creo el mismo correo un instante antes, el conflicto se salta y ese lead se lee
      // y se reusa, en vez de fallar o de crear un segundo.
      const idDeLead = new Map<string, string>();
      const creados = new Set<string>();
      const correosNuevos = [
        ...new Set(
          identidad.asignaciones.flatMap((a) => (a.lead?.tipo === "nuevo" ? [a.lead.correo] : [])),
        ),
      ];
      for (const lote of enLotes(correosNuevos)) {
        const insertados = await tx
          .insert(leads)
          .values(lote.map((correo) => ({ programId, emailNormalizado: correo, entrada: "formulario" as const })))
          .onConflictDoNothing()
          .returning();
        for (const f of insertados) {
          idDeLead.set(`nuevo:${f.emailNormalizado}`, f.id);
          creados.add(f.id);
        }
        const faltan = lote.filter((c) => !idDeLead.has(`nuevo:${c}`));
        if (faltan.length > 0) {
          const ganados = await tx
            .select()
            .from(leads)
            .where(and(eq(leads.programId, programId), inArray(leads.emailNormalizado, faltan)));
          for (const f of ganados) idDeLead.set(`nuevo:${f.emailNormalizado}`, f.id);
        }
      }
      const resolverLead = (lead: LeadRef | null): string | null =>
        lead === null ? null : lead.tipo === "existente" ? lead.leadId : (idDeLead.get(llaveDeLead(lead)) ?? null);

      // 5. Los envios. En un reintento se actualiza el contenido, pero el lead de un
      // envio que ya tenia uno NO se reasigna: separar o unir es una decision del
      // gerente (ADR 0035), y una relectura de la hoja no la deshace.
      const leadDeEnvio = new Map(identidad.asignaciones.map((a) => [a.token, resolverLead(a.lead)]));
      const idDeEnvio = new Map<string, string>();
      // Los envios de ESTE lote por lead: el que dispara la regla de deals es el mas
      // reciente de ellos, y es el origen del deal que abra (ADR 0060).
      const enviosDelLote = new Map<string, EnvioCandidato[]>();
      for (const lote of enLotes(envios)) {
        const filas = await tx
          .insert(submissions)
          .values(
            lote.map((e) => ({
              leadId: leadDeEnvio.get(llaveDeEnvio(e)) ?? null,
              sourceId: e.sourceId,
              token: e.token,
              esParcial: e.esParcial,
              fechaEnvio: e.fechaEnvio,
              nombre: e.nombre,
              estadoHoja: e.estadoHoja,
              utmSource: e.utmSource,
              utmMedium: e.utmMedium,
              utmCampaign: e.utmCampaign,
              utmId: e.utmId,
              utmContent: e.utmContent,
              utmTerm: e.utmTerm,
              posicionEnHoja: e.posicionEnHoja,
              respuestas: e.respuestas,
              puntaje: e.puntaje,
              leadQuality: e.leadQuality,
              leadValue: e.leadValue,
              ...notaDe.get(llaveDeEnvio(e)),
            })),
          )
          .onConflictDoUpdate({
            target: [submissions.sourceId, submissions.token, submissions.esParcial],
            set: {
              leadId: sql`coalesce("submissions"."lead_id", excluded."lead_id")`,
              fechaEnvio: sql`excluded."fecha_envio"`,
              nombre: sql`excluded."nombre"`,
              estadoHoja: sql`excluded."estado_hoja"`,
              utmSource: sql`excluded."utm_source"`,
              utmMedium: sql`excluded."utm_medium"`,
              utmCampaign: sql`excluded."utm_campaign"`,
              utmId: sql`excluded."utm_id"`,
              utmContent: sql`excluded."utm_content"`,
              utmTerm: sql`excluded."utm_term"`,
              posicionEnHoja: sql`excluded."posicion_en_hoja"`,
              respuestas: sql`excluded."respuestas"`,
              calificacion: sql`excluded."calificacion"`,
              puntaje: sql`excluded."puntaje"`,
              leadQuality: sql`excluded."lead_quality"`,
              leadValue: sql`excluded."lead_value"`,
              versionPuntaje: sql`excluded."version_puntaje"`,
            },
          })
          .returning();
        for (const f of filas) {
          idDeEnvio.set(llaveDeEnvio(f), f.id);
          if (f.leadId === null) resultado.enviosSinLead++;
          else enviosDelLote.set(f.leadId, [...(enviosDelLote.get(f.leadId) ?? []), f]);
        }
      }
      resultado.envios = envios.length;

      // 6. Los contactos, cada uno con el envio del que llego.
      const contactos = identidad.contactosNuevos.flatMap((c) => {
        const leadId = resolverLead(c.lead);
        return leadId === null
          ? []
          : [
              {
                leadId,
                programId,
                tipo: c.tipo,
                valor: c.valor,
                submissionId: idDeEnvio.get(c.token) ?? null,
                esPrincipal: c.esPrincipal,
                confirmado: c.confirmado,
              },
            ];
      });
      for (const lote of enLotes(contactos)) {
        const filas = await tx
          .insert(leadContactos)
          .values(lote)
          .onConflictDoNothing()
          .returning();
        resultado.contactosNuevos += filas.length;
      }

      // 7. El resumen de cada lead tocado, recalculado desde TODOS sus envios.
      const tocados = [
        ...new Set(
          identidad.asignaciones.map((a) => resolverLead(a.lead)).filter((id): id is string => id !== null),
        ),
      ];
      const { actualizados, cambios } = await recalcularResumen(tx, tocados, creados, opciones.syncRunId ?? null);
      resultado.leadsNuevos = creados.size;
      resultado.leadsActualizados = actualizados;
      resultado.cambiosRegistrados = cambios;

      // 8. La regla de deals (ticket 052), SOLO si el llamador la pidio. Corre DENTRO
      // de esta misma transaccion, despues del resumen: la regla lee `leads.calificacion`
      // y esa cifra la acaba de fijar el paso 7, asi que tiene que ver el valor final, no
      // el previo. Y al ir en la misma transaccion, un deal que el motor rechace deshace
      // tambien la escritura del envio: no queda un lead ingerido con un deal a medias.
      if (opciones.aplicarReglaDeDeals && tocados.length > 0) {
        const leadsTocados = await tx
          .select({
            id: leads.id,
            programId: leads.programId,
            emailNormalizado: leads.emailNormalizado,
            calificacion: leads.calificacion,
          })
          .from(leads)
          .where(inArray(leads.id, tocados));
        for (const lead of leadsTocados) {
          const cita = opciones.citasPorCorreo?.get(lead.emailNormalizado);
          const origen = envioMasReciente(enviosDelLote.get(lead.id) ?? []);
          const r = await aplicarReglaDeDeal(tx, lead, cita, origen);
          resultado.reglaDeDeals.push({
            leadId: r.leadId,
            accion: r.accion,
            dealAbiertoId: r.dealAbiertoId,
            rechazo: r.rechazo,
            nota: r.nota,
          });
        }
      }

      return resultado;
    },
  );
}

/**
 * Los contactos que el programa ya tiene para las personas de este lote, y TODOS los
 * contactos de esos leads (no solo los que casan): sin eso, un telefono nuevo de un
 * lead que ya tiene uno entraria como segundo principal.
 *
 * El correo de `leads.email_normalizado` entra tambien como conocido: es la llave
 * unica del lead, y un lead cuyo contacto faltara pareceria nuevo y chocaria con ella.
 */
async function contactosConocidos(tx: Db, programId: string, envios: Envio[]): Promise<ContactoConocido[]> {
  const correos = [...new Set(envios.flatMap((e) => (e.identidad.correo ? [e.identidad.correo] : [])))];
  const telefonos = [...new Set(envios.flatMap((e) => (e.identidad.telefono ? [e.identidad.telefono] : [])))];

  const leadIds = new Set<string>();
  const conocidos: ContactoConocido[] = [];

  for (const lote of enLotes(correos)) {
    const filas = await tx
      .select({ id: leads.id, correo: leads.emailNormalizado })
      .from(leads)
      .where(and(eq(leads.programId, programId), inArray(leads.emailNormalizado, lote)));
    for (const f of filas) {
      leadIds.add(f.id);
      conocidos.push({ leadId: f.id, tipo: "correo", valor: f.correo, confirmado: true });
    }
  }
  for (const [tipo, valores] of [["correo", correos], ["telefono", telefonos]] as const) {
    for (const lote of enLotes(valores)) {
      const filas = await tx
        .select({ leadId: leadContactos.leadId })
        .from(leadContactos)
        .where(
          and(
            eq(leadContactos.programId, programId),
            eq(leadContactos.tipo, tipo),
            inArray(leadContactos.valor, lote),
          ),
        );
      for (const f of filas) leadIds.add(f.leadId);
    }
  }

  for (const lote of enLotes([...leadIds])) {
    const filas = await tx
      .select({
        leadId: leadContactos.leadId,
        tipo: leadContactos.tipo,
        valor: leadContactos.valor,
        confirmado: leadContactos.confirmado,
      })
      .from(leadContactos)
      .where(inArray(leadContactos.leadId, lote));
    conocidos.push(...filas);
  }
  return conocidos;
}

/** Los campos del lead que salen de sus envios. Ninguno se teclea: se recalculan. */
type Resumen = Pick<
  typeof leads.$inferSelect,
  | "nombre"
  | "telefono"
  | "fechaPrimeraAplicacion"
  | "fechaUltimaAplicacion"
  | "numAplicaciones"
  | "calificacion"
  | "puntaje"
  | "leadQuality"
  | "leadValue"
>;

const CAMPOS_DEL_RESUMEN = [
  "nombre",
  "telefono",
  "fechaPrimeraAplicacion",
  "fechaUltimaAplicacion",
  "numAplicaciones",
  "calificacion",
  "puntaje",
  "leadQuality",
  "leadValue",
] as const satisfies readonly (keyof Resumen)[];

type EnvioGuardado = Pick<
  typeof submissions.$inferSelect,
  | "sourceId"
  | "token"
  | "esParcial"
  | "fechaEnvio"
  | "nombre"
  | "posicionEnHoja"
  | "calificacion"
  | "puntaje"
> & { leadQuality?: string | null; leadValue?: string | null };

/**
 * El resumen de un lead a partir de sus envios. Mismas reglas que el dedup de la hoja
 * (`lib/sheets/dedup.ts`), que las aprendio sangrando:
 * - las fechas: la mas antigua y la mas reciente, ignorando las nulas. Una parcial trae
 *   el placeholder `1/1/0001`, que el parser ya devuelve nulo, y una fecha nula NUNCA le
 *   gana a una real (🩸 839 de 1.034 personas perdieron su fecha asi);
 * - los UTM NO: el origen es del envio y el deal recuerda el que lo abrio (ADR 0060).
 *   Un resumen "el mas reciente no vacio" por campo mezclaba dos clics en una sola
 *   combinacion que nadie hizo;
 * - las aplicaciones: los TOKENS distintos. La parcial y la completa de un token son una
 *   sola aplicacion, no dos;
 * - el nombre: el del envio COMPLETO mas reciente con nombre no vacio; si ninguno
 *   completo lo trae, el del parcial mas reciente con nombre; si NINGUN envio trae
 *   nombre, se conserva `nombreActual` (un lead creado a mano no pierde su nombre);
 * - la calificacion: la del envio COMPLETO mas reciente que tenga
 *   calificacion. Si solo hay parciales, el de la ultima parcial. Asi, cuando llega la
 *   completa, el lead deja de estar "incompleto" (la herida del script, que decidia una
 *   vez), y quien re-aplico con otra respuesta queda con la nueva;
 * - el puntaje, el leadQuality y el leadValue: los del envio con la MISMA precedencia
 *   (completo fechado mas reciente; si no, completo por posicion; si no, parcial), pero
 *   filtrando por envios que traigan AL MENOS UNO de los tres no nulo. Van por separado
 *   de la calificacion porque un lead con estado vacio (calificacion nula, p. ej. High
 *   que aun no agenda) SI trae valores en el envio, y decidirlos con la calificacion los
 *   perdia (🩸 verificado en produccion: 2 envios con valores y sus leads en NULL). Un
 *   lead sin ningun envio con valores queda con los tres en null, nunca un valor por defecto.
 */
export function resumirEnvios(
  envios: EnvioGuardado[],
  telefonoPrincipal: string | null,
  nombreActual: string | null = null,
): Resumen {
  const conFecha = envios
    .filter((e) => e.fechaEnvio !== null)
    .sort((a, b) => a.fechaEnvio!.getTime() - b.fechaEnvio!.getTime() || (a.posicionEnHoja ?? 0) - (b.posicionEnHoja ?? 0));
  const sinFecha = envios.filter((e) => e.fechaEnvio === null);

  const calificados = envios.filter((e) => e.calificacion !== null);
  const porPosicion = (a: EnvioGuardado, b: EnvioGuardado) => (a.posicionEnHoja ?? 0) - (b.posicionEnHoja ?? 0);
  const completos = conFecha.filter((e) => !e.esParcial && e.calificacion !== null);
  const decide =
    completos.at(-1) ??
    calificados.filter((e) => !e.esParcial).sort(porPosicion).at(-1) ??
    calificados.sort(porPosicion).at(-1) ??
    null;

  // Los valores (puntaje, leadQuality, leadValue) van por separado de la calificacion:
  // un lead con calificacion nula (estado vacio) igual trae valores en su envio, y
  // decidirlos con `decide` los perdia. Misma precedencia que `decide` (completo fechado
  // mas reciente; si no, completo por posicion; si no, parcial mas reciente), pero
  // filtrando por envios con AL MENOS UNO de los tres no nulo.
  const tieneValores = (e: EnvioGuardado) =>
    e.puntaje !== null || (e.leadQuality ?? null) !== null || (e.leadValue ?? null) !== null;
  const conValores = envios.filter(tieneValores);
  const completosConValores = conFecha.filter((e) => !e.esParcial && tieneValores(e));
  const decideValores =
    completosConValores.at(-1) ??
    conValores.filter((e) => !e.esParcial).sort(porPosicion).at(-1) ??
    conValores.sort(porPosicion).at(-1) ??
    null;

  // El nombre sigue el mismo criterio "mas reciente" que las fechas: entre los envios
  // fechados, el ultimo con nombre no vacio (preferiendo un completo sobre un parcial);
  // si ninguno fechado lo trae, un envio sin fecha (parcial) puede aportarlo; y si
  // ningun envio del lead trae nombre, se conserva el actual (un lead creado a mano no
  // pierde su nombre porque llegue un envio anonimo). `nombre` de `EnvioGuardado` ya
  // viene recortado por `construirEnvio` (vacio = null).
  const conNombre = (e: EnvioGuardado) => e.nombre !== null;
  const completosFechadosConNombre = conFecha.filter((e) => !e.esParcial && conNombre(e));
  const parcialesFechadosConNombre = conFecha.filter((e) => e.esParcial && conNombre(e));
  const sinFechaConNombre = sinFecha.filter(conNombre);
  const nombre =
    completosFechadosConNombre.at(-1)?.nombre ??
    parcialesFechadosConNombre.at(-1)?.nombre ??
    sinFechaConNombre.at(-1)?.nombre ??
    nombreActual;

  return {
    nombre,
    telefono: telefonoPrincipal,
    calificacion: decide?.calificacion ?? null,
    puntaje: decideValores?.puntaje ?? null,
    leadQuality: decideValores?.leadQuality ?? null,
    leadValue: decideValores?.leadValue ?? null,
    fechaPrimeraAplicacion: conFecha[0]?.fechaEnvio ?? null,
    fechaUltimaAplicacion: conFecha.at(-1)?.fechaEnvio ?? null,
    numAplicaciones: new Set(envios.map((e) => `${e.sourceId}\u0000${e.token}`)).size,
  };
}

function comoTexto(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

/**
 * UN `UPDATE ... FROM (VALUES ...)` por lote en vez de uno por lead: por el pooler cada
 * viaje cuesta y el traslado de ~3.000 leads no cabia (AGENTS.md, "Rendimiento y escala").
 * Los valores van con su cast: un `null` sin tipo en un VALUES no lo infiere Postgres, y un
 * `Date` NUNCA se interpola crudo en una plantilla `sql` (postgres-js lo rechaza), asi que
 * viajan como ISO. Los nombres de columna van escritos a mano porque aqui no hay ambiguedad
 * que resolver: el UPDATE es de una sola tabla.
 */
async function actualizarResumenes(tx: Db, filas: { id: string; resumen: Resumen }[], ahora: Date): Promise<void> {
  const iso = (d: Date | null) => (d === null ? null : d.toISOString());
  for (const lote of enLotes(filas)) {
    const valores = lote.map(
      ({ id, resumen: r }) =>
        sql`(${id}::uuid, ${r.nombre}::text, ${r.telefono}::text, ${iso(r.fechaPrimeraAplicacion)}::timestamptz, ${iso(r.fechaUltimaAplicacion)}::timestamptz, ${r.numAplicaciones}::integer, ${r.calificacion}::calificacion_envio, ${r.puntaje}::integer, ${r.leadQuality}::text, ${r.leadValue}::text)`,
    );
    await tx.execute(sql`
      update "leads" set
        "nombre" = v.nombre, "telefono" = v.telefono,
        "fecha_primera_aplicacion" = v.fecha_primera, "fecha_ultima_aplicacion" = v.fecha_ultima,
        "num_aplicaciones" = v.num_aplicaciones, "calificacion" = v.calificacion,
        "puntaje" = v.puntaje, "lead_quality" = v.lead_quality, "lead_value" = v.lead_value,
        "updated_at" = ${ahora.toISOString()}::timestamptz
      from (values ${sql.join(valores, sql`, `)})
        as v(id, nombre, telefono, fecha_primera, fecha_ultima, num_aplicaciones, calificacion, puntaje, lead_quality, lead_value)
      where "leads"."id" = v.id
    `);
  }
}

/**
 * Reescribe el resumen de los leads que cambian y deja en `change_log` cada campo
 * tocado de un lead que YA existia. Un lead recien creado no deja bitacora de sus
 * campos: su creacion es el envio mismo, que queda guardado.
 *
 * `actorId`: cuando lo dispara una PERSONA (separar un correo, ticket 072) y no la ingesta,
 * el rastro sale como `app` con su usuario. Sin actor, es la ingesta (`sync`).
 */
export async function recalcularResumen(
  tx: Db,
  leadIds: string[],
  creados: Set<string>,
  syncRunId: string | null,
  actorId: string | null = null,
): Promise<{ actualizados: number; cambios: number }> {
  let actualizados = 0;
  let cambios = 0;

  for (const lote of enLotes(leadIds)) {
    const guardados = await tx.select().from(leads).where(inArray(leads.id, lote));
    const envios = await tx
      .select({
        leadId: submissions.leadId,
        sourceId: submissions.sourceId,
        token: submissions.token,
        fechaEnvio: submissions.fechaEnvio,
        nombre: submissions.nombre,
        posicionEnHoja: submissions.posicionEnHoja,
        esParcial: submissions.esParcial,
        calificacion: submissions.calificacion,
        puntaje: submissions.puntaje,
        leadQuality: submissions.leadQuality,
        leadValue: submissions.leadValue,
      })
      .from(submissions)
      .where(inArray(submissions.leadId, lote));
    const principales = await tx
      .select({ leadId: leadContactos.leadId, valor: leadContactos.valor })
      .from(leadContactos)
      .where(
        and(
          inArray(leadContactos.leadId, lote),
          eq(leadContactos.tipo, "telefono"),
          eq(leadContactos.esPrincipal, true),
        ),
      );
    const telefonoDe = new Map(principales.map((p) => [p.leadId, p.valor]));

    const ahora = new Date();
    const aEscribir: { id: string; resumen: Resumen }[] = [];
    const bitacora: (typeof changeLog.$inferInsert)[] = [];
    for (const lead of guardados) {
      const resumen = resumirEnvios(
        envios.filter((e) => e.leadId === lead.id),
        telefonoDe.get(lead.id) ?? lead.telefono,
        lead.nombre,
      );
      const diffs = CAMPOS_DEL_RESUMEN.filter((c) => comoTexto(lead[c]) !== comoTexto(resumen[c]));
      if (diffs.length === 0) continue;

      aEscribir.push({ id: lead.id, resumen });
      if (creados.has(lead.id)) continue;

      actualizados++;
      for (const campo of diffs) {
        bitacora.push({
          tabla: "leads",
          registroId: lead.id,
          etiqueta: lead.nombre ?? lead.emailNormalizado,
          campo,
          valorAnterior: comoTexto(lead[campo]),
          valorNuevo: comoTexto(resumen[campo]),
          origen: actorId ? ("app" as const) : ("sync" as const),
          userId: actorId,
          syncRunId,
        });
      }
      cambios += diffs.length;
    }
    await actualizarResumenes(tx, aEscribir, ahora);
    for (const filas of enLotes(bitacora)) await tx.insert(changeLog).values(filas);
  }
  return { actualizados, cambios };
}
