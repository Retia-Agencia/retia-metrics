import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { diasHabilesEntre } from "@/lib/dias-habiles";
import { resolverPeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { serieDealsContraAgendas, type SerieDealsContraAgendas } from "@/lib/queries/deals-contra-agendas";
import { detalleDeCifra, type DetalleDeCifra } from "@/lib/queries/vista-metrica";

export interface EntradaDealsContraAgendas {
  programId: string;
  slug: string;
  hoy: string;
  /** El periodo del selector del dashboard (136). */
  periodo: PeriodoResuelto;
  closerId: string | null;
}

export type VistaDealsContraAgendas =
  | { disponible: false }
  | {
      disponible: true;
      /** El periodo que pinta la gráfica: el del selector, o este mes si el selector es un solo hábil. */
      periodo: PeriodoResuelto;
      /** Por qué la gráfica no usa el periodo del selector, cuando no lo usa. */
      nota?: string;
      a: SerieDealsContraAgendas;
      b: SerieDealsContraAgendas | null;
      detalles: { deals_creados: DetalleDeCifra; agendas_creadas: DetalleDeCifra };
    };

/**
 * La gráfica sigue al selector del dashboard (ADR 0067), salvo cuando A tiene un solo hábil:
 * un punto no es una curva, y el selector arranca en Hoy. Ahí pinta lo que pide el ticket por
 * defecto: este mes contra el mes pasado al mismo día hábil, y lo dice.
 */
export function periodoDeLaGrafica(periodo: PeriodoResuelto, hoy: string): { periodo: PeriodoResuelto; nota?: string } {
  if (diasHabilesEntre(periodo.a.desde, periodo.a.hasta) > 1) return { periodo };
  return {
    periodo: resolverPeriodo({ preset: "este_mes" }, { hoy }),
    nota: "Un solo día no hace curva: la gráfica muestra este mes contra el mes pasado al mismo día hábil.",
  };
}

/** Con closer no hay gráfica: generar deals y agendas es del programa (ver `filtroDealsCreados`). */
export async function vistaDealsContraAgendas(
  entrada: EntradaDealsContraAgendas,
  db: Db = dbDeLaApp,
): Promise<VistaDealsContraAgendas> {
  if (entrada.closerId) return { disponible: false };

  const { periodo, nota } = periodoDeLaGrafica(entrada.periodo, entrada.hoy);
  const detallesDe = { ...entrada, periodo };
  const [a, b, dealsCreados, agendasCreadas] = await Promise.all([
    serieDealsContraAgendas(db, { programId: entrada.programId, rango: periodo.a }),
    periodo.b ? serieDealsContraAgendas(db, { programId: entrada.programId, rango: periodo.b }) : null,
    detalleDeCifra("deals_creados", detallesDe, db),
    detalleDeCifra("agendas_creadas", detallesDe, db),
  ]);
  return {
    disponible: true,
    periodo,
    nota,
    a,
    b,
    detalles: { deals_creados: dealsCreados, agendas_creadas: agendasCreadas },
  };
}
