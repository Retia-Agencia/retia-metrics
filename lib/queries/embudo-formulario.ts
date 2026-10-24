import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { emparejar } from "@/lib/atribucion/emparejar";
import type { Area } from "@/lib/atribucion/canal";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { calls, deals, leads, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agendoElEnvio, esCalidadAlta } from "@/lib/ingesta/etapa-de-entrada";
import { arbolDePauta } from "@/lib/pauta/arbol";
import type { AlcanceDeSerie } from "@/lib/queries/serie";
import { vigente } from "@/lib/queries/vigente";
import { ETAPAS_EN_ORDEN, type EtapaDeal } from "@/lib/deals/etapas";
import { etiquetaDeCloserSql } from "@/lib/closers/identidad";
import { CLAVE_SIN_DUENO } from "@/lib/queries/embudo-con-filas";
import { ultimaActividadPorDeal } from "@/lib/queries/ultima-actividad";
import { diaDeCalendario } from "@/lib/dias-habiles";

/**
 * El embudo del formulario POR CANAL (ticket 126, parte A; `docs/analytics.md` §6): de las
 * personas-envío que dejaron datos, cuántas completaron, cuántas llegaron al Calendly y cuántas
 * agendaron. Lo agregado por pregunta lo da el Insights de Typeform (parte B); esto es lo que
 * el CRM ve desde el primer parcial, y es lo único que trae canal.
 *
 * - **La unidad es el registro** (`fuente`, `token`): un parcial y su completa son UNO (PT-09).
 * - **Por la fecha de su primer envío**, en días de Bogotá. Un token que empezó en el rango
 *   cuenta entero aunque complete después.
 * - **El canal sale del envío completo** si lo hay (el último que mandó el formulario), si no
 *   del primer parcial; por `emparejar`, igual que el resto del embudo. "Sin UTM" queda
 *   como una fila aparte, siempre.
 * - **Agendó** es el hecho que pone el código (`agendoElEnvio`, `ESTADO_CON_CALENDLY`: la pregunta de agenda
 *   trae link). **Llegó al Calendly** es agendó, o la calidad `High`: a quien es High el
 *   formulario le ofrece la agenda (ADR 0069 punto 2; medido el 1-oct: todo
 *   `con_calendly_sin_agenda` llega High). No lee la variable `estado`, que el 0069 retira.
 *   Un envío anterior a que el formulario mandara la calidad solo "llegó" si agendó: se
 *   cuenta aparte en `sinCalidad` para que la pantalla lo diga.
 */

export const METRICA_NO_AGENDARON = "no_agendaron" as const;
export type MetricaDeEmbudoFormulario = typeof METRICA_NO_AGENDARON;

export function esMetricaDeEmbudoFormulario(metrica: string): metrica is MetricaDeEmbudoFormulario {
  return metrica === METRICA_NO_AGENDARON;
}

/** La única respuesta a “¿este registro llegó al Calendly?”. */
export function llegoAlCalendly(envios: readonly Pick<Envio, "calificacion" | "leadQuality">[]): boolean {
  return envios.some((envio) => agendoElEnvio(envio.calificacion) || esCalidadAlta(envio.leadQuality));
}

export type OrigenDelEmbudoFormulario = "canal" | "sin_utm";

export interface PasosDelFormulario {
  dejoDatos: number;
  completo: number;
  llegoCalendly: number;
  agendo: number;
}

type PasoDespuesDeDejarDatos = Exclude<keyof PasosDelFormulario, "dejoDatos">;

export function tasasDelEmbudo(
  pasos: PasosDelFormulario,
): Record<PasoDespuesDeDejarDatos, { sobreAnterior: number | null; sobreDejoDatos: number | null }> {
  const tasa = (parte: number, base: number) => (base === 0 ? null : parte / base);
  return {
    completo: {
      sobreAnterior: tasa(pasos.completo, pasos.dejoDatos),
      sobreDejoDatos: tasa(pasos.completo, pasos.dejoDatos),
    },
    llegoCalendly: {
      sobreAnterior: tasa(pasos.llegoCalendly, pasos.completo),
      sobreDejoDatos: tasa(pasos.llegoCalendly, pasos.dejoDatos),
    },
    agendo: {
      sobreAnterior: tasa(pasos.agendo, pasos.llegoCalendly),
      sobreDejoDatos: tasa(pasos.agendo, pasos.dejoDatos),
    },
  };
}

export interface FilaEmbudoFormulario extends PasosDelFormulario {
  origen: OrigenDelEmbudoFormulario;
  canalClave: string | null;
  canal: string | null;
  area: Area;
}

export interface EmbudoDelFormulario {
  filas: FilaEmbudoFormulario[];
  total: PasosDelFormulario;
  /** Registros sin calidad que no agendaron: no se sabe si vieron el Calendly. */
  sinCalidad: number;
  /** Foto viva: llegó al Calendly, pero hoy no conserva cita ni etapa Agendado o posterior. */
  noAgendaron: number;
}

const diaDeEnvio = () => sql<string>`(${submissions.fechaEnvio} AT TIME ZONE 'America/Bogota')::date`;


/**
 * Desde el inicio del rango sin tope: un token que empezó dentro puede completar después. El
 * tope lo pone el primer envío de cada token, en memoria.
 */
function leerEnvios(db: Db, programId: string, desde: string) {
  return db
    .select({
      leadId: submissions.leadId,
      sourceId: submissions.sourceId,
      token: submissions.token,
      esParcial: submissions.esParcial,
      dia: diaDeEnvio(),
      fechaEnvio: submissions.fechaEnvio,
      calificacion: submissions.calificacion,
      leadQuality: submissions.leadQuality,
      ...columnasUtmDelEnvio,
    })
    .from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(and(eq(sources.programId, programId), gte(diaDeEnvio(), desde)));
}

type EnvioLeido = Awaited<ReturnType<typeof leerEnvios>>[number];
type Envio = Omit<EnvioLeido, "fechaEnvio"> & { fechaEnvio: Date };

interface RegistroDelFormulario {
  id: string;
  leadId: string | null;
  fecha: string;
  envios: Envio[];
}

export interface MiembroNoAgendaron {
  id: string;
  dealId: string;
  leadId: string;
  nombre: string | null;
  fecha: string;
  ultimaActividad: string;
  closer: string | null;
  claveCloser: string;
  etapa: EtapaDeal;
}

function registrosEnElRango(envios: readonly EnvioLeido[], rango: AlcanceDeSerie["rango"]): RegistroDelFormulario[] {
  const porRegistro = new Map<string, Envio[]>();
  for (const envio of envios) {
    if (envio.fechaEnvio === null) continue;
    const id = `${envio.sourceId}\u0000${envio.token}`;
    const lista = porRegistro.get(id) ?? [];
    lista.push({ ...envio, fechaEnvio: envio.fechaEnvio });
    porRegistro.set(id, lista);
  }
  return [...porRegistro].flatMap(([id, lista]) => {
    lista.sort((a, b) => a.fechaEnvio.getTime() - b.fechaEnvio.getTime());
    const primero = lista[0];
    return primero.dia > rango.hasta ? [] : [{ id, leadId: primero.leadId, fecha: primero.dia, envios: lista }];
  });
}

const DESDE_AGENDADO = ETAPAS_EN_ORDEN.indexOf("agendado");
const ETAPAS_CERRADAS: readonly EtapaDeal[] = ["ganado_completo", "cierre_perdido"];

/** El deal que representa al lead, determinista: el abierto; si no hay, el más reciente; desempate por id. */
function compararDeals(
  a: { dealId: string; etapa: EtapaDeal; createdAt: Date },
  b: { dealId: string; etapa: EtapaDeal; createdAt: Date },
): number {
  const cerradoA = ETAPAS_CERRADAS.includes(a.etapa) ? 1 : 0;
  const cerradoB = ETAPAS_CERRADAS.includes(b.etapa) ? 1 : 0;
  return cerradoA - cerradoB || b.createdAt.getTime() - a.createdAt.getTime() || a.dealId.localeCompare(b.dealId);
}

async function miembrosNoAgendaron(
  db: Db,
  programId: string,
  registros: readonly RegistroDelFormulario[],
): Promise<MiembroNoAgendaron[]> {
  const candidatos = registros.filter(
    (registro): registro is RegistroDelFormulario & { leadId: string } =>
      registro.leadId !== null && llegoAlCalendly(registro.envios),
  );
  const leadIds = [...new Set(candidatos.map((registro) => registro.leadId))];
  if (leadIds.length === 0) return [];
  const filas = await db
    .select({
      dealId: deals.id,
      leadId: deals.leadId,
      nombre: leads.nombre,
      etapa: deals.etapa,
      ownerUserId: deals.ownerUserId,
      closer: etiquetaDeCloserSql(),
      createdAt: deals.createdAt,
    })
    .from(deals)
    .innerJoin(leads, and(eq(leads.id, deals.leadId), eq(leads.programId, deals.programId)))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(eq(deals.programId, programId), inArray(deals.leadId, leadIds), vigente(deals)));
  const dealIds = filas.map((fila) => fila.dealId);
  const [citas, ultimaActividad] = await Promise.all([
    dealIds.length === 0
      ? Promise.resolve([])
      : db.select({ dealId: calls.dealId }).from(calls)
        .where(and(eq(calls.programId, programId), inArray(calls.dealId, dealIds), vigente(calls))),
    ultimaActividadPorDeal(db, dealIds, filas.map((fila) => ({ dealId: fila.dealId, createdAt: fila.createdAt }))),
  ]);
  const conCita = new Set(citas.map((cita) => cita.dealId));
  const dealDeLead = new Map<string, (typeof filas)[number]>();
  for (const fila of filas) {
    const actual = dealDeLead.get(fila.leadId);
    if (!actual || compararDeals(fila, actual) < 0) dealDeLead.set(fila.leadId, fila);
  }
  // Una fila por persona (Mani, 24-oct): la del registro más antiguo que llegó al Calendly.
  const primerRegistro = new Map<string, RegistroDelFormulario & { leadId: string }>();
  for (const registro of candidatos) {
    const actual = primerRegistro.get(registro.leadId);
    if (!actual || registro.fecha < actual.fecha || (registro.fecha === actual.fecha && registro.id < actual.id)) {
      primerRegistro.set(registro.leadId, registro);
    }
  }
  return [...primerRegistro.values()].flatMap((registro) => {
    const deal = dealDeLead.get(registro.leadId);
    // Lo decide el deal mostrado: con cita vigente, en Agendado o después (Cierre perdido incluido), sale.
    if (!deal || conCita.has(deal.dealId) || ETAPAS_EN_ORDEN.indexOf(deal.etapa) >= DESDE_AGENDADO) return [];
    return [{
      id: registro.id,
      dealId: deal.dealId,
      leadId: deal.leadId,
      nombre: deal.nombre,
      fecha: registro.fecha,
      ultimaActividad: diaDeCalendario(ultimaActividad.get(deal.dealId) ?? deal.createdAt),
      closer: deal.closer,
      claveCloser: deal.ownerUserId ?? CLAVE_SIN_DUENO,
      etapa: deal.etapa,
    }];
  });
}

export async function noAgendaronDelFormulario(db: Db, alcance: AlcanceDeSerie): Promise<MiembroNoAgendaron[]> {
  const envios = await leerEnvios(db, alcance.programId, alcance.rango.desde);
  return miembrosNoAgendaron(db, alcance.programId, registrosEnElRango(envios, alcance.rango));
}

const vacio = (): PasosDelFormulario => ({ dejoDatos: 0, completo: 0, llegoCalendly: 0, agendo: 0 });

export async function embudoDelFormulario(db: Db, { programId, rango }: AlcanceDeSerie): Promise<EmbudoDelFormulario> {
  const [envios, arbol] = await Promise.all([
    leerEnvios(db, programId, rango.desde),
    arbolDePauta(db, programId),
  ]);

  const registros = registrosEnElRango(envios, rango);

  const filas = new Map<string, FilaEmbudoFormulario>();
  const total = vacio();
  let sinCalidad = 0;

  for (const { envios: lista } of registros) {

    const completas = lista.filter((e) => !e.esParcial);
    const conUtm = completas.at(-1) ?? lista[0];
    const traza = emparejar(utmsDelEnvio(conUtm), arbol);
    const origen = traza.origen;
    const tipo = origen.regla === "sin_utm" ? "sin_utm" : "canal";
    const clave = tipo === "canal" ? `canal:${origen.area}:${origen.canal?.clave ?? ""}` : tipo;
    const fila =
      filas.get(clave) ??
      ({
        origen: tipo,
        canalClave: tipo === "canal" ? origen.canal?.clave ?? null : null,
        canal: tipo === "canal" ? origen.canal?.nombre ?? "(sin utm_source)" : null,
        area: origen.area,
        ...vacio(),
      } satisfies FilaEmbudoFormulario);

    const agendo = lista.some((e) => agendoElEnvio(e.calificacion));
    const calidades = lista.map((e) => e.leadQuality?.trim().toLowerCase() ?? null).filter((c) => c !== null && c !== "");
    const llego = llegoAlCalendly(lista);
    if (!agendo && calidades.length === 0) sinCalidad += 1;

    const pasos: PasosDelFormulario = {
      dejoDatos: 1,
      completo: completas.length > 0 ? 1 : 0,
      llegoCalendly: llego ? 1 : 0,
      agendo: agendo ? 1 : 0,
    };
    for (const k of Object.keys(pasos) as (keyof PasosDelFormulario)[]) {
      fila[k] += pasos[k];
      total[k] += pasos[k];
    }
    filas.set(clave, fila);
  }

  if (!filas.has("sin_utm")) {
    filas.set("sin_utm", { origen: "sin_utm", canalClave: null, canal: null, area: "sin_utm", ...vacio() });
  }

  const orden = { canal: 0, sin_utm: 1 } as const;
  const noAgendaron = await miembrosNoAgendaron(db, programId, registros);
  return {
    filas: [...filas.values()].sort(
      (a, b) =>
        orden[a.origen] - orden[b.origen] ||
        b.dejoDatos - a.dejoDatos ||
        (a.canal ?? "").localeCompare(b.canal ?? "") ||
        a.area.localeCompare(b.area),
    ),
    total,
    sinCalidad,
    noAgendaron: noAgendaron.length,
  };
}
