import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { cohorts, objetivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilAnterior, diaHabilSiguiente, diasHabilesEntre, esDiaHabil } from "@/lib/dias-habiles";
import { agrupar as agruparAgendas } from "@/lib/queries/hechos/agenda";
import { agrupar as agruparEnvios } from "@/lib/queries/hechos/envio";
import { agrupar as agruparVentas } from "@/lib/queries/hechos/venta";
import { grupoDeCitas, type TasasDelGrupo } from "@/lib/queries/tasas-del-grupo";
import { cohorteAnterior } from "@/lib/objetivos/cohorte-anterior";

/** Las ventanas que se pueden escoger en pantalla (`?ritmo=`), en días hábiles. */
export const OPCIONES_VENTANA_RITMO = [5, 10, 20] as const;
export type VentanaRitmo = (typeof OPCIONES_VENTANA_RITMO)[number];
export const VENTANA_RITMO_POR_DEFECTO: VentanaRitmo = 10;

/** `?ritmo=` validado: un valor fuera de las opciones vuelve al de por defecto, nunca falla. */
export function ventanaRitmoDeUrl(valor: unknown): VentanaRitmo {
  const n = z.coerce.number().int().catch(VENTANA_RITMO_POR_DEFECTO).parse(Array.isArray(valor) ? valor[0] : valor);
  return (OPCIONES_VENTANA_RITMO as readonly number[]).includes(n) ? (n as VentanaRitmo) : VENTANA_RITMO_POR_DEFECTO;
}

/**
 * Con menos personas con cita que esto, una conversión medida no se usa: con 20, una venta de más
 * o de menos mueve la tasa 5 puntos, y con menos el requerido de agendas salta de un día a otro.
 */
export const MUESTRA_MINIMA_CONVERSION = 20;

export type OrigenConversion = "objetivo_cohorte" | "cohorte_anterior" | "cohorte_en_curso" | "sin_conversion";

export interface ConversionElegida {
  pctShow: number | null;
  pctCierre: number | null;
  /** Solo existe cuando manda el objetivo declarado agenda → venta. */
  objetivoAgendaAVenta: number | null;
  origen: OrigenConversion;
  /** La cohorte de la que se midió (anterior o en curso); nulo cuando no hubo medición. */
  cohorteCodigo: string | null;
  /** Denominadores y numeradores del único grupo medido (ADR 0079). */
  muestra: { personas: number; shows: number; vendidos: number; pendientes: number } | null;
  /** La medición de la cohorte en curso todavía puede subir: hay citas recientes sin decidir. */
  madurando: boolean;
  razonShow: string | null;
  razonCierre: string | null;
}

interface MedicionDeCohorte {
  codigo: string;
  tasas: Pick<TasasDelGrupo, "deals" | "conShow" | "vendidos" | "pctShow" | "pctCierre">;
  pendientes: number;
}

/** ¿Esta medición tiene las dos muestras para encadenar ventas → shows → agendas? */
export const alcanzaMuestra = (m: MedicionDeCohorte | null): boolean =>
  !!m && m.tasas.deals >= MUESTRA_MINIMA_CONVERSION
    && m.tasas.conShow >= MUESTRA_MINIMA_CONVERSION && m.tasas.vendidos >= 1;

/**
 * Elige las dos tasas de UN mismo grupo. El objetivo declarado sigue mandando sobre las agendas;
 * en ese caso una medición suficiente aporta solo el % de show para hacer visible el paso intermedio.
 */
export function elegirConversion(args: {
  objetivo: number | null;
  anterior: MedicionDeCohorte | null;
  enCurso: (MedicionDeCohorte & { madurando: boolean }) | null;
}): ConversionElegida {
  const muestraDe = (m: MedicionDeCohorte) => ({
    personas: m.tasas.deals,
    shows: m.tasas.conShow,
    vendidos: m.tasas.vendidos,
    pendientes: m.pendientes,
  });
  const razonDeShow = (m: MedicionDeCohorte | null) => !m
    ? "Todavía no sabemos qué porcentaje de las agendas llega al show. Se calcula cuando haya citas con resultado."
    : m.tasas.deals < MUESTRA_MINIMA_CONVERSION
      ? m.pendientes > 0
        ? `En ${m.codigo} hay ${m.pendientes} ${m.pendientes === 1 ? "cita pasada sin resultado" : "citas pasadas sin resultado"}: cuando se ${m.pendientes === 1 ? "registre" : "registren"} se puede medir el % de show.`
        : `En ${m.codigo} van ${m.tasas.deals} ${m.tasas.deals === 1 ? "persona" : "personas"} con cita con resultado y hacen falta ${MUESTRA_MINIMA_CONVERSION} para medir el % de show.`
      : null;
  const razonDeCierre = (m: MedicionDeCohorte | null) => !m
    ? "Todavía no sabemos qué porcentaje de los shows termina en venta. Se calcula cuando haya shows."
    : m.tasas.conShow < MUESTRA_MINIMA_CONVERSION
      ? `En ${m.codigo} van ${m.tasas.conShow} shows y hacen falta ${MUESTRA_MINIMA_CONVERSION} para medir el % de cierre.`
      : m.tasas.vendidos < 1
        ? `Ninguno de los ${m.tasas.conShow} shows de ${m.codigo} ha comprado todavía, así que no hay con qué medir el % de cierre.`
        : null;
  const medida = (m: MedicionDeCohorte, origen: OrigenConversion, madurando: boolean): ConversionElegida => ({
    pctShow: m.tasas.pctShow,
    pctCierre: m.tasas.pctCierre,
    objetivoAgendaAVenta: null,
    origen,
    cohorteCodigo: m.codigo,
    muestra: muestraDe(m),
    madurando,
    razonShow: null,
    razonCierre: null,
  });
  if (args.objetivo !== null && args.objetivo > 0) {
    const medidaShow = [args.anterior, args.enCurso].find((m) => !!m && m.tasas.deals >= MUESTRA_MINIMA_CONVERSION) ?? null;
    return {
      pctShow: medidaShow?.tasas.pctShow ?? null,
      pctCierre: null,
      objetivoAgendaAVenta: args.objetivo,
      origen: "objetivo_cohorte",
      cohorteCodigo: medidaShow?.codigo ?? null,
      muestra: medidaShow ? muestraDe(medidaShow) : null,
      madurando: medidaShow === args.enCurso ? args.enCurso?.madurando ?? false : false,
      razonShow: medidaShow ? null : razonDeShow(args.enCurso ?? args.anterior),
      razonCierre: null,
    };
  }
  if (args.anterior && alcanzaMuestra(args.anterior)) return medida(args.anterior, "cohorte_anterior", false);
  if (args.enCurso && alcanzaMuestra(args.enCurso)) return medida(args.enCurso, "cohorte_en_curso", args.enCurso.madurando);

  const enCurso = args.enCurso;
  return {
    pctShow: null,
    pctCierre: null,
    objetivoAgendaAVenta: null,
    origen: "sin_conversion",
    cohorteCodigo: enCurso?.codigo ?? null,
    muestra: enCurso ? muestraDe(enCurso) : null,
    madurando: false,
    razonShow: razonDeShow(enCurso),
    razonCierre: razonDeCierre(enCurso),
  };
}

export interface ValorDeProyeccion {
  valor: number | null;
  razon: string | null;
}

export interface TramoSemanal {
  tipo: "resto_semana" | "semana" | "final";
  desde: string;
  hasta: string;
  diasHabiles: number;
  ventas: number;
}

export interface ProyeccionDeCohorte {
  cohorte: { codigo: string; metaCupos: number; metaLeadsDia: number | null; fechaCierreVentas: string } | null;
  vendidos: number;
  faltan: number;
  diasHabilesRestantes: number;
  ritmo: ValorDeProyeccion;
  proyeccion: ValorDeProyeccion;
  ventasRequeridasDia: ValorDeProyeccion;
  showsRequeridosDia: ValorDeProyeccion;
  agendasRequeridasDia: ValorDeProyeccion;
  leadsRequeridosDia: ValorDeProyeccion;
  repartoSemanal: TramoSemanal[];
  supuestos: {
    /** La ventana escogida, en días hábiles. */
    ventanaDiasHabiles: VentanaRitmo;
    /** Los días hábiles que de verdad cubre: menos si la venta de la cohorte empezó después. */
    diasHabilesVentana: number;
    ventanaDesde: string;
    ventanaHasta: string;
    /** La ventana se recortó al inicio de ventas de la cohorte. */
    ventanaRecortada: boolean;
    ventasVentana: number;
    agendasVentana: number;
    registrosVentana: number;
    /** Agendas ÷ registros de la ventana: de cada lead, cuántas agendas salen. */
    agendasPorRegistro: number | null;
    conversion: ConversionElegida;
  };
}

export interface DatosParaProyeccion {
  hoy: string;
  cohorte: {
    codigo: string;
    metaCupos: number;
    metaLeadsDia: number | null;
    fechaCierreVentas: string;
  } | null;
  vendidos: number;
  ventasVentana: number;
  agendasVentana: number;
  registrosVentana: number;
  diasHabilesVentana: number;
  ventanaDiasHabiles: VentanaRitmo;
  ventanaDesde: string;
  ventanaHasta: string;
  ventanaRecortada?: boolean;
  conversion: ConversionElegida;
}

const disponible = (valor: number): ValorDeProyeccion => ({ valor, razon: null });
const noDisponible = (razon: string): ValorDeProyeccion => ({ valor: null, razon });

function fechaUtc(anio: number, mes: number, dia: number): string {
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${dos(fecha.getUTCMonth() + 1)}-${dos(fecha.getUTCDate())}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return fechaUtc(anio, mes, dia + dias);
}

function lunesDe(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const semana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return sumarDias(fecha, semana === 0 ? -6 : 1 - semana);
}

/** Reparte el faltante desde el siguiente día hábil, conservando exactamente el total. */
export function repartirFaltantePorSemana(args: {
  hoy: string;
  cierre: string;
  faltan: number;
}): TramoSemanal[] {
  const primero = diaHabilSiguiente(args.hoy);
  const dias = diasHabilesEntre(primero, args.cierre);
  if (dias === 0 || args.faltan <= 0) return [];

  const grupos = new Map<string, string[]>();
  let fecha = primero;
  while (fecha <= args.cierre) {
    const semana = lunesDe(fecha);
    grupos.set(semana, [...(grupos.get(semana) ?? []), fecha]);
    fecha = diaHabilSiguiente(fecha);
  }
  const semanaActual = lunesDe(args.hoy);
  return [...grupos.entries()].map(([semana, fechas]) => ({
    tipo: semana === semanaActual ? "resto_semana" : fechas.length === 5 ? "semana" : "final",
    desde: fechas[0],
    hasta: fechas.at(-1)!,
    diasHabiles: fechas.length,
    ventas: args.faltan * fechas.length / dias,
  }));
}

/** Cómo se nombra la ventana en una razón: "los últimos 10 días hábiles" o "desde que empezó la venta". */
function nombreDeVentana(datos: Pick<DatosParaProyeccion, "ventanaDiasHabiles" | "ventanaRecortada">): string {
  return datos.ventanaRecortada
    ? "desde que empezó la venta de la cohorte"
    : `en los últimos ${datos.ventanaDiasHabiles} días hábiles`;
}

/** Fórmulas de Planeación de `docs/metricas.md`, sin I/O ni redondeos de presentación. */
export function calcularProyeccion(datos: DatosParaProyeccion): ProyeccionDeCohorte {
  const agendasPorRegistro = datos.registrosVentana > 0 ? datos.agendasVentana / datos.registrosVentana : null;
  const base = {
    cohorte: datos.cohorte && {
      codigo: datos.cohorte.codigo,
      metaCupos: datos.cohorte.metaCupos,
      metaLeadsDia: datos.cohorte.metaLeadsDia,
      fechaCierreVentas: datos.cohorte.fechaCierreVentas,
    },
    supuestos: {
      ventanaDiasHabiles: datos.ventanaDiasHabiles,
      diasHabilesVentana: datos.diasHabilesVentana,
      ventanaDesde: datos.ventanaDesde,
      ventanaHasta: datos.ventanaHasta,
      ventanaRecortada: datos.ventanaRecortada ?? false,
      ventasVentana: datos.ventasVentana,
      agendasVentana: datos.agendasVentana,
      registrosVentana: datos.registrosVentana,
      agendasPorRegistro,
      conversion: datos.conversion,
    },
  };
  if (!datos.cohorte) {
    const valor = noDisponible("No hay una cohorte abierta con fechas de venta. Se configura en la pestaña Programa.");
    return {
      ...base,
      vendidos: 0,
      faltan: 0,
      diasHabilesRestantes: 0,
      ritmo: valor,
      proyeccion: valor,
      ventasRequeridasDia: valor,
      showsRequeridosDia: valor,
      agendasRequeridasDia: valor,
      leadsRequeridosDia: valor,
      repartoSemanal: [],
    };
  }

  const ventana = nombreDeVentana(datos);
  const faltan = Math.max(datos.cohorte.metaCupos - datos.vendidos, 0);
  const manana = diaHabilSiguiente(datos.hoy);
  const diasHabilesRestantes = diasHabilesEntre(manana, datos.cohorte.fechaCierreVentas);
  const ventanaMasLarga = OPCIONES_VENTANA_RITMO.some((n) => n > datos.ventanaDiasHabiles) && !datos.ventanaRecortada;
  const ritmo = datos.ventasVentana > 0 && datos.diasHabilesVentana > 0
    ? disponible(datos.ventasVentana / datos.diasHabilesVentana)
    : noDisponible(`No hubo ventas ${ventana}, así que no hay ritmo con qué proyectar.${ventanaMasLarga ? " Prueba con una ventana más larga." : ""}`);
  const proyeccion = ritmo.valor === null
    ? noDisponible(ritmo.razon!)
    : disponible(datos.vendidos + ritmo.valor * diasHabilesRestantes);
  const ventasRequeridasDia = faltan === 0
    ? disponible(0)
    : diasHabilesRestantes > 0
      ? disponible(faltan / diasHabilesRestantes)
      : noDisponible("La venta de esta cohorte ya cerró: no quedan días hábiles para repartir lo que falta.");
  const objetivo = datos.conversion.objetivoAgendaAVenta;
  const agendasRequeridasDia = ventasRequeridasDia.valor === null
    ? noDisponible(ventasRequeridasDia.razon!)
    : ventasRequeridasDia.valor === 0
      ? disponible(0)
      : objetivo !== null && objetivo > 0
        ? disponible(ventasRequeridasDia.valor / objetivo)
        : datos.conversion.pctCierre !== null && datos.conversion.pctCierre > 0
          && datos.conversion.pctShow !== null && datos.conversion.pctShow > 0
          ? disponible((ventasRequeridasDia.valor / datos.conversion.pctCierre) / datos.conversion.pctShow)
          : noDisponible(datos.conversion.pctShow === null
            ? datos.conversion.razonShow ?? "Todavía no sabemos qué porcentaje de las agendas llega al show."
            : datos.conversion.razonCierre ?? "Todavía no sabemos qué porcentaje de los shows termina en venta.");
  const showsRequeridosDia = ventasRequeridasDia.valor === null
    ? noDisponible(ventasRequeridasDia.razon!)
    : ventasRequeridasDia.valor === 0
      ? disponible(0)
      : objetivo !== null
        ? datos.conversion.pctShow !== null
          ? disponible(agendasRequeridasDia.valor! * datos.conversion.pctShow)
          : noDisponible(datos.conversion.razonShow ?? "Todavía no sabemos qué porcentaje de las agendas llega al show.")
        : datos.conversion.pctCierre !== null && datos.conversion.pctCierre > 0
          ? disponible(ventasRequeridasDia.valor / datos.conversion.pctCierre)
          : noDisponible(datos.conversion.razonCierre ?? "Todavía no sabemos qué porcentaje de los shows termina en venta.");
  const leadsRequeridosDia = agendasRequeridasDia.valor === null
    ? noDisponible(ventasRequeridasDia.valor !== null
      ? "Sale de las agendas por día, que todavía no se pueden calcular."
      : agendasRequeridasDia.razon!)
    : agendasRequeridasDia.valor === 0
      ? disponible(0)
      : agendasPorRegistro !== null && agendasPorRegistro > 0
        ? disponible(agendasRequeridasDia.valor / agendasPorRegistro)
        : noDisponible(datos.registrosVentana === 0
          ? `No entraron leads ${ventana}, así que no sabemos cuántos hacen falta para una agenda.`
          : `Ninguno de los leads que entraron ${ventana} agendó, así que no sabemos cuántos hacen falta para una agenda.`);

  return {
    ...base,
    vendidos: datos.vendidos,
    faltan,
    diasHabilesRestantes,
    ritmo,
    proyeccion,
    ventasRequeridasDia,
    showsRequeridosDia,
    agendasRequeridasDia,
    leadsRequeridosDia,
    repartoSemanal: repartirFaltantePorSemana({
      hoy: datos.hoy,
      cierre: datos.cohorte.fechaCierreVentas,
      faltan,
    }),
  };
}

function inicioDeVentana(hoy: string, diasHabiles: number): string {
  // Un fin de semana no es el primer día de la ventana: se cuenta desde el último hábil.
  let fecha = esDiaHabil(hoy) ? hoy : diaHabilAnterior(hoy);
  for (let i = 1; i < diasHabiles; i++) fecha = diaHabilAnterior(fecha);
  return fecha;
}

const total = <T extends "ventas" | "agendas" | "envios">(
  filas: Array<Record<T, number>>,
  medida: T,
) => filas.reduce((suma, fila) => suma + fila[medida], 0);

const menor = (a: string, b: string) => (a < b ? a : b);

/** Lee una sola frontera de programa y delega todos los conteos a la capa de hechos y al grupo del ADR 0079. */
export async function leerProyeccion(
  { programId, hoy, ahora = new Date(), ventanaDiasHabiles = VENTANA_RITMO_POR_DEFECTO }: {
    programId: string;
    hoy: string;
    ahora?: Date;
    ventanaDiasHabiles?: VentanaRitmo;
  },
  db: Db = dbDeLaApp,
): Promise<ProyeccionDeCohorte> {
  const ventanaInicial = inicioDeVentana(hoy, ventanaDiasHabiles);
  const cohortes = await db.select({
    id: cohorts.id,
    codigo: cohorts.codigo,
    estado: cohorts.estado,
    metaCupos: cohorts.metaCupos,
    metaLeadsDia: cohorts.metaLeadsDia,
    fechaInicioVentas: cohorts.fechaInicioVentas,
    fechaCierreVentas: cohorts.fechaCierreVentas,
  }).from(cohorts).where(eq(cohorts.programId, programId));
  const cohorte = cohortes.find((c) => c.estado === "activo");

  if (!cohorte?.fechaInicioVentas || !cohorte.fechaCierreVentas) {
    return calcularProyeccion({
      hoy,
      cohorte: null,
      vendidos: 0,
      ventasVentana: 0,
      agendasVentana: 0,
      registrosVentana: 0,
      diasHabilesVentana: 0,
      ventanaDiasHabiles,
      ventanaDesde: ventanaInicial,
      ventanaHasta: hoy,
      conversion: elegirConversion({ objetivo: null, anterior: null, enCurso: null }),
    });
  }

  const ventanaRecortada = cohorte.fechaInicioVentas > ventanaInicial;
  const ventanaDesde = ventanaRecortada ? cohorte.fechaInicioVentas : ventanaInicial;
  const ventanaHasta = menor(cohorte.fechaCierreVentas, hoy);
  const rangoVentana = { desde: ventanaDesde, hasta: ventanaHasta };
  const rangoCohorte = { desde: cohorte.fechaInicioVentas, hasta: ventanaHasta };
  const [objetivo] = await db.select({ meta: objetivos.meta }).from(objetivos).where(and(
    eq(objetivos.cohortId, cohorte.id),
    eq(objetivos.metrica, "conversion_agenda_venta"),
    isNull(objetivos.area),
    eq(objetivos.activo, true),
  )).limit(1);
  const [ventas, ventasVentana, agendasVentana, registrosVentana] = await Promise.all([
    agruparVentas(db, { programId, rango: rangoCohorte, agruparPor: [], filtros: { cohorte: [cohorte.id] } }),
    agruparVentas(db, { programId, rango: rangoVentana, agruparPor: [], filtros: { cohorte: [cohorte.id] } }),
    agruparAgendas(db, { programId, rango: rangoVentana, agruparPor: [], filtros: { cohorte: [cohorte.id] } }),
    agruparEnvios(db, { programId, rango: rangoVentana, agruparPor: [] }),
  ]);

  const anterior = cohorteAnterior(cohortes, cohorte.id);
  const medir = async (c: { codigo: string; fechaInicioVentas: string | null; fechaCierreVentas: string | null }) => {
    if (!c.fechaInicioVentas || !c.fechaCierreVentas) return null;
    const grupo = await grupoDeCitas(db, {
      programId,
      rango: { desde: c.fechaInicioVentas, hasta: menor(c.fechaCierreVentas, hoy) },
      ahora,
    });
    return { codigo: c.codigo, tasas: grupo.tasas, pendientes: grupo.pendientes.length, madurando: grupo.madurando };
  };
  const medidaAnterior = anterior ? await medir(anterior) : null;
  const necesitaEnCurso = !alcanzaMuestra(medidaAnterior)
    || (!!objetivo && (medidaAnterior?.tasas.deals ?? 0) < MUESTRA_MINIMA_CONVERSION);
  const medidaEnCurso = necesitaEnCurso ? await medir(cohorte) : null;

  return calcularProyeccion({
    hoy,
    cohorte: {
      codigo: cohorte.codigo,
      metaCupos: cohorte.metaCupos,
      metaLeadsDia: cohorte.metaLeadsDia,
      fechaCierreVentas: cohorte.fechaCierreVentas,
    },
    vendidos: total(ventas, "ventas"),
    ventasVentana: total(ventasVentana, "ventas"),
    agendasVentana: total(agendasVentana, "agendas"),
    registrosVentana: total(registrosVentana, "envios"),
    diasHabilesVentana: diasHabilesEntre(ventanaDesde, ventanaHasta),
    ventanaDiasHabiles,
    ventanaDesde,
    ventanaHasta,
    ventanaRecortada,
    conversion: elegirConversion({
      objetivo: objetivo ? Number(objetivo.meta) / 100 : null,
      anterior: medidaAnterior,
      enCurso: medidaEnCurso,
    }),
  });
}
