import type { ProgramaVisible } from "@/lib/auth/alcance";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { resolverPeriodo, type EntradaDePeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { armarVistaDelDashboard, type VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import {
  conteo,
  dinero,
  sumarConteos,
  sumarDinero,
  sumarUsd,
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

const METRICAS = ["leads", "agendas", "shows", "shows_sin_grain", "sin_resultado", "cierres", "contratado", "caja"] as const;
type MetricaDeTodos = (typeof METRICAS)[number];
/** Las que son foto de hoy: no pertenecen a A ni se comparan con B. */
const FOTOS_DE_HOY = ["cartera", "atendidos_sin_valor", "atendidos_sin_grain"] as const;
type MetricaFotoDeHoy = (typeof FOTOS_DE_HOY)[number];

interface TotalesDePeriodo {
  leads: Conteo;
  agendas: Conteo;
  shows: Conteo;
  /** Shows sin Grain (ticket 135): el conteo se suma; su % va por programa. */
  showsSinGrain: Conteo;
  sinResultado: Conteo;
  cierres: Conteo;
  contratado: Dinero<"USD">;
  caja: Dinero[];
}

export interface FilaDePrograma {
  programa: ProgramaVisible;
  pctShow: Tasa;
  pctCierre: Tasa;
  pctSinGrain: Tasa;
  metaCupos: Conteo | null;
  metaDinamica: Conteo | null;
  vendidos: Conteo | null;
  comision: Dinero;
  descuento: Tasa;
  dashboard: VistaDelDashboard;
  href: string;
}

export interface VistaDeTodos {
  periodo: PeriodoResuelto;
  a: TotalesDePeriodo;
  b: TotalesDePeriodo | null;
  detalles: Record<MetricaDeTodos | MetricaFotoDeHoy, DetalleDeCifra>;
  /** Foto de hoy; no pertenece a A ni se compara con B. */
  cartera: {
    saldo: Dinero<"USD">;
    deals: Conteo;
    vencidos: Conteo;
    sinFechaDeReferencia: Conteo;
    sinSaldoCalculable: Conteo;
  };
  sinValorVendido: Conteo;
  /** Las banderas del Pulso (ticket 191), foto de hoy: los conteos se suman; el % va por programa. */
  banderas: { atendidos: Conteo; sinValor: Conteo; sinGrain: Conteo };
  programas: FilaDePrograma[];
}

export interface EntradaDeVistaDeTodos {
  programas: ProgramaVisible[];
  hoy: string;
  periodo: EntradaDePeriodo;
  ahora?: Date;
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
  const total = (metrica: Exclude<MetricaDeTodos, "caja" | "contratado">) =>
    sumarConteos(resumenes[metrica].map((r) => conteo(r.subtotal.cantidad)));
  return {
    leads: total("leads"),
    agendas: total("agendas"),
    shows: total("shows"),
    showsSinGrain: total("shows_sin_grain"),
    sinResultado: total("sin_resultado"),
    cierres: total("cierres"),
    contratado: sumarUsd(resumenes.contratado.map((r) => dinero("USD", r.subtotal.caja.find((c) => c.moneda === "USD")?.total ?? 0))),
    caja: sumarDinero(
      resumenes.caja.map((r) => r.subtotal.caja.map((c) => dinero(c.moneda, c.total))),
    ),
  };
}

async function resumenesDelPeriodo(
  ids: readonly string[],
  rango: PeriodoResuelto["a"],
  hoy: string,
  ahora: Date,
  db: Db,
): Promise<Record<MetricaDeTodos, ResumenDeMetrica[]>> {
  const pares = await Promise.all(
    METRICAS.map(async (metrica) => [
      metrica,
      await resumenDeMetrica(metrica, { programId: ids, rango, hoy, ahora }, db),
    ] as const),
  );
  return Object.fromEntries(pares) as Record<MetricaDeTodos, ResumenDeMetrica[]>;
}

function detalle(
  metrica: MetricaDeTodos | MetricaFotoDeHoy,
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
    fotoDeHoy: (FOTOS_DE_HOY as readonly string[]).includes(metrica),
  };
}

export async function armarVistaDeTodos(
  { programas, hoy, periodo: entrada, ahora = new Date() }: EntradaDeVistaDeTodos,
  db: Db = dbDeLaApp,
): Promise<VistaDeTodos> {
  const periodo = resolverPeriodo(entrada, { hoy, actual: null });
  const ids = programas.map((p) => p.id);
  const [resumenesA, resumenesB, fotos, filas] = await Promise.all([
    resumenesDelPeriodo(ids, periodo.a, hoy, ahora, db),
    periodo.b ? resumenesDelPeriodo(ids, periodo.b, hoy, ahora, db) : null,
    Promise.all(FOTOS_DE_HOY.map((metrica) => resumenDeMetrica(metrica, { programId: ids, rango: periodo.a, hoy }, db))),
    Promise.all(programas.map(async (programa): Promise<FilaDePrograma> => {
      // Una sola definición de tasas, comisión, descuento, metas y saldo (ADR 0024).
      // A/B se resuelven arriba: las ventanas de cada cohorte no cambian el rango común.
      const dashboard = await armarVistaDelDashboard({
        programId: programa.id, hoy, ahora, preset: "custom",
        periodo: { preset: "custom", a: periodo.a, b: periodo.b ?? undefined },
      }, db);
      const { embudo, sinGrain, cohorte } = dashboard;
      return {
        programa,
        pctShow: tasa(embudo.pctShow),
        pctCierre: tasa(embudo.pctCierre),
        pctSinGrain: tasa(sinGrain.pct),
        metaCupos: cohorte ? conteo(cohorte.meta) : null,
        metaDinamica: cohorte?.ventana ? conteo(cohorte.ventana.metaDinamica) : null,
        vendidos: cohorte ? conteo(cohorte.vendidos) : null,
        comision: dinero("USD", dashboard.comision.totalUsd),
        descuento: tasa(dashboard.descuento.promedioPct),
        dashboard,
        href: `/p/${encodeURIComponent(programa.slug)}/dashboard?${queryDePeriodo(periodo)}`,
      };
    })),
  ]);

  return {
    periodo,
    a: totales(resumenesA),
    b: resumenesB ? totales(resumenesB) : null,
    detalles: {
      ...Object.fromEntries(METRICAS.map((m) => [m, detalle(m, resumenesA[m], periodo)])) as Record<MetricaDeTodos, DetalleDeCifra>,
      ...Object.fromEntries(FOTOS_DE_HOY.map((m, i) => [m, detalle(m, fotos[i], periodo)])) as Record<MetricaFotoDeHoy, DetalleDeCifra>,
    },
    cartera: {
      saldo: sumarUsd(filas.map((f) => dinero("USD", f.dashboard.cartera.saldoUsd))),
      deals: sumarConteos(filas.map((f) => conteo(f.dashboard.cartera.deals))),
      vencidos: sumarConteos(filas.map((f) => conteo(f.dashboard.cartera.vencidos))),
      sinFechaDeReferencia: sumarConteos(filas.map((f) => conteo(f.dashboard.cartera.sinFechaDeReferencia))),
      sinSaldoCalculable: sumarConteos(filas.map((f) => conteo(f.dashboard.cartera.sinSaldoCalculable))),
    },
    sinValorVendido: sumarConteos(filas.map((f) => conteo(f.dashboard.sinValorVendido))),
    banderas: {
      atendidos: sumarConteos(filas.map((f) => conteo(f.dashboard.banderas.atendidos))),
      sinValor: sumarConteos(filas.map((f) => conteo(f.dashboard.banderas.sinValor.cantidad))),
      sinGrain: sumarConteos(filas.map((f) => conteo(f.dashboard.banderas.sinGrain.cantidad))),
    },
    programas: filas,
  };
}
