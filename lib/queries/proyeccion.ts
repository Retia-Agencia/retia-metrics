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
  valor: number | null;
  origen: OrigenConversion;
  /** La cohorte de la que se midió (anterior o en curso); nulo con objetivo o sin conversión. */
  cohorteCodigo: string | null;
  /** Personas con cita y, de ellas, las que compraron (ADR 0079); nulo con objetivo. */
  muestra: { personas: number; vendidos: number } | null;
  /** La medición de la cohorte en curso todavía puede subir: hay citas recientes sin decidir. */
  madurando: boolean;
  /** Por qué no hay conversión, en palabras de gerencia. */
  razon: string | null;
}

interface MedicionDeCohorte {
  codigo: string;
  tasas: Pick<TasasDelGrupo, "deals" | "vendidos" | "agendaAVenta">;
}

/** ¿Esta medición alcanza para usarse? Al menos la muestra mínima de personas y alguna venta. */
export const alcanzaMuestra = (m: MedicionDeCohorte | null): boolean =>
  !!m && m.tasas.deals >= MUESTRA_MINIMA_CONVERSION && (m.tasas.agendaAVenta ?? 0) > 0;

/**
 * Qué conversión agenda → venta usa la proyección, en este orden: el objetivo declarado de la
 * cohorte, la medida en la cohorte anterior y la medida en la cohorte en curso. Las dos medidas son
 * la del ADR 0079 (personas con cita que compraron ÷ personas con cita) y solo valen con al menos
 * `MUESTRA_MINIMA_CONVERSION` personas y alguna venta.
 */
export function elegirConversion(args: {
  objetivo: number | null;
  anterior: MedicionDeCohorte | null;
  enCurso: (MedicionDeCohorte & { madurando: boolean }) | null;
}): ConversionElegida {
  if (args.objetivo !== null && args.objetivo > 0) {
    return { valor: args.objetivo, origen: "objetivo_cohorte", cohorteCodigo: null, muestra: null, madurando: false, razon: null };
  }
  const medida = (m: MedicionDeCohorte, origen: OrigenConversion, madurando: boolean): ConversionElegida => ({
    valor: m.tasas.agendaAVenta,
    origen,
    cohorteCodigo: m.codigo,
    muestra: { personas: m.tasas.deals, vendidos: m.tasas.vendidos },
    madurando,
    razon: null,
  });
  if (args.anterior && alcanzaMuestra(args.anterior)) return medida(args.anterior, "cohorte_anterior", false);
  if (args.enCurso && alcanzaMuestra(args.enCurso)) return medida(args.enCurso, "cohorte_en_curso", args.enCurso.madurando);

  const enCurso = args.enCurso;
  const razon = !enCurso
    ? "Todavía no sabemos cuántas agendas terminan en venta. Se calcula solo cuando haya citas."
    : enCurso.tasas.deals < MUESTRA_MINIMA_CONVERSION
      ? `Todavía no sabemos cuántas agendas terminan en venta: en ${enCurso.codigo} van ${enCurso.tasas.deals} ${enCurso.tasas.deals === 1 ? "persona" : "personas"} con cita y hacen falta ${MUESTRA_MINIMA_CONVERSION} para medirlo. Se completa solo a medida que pasen las citas.`
      : `Ninguna de las ${enCurso.tasas.deals} personas con cita de ${enCurso.codigo} ha comprado todavía, así que no hay con qué calcular las agendas. Revisa en Comercial el cierre de esas llamadas.`;
  return { valor: null, origen: "sin_conversion", cohorteCodigo: null, muestra: enCurso ? { personas: enCurso.tasas.deals, vendidos: enCurso.tasas.vendidos } : null, madurando: false, razon };
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
  const agendasRequeridasDia = ventasRequeridasDia.valor === null
    ? noDisponible(ventasRequeridasDia.razon!)
    : ventasRequeridasDia.valor === 0
      ? disponible(0)
      : datos.conversion.valor !== null && datos.conversion.valor > 0
        ? disponible(ventasRequeridasDia.valor / datos.conversion.valor)
        : noDisponible(datos.conversion.razon ?? "Todavía no sabemos cuántas agendas terminan en venta.");
  const leadsRequeridosDia = agendasRequeridasDia.valor === null
    ? noDisponible(datos.conversion.valor === null && ventasRequeridasDia.valor !== null
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

  // Las medidas solo se leen si hacen falta: con objetivo no se usa ninguna.
  const anterior = objetivo ? null : cohorteAnterior(cohortes, cohorte.id);
  const medir = async (c: { codigo: string; fechaInicioVentas: string | null; fechaCierreVentas: string | null }) => {
    if (!c.fechaInicioVentas || !c.fechaCierreVentas) return null;
    const grupo = await grupoDeCitas(db, {
      programId,
      rango: { desde: c.fechaInicioVentas, hasta: menor(c.fechaCierreVentas, hoy) },
      ahora,
    });
    return { codigo: c.codigo, tasas: grupo.tasas, madurando: grupo.madurando };
  };
  const medidaAnterior = anterior ? await medir(anterior) : null;
  const necesitaEnCurso = !objetivo && !alcanzaMuestra(medidaAnterior);
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
