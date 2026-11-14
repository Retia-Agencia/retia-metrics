/**
 * Hub › Hoy como Cifras (ticket 419, enmienda del 13-nov, fase E-2).
 *
 * Recibe lo que el reporte diario YA calculó (`ReporteDiario`, que la página pasa campo por campo en `DatosDeHoy`) y
 * lo vuelve `CifraDeMetrica`. No consulta la base ni recalcula: cada valor es el campo del reporte que hoy pinta la
 * pantalla. Las tasas, el dinero de las ventas y la caja por moneda son las mismas piezas de Comercial y Dinero, con
 * el periodo de un solo día.
 *
 * Hoy NO sigue el filtro de cohorte ni el de closer: "Calculada con" dice el programa y el día (o la semana).
 * El texto de cada concepto llega por `explicaciones` (es de la ficha, E-1), con el universo ya puesto (DC-2).
 * Módulo PURO.
 */
import { fechaCorta, num, pct } from "@/lib/format";
import {
  cifraDeAsistencia, cifraDeCierreDeVentas, cifraSinMarcar, type ListaDeComercial, type PartesDelGrupo,
} from "@/lib/hub/cifras-de-comercial";
import { cifrasDeEntroACaja, tresDeLasVentas } from "@/lib/hub/cifras-de-dinero";
import { listaDeDetalle, type ContextoDelHub, type FilasDeEvidencia } from "@/lib/hub/contexto-de-cifras";
import { armarCifra, type CifraDeMetrica, type EntradaDeCifra, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { EmbudoDelRango } from "@/lib/queries/dashboard";
import type { DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

export const CONCEPTOS_DE_HOY = [
  "cupos_vendidos", "leads", "leads_que_hacen_falta", "entro_a_caja", "asistencia", "cierre_de_ventas", "citas_sin_marcar",
  "registros", "citas_del_dia", "citas_realizadas", "citas_canceladas", "citas_pendientes",
  "vendido", "recaudado", "por_cobrar", "llevamos", "show_por_cita", "citas_de_manana",
] as const;
export type ConceptoDeHoy = (typeof CONCEPTOS_DE_HOY)[number];
export type ExplicacionesDeHoy = Record<ConceptoDeHoy, ExplicacionDeConcepto>;

/** Las listas que abre Hoy. Las de la semana llegan solo como enlace (sin su total). */
export type ListaDeHoy = ListaDeComercial | "shows" | "canceladas" | "sin_resultado" | "caja" | "leads" | "citas_de_manana";

/** Lo que Hoy necesita del reporte diario, campo por campo: la página lo copia, no lo calcula. */
export interface DatosDeHoy {
  /** `reporte.vista.embudo`: el embudo del día. */
  embudo: EmbudoDelRango;
  /** `reporte.vista.sinResultado`: citas pasadas que el closer no ha marcado. */
  sinResultado: number;
  /** `reporte.registros`: formularios del día. */
  registros: number;
  /** Personas distintas del día; `null` cuando no se midió. */
  leadsDelDia: number | null;
  /** El horizonte "dia" del reporte: cupos vendidos hoy y el objetivo del día (`null` sin ventana de ventas). */
  dia: { real: number; meta: number | null };
  /** El horizonte "semana": cupos de la semana y su objetivo. */
  semana: { real: number; meta: number | null };
  /** `reporte.contexto.semana`: en qué día hábil de la semana vamos y cuántos tiene. */
  diasDeLaSemana: { dia: number; total: number };
  /** El objetivo de leads por día que escribió una persona (`metaDeLeads`); `null` si no hay. */
  objetivoDeLeads: number | null;
  /** `reporte.proyeccion.leadsRequeridosDia`: se calcula; sin valor trae su razón. */
  leadsQueHacenFalta: { valor: number | null; razon: string | null };
  /** `reporte.caja`: los abonos del día por moneda. */
  caja: ReadonlyArray<{ moneda: string; total: number }>;
  /** `reporte.dinero`: Vendido, Recaudado y Por cobrar de las ventas del día. */
  dinero: DineroDeVentas;
  /** `reporte.leadsDeLaSemana`. */
  leadsDeLaSemana: number | null;
  /** `reporte.showDeLaSemana`: la asistencia por CITA de la semana (otra pregunta que la del día, que es por persona). */
  showDeLaSemana: { citasQueYaDebianOcurrir: number; realizadas: number; sinMarcar: number; porcentaje: number | null };
  citasDeManana: number;
}

export interface EntradaDeCifrasDeHoy {
  datos: DatosDeHoy;
  detalles?: Partial<Record<ListaDeHoy, DetalleDeCifra>>;
  evidencia?: Partial<Record<ListaDeHoy, FilasDeEvidencia>>;
  /** Las listas de la semana, ya armadas por la página con `urlDeLista`; solo para quien abre listas. */
  enlacesDeLaSemana?: { cupos: string; leads: string; asistencia: string };
  explicaciones: ExplicacionesDeHoy;
  programa: string;
  /** El día del reporte y hoy en Bogotá, 'YYYY-MM-DD'. */
  dia: string;
  hoy: string;
  /** El lunes de la semana del reporte. */
  lunes: string;
}

export interface CifrasDeHoy {
  // Cifras clave
  cuposVendidos: CifraDeMetrica;
  leads: CifraDeMetrica;
  leadsQueHacenFalta: CifraDeMetrica;
  entroACaja: CifraDeMetrica[];
  asistencia: CifraDeMetrica;
  sinMarcar: CifraDeMetrica | null;
  // Del lead a la venta
  cierreDeVentas: CifraDeMetrica;
  embudo: { envios: CifraDeMetrica; citas: CifraDeMetrica; realizadas: CifraDeMetrica; cuposVendidos: CifraDeMetrica };
  // Citas del día
  citas: { delDia: CifraDeMetrica; realizadas: CifraDeMetrica; canceladas: CifraDeMetrica; sinResultado: CifraDeMetrica };
  // Dinero del día
  vendido: CifraDeMetrica;
  recaudado: CifraDeMetrica;
  porCobrar: CifraDeMetrica;
  // La semana
  semana: { cupos: CifraDeMetrica; leads: CifraDeMetrica; asistencia: CifraDeMetrica };
  citasDeManana: CifraDeMetrica;
}

type Linea = NonNullable<EntradaDeCifra["linea"]>;

export const MOTIVO_SIN_CITAS_DEBIDAS = "Ninguna cita de la semana que ya debía ocurrir tiene resultado";
export const MOTIVO_SIN_LEADS_DE_LA_SEMANA = "No se midieron los leads de la semana";

const fraccion = (llevamos: number, objetivo: number) => (objetivo > 0 ? pct(llevamos / objetivo) : "—");

function soloEnlace(href: string | undefined, nombre: string, articulo: "los" | "las"): EntradaDeCifra["lista"] {
  return href ? { href, nombre, articulo, total: null, filas: [] } : undefined;
}

export function cifrasDeHoy(e: EntradaDeCifrasDeHoy): CifrasDeHoy {
  const d = e.datos;
  const x = e.explicaciones;
  const esHoy = e.dia === e.hoy;
  const elDia = esHoy ? "hoy" : `el ${fechaCorta(e.dia)}`;
  const filtros: Array<readonly [string, string]> = [["Programa", e.programa], ["Día", esHoy ? "Hoy" : fechaCorta(e.dia)]];
  const comun = { filtros, periodo: elDia, enCurso: esHoy };
  const contexto: ContextoDelHub = { programa: e.programa, cohorte: null, rango: { desde: e.dia, hasta: e.dia }, hoy: e.hoy, closer: null };
  const lista = (clave: ListaDeHoy, nombre: string, articulo: "los" | "las" = "las") =>
    listaDeDetalle(e.detalles?.[clave], e.evidencia?.[clave], { nombre, articulo });
  const conteo = (concepto: ConceptoDeHoy, valor: number, deLista?: EntradaDeCifra["lista"], linea?: Linea) =>
    armarCifra({ concepto, explicacion: x[concepto], valor, lista: deLista, linea, ...comun });

  const grupo: PartesDelGrupo = { embudo: d.embudo, detalles: e.detalles, evidencia: e.evidencia, ...comun };

  // --- Cifras clave -------------------------------------------------------------------------------------------
  const cuposVendidos = armarCifra({
    concepto: "cupos_vendidos",
    explicacion: x.cupos_vendidos,
    valor: d.dia.real,
    lista: lista("cierres", "ventas"),
    // El estado sale de lo esperado a hoy, que en un día es el objetivo del día. Sin objetivo, sin estado.
    estado: d.dia.meta !== null && d.dia.meta > 0 ? { fuente: "esperado", llevamos: d.dia.real, esperado: d.dia.meta } : undefined,
    linea: d.dia.meta === null
      ? { antes: "Sin objetivo del día: la cohorte no tiene ventana de ventas" }
      : { antes: "Objetivo del día: ", cifra: num(d.dia.meta, 1), despues: ` · llevas el ${fraccion(d.dia.real, d.dia.meta)}` },
    ...comun,
  });

  const leadsDeHoy = d.leadsDelDia ?? 0;
  const leads = armarCifra({
    concepto: "leads",
    explicacion: x.leads,
    valor: leadsDeHoy,
    lista: lista("leads", "leads", "los"),
    linea: d.objetivoDeLeads === null
      ? { antes: "Sin objetivo de leads por día" }
      : { antes: "Objetivo de leads: ", cifra: `${num(d.objetivoDeLeads, 0)} por día`, despues: ` · llevas el ${fraccion(leadsDeHoy, d.objetivoDeLeads)}` },
    ...comun,
  });

  const leadsQueHacenFalta = armarCifra({
    concepto: "leads_que_hacen_falta",
    explicacion: x.leads_que_hacen_falta,
    valor: d.leadsQueHacenFalta.valor,
    motivo: d.leadsQueHacenFalta.valor === null ? d.leadsQueHacenFalta.razon ?? "Todavía no hay con qué calcularlos" : undefined,
    linea: { antes: "por día" },
    ...comun,
  });

  // --- La semana ----------------------------------------------------------------------------------------------
  const { dia: diaHabil, total: diasHabiles } = d.diasDeLaSemana;
  const tiempo = diasHabiles > 0 ? diaHabil / diasHabiles : 0;
  const semana = esHoy ? `${fechaCorta(e.lunes)} a hoy` : `${fechaCorta(e.lunes)} a ${fechaCorta(e.dia)}`;
  const deLaSemana = {
    filtros: [["Programa", e.programa], ["Semana", semana]] as Array<readonly [string, string]>,
    periodo: `de la semana, del ${semana}`,
    enCurso: esHoy,
  };
  const avanceDeLaSemana = (llevamos: number, meta: number, de: string, origenDeLaMeta: string) => ({
    llevamos, meta, esperado: meta * tiempo, fraccionDeTiempo: tiempo, de,
    ambito: "la semana", origenDeLaMeta, dias: "días hábiles de la semana",
  });
  const metaDeCupos = d.semana.meta !== null && d.semana.meta > 0 && diasHabiles > 0 ? d.semana.meta : null;
  const cuposDeLaSemana = armarCifra({
    concepto: "llevamos",
    explicacion: x.llevamos,
    valor: d.semana.real,
    lista: soloEnlace(e.enlacesDeLaSemana?.cupos, "ventas de la semana", "las"),
    avance: metaDeCupos === null ? undefined : avanceDeLaSemana(d.semana.real, metaDeCupos, "cupos", "Se calcula: es la parte del objetivo del mes que toca esta semana."),
    estado: metaDeCupos === null || tiempo === 0 ? undefined : { fuente: "esperado", llevamos: d.semana.real, esperado: metaDeCupos * tiempo },
    linea: d.semana.meta === null ? { antes: "Sin objetivo de la semana: el mes no tiene ventana de ventas" } : undefined,
    ...deLaSemana,
  });
  const metaDeLeads = d.objetivoDeLeads !== null && d.objetivoDeLeads > 0 && diasHabiles > 0 ? d.objetivoDeLeads * diasHabiles : null;
  const leadsDeLaSemana = armarCifra({
    concepto: "leads",
    explicacion: x.leads,
    valor: d.leadsDeLaSemana,
    motivo: d.leadsDeLaSemana === null ? MOTIVO_SIN_LEADS_DE_LA_SEMANA : undefined,
    lista: soloEnlace(e.enlacesDeLaSemana?.leads, "leads de la semana", "los"),
    avance: metaDeLeads === null || d.leadsDeLaSemana === null ? undefined
      : avanceDeLaSemana(d.leadsDeLaSemana, metaDeLeads, "leads", `Es el objetivo de leads por día (${num(d.objetivoDeLeads!, 0)}) por los ${num(diasHabiles)} días hábiles de la semana.`),
    linea: d.objetivoDeLeads === null ? { antes: "Sin objetivo de leads por día: se define en Configuración" } : undefined,
    ...deLaSemana,
  });
  const s = d.showDeLaSemana;
  const asistenciaDeLaSemana = armarCifra({
    concepto: "show_por_cita",
    explicacion: x.show_por_cita,
    valor: s.porcentaje,
    motivo: s.porcentaje === null ? (s.citasQueYaDebianOcurrir === 0 ? "Todavía no hay citas de la semana que ya debían ocurrir" : MOTIVO_SIN_CITAS_DEBIDAS) : undefined,
    partes: [s.realizadas, s.citasQueYaDebianOcurrir],
    // Una cita sin marcar no es un no show: es un dato que falta.
    parcial: s.porcentaje !== null && s.sinMarcar > 0
      ? `${num(s.sinMarcar)} de ${num(s.citasQueYaDebianOcurrir)} citas ${s.sinMarcar === 1 ? "sigue" : "siguen"} sin resultado marcado por el closer.`
      : undefined,
    lista: soloEnlace(e.enlacesDeLaSemana?.asistencia, "citas que ya debían ocurrir", "las"),
    ...deLaSemana,
  });

  return {
    cuposVendidos,
    leads,
    leadsQueHacenFalta,
    entroACaja: cifrasDeEntroACaja({ caja: d.caja, detalle: e.detalles?.caja, evidencia: e.evidencia?.caja, explicacion: x.entro_a_caja, contexto })
      .map((cifra) => ({ ...cifra, explicacion: { ...cifra.explicacion, filtros: [...filtros, cifra.explicacion.filtros.at(-1)!] } })),
    asistencia: cifraDeAsistencia(grupo, x.asistencia),
    sinMarcar: cifraSinMarcar(grupo, x.citas_sin_marcar),
    cierreDeVentas: cifraDeCierreDeVentas(grupo, x.cierre_de_ventas),
    embudo: {
      // Sin lista: hoy este paso cuenta formularios y abre la lista de personas, que no es lo mismo.
      envios: conteo("registros", d.registros),
      citas: conteo("citas_del_dia", d.embudo.agendas, lista("agendas", "citas")),
      realizadas: conteo("citas_realizadas", d.embudo.llamadasConShow, lista("shows", "citas realizadas")),
      cuposVendidos: conteo("cupos_vendidos", d.embudo.cierres, lista("cierres", "ventas")),
    },
    citas: {
      delDia: conteo("citas_del_dia", d.embudo.agendas, lista("agendas", "citas")),
      realizadas: conteo("citas_realizadas", d.embudo.llamadasConShow, lista("shows", "citas realizadas")),
      canceladas: conteo("citas_canceladas", d.embudo.canceladas, lista("canceladas", "citas canceladas")),
      sinResultado: conteo("citas_pendientes", d.sinResultado, lista("sin_resultado", "citas sin resultado")),
    },
    ...tresDeLasVentas({ dinero: d.dinero, lista: lista("cierres", "ventas"), explicaciones: x, ...comun }),
    semana: { cupos: cuposDeLaSemana, leads: leadsDeLaSemana, asistencia: asistenciaDeLaSemana },
    citasDeManana: armarCifra({
      concepto: "citas_de_manana",
      explicacion: x.citas_de_manana,
      valor: d.citasDeManana,
      lista: lista("citas_de_manana", "citas de mañana"),
      linea: { antes: "Por la fecha de la cita" },
      filtros: [["Programa", e.programa], ["Día", esHoy ? "Mañana" : "El día siguiente"]],
    }),
  };
}
