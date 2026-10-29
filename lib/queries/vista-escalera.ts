import { tasa, type Tasa } from "@/lib/queries/agregado-programas";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import type { PeriodoResuelto } from "@/lib/periodo";
import {
  ESCALONES,
  agruparEscalera,
  cargarEscalera,
  filtrarEscalera,
  resumirEscalera,
  type DealEnLaEscalera,
  type DimensionDeEscalera,
  type Escalon,
  type EscaleraCargada,
  type LineaDeEscalon,
} from "@/lib/queries/escalera";
import { desglosesDelResumen, resumenDeDeals } from "@/lib/queries/metricas-con-filas";
import { nombreDeEtapa, urlDeLista, type DetalleDeCifra } from "@/lib/queries/vista-metrica";

/**
 * La tarjeta "Ventas por escalón" del Hub (ticket 320, ADR 0109): la distribución de los deals del
 * periodo en la escalera, por programa, y abierta por closer y por calidad. Toda cifra trae el
 * `DetalleDeCifra` de su lista (ADR 0067), calculado sobre los MISMOS deals que la cuentan.
 */

export interface CeldaDeEscalera {
  deals: number;
  /**
   * Sobre el universo del conjunto, en 0 a 100; nulo con base cero. Es una `Tasa`: ninguna función de
   * suma entre programas la acepta (ADR 0048), así que no se puede combinar con la de otro programa.
   */
  porcentaje: Tasa;
  /** Mediana de días hábiles de la cita al primer abono (escalones 2 y 3). */
  diasMedianos: number | null;
  /** Los deals del periodo B en el mismo escalón y conjunto; nulo sin comparación. */
  anterior: number | null;
  /** El resumen y el enlace de su lista; nulo para quien no ve el trabajo del equipo. */
  detalle: DetalleDeCifra | null;
}

export interface FilaDeEscalera {
  /** Clave de la dimensión (closer, calidad); vacía en la fila principal. */
  clave: string;
  etiqueta: string;
  total: number;
  celdas: Record<Escalon, CeldaDeEscalera>;
}

export interface VistaDeEscalera {
  /** Días hábiles del corte de "pagó rápido"; nulo = el programa no lo definió. */
  corteDias: number | null;
  /** Sin corte, "pagó rápido" no existe y la tarjeta lo dice. */
  sinCorte: boolean;
  principal: FilaDeEscalera;
  /** Una fila por closer; vacío para quien no ve el trabajo del equipo (ADR 0023: nunca acotado). */
  porCloser: FilaDeEscalera[];
  porCalidad: FilaDeEscalera[];
  hayComparacion: boolean;
}

export interface EntradaDeVistaDeEscalera {
  programId: string;
  slug: string;
  hoy: string;
  periodo: PeriodoResuelto;
  /** El filtro de closer del Hub; acota la fila principal y la de calidad. */
  claveCloser: string | null;
  origen: string;
  /** Quien ve el trabajo del equipo (`veEquipoComercial`): sin él no hay closers ni listas. */
  conEquipo: boolean;
  /** Solo la distribución del programa, sin abrirla por closer ni calidad (la vista de todos los programas). */
  soloPrincipal?: boolean;
  /** El instante que decide qué cita ya venció; por defecto, ahora. */
  ahora?: Date;
}

function fila(
  cargada: EscaleraCargada,
  anterior: EscaleraCargada | null,
  conjunto: readonly DealEnLaEscalera[],
  conjuntoAnterior: readonly DealEnLaEscalera[],
  entrada: EntradaDeVistaDeEscalera,
  clave: string,
  etiqueta: string,
  enlace: { claveCloser: string | null; calidad?: string },
): FilaDeEscalera {
  const resumen = resumirEscalera(conjunto, cargada.corteDias);
  const previo = anterior ? resumirEscalera(conjuntoAnterior, anterior.corteDias) : null;
  const celdas = Object.fromEntries(ESCALONES.map((escalon) => {
    const linea = resumen.lineas.find((l: LineaDeEscalon) => l.escalon === escalon)!;
    const miembros = conjunto.filter((deal) => deal.escalon === escalon);
    const detalle: DetalleDeCifra | null = entrada.conEquipo && miembros.length > 0
      ? (() => {
          const resumenDeLista = resumenDeDeals(entrada.programId, miembros, entrada.hoy);
          return {
            resumen: resumenDeLista,
            desgloses: desglosesDelResumen(resumenDeLista.grupos, nombreDeEtapa),
            href: urlDeLista({
              slug: entrada.slug,
              metrica: "escalera",
              periodo: entrada.periodo,
              origen: entrada.origen,
              claveCloser: enlace.claveCloser,
              escalera: { escalon, calidad: enlace.calidad },
            }),
          };
        })()
      : null;
    return [escalon, {
      deals: linea.deals,
      porcentaje: tasa(linea.porcentaje),
      diasMedianos: linea.diasMedianos,
      anterior: previo ? previo.lineas.find((l: LineaDeEscalon) => l.escalon === escalon)!.deals : null,
      detalle,
    } satisfies CeldaDeEscalera];
  })) as Record<Escalon, CeldaDeEscalera>;
  return { clave, etiqueta, total: resumen.total, celdas };
}

/** Arma la tarjeta: carga la escalera del periodo A (y la del B si hay comparación) una vez cada una. */
export async function vistaDeEscalera(entrada: EntradaDeVistaDeEscalera, db: Db = dbDeLaApp): Promise<VistaDeEscalera> {
  const [cargada, anterior] = await Promise.all([
    cargarEscalera(db, { programId: entrada.programId, rango: entrada.periodo.a }, entrada.ahora),
    entrada.periodo.b ? cargarEscalera(db, { programId: entrada.programId, rango: entrada.periodo.b }, entrada.ahora) : Promise.resolve(null),
  ]);
  const delFiltro = { claveCloser: entrada.claveCloser };
  const principal = fila(
    cargada,
    anterior,
    filtrarEscalera(cargada, delFiltro),
    anterior ? filtrarEscalera(anterior, delFiltro) : [],
    entrada,
    "",
    "Todos",
    { claveCloser: entrada.claveCloser },
  );
  const abrir = (dimension: DimensionDeEscalera, filtros: { claveCloser?: string | null }) =>
    agruparEscalera(cargada, dimension, filtros).map((grupo) => {
      const enGrupo = (carga: EscaleraCargada) => filtrarEscalera(carga, {
        ...filtros,
        ...(dimension === "closer" ? { claveCloser: grupo.clave } : { calidad: grupo.clave }),
      });
      return fila(
        cargada,
        anterior,
        enGrupo(cargada),
        anterior ? enGrupo(anterior) : [],
        entrada,
        grupo.clave,
        grupo.etiqueta,
        dimension === "closer"
          ? { claveCloser: grupo.clave }
          : { claveCloser: entrada.claveCloser, calidad: grupo.clave },
      );
    });
  return {
    corteDias: cargada.corteDias,
    sinCorte: cargada.corteDias === null,
    principal,
    // El comparativo entre closers no se puede acotar (ADR 0023): ignora el filtro de closer.
    porCloser: entrada.conEquipo && !entrada.soloPrincipal ? abrir("closer", {}) : [],
    porCalidad: entrada.soloPrincipal ? [] : abrir("calidad", delFiltro),
    hayComparacion: anterior !== null,
  };
}
