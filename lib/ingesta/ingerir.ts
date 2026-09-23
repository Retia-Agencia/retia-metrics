import { and, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";
import { changeLog, leadContactos, leads, sources, submissions } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { calificarEnvio, esquemaCalificacion, type Calificacion, type ConfigCalificacion } from "./calificacion";
import { construirEnvio, type EntradaEnvio, type Envio } from "./envio";
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
 * Cada envio se califica y se puntua con la configuracion de SU fuente
 * (`lib/ingesta/calificacion.ts`, T2 y T4). Un envio que no se pudo calificar entra
 * igual, sin calificacion, y queda contado en `sinCalificar` con el motivo.
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
  /** Envios que entraron sin calificacion (o sin puntaje) y por que, agrupado por motivo. */
  sinCalificar: { motivo: string; envios: number }[];
}

export interface OpcionesIngesta {
  /** La corrida que origino la escritura, para la bitacora. Nulo para un webhook. */
  syncRunId?: string | null;
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
  };
  if (entradas.length === 0) return resultado;

  // El programa es una FRONTERA (ADR 0043): un envio de una fuente de otro programa no
  // se escribe aqui, ni aunque el llamador se equivoque. El programa sale de la fuente
  // registrada, nunca de un campo del formulario (T1).
  const idsDeFuente = [...new Set(entradas.map((e) => e.sourceId))];
  const propias = await db
    .select({ id: sources.id, nombre: sources.nombre, calificacion: sources.calificacion })
    .from(sources)
    .where(and(eq(sources.programId, programId), inArray(sources.id, idsDeFuente)));
  if (propias.length !== idsDeFuente.length) {
    throw new ErrorDeApp("Hay envios de una fuente que no pertenece a este programa.", 422);
  }

  // Una configuracion guardada que no pasa el esquema detiene la ingesta antes de
  // escribir: es un error de quien configuro, no algo que se reparte en los leads.
  const configDe = new Map<string, ConfigCalificacion | null>();
  for (const f of propias) {
    if (f.calificacion === null) {
      configDe.set(f.id, null);
      continue;
    }
    const r = esquemaCalificacion.safeParse(f.calificacion);
    if (!r.success) {
      throw new ErrorDeApp(`La calificacion de la fuente "${f.nombre}" esta mal configurada.`, 422);
    }
    configDe.set(f.id, r.data);
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

  // 1b. Calificar y puntuar cada envio con la configuracion de su fuente.
  type Nota = { calificacion: Calificacion | null; puntaje: number | null; versionPuntaje: number | null };
  const notaDe = new Map<string, Nota>();
  const motivos = new Map<string, number>();
  const contar = (motivo: string) => motivos.set(motivo, (motivos.get(motivo) ?? 0) + 1);
  for (const e of envios) {
    const config = configDe.get(e.sourceId) ?? null;
    if (config === null) {
      contar("la fuente no tiene calificacion configurada");
      notaDe.set(llaveDeEnvio(e), { calificacion: null, puntaje: null, versionPuntaje: null });
      continue;
    }
    const r = calificarEnvio(e.respuestas, config);
    if (!r.ok) {
      contar(`el envio no trae: ${r.faltan.join(" · ")}`);
      notaDe.set(llaveDeEnvio(e), { calificacion: null, puntaje: null, versionPuntaje: null });
      continue;
    }
    if (r.faltanParaPuntaje.length > 0) contar(`sin puntaje, el envio no trae: ${r.faltanParaPuntaje.join(" · ")}`);
    notaDe.set(llaveDeEnvio(e), { calificacion: r.calificacion, puntaje: r.puntaje, versionPuntaje: r.versionPuntaje });
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
              estadoHoja: e.estadoHoja,
              utmSource: e.utmSource,
              utmMedium: e.utmMedium,
              utmCampaign: e.utmCampaign,
              posicionEnHoja: e.posicionEnHoja,
              respuestas: e.respuestas,
              ...notaDe.get(llaveDeEnvio(e)),
            })),
          )
          .onConflictDoUpdate({
            target: [submissions.sourceId, submissions.token, submissions.esParcial],
            set: {
              leadId: sql`coalesce("submissions"."lead_id", excluded."lead_id")`,
              fechaEnvio: sql`excluded."fecha_envio"`,
              estadoHoja: sql`excluded."estado_hoja"`,
              utmSource: sql`excluded."utm_source"`,
              utmMedium: sql`excluded."utm_medium"`,
              utmCampaign: sql`excluded."utm_campaign"`,
              posicionEnHoja: sql`excluded."posicion_en_hoja"`,
              respuestas: sql`excluded."respuestas"`,
              calificacion: sql`excluded."calificacion"`,
              puntaje: sql`excluded."puntaje"`,
              versionPuntaje: sql`excluded."version_puntaje"`,
            },
          })
          .returning();
        for (const f of filas) {
          idDeEnvio.set(llaveDeEnvio(f), f.id);
          if (f.leadId === null) resultado.enviosSinLead++;
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
  | "telefono"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "fechaPrimeraAplicacion"
  | "fechaUltimaAplicacion"
  | "numAplicaciones"
  | "calificacion"
  | "puntaje"
>;

const CAMPOS_DEL_RESUMEN = [
  "telefono",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "fechaPrimeraAplicacion",
  "fechaUltimaAplicacion",
  "numAplicaciones",
  "calificacion",
  "puntaje",
] as const satisfies readonly (keyof Resumen)[];

type EnvioGuardado = Pick<
  typeof submissions.$inferSelect,
  | "sourceId"
  | "token"
  | "esParcial"
  | "fechaEnvio"
  | "posicionEnHoja"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "calificacion"
  | "puntaje"
>;

/**
 * El resumen de un lead a partir de sus envios. Mismas reglas que el dedup de la hoja
 * (`lib/sheets/dedup.ts`), que las aprendio sangrando:
 * - las fechas: la mas antigua y la mas reciente, ignorando las nulas. Una parcial trae
 *   el placeholder `1/1/0001`, que el parser ya devuelve nulo, y una fecha nula NUNCA le
 *   gana a una real (🩸 839 de 1.034 personas perdieron su fecha asi);
 * - cada UTM: el valor mas reciente NO vacio. Un envio sin fecha solo rellena huecos;
 * - las aplicaciones: los TOKENS distintos. La parcial y la completa de un token son una
 *   sola aplicacion, no dos;
 * - la calificacion y el puntaje: los del envio COMPLETO mas reciente que tenga
 *   calificacion. Si solo hay parciales, el de la ultima parcial. Asi, cuando llega la
 *   completa, el lead deja de estar "incompleto" (la herida del script, que decidia una
 *   vez), y quien re-aplico con otra respuesta queda con la nueva.
 */
export function resumirEnvios(envios: EnvioGuardado[], telefonoPrincipal: string | null): Resumen {
  const conFecha = envios
    .filter((e) => e.fechaEnvio !== null)
    .sort((a, b) => a.fechaEnvio!.getTime() - b.fechaEnvio!.getTime() || (a.posicionEnHoja ?? 0) - (b.posicionEnHoja ?? 0));
  const sinFecha = envios.filter((e) => e.fechaEnvio === null);

  const utm = { utmSource: null as string | null, utmMedium: null as string | null, utmCampaign: null as string | null };
  // Primero los que no tienen fecha, para que cualquier envio fechado los pise.
  for (const e of [...sinFecha, ...conFecha]) {
    for (const c of ["utmSource", "utmMedium", "utmCampaign"] as const) {
      if (e[c] !== null) utm[c] = e[c];
    }
  }

  const calificados = envios.filter((e) => e.calificacion !== null);
  const porPosicion = (a: EnvioGuardado, b: EnvioGuardado) => (a.posicionEnHoja ?? 0) - (b.posicionEnHoja ?? 0);
  const completos = conFecha.filter((e) => !e.esParcial && e.calificacion !== null);
  const decide =
    completos.at(-1) ??
    calificados.filter((e) => !e.esParcial).sort(porPosicion).at(-1) ??
    calificados.sort(porPosicion).at(-1) ??
    null;

  return {
    telefono: telefonoPrincipal,
    ...utm,
    calificacion: decide?.calificacion ?? null,
    puntaje: decide?.puntaje ?? null,
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
 * Reescribe el resumen de los leads que cambian y deja en `change_log` cada campo
 * tocado de un lead que YA existia. Un lead recien creado no deja bitacora de sus
 * campos: su creacion es el envio mismo, que queda guardado.
 */
async function recalcularResumen(
  tx: Db,
  leadIds: string[],
  creados: Set<string>,
  syncRunId: string | null,
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
        posicionEnHoja: submissions.posicionEnHoja,
        utmSource: submissions.utmSource,
        utmMedium: submissions.utmMedium,
        utmCampaign: submissions.utmCampaign,
        esParcial: submissions.esParcial,
        calificacion: submissions.calificacion,
        puntaje: submissions.puntaje,
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
    for (const lead of guardados) {
      const resumen = resumirEnvios(
        envios.filter((e) => e.leadId === lead.id),
        telefonoDe.get(lead.id) ?? lead.telefono,
      );
      const diffs = CAMPOS_DEL_RESUMEN.filter((c) => comoTexto(lead[c]) !== comoTexto(resumen[c]));
      if (diffs.length === 0) continue;

      await tx.update(leads).set({ ...resumen, updatedAt: ahora }).where(eq(leads.id, lead.id));
      if (creados.has(lead.id)) continue;

      actualizados++;
      await tx.insert(changeLog).values(
        diffs.map((campo) => ({
          tabla: "leads",
          registroId: lead.id,
          etiqueta: lead.nombre ?? lead.emailNormalizado,
          campo,
          valorAnterior: comoTexto(lead[campo]),
          valorNuevo: comoTexto(resumen[campo]),
          origen: "sync" as const,
          syncRunId,
        })),
      );
      cambios += diffs.length;
    }
  }
  return { actualizados, cambios };
}
