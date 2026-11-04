import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { diasHabilesEntre } from "@/lib/dias-habiles";
import { resolverPeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { serieDealsContraAgendas, type SerieDealsContraAgendas } from "@/lib/queries/deals-contra-agendas";
import type { OrigenDeDeal } from "@/lib/queries/metricas-filtros";
import { detalleDeCifra, type DetalleDeCifra } from "@/lib/queries/vista-metrica";

export interface EntradaDealsContraAgendas {
  programId: string;
  slug: string;
  hoy: string;
  /** El periodo del selector del dashboard (136). */
  periodo: PeriodoResuelto;
  claveCloser: string | null;
  /** El filtro de cohorte del Hub (377); `null` = todas. */
  cohorteId?: string | null;
  /** La cohorte con que se consulta B (la anterior si se compara contra ella). */
  cohorteIdDeB?: string | null;
  origen: string;
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
      /** Los deals partidos por el envío que los abrió (ticket 372): cada mitad con su propia tasa (N2). */
      porOrigen: Record<OrigenDeDeal, { a: SerieDealsContraAgendas; b: SerieDealsContraAgendas | null }>;
      detalles: {
        deals_creados: DetalleDeCifra;
        deals_que_agendaron: DetalleDeCifra;
        agendas_creadas: DetalleDeCifra;
        deals_desde_completo: DetalleDeCifra;
        deals_desde_parcial: DetalleDeCifra;
        completos_que_agendaron: DetalleDeCifra;
        parciales_que_agendaron: DetalleDeCifra;
      };
    };

const METRICAS_DE_LA_VISTA = [
  "deals_creados", "deals_que_agendaron", "agendas_creadas",
  "deals_desde_completo", "deals_desde_parcial", "completos_que_agendaron", "parciales_que_agendaron",
] as const;

type VistaDealsContraAgendasDisponible = Extract<VistaDealsContraAgendas, { disponible: true }>;

const hayCurva = (p: PeriodoResuelto) => diasHabilesEntre(p.a.desde, p.a.hasta) > 1;

/**
 * La gráfica sigue al selector del dashboard (ADR 0067), salvo cuando A tiene uno o ningún
 * hábil: un punto no es una curva, y el selector arranca en Hoy. Ahí pinta lo que pide el
 * ticket por defecto, este mes contra el mes pasado al mismo día hábil; y si el mes apenas
 * empieza (su primer hábil, o un 1 en fin de semana), el mes pasado completo. Siempre lo dice.
 */
export function periodoDeLaGrafica(periodo: PeriodoResuelto, hoy: string): { periodo: PeriodoResuelto; nota?: string } {
  if (hayCurva(periodo)) return { periodo };
  const esteMes = resolverPeriodo({ preset: "este_mes" }, { hoy });
  if (hayCurva(esteMes)) {
    return {
      periodo: esteMes,
      nota: "El periodo elegido no tiene días hábiles suficientes para una curva: la gráfica muestra este mes contra el mes pasado al mismo día hábil.",
    };
  }
  return {
    periodo: resolverPeriodo({ preset: "mes_pasado" }, { hoy }),
    nota: "El mes apenas empieza: la gráfica muestra el mes pasado contra el anterior al mismo día hábil.",
  };
}

/** Con closer no hay gráfica: generar deals y agendas es del programa (ver `filtroDealsCreados`). */
export async function vistaDealsContraAgendas(
  entrada: EntradaDealsContraAgendas,
  db: Db = dbDeLaApp,
): Promise<VistaDealsContraAgendas> {
  if (entrada.claveCloser) return { disponible: false };

  const { periodo, nota } = periodoDeLaGrafica(entrada.periodo, entrada.hoy);
  const detallesDe = { ...entrada, periodo };
  const cohorteDeB = entrada.cohorteIdDeB === undefined ? entrada.cohorteId : entrada.cohorteIdDeB;
  const serie = (rango: typeof periodo.a, cohorteId: string | null | undefined, origen?: OrigenDeDeal) =>
    serieDealsContraAgendas(db, { programId: entrada.programId, rango, cohorteId }, origen);
  const parDe = async (origen?: OrigenDeDeal) => ({
    a: await serie(periodo.a, entrada.cohorteId, origen),
    b: periodo.b ? await serie(periodo.b, cohorteDeB, origen) : null,
  });
  const [total, completo, parcial, ...detalles] = await Promise.all([
    parDe(),
    parDe("completo"),
    parDe("parcial"),
    ...METRICAS_DE_LA_VISTA.map((metrica) => detalleDeCifra(metrica, detallesDe, db)),
  ]);
  return {
    disponible: true,
    periodo,
    nota,
    a: total.a,
    b: total.b,
    porOrigen: { completo, parcial },
    detalles: Object.fromEntries(METRICAS_DE_LA_VISTA.map((m, i) => [m, detalles[i]])) as VistaDealsContraAgendasDisponible["detalles"],
  };
}
