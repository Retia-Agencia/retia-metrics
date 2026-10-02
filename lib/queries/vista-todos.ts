import type { ProgramaVisible } from "@/lib/auth/alcance";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { resolverPeriodo, type EntradaDePeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { comisionesPorCloser } from "@/lib/queries/comision";
import { embudoDelRango, vistaDeCohorteActiva } from "@/lib/queries/dashboard";
import {
  conteo,
  dinero,
  sumarConteos,
  sumarDinero,
  tasa,
  type Conteo,
  type Dinero,
  type Tasa,
} from "@/lib/queries/agregado-programas";
import {
  desglosesDelResumen,
  resumenDeMetrica,
  type Metrica,
  type ResumenDeMetrica,
} from "@/lib/queries/metricas-con-filas";
import { nombreDeEtapa, type DetalleDeCifra } from "@/lib/queries/vista-metrica";

const METRICAS = ["leads", "agendas", "shows", "cierres", "caja"] as const;
type MetricaDeTodos = (typeof METRICAS)[number];

interface TotalesDePeriodo {
  leads: Conteo;
  agendas: Conteo;
  shows: Conteo;
  cierres: Conteo;
  caja: Dinero[];
}

export interface FilaDePrograma {
  programa: ProgramaVisible;
  pctShow: Tasa;
  pctCierre: Tasa;
  metaCupos: Conteo | null;
  metaDinamica: Conteo | null;
  vendidos: Conteo | null;
  comision: Dinero;
  href: string;
}

export interface VistaDeTodos {
  periodo: PeriodoResuelto;
  a: TotalesDePeriodo;
  b: TotalesDePeriodo | null;
  detalles: Record<MetricaDeTodos, DetalleDeCifra>;
  programas: FilaDePrograma[];
}

export interface EntradaDeVistaDeTodos {
  programas: ProgramaVisible[];
  hoy: string;
  periodo: EntradaDePeriodo;
}

export function queryDePeriodo(periodo: PeriodoResuelto): string {
  const q = new URLSearchParams({ periodo: "custom", a_desde: periodo.a.desde, a_hasta: periodo.a.hasta });
  if (periodo.b) {
    q.set("b_desde", periodo.b.desde);
    q.set("b_hasta", periodo.b.hasta);
  }
  return q.toString();
}

export function urlDeListaTodos(metrica: Metrica, periodo: PeriodoResuelto, moneda?: string): string {
  const q = new URLSearchParams(queryDePeriodo(periodo));
  q.set("metrica", metrica);
  if (moneda) q.set("moneda", moneda);
  return `/dashboard/lista?${q}`;
}

function totales(resumenes: Record<MetricaDeTodos, ResumenDeMetrica[]>): TotalesDePeriodo {
  const total = (metrica: Exclude<MetricaDeTodos, "caja">) =>
    sumarConteos(resumenes[metrica].map((r) => conteo(r.subtotal.cantidad)));
  return {
    leads: total("leads"),
    agendas: total("agendas"),
    shows: total("shows"),
    cierres: total("cierres"),
    caja: sumarDinero(
      resumenes.caja.map((r) => r.subtotal.caja.map((c) => dinero(c.moneda, c.total))),
    ),
  };
}

async function resumenesDelPeriodo(
  ids: readonly string[],
  rango: PeriodoResuelto["a"],
  hoy: string,
  db: Db,
): Promise<Record<MetricaDeTodos, ResumenDeMetrica[]>> {
  const pares = await Promise.all(
    METRICAS.map(async (metrica) => [
      metrica,
      await resumenDeMetrica(metrica, { programId: ids, rango, hoy }, db),
    ] as const),
  );
  return Object.fromEntries(pares) as Record<MetricaDeTodos, ResumenDeMetrica[]>;
}

function detalle(
  metrica: MetricaDeTodos,
  secciones: ResumenDeMetrica[],
  periodo: PeriodoResuelto,
): DetalleDeCifra {
  const resumen: ResumenDeMetrica = {
    programId: "todos",
    disponible: secciones.every((s) => s.disponible),
    subtotal: {
      cantidad: sumarConteos(secciones.map((s) => conteo(s.subtotal.cantidad))).valor,
      caja: sumarDinero(
        secciones.map((s) => s.subtotal.caja.map((c) => dinero(c.moneda, c.total))),
      ).map((c) => ({ moneda: c.moneda, total: c.valor })),
    },
    grupos: secciones.flatMap((s) => s.grupos),
  };
  return {
    resumen,
    desgloses: desglosesDelResumen(resumen.grupos, nombreDeEtapa),
    href: urlDeListaTodos(metrica, periodo),
  };
}

export async function armarVistaDeTodos(
  { programas, hoy, periodo: entrada }: EntradaDeVistaDeTodos,
  db: Db = dbDeLaApp,
): Promise<VistaDeTodos> {
  const periodo = resolverPeriodo(entrada, { hoy, actual: null });
  const ids = programas.map((p) => p.id);
  const [resumenesA, resumenesB, filas] = await Promise.all([
    resumenesDelPeriodo(ids, periodo.a, hoy, db),
    periodo.b ? resumenesDelPeriodo(ids, periodo.b, hoy, db) : null,
    Promise.all(programas.map(async (programa): Promise<FilaDePrograma> => {
      const [embudo, cohorte, comisiones] = await Promise.all([
        embudoDelRango({ programId: programa.id, rango: periodo.a }, db),
        vistaDeCohorteActiva({ programId: programa.id }, hoy, db),
        comisionesPorCloser({ programId: programa.id, rango: periodo.a }, db),
      ]);
      const totalComision = comisiones.reduce((total, c) => total + c.comisionUsd, 0);
      return {
        programa,
        pctShow: tasa(embudo.pctShow),
        pctCierre: tasa(embudo.pctCierre),
        metaCupos: cohorte ? conteo(cohorte.meta) : null,
        metaDinamica: cohorte?.ventana ? conteo(cohorte.ventana.metaDinamica) : null,
        vendidos: cohorte ? conteo(cohorte.vendidos) : null,
        comision: dinero("USD", Math.round((totalComision + Number.EPSILON) * 100) / 100),
        href: `/p/${encodeURIComponent(programa.slug)}/dashboard?${queryDePeriodo(periodo)}`,
      };
    })),
  ]);

  return {
    periodo,
    a: totales(resumenesA),
    b: resumenesB ? totales(resumenesB) : null,
    detalles: Object.fromEntries(METRICAS.map((m) => [m, detalle(m, resumenesA[m], periodo)])) as VistaDeTodos["detalles"],
    programas: filas,
  };
}
