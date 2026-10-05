import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import type { EntradaDePeriodo, PeriodoResuelto } from "@/lib/periodo";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { cajaRecaudada, embudoDelRango, type CajaPorMoneda } from "@/lib/queries/dashboard";
import { comisionesPorCloser } from "@/lib/queries/comision";
import { resumenDeMetrica } from "@/lib/queries/metricas-con-filas";
import { detalleDeCifra, type DetalleDeCifra } from "@/lib/queries/vista-metrica";
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

export interface ProgramaDeMetricas {
  id: string;
  slug: string;
  nombre: string;
}

export interface CifrasDePeriodo {
  agendas: number;
  shows: number;
  noShows: number;
  cierres: number;
  pctCierre: number | null;
  /** El rango termina hace menos de 30 días: el % de cierre todavía puede subir (ADR 0079). */
  madurando: boolean;
  caja: CajaPorMoneda[];
  comisionUsd: number;
}

export interface DetallesDeMisMetricas {
  agendas: DetalleDeCifra;
  shows: DetalleDeCifra;
  noShows: DetalleDeCifra;
  cierres: DetalleDeCifra;
  /** La lista del % de cierre: los deals de su grupo con show que hoy están vendidos (ADR 0079). */
  grupoVendidos: DetalleDeCifra;
  caja: DetalleDeCifra;
}

export interface VistaDeMisMetricas {
  programa: ProgramaDeMetricas;
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
  cohorteDisponible: boolean;
  a: CifrasDePeriodo;
  b: CifrasDePeriodo | null;
  detalles: DetallesDeMisMetricas;
}

function comisionDelCloser(
  filas: Awaited<ReturnType<typeof comisionesPorCloser>>,
  closerUserId: string,
): number {
  return filas.find((fila) => fila.userId === closerUserId)?.comisionUsd ?? 0;
}

async function cifrasDelPeriodo(
  programId: string,
  rango: PeriodoResuelto["a"],
  closerUserId: string,
  hoy: string,
  db: Db,
): Promise<CifrasDePeriodo> {
  const alcance = { programId, rango, claveCloser: closerUserId };
  const [embudo, caja, comisiones, [noShows]] = await Promise.all([
    embudoDelRango(alcance, db),
    cajaRecaudada(alcance, db),
    comisionesPorCloser({ programId, rango }, db),
    resumenDeMetrica("no_shows", { ...alcance, hoy }, db),
  ]);
  return {
    agendas: embudo.agendas,
    shows: embudo.llamadasConShow,
    noShows: noShows.subtotal.cantidad,
    cierres: embudo.cierres,
    pctCierre: embudo.pctCierre,
    madurando: embudo.madurando,
    caja,
    comisionUsd: comisionDelCloser(comisiones, closerUserId),
  };
}

/** Read model personal: compone las preguntas existentes; no redefine ninguna métrica. */
export async function armarVistaDeMisMetricas(
  entrada: {
    programa: ProgramaDeMetricas;
    closerUserId: string;
    hoy: string;
    periodo: EntradaDePeriodo;
  },
  db: Db = dbDeLaApp,
): Promise<VistaDeMisMetricas> {
  const { programa, closerUserId, hoy } = entrada;
  const dashboard = await armarVistaDelDashboard({
    programId: programa.id,
    hoy,
    preset: "hoy",
    periodo: entrada.periodo,
    claveCloser: closerUserId,
  }, db);
  const periodo = dashboard.periodo;
  const [noShowsA, comisionesA, b, detalles] = await Promise.all([
    resumenDeMetrica("no_shows", { programId: programa.id, rango: periodo.a, claveCloser: closerUserId, hoy }, db),
    comisionesPorCloser({ programId: programa.id, rango: periodo.a }, db),
    periodo.b ? cifrasDelPeriodo(programa.id, periodo.b, closerUserId, hoy, db) : null,
    Promise.all([
      detalleDeCifra("agendas", { programId: programa.id, slug: programa.slug, hoy, periodo, claveCloser: closerUserId }, db),
      detalleDeCifra("shows", { programId: programa.id, slug: programa.slug, hoy, periodo, claveCloser: closerUserId }, db),
      detalleDeCifra("no_shows", { programId: programa.id, slug: programa.slug, hoy, periodo, claveCloser: closerUserId }, db),
      detalleDeCifra("cierres", { programId: programa.id, slug: programa.slug, hoy, periodo, claveCloser: closerUserId }, db),
      detalleDeCifra("caja", { programId: programa.id, slug: programa.slug, hoy, periodo, claveCloser: closerUserId }, db),
      detalleDeCifra("grupo_vendidos", { programId: programa.id, slug: programa.slug, hoy, periodo, claveCloser: closerUserId }, db),
    ]),
  ]);
  // Mi espacio nunca muestra el texto interno del closer (A-159/167). El código opaco
  // sigue viajando únicamente en el href que construyó `detalleDeCifra`.
  const personal = (detalle: DetalleDeCifra): DetalleDeCifra => ({
    ...detalle,
    desgloses: { ...detalle.desgloses, porCloser: [] },
  });

  return {
    programa,
    periodo,
    anteriorDisponible: dashboard.anteriorDisponible,
    cohorteDisponible: dashboard.cohorte?.ventana != null,
    a: {
      agendas: dashboard.embudo.agendas,
      shows: dashboard.embudo.llamadasConShow,
      noShows: noShowsA[0].subtotal.cantidad,
      cierres: dashboard.embudo.cierres,
      pctCierre: dashboard.embudo.pctCierre,
      madurando: dashboard.embudo.madurando,
      caja: dashboard.caja,
      comisionUsd: comisionDelCloser(comisionesA, closerUserId),
    },
    b,
    detalles: {
      agendas: personal(detalles[0]),
      shows: personal(detalles[1]),
      noShows: personal(detalles[2]),
      cierres: personal(detalles[3]),
      caja: personal(detalles[4]),
      grupoVendidos: personal(detalles[5]),
    },
  };
}

export interface SumablesDeMisMetricas {
  agendas: Conteo;
  shows: Conteo;
  noShows: Conteo;
  cierres: Conteo;
  caja: Dinero[];
}

/** El contrato no acepta tasas ni comisión: ambas permanecen por programa. */
export function sumarCifrasDeMiEspacio(cifras: readonly SumablesDeMisMetricas[]): SumablesDeMisMetricas {
  return {
    agendas: sumarConteos(cifras.map((c) => c.agendas)),
    shows: sumarConteos(cifras.map((c) => c.shows)),
    noShows: sumarConteos(cifras.map((c) => c.noShows)),
    cierres: sumarConteos(cifras.map((c) => c.cierres)),
    caja: sumarDinero(cifras.map((c) => c.caja)),
  };
}

function sumables(cifras: CifrasDePeriodo): SumablesDeMisMetricas {
  return {
    agendas: conteo(cifras.agendas),
    shows: conteo(cifras.shows),
    noShows: conteo(cifras.noShows),
    cierres: conteo(cifras.cierres),
    caja: cifras.caja.map((c) => dinero(c.moneda, c.total)),
  };
}

export interface FilaDeMisMetricasPorPrograma {
  vista: VistaDeMisMetricas;
  pctCierre: Tasa;
  comision: Dinero;
}

export interface VistaDeMisMetricasTodos {
  periodo: PeriodoResuelto;
  a: SumablesDeMisMetricas;
  b: SumablesDeMisMetricas | null;
  programas: FilaDeMisMetricasPorPrograma[];
}

export async function armarVistaDeMisMetricasTodos(
  entrada: { programas: ProgramaDeMetricas[]; closerUserId: string; hoy: string; periodo: EntradaDePeriodo },
  db: Db = dbDeLaApp,
): Promise<VistaDeMisMetricasTodos> {
  const vistas = await Promise.all(entrada.programas.map((programa) => armarVistaDeMisMetricas({ ...entrada, programa }, db)));
  const primera = vistas[0];
  if (!primera) throw new Error("Mis métricas requiere al menos un programa visible.");
  return {
    // Para Cohorte cada programa resuelve su propia ventana; el selector conserva el preset.
    periodo: primera.periodo,
    a: sumarCifrasDeMiEspacio(vistas.map((v) => sumables(v.a))),
    b: vistas.every((v) => v.b !== null)
      ? sumarCifrasDeMiEspacio(vistas.map((v) => sumables(v.b!)))
      : null,
    programas: vistas.map((vista) => ({
      vista,
      pctCierre: tasa(vista.a.pctCierre),
      comision: dinero("USD", vista.a.comisionUsd),
    })),
  };
}
