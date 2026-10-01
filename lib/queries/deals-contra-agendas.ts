import { and, eq, sql } from "drizzle-orm";
import { diasHabilesEntre, esDiaHabil } from "@/lib/dias-habiles";
import { calls, deals, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Rango } from "@/lib/queries/dashboard";
import {
  fechaAnclaAgendaCreada,
  fechaAnclaDealCreado,
  filtroAgendasCreadas,
  filtroDealsCreados,
} from "@/lib/queries/metricas-filtros";
import type { AlcanceDeSerie } from "@/lib/queries/serie";
import { vigente } from "@/lib/queries/vigente";
import { sumarDias } from "@/lib/rangos";

/**
 * Deals creados contra agendas creadas (ticket 138, GC-33): *"si la generación de deals sube y
 * los agendados no, no estoy trayendo leads calificados"*. Cada punto es el ACUMULADO al cierre
 * de un día hábil, para que A y B se comparen al mismo día hábil (ADR 0067) y no al mismo día
 * del calendario.
 */

export interface ConteoDelDia {
  dia: string;
  deals: number;
  agendas: number;
}

export interface PuntoHabil {
  /** 1 para el primer hábil del periodo. */
  habil: number;
  /** El día de calendario de ese hábil. */
  dia: string;
  deals: number;
  agendas: number;
  /** Agendas por deal. Sin deals no hay razón: `null`, nunca 0 ni infinito. */
  razon: number | null;
}

export interface SerieDealsContraAgendas {
  programId: string;
  rango: Rango;
  puntos: PuntoHabil[];
}

/** La razón de UN programa. Se calcula aquí y en ninguna otra parte: jamás se suma entre programas. */
export function razonAgendasPorDeal(agendas: number, deals: number): number | null {
  return deals === 0 ? null : agendas / deals;
}

/**
 * Acumula los conteos diarios sobre los hábiles del rango. Un día no hábil no tiene punto: lo
 * que nace un sábado entra en el hábil siguiente, y lo que cae después del último hábil (A
 * termina un domingo) entra en el último. Así el último punto es el total del rango, el mismo
 * que cuenta la lista (137). Sin hábiles no hay puntos. Pura: sin base y sin reloj.
 */
export function acumularPorHabil(rango: Rango, conteos: ConteoDelDia[]): PuntoHabil[] {
  const total = diasHabilesEntre(rango.desde, rango.hasta);
  if (total === 0) return [];

  const puntos: PuntoHabil[] = [];
  for (let dia = rango.desde; dia <= rango.hasta; dia = sumarDias(dia, 1)) {
    if (esDiaHabil(dia)) puntos.push({ habil: puntos.length + 1, dia, deals: 0, agendas: 0, razon: null });
  }

  for (const conteo of conteos) {
    if (conteo.dia < rango.desde || conteo.dia > rango.hasta) continue;
    const habilesHastaElDia = diasHabilesEntre(rango.desde, conteo.dia);
    const indice = Math.min(esDiaHabil(conteo.dia) ? habilesHastaElDia : habilesHastaElDia + 1, total) - 1;
    puntos[indice].deals += conteo.deals;
    puntos[indice].agendas += conteo.agendas;
  }

  let deals = 0;
  let agendas = 0;
  for (const punto of puntos) {
    deals += punto.deals;
    agendas += punto.agendas;
    Object.assign(punto, { deals, agendas, razon: razonAgendasPorDeal(agendas, deals) });
  }
  return puntos;
}

/**
 * La serie de UN programa. Los conteos salen de los mismos filtros que la lista de cada cifra
 * (`metricas-filtros.ts`), así el último punto cuadra con ella. En "todos los programas" (095)
 * se llama una vez por programa: los conteos se pueden sumar, la razón no.
 */
export async function serieDealsContraAgendas(
  db: Db,
  { programId, rango }: AlcanceDeSerie,
): Promise<SerieDealsContraAgendas> {
  const alcance = { programId, rango };
  const [porDiaDeDeal, porDiaDeAgenda] = await Promise.all([
    db
      .select({ dia: fechaAnclaDealCreado(), n: sql<number>`count(*)::int` })
      .from(deals)
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(and(filtroDealsCreados(alcance), vigente(deals)))
      .groupBy(fechaAnclaDealCreado()),
    db
      .select({ dia: fechaAnclaAgendaCreada(), n: sql<number>`count(*)::int` })
      .from(calls)
      .where(and(filtroAgendasCreadas(alcance), vigente(calls)))
      .groupBy(fechaAnclaAgendaCreada()),
  ]);

  const conteos = [
    ...porDiaDeDeal.map((f) => ({ dia: f.dia, deals: f.n, agendas: 0 })),
    ...porDiaDeAgenda.map((f) => ({ dia: f.dia, deals: 0, agendas: f.n })),
  ];
  return { programId, rango, puntos: acumularPorHabil(rango, conteos) };
}
