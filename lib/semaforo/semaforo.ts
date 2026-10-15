import { and, desc, eq, lte } from "drizzle-orm";
import { fotosPauta, pautaSincronizaciones } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaHabilAnterior } from "@/lib/dias-habiles";
import { fechaDeInstanteEnBogota, instanteDeBogota } from "@/lib/format";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { cohorteActiva } from "@/lib/queries/cohortes";
import {
  costoPorAgenda,
  costoPorAgendaDeVentana,
  type CostoPorAgenda,
  type NotaSemaforo,
} from "./costo-por-agenda";
import {
  colorDeCierre,
  colorDeDia,
  porcentajeDelUmbral,
  type ColorSemaforo,
  type MotivoSemaforo,
  type UmbralCostoPorAgenda,
} from "./color";

export interface PuntoSemaforo {
  hora: string;
  gasto: number;
  agendas: number;
  costo: number | null;
}

export interface MetricaSemaforo {
  metrica: "costo_por_agenda";
  color: ColorSemaforo;
  motivo: MotivoSemaforo;
  moneda: "COP";
  gasto: number;
  agendas: number;
  costo: number | null;
  umbral: UmbralCostoPorAgenda | null;
  porcentajeDelUmbral: number | null;
  ayerALaMismaHora: (Omit<PuntoSemaforo, "hora"> & { dia: string }) | null;
  trayectoria: PuntoSemaforo[];
  diasSeguidosEnRojo: number;
  agendasMeta: number | null;
  campanas: [];
  notas: NotaSemaforo[];
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
    const hasta = instanteDeBogota(args.dia, horaTexto);
    if (!hasta || primera.tomadaEn > hasta) return null;
    const datos = await costoPorAgenda(db, { programId: args.programId, dia: args.dia, hasta });
    return { hora: horaTexto, gasto: datos.gasto, agendas: datos.agendas, costo: datos.costo };
  }));
  return puntos.filter((punto): punto is PuntoSemaforo => punto !== null).slice(-14);
}

async function diasSeguidosEnRojo(
  db: Db,
  args: { programId: string; hoy: string; tieneCohorte: boolean; umbral: UmbralCostoPorAgenda | null },
): Promise<number> {
  let dia = diaHabilAnterior(args.hoy);
  let cantidad = 0;
  // La v1 compara el historial con el umbral de la cohorte activa de hoy, no con umbrales históricos.
  for (let revisados = 0; revisados < 20; revisados++) {
    const datos = await costoPorAgendaDeVentana(db, {
      programId: args.programId,
      desde: dia,
      hasta: dia,
    });
    const resultado = colorDeCierre({ datos, tieneCohorte: args.tieneCohorte, umbral: args.umbral });
    if (resultado.color !== "peligro") break;
    cantidad += 1;
    dia = diaHabilAnterior(dia);
  }
  return cantidad;
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
  args: { programId: string; hoy: string; ayer: string; tieneCohorte: boolean; umbral: UmbralCostoPorAgenda | null },
): Promise<NotaSemaforo[]> {
  const [ultimoError, ultimoOk, fotoHoy, gastoAyer] = await Promise.all([
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
    costoPorAgendaDeVentana(db, { programId: args.programId, desde: args.ayer, hasta: args.ayer }),
  ]);
  const notas: NotaSemaforo[] = [];
  if (ultimoError && (!ultimoOk || ultimoError.inicio > ultimoOk.inicio)) {
    notas.push({
      tipo: "problema",
      texto: `La última sincronización con Meta falló a las ${partesDeHoraEnBogota(ultimoError.inicio).texto}.`,
    });
  }
  if (!fotoHoy && gastoAyer.gasto > 0) {
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
  return { gasto: datos.gasto, agendas: datos.agendas, costo: datos.costo };
}

export async function semaforoDelPrograma(
  db: Db,
  args: { programId: string; ahora: Date; tipo: "dia" | "cierre"; horas?: number[] },
): Promise<MetricaSemaforo> {
  const hoy = fechaDeInstanteEnBogota(args.ahora);
  const ayer = diaHabilAnterior(hoy);
  const hora = partesDeHoraEnBogota(args.ahora);
  const instanteAyer = instanteDeBogota(ayer, hora.texto);
  if (!instanteAyer) throw new Error("No se pudo construir el instante de ayer en Bogotá.");

  const [{ tieneCohorte, umbral }, datos, datosAyer] = await Promise.all([
    leerUmbral(db, args.programId),
    // Hoy, de día o al cierre, sale de las fotos: el gasto cerrado de hoy lo escribe el cron diario
    // después de las 18 h, así que `gasto_pauta` todavía no lo tiene.
    costoPorAgenda(db, { programId: args.programId, dia: hoy, hasta: args.ahora }),
    costoPorAgenda(db, { programId: args.programId, dia: ayer, hasta: instanteAyer }),
  ]);
  const resultado = args.tipo === "dia"
    ? colorDeDia({ hoy: datos, ayer: datosAyer, umbral })
    : colorDeCierre({ datos, tieneCohorte, umbral });
  const [trayectoria, diasRojos, calidad] = await Promise.all([
    trayectoriaDelDia(db, {
      programId: args.programId,
      dia: hoy,
      ahora: args.ahora,
      horas: args.horas,
    }),
    diasSeguidosEnRojo(db, { programId: args.programId, hoy, tieneCohorte, umbral }),
    notasDeCalidad(db, { programId: args.programId, hoy, ayer, tieneCohorte, umbral }),
  ]);
  const notas: NotaSemaforo[] = [];
  agregarSinDuplicar(notas, datos.notas);
  agregarSinDuplicar(notas, datosAyer.notas);
  agregarSinDuplicar(notas, calidad);
  if (!notas.some((nota) => nota.tipo === "problema")) {
    notas.push({ tipo: "info", texto: "Sin errores en esta corrida." });
  }

  return {
    metrica: "costo_por_agenda",
    color: resultado.color,
    motivo: resultado.motivo,
    moneda: "COP",
    ...resumen(datos),
    umbral,
    porcentajeDelUmbral: porcentajeDelUmbral(datos.costo, umbral),
    ayerALaMismaHora: { dia: ayer, ...resumen(datosAyer) },
    trayectoria,
    diasSeguidosEnRojo: diasRojos,
    agendasMeta: datos.agendasMeta,
    campanas: [],
    notas,
  };
}
