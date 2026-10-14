import { and, inArray, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario, diaHabilDe } from "@/lib/dias-habiles";
import { cajaRecaudada, type CajaPorMoneda, type VistaDeCohorte } from "@/lib/queries/dashboard";
import { filtroCaja, vendidosEn } from "@/lib/queries/metricas-filtros";
import { sumaDeAbonos } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";

/**
 * La pestaña Hoy del Hub (ticket 252, ADR 0086 punto 3): el reporte diario de septiembre armado
 * con lo que el CRM ya calcula. Este módulo NO calcula ninguna métrica nueva: ordena las que trae
 * `armarVistaDelDashboard` con el periodo de hoy (las mismas de Comercial, Dinero y las metas) y
 * solo agrega dos cosas que el reporte pedía y no existían como cifra suelta: la línea de contexto
 * (en qué día hábil vamos) y la caja del día partida por el origen de cada abono.
 */

/** "día X de N hábiles": X es el conteo de hábiles hasta hoy, inclusive (`diaHabilDe`). */
export interface DiaHabil {
  dia: number;
  total: number;
}

export interface ContextoDelDia {
  semana: DiaHabil;
  mes: DiaHabil & { mes: string };
  /** `null` sin cohorte activa o sin ventana de ventas declarada: no se inventa (ADR 0022). */
  cohorte: (DiaHabil & { codigo: string }) | null;
}

/** Una fecha de calendario armada con `Date.UTC`, escrita 'YYYY-MM-DD' sin pasar por ninguna zona. */
function fechaUtc(anio: number, mes: number, dia: number): string {
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return fechaUtc(anio, mes, dia + dias);
}

function ultimoDiaDelMes(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  return fechaUtc(anio, numero + 1, 0);
}

/**
 * La línea de contexto del reporte: "Semana: día 3 de 5 · Octubre: día 10 de 22 hábiles · C3: día
 * 13 de 32". Días hábiles de Retia: solo se excluyen sábado y domingo. `hoy` ya es el día de Bogotá
 * (`hoyEnBogota`); aquí solo se hace aritmética de calendario sobre él.
 */
export function contextoDelDia(hoy: string, cohorte: VistaDeCohorte | null): ContextoDelDia {
  const dia = diaDeCalendario(hoy);
  const [anio, mes, d] = dia.split("-").map(Number);
  const diaDeLaSemana = new Date(Date.UTC(anio, mes - 1, d)).getUTCDay();
  const lunes = sumarDias(dia, diaDeLaSemana === 0 ? -6 : 1 - diaDeLaSemana);
  const mesDeHoy = dia.slice(0, 7);
  return {
    semana: diaHabilDe(dia, lunes, sumarDias(lunes, 4)),
    mes: { mes: mesDeHoy, ...diaHabilDe(dia, `${mesDeHoy}-01`, ultimoDiaDelMes(mesDeHoy)) },
    cohorte: cohorte?.ventana
      ? { codigo: cohorte.codigo, dia: cohorte.ventana.dia, total: cohorte.ventana.total }
      : null,
  };
}

export type ClaveDeHorizonte = "dia" | "semana" | "cohorte" | "mes";

export interface Horizonte {
  clave: ClaveDeHorizonte;
  /** Cupos esperados en ese horizonte; `null` cuando no hay meta declarada o no aplica. */
  meta: number | null;
  /** Cupos vendidos en ese horizonte. */
  real: number;
  /** real ÷ lo esperado a hoy en ese horizonte; `null` sin base (nunca cero). */
  cumplimiento: number | null;
}

/**
 * Los cupos del día, la semana, la cohorte y el mes, con meta, real y cumplimiento. Cada número sale
 * tal cual de la vista; ninguno se vuelve a contar:
 *
 * - **Día:** la meta es la dinámica de la cohorte (020: faltan ÷ hábiles que quedan); el real, las
 *   ventas de hoy (los cierres del embudo de hoy, los mismos de Comercial).
 * - **Semana:** la compensación semanal de las metas del mes (146).
 * - **Cohorte:** meta y vendidos de la cohorte activa; el cumplimiento es contra la meta lineal a hoy.
 * - **Mes:** la meta del mes (146) y su cumplimiento contra lo esperado a hoy.
 */
export function horizontesDeCupos(vista: VistaDelDashboard): Horizonte[] {
  const { cohorte, metasDelMes, embudo } = vista;
  const semana = metasDelMes.compensacionSemanal;
  const metaDelDia = cohorte?.ventana?.metaDinamica ?? null;
  return [
    {
      clave: "dia",
      meta: metaDelDia,
      real: embudo.cierres,
      cumplimiento: metaDelDia ? embudo.cierres / metaDelDia : null,
    },
    {
      clave: "semana",
      meta: semana?.meta ?? null,
      real: semana?.vendidos ?? 0,
      cumplimiento: semana && semana.meta > 0 ? semana.vendidos / semana.meta : null,
    },
    {
      clave: "cohorte",
      meta: cohorte?.meta ?? null,
      real: cohorte?.vendidos ?? 0,
      cumplimiento: cohorte?.ventana?.cumplimiento ?? null,
    },
    {
      clave: "mes",
      meta: metasDelMes.mesSinVentana ? null : metasDelMes.metaCupos,
      real: metasDelMes.vendidos,
      cumplimiento: metasDelMes.cumplimiento,
    },
  ];
}

export interface CajaDelDiaPorOrigen {
  moneda: string;
  total: number;
  /** Abonos de deals que se vendieron hoy. */
  deVentasDeHoy: number;
  /** Abonos que completan una venta de otro día. */
  deVentasAnteriores: number;
}

/**
 * La caja del día (la misma `cajaRecaudada` de Dinero) partida por el origen de cada abono: los de
 * las ventas de hoy y los que completan una venta anterior. La parte de hoy es la misma suma con un
 * filtro más (el deal está entre los vendidos hoy, `vendidosEn`); la anterior es la diferencia, así
 * que las dos partes siempre suman el total de Dinero.
 */
export async function cajaDelDiaPorOrigen(
  { programId, hoy }: { programId: string; hoy: string },
  db: Db = dbDeLaApp,
): Promise<CajaDelDiaPorOrigen[]> {
  const rango = { desde: hoy, hasta: hoy };
  const alcance = { programId, rango, claveCloser: null };
  const [totales, deHoy] = await Promise.all([
    cajaRecaudada(alcance, db),
    db
      .select({ moneda: abonos.moneda, total: sql<number>`${sumaDeAbonos()}::float8` })
      .from(abonos)
      .where(and(filtroCaja(alcance, db), vigente(abonos), inArray(abonos.dealId, vendidosEn(db, rango))))
      .groupBy(abonos.moneda),
  ]);
  const deHoyPorMoneda = new Map(deHoy.map((fila) => [fila.moneda, fila.total]));
  return totales
    .map((fila: CajaPorMoneda) => {
      const deVentasDeHoy = deHoyPorMoneda.get(fila.moneda) ?? 0;
      return {
        moneda: fila.moneda,
        total: fila.total,
        deVentasDeHoy,
        deVentasAnteriores: Math.round((fila.total - deVentasDeHoy) * 100) / 100,
      };
    })
    .sort((a, b) => a.moneda.localeCompare(b.moneda));
}
