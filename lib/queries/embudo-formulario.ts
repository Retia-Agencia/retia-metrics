import { and, eq, gte, sql } from "drizzle-orm";
import { emparejar, ARBOL_VACIO } from "@/lib/atribucion/emparejar";
import type { Area } from "@/lib/atribucion/canal";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agendoElEnvio } from "@/lib/ingesta/etapa-de-entrada";
import type { AlcanceDeSerie } from "@/lib/queries/serie";

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

/** La calidad con la que el formulario ofrece la agenda (ADR 0069, estándar de puntaje). */
export const CALIDAD_QUE_VE_LA_AGENDA = "high";

export type OrigenDelEmbudoFormulario = "canal" | "sin_utm";

export interface PasosDelFormulario {
  dejoDatos: number;
  completo: number;
  llegoCalendly: number;
  agendo: number;
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
}

const diaDeEnvio = () => sql<string>`(${submissions.fechaEnvio} AT TIME ZONE 'America/Bogota')::date`;


/**
 * Desde el inicio del rango sin tope: un token que empezó dentro puede completar después. El
 * tope lo pone el primer envío de cada token, en memoria.
 */
function leerEnvios(db: Db, programId: string, desde: string) {
  return db
    .select({
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

type Envio = Awaited<ReturnType<typeof leerEnvios>>[number] & { fechaEnvio: Date };

const vacio = (): PasosDelFormulario => ({ dejoDatos: 0, completo: 0, llegoCalendly: 0, agendo: 0 });

export async function embudoDelFormulario(db: Db, { programId, rango }: AlcanceDeSerie): Promise<EmbudoDelFormulario> {
  const envios = await leerEnvios(db, programId, rango.desde);

  const porRegistro = new Map<string, Envio[]>();
  for (const e of envios) {
    // Sin fecha (un centinela de la hoja) no hay día en que contarlo.
    if (e.fechaEnvio === null) continue;
    const llave = `${e.sourceId}\u0000${e.token}`;
    const lista = porRegistro.get(llave) ?? [];
    lista.push({ ...e, fechaEnvio: e.fechaEnvio });
    porRegistro.set(llave, lista);
  }

  const filas = new Map<string, FilaEmbudoFormulario>();
  const total = vacio();
  let sinCalidad = 0;

  for (const lista of porRegistro.values()) {
    lista.sort((a, b) => a.fechaEnvio.getTime() - b.fechaEnvio.getTime());
    if (lista[0].dia > rango.hasta) continue;

    const completas = lista.filter((e) => !e.esParcial);
    const conUtm = completas.at(-1) ?? lista[0];
    const traza = emparejar(utmsDelEnvio(conUtm), ARBOL_VACIO);
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
    const llego = agendo || calidades.includes(CALIDAD_QUE_VE_LA_AGENDA);
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
  };
}
