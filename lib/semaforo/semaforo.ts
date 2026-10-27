import { and, desc, eq, lte } from "drizzle-orm";
import { fotosPauta, pautaSincronizaciones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaCalendarioAnterior } from "@/lib/dias-habiles";
import { fechaDeInstanteEnBogota, instanteDeBogota } from "@/lib/format";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { cohorteActiva } from "@/lib/queries/cohortes";
import {
  costoPorAgenda,
  costoPorAgendaDeVentana,
  type CampanaSemaforo,
  type CostoPorAgenda,
  type NotaSemaforo,
} from "./costo-por-agenda";
import {
  colorDelCosto,
  porcentajeDelUmbral,
  type ColorSemaforo,
  type MotivoSemaforo,
  type UmbralCostoPorAgenda,
} from "./color";

export const NOTA_SIN_ERRORES = "Sin errores en esta corrida.";
export const MINUTOS_DE_GRACIA = 15;

export interface PuntoSemaforo {
  hora: string;
  gasto: number;
  agendasMeta: number | null;
  agendasCrm: number;
  costo: number | null;
}

export interface ComparacionSemaforo extends Omit<PuntoSemaforo, "hora"> {
  dia: string;
  etiqueta: "ayer a esta hora" | "día anterior";
}

export interface RachaSemaforo {
  color: Exclude<ColorSemaforo, "sin_dato">;
  dias: number;
}

export interface MetricaSemaforo {
  metrica: "costo_por_agenda";
  color: ColorSemaforo;
  motivo: MotivoSemaforo;
  moneda: "COP";
  dia: string;
  gasto: number;
  agendasMeta: number | null;
  agendasCrm: number;
  costo: number | null;
  umbral: UmbralCostoPorAgenda | null;
  porcentajeDelUmbral: number | null;
  comparacion: ComparacionSemaforo | null;
  trayectoria: PuntoSemaforo[];
  /** El color del último día cerrado y cuántos días cerrados seguidos lo repiten; null sin dato. */
  racha: RachaSemaforo | null;
  campanas: CampanaSemaforo[];
  lanzamiento: { gasto: number; campanas: CampanaSemaforo[] };
  gastoTotal: number;
  notas: NotaSemaforo[];
}

function corteDeHora(dia: string, hora: number): Date {
  const instante = instanteDeBogota(dia, `${String(hora).padStart(2, "0")}:00`);
  if (!instante) throw new Error("No se pudo construir el corte horario en Bogotá.");
  return new Date(instante.getTime() + MINUTOS_DE_GRACIA * 60_000);
}

function partesDeHoraEnBogota(instante: Date): { hora: number; minuto: number; texto: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instante);
  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  const hora = Number(mapa.hour);
  const minuto = Number(mapa.minute);
  return { hora, minuto, texto: `${mapa.hour}:${mapa.minute}` };
}

async function leerUmbral(db: Db, programId: string): Promise<{
  tieneCohorte: boolean;
  umbral: UmbralCostoPorAgenda | null;
}> {
  const cohorte = await cohorteActiva(programId, db);
  if (!cohorte) return { tieneCohorte: false, umbral: null };
  const objetivo = (await objetivosDeCohortes(db, [cohorte.id])).find((fila) =>
    fila.activo && fila.area === null && fila.metrica === "costo_por_agenda"
  );
  return {
    tieneCohorte: true,
    umbral: objetivo ? { meta: objetivo.meta, aceptable: objetivo.aceptable } : null,
  };
}

async function trayectoriaDelDia(
  db: Db,
  args: { programId: string; dia: string; ahora: Date; horas?: number[] },
): Promise<PuntoSemaforo[]> {
  const { hora } = partesDeHoraEnBogota(args.ahora);
  const horas = args.horas === undefined
    ? Array.from({ length: hora + 1 }, (_, horaPunto) => horaPunto)
    : [...new Set(args.horas)].filter((horaPunto) => horaPunto <= hora).sort((a, b) => a - b);
  const [primera] = await db.select({ tomadaEn: fotosPauta.tomadaEn }).from(fotosPauta).where(and(
    eq(fotosPauta.programId, args.programId),
    eq(fotosPauta.fecha, args.dia),
    lte(fotosPauta.tomadaEn, args.ahora),
  )).orderBy(fotosPauta.tomadaEn).limit(1);
  if (!primera) return [];

  const puntos = await Promise.all(horas.map(async (horaPunto) => {
    const horaTexto = `${String(horaPunto).padStart(2, "0")}:00`;
    const hasta = corteDeHora(args.dia, horaPunto);
    if (primera.tomadaEn > hasta) return null;
    const datos = await costoPorAgenda(db, { programId: args.programId, dia: args.dia, hasta });
    return {
      hora: horaTexto,
      gasto: datos.gasto,
      agendasMeta: datos.agendasMeta,
      agendasCrm: datos.agendasCrm,
      costo: datos.costo,
    };
  }));
  return puntos.filter((punto): punto is PuntoSemaforo => punto !== null).slice(-14);
}

async function rachaDeDiasCerrados(
  db: Db,
  args: { programId: string; hoy: string; tieneCohorte: boolean; umbral: UmbralCostoPorAgenda | null },
): Promise<RachaSemaforo | null> {
  let dia = diaCalendarioAnterior(args.hoy);
  let colorDeRacha: RachaSemaforo["color"] | null = null;
  let dias = 0;
  // La v1 compara el historial con el umbral de la cohorte activa de hoy, no con umbrales históricos.
  for (let revisados = 0; revisados < 20; revisados++) {
    const datos = await costoPorAgendaDeVentana(db, {
      programId: args.programId,
      desde: dia,
      hasta: dia,
    });
    const { color } = colorDelCosto({ datos, tieneCohorte: args.tieneCohorte, umbral: args.umbral });
    if (color === "sin_dato" || (colorDeRacha !== null && color !== colorDeRacha)) break;
    colorDeRacha = color;
    dias += 1;
    dia = diaCalendarioAnterior(dia);
  }
  return colorDeRacha === null ? null : { color: colorDeRacha, dias };
}

function agregarSinDuplicar(destino: NotaSemaforo[], notas: NotaSemaforo[]): void {
  for (const nota of notas) {
    if (!destino.some((existente) => existente.tipo === nota.tipo && existente.texto === nota.texto)) {
      destino.push(nota);
    }
  }
}

async function notasDeCalidad(
  db: Db,
  args: {
    programId: string;
    hoy: string;
    gastoComparacion: number | null;
    tieneCohorte: boolean;
    umbral: UmbralCostoPorAgenda | null;
  },
): Promise<NotaSemaforo[]> {
  const [ultimoError, ultimoOk, fotoHoy] = await Promise.all([
    db.select({ inicio: pautaSincronizaciones.inicio }).from(pautaSincronizaciones)
      .where(eq(pautaSincronizaciones.estado, "error"))
      .orderBy(desc(pautaSincronizaciones.inicio)).limit(1).then((filas) => filas[0] ?? null),
    db.select({ inicio: pautaSincronizaciones.inicio }).from(pautaSincronizaciones)
      .where(eq(pautaSincronizaciones.estado, "ok"))
      .orderBy(desc(pautaSincronizaciones.inicio)).limit(1).then((filas) => filas[0] ?? null),
    db.select({ id: fotosPauta.id }).from(fotosPauta).where(and(
      eq(fotosPauta.programId, args.programId),
      eq(fotosPauta.fecha, args.hoy),
    )).limit(1).then((filas) => filas[0] ?? null),
  ]);
  const notas: NotaSemaforo[] = [];
  if (ultimoError && (!ultimoOk || ultimoError.inicio > ultimoOk.inicio)) {
    notas.push({
      tipo: "problema",
      texto: `La última sincronización con Meta falló a las ${partesDeHoraEnBogota(ultimoError.inicio).texto}.`,
    });
  }
  if (!fotoHoy && args.gastoComparacion !== null && args.gastoComparacion > 0) {
    notas.push({ tipo: "problema", texto: "Meta no trajo datos hoy de este programa." });
  }
  if (!args.tieneCohorte) {
    notas.push({ tipo: "problema", texto: "El programa no tiene una cohorte activa." });
  } else if (!args.umbral) {
    notas.push({ tipo: "problema", texto: "La cohorte activa no tiene umbral de costo por agenda." });
  }
  return notas;
}

function resumen(datos: CostoPorAgenda): Omit<PuntoSemaforo, "hora"> {
  return {
    gasto: datos.gasto,
    agendasMeta: datos.agendasMeta,
    agendasCrm: datos.agendasCrm,
    costo: datos.costo,
  };
}

export async function semaforoDelPrograma(
  db: Db,
  args: { programId: string; ahora: Date; tipo: "dia" | "cierre"; horas?: number[] },
): Promise<MetricaSemaforo> {
  const hoy = fechaDeInstanteEnBogota(args.ahora);
  const dia = args.tipo === "cierre" ? diaCalendarioAnterior(hoy) : hoy;
  const diaComparacion = diaCalendarioAnterior(dia);
  const hora = partesDeHoraEnBogota(args.ahora);
  const instanteComparacion = corteDeHora(diaComparacion, hora.hora);
  const [fotoComparacion] = args.tipo === "dia"
    ? await db.select({ id: fotosPauta.id }).from(fotosPauta).where(and(
      eq(fotosPauta.programId, args.programId),
      eq(fotosPauta.fecha, diaComparacion),
      lte(fotosPauta.tomadaEn, instanteComparacion),
    )).limit(1)
    : [null];

  const [{ tieneCohorte, umbral }, datos, datosComparacion] = await Promise.all([
    leerUmbral(db, args.programId),
    args.tipo === "cierre"
      ? costoPorAgendaDeVentana(db, { programId: args.programId, desde: dia, hasta: dia })
      : costoPorAgenda(db, { programId: args.programId, dia, hasta: corteDeHora(dia, hora.hora) }),
    args.tipo === "cierre"
      ? costoPorAgendaDeVentana(db, {
        programId: args.programId,
        desde: diaComparacion,
        hasta: diaComparacion,
      })
      : fotoComparacion
        ? costoPorAgenda(db, {
          programId: args.programId,
          dia: diaComparacion,
          hasta: instanteComparacion,
        })
        : Promise.resolve(null),
  ]);
  const resultado = colorDelCosto({ datos, tieneCohorte, umbral });
  const ahoraTrayectoria = args.tipo === "cierre"
    ? instanteDeBogota(dia, "23:59")
    : args.ahora;
  if (!ahoraTrayectoria) throw new Error("No se pudo construir el fin del día en Bogotá.");
  const [trayectoria, racha, calidad] = await Promise.all([
    trayectoriaDelDia(db, {
      programId: args.programId,
      dia,
      ahora: ahoraTrayectoria,
      horas: args.horas,
    }),
    rachaDeDiasCerrados(db, { programId: args.programId, hoy, tieneCohorte, umbral }),
    notasDeCalidad(db, {
      programId: args.programId,
      hoy: dia,
      gastoComparacion: args.tipo === "dia" ? (datosComparacion?.gasto ?? null) : null,
      tieneCohorte,
      umbral,
    }),
  ]);
  const notas: NotaSemaforo[] = [];
  agregarSinDuplicar(notas, datos.notas);
  if (datosComparacion) agregarSinDuplicar(notas, datosComparacion.notas);
  agregarSinDuplicar(notas, calidad);
  if (!notas.some((nota) => nota.tipo === "problema")) {
    notas.push({ tipo: "info", texto: NOTA_SIN_ERRORES });
  }

  return {
    metrica: "costo_por_agenda",
    color: resultado.color,
    motivo: resultado.motivo,
    moneda: "COP",
    dia,
    ...resumen(datos),
    umbral,
    porcentajeDelUmbral: porcentajeDelUmbral(datos.costo, umbral),
    comparacion: datosComparacion ? {
      dia: diaComparacion,
      ...resumen(datosComparacion),
      etiqueta: args.tipo === "cierre" ? "día anterior" : "ayer a esta hora",
    } : null,
    trayectoria,
    racha,
    campanas: datos.campanas,
    lanzamiento: datos.lanzamiento,
    gastoTotal: datos.gastoTotal,
    notas,
  };
}
