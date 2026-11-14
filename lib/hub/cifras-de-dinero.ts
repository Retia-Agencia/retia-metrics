/**
 * Hub › Dinero como Cifras (ticket 419, enmienda del 13-nov, fase E-2).
 *
 * Recibe lo que la página YA consultó (el dinero de las ventas del periodo, la caja por moneda y las ventas por
 * cohorte de `VistaDelDashboard`) y lo vuelve `CifraDeMetrica`. No consulta la base ni recalcula.
 *
 * Dos reglas duras del proyecto viven aquí como forma, no como cuenta:
 * - **"Entró a caja" es una Cifra por moneda, nunca una suma.** Sin abonos, una sola en USD con 0.
 * - **Vendido, Recaudado y Por cobrar son del MISMO conjunto de ventas** (369) y abren la misma lista.
 *
 * El texto de cada concepto llega por `explicaciones` (es de la ficha, E-1), con el universo ya puesto (DC-2).
 * Módulo PURO.
 */
import { num, pct, usd } from "@/lib/format";
import {
  comparacionCon, enCurso, filtrosDelHub, listaDeDetalle, periodoEnPalabras,
  type ContextoDelHub, type FilasDeEvidencia,
} from "@/lib/hub/contexto-de-cifras";
import { armarCifra, type CifraDeMetrica, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { CajaPorMoneda, VentasDeCohorte } from "@/lib/queries/dashboard";
import type { DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

export const CONCEPTOS_DE_DINERO = ["vendido", "recaudado", "por_cobrar", "entro_a_caja", "ventas"] as const;
export type ConceptoDeDinero = (typeof CONCEPTOS_DE_DINERO)[number];
export type ExplicacionesDeDinero = Record<ConceptoDeDinero, ExplicacionDeConcepto>;

/** Las listas que abre Dinero: las ventas del periodo (con sus tres columnas) y los abonos del periodo. */
export type ListaDeDinero = "contratado" | "caja";

/** Las monedas en que la base deja registrar un abono (conjunto cerrado, ADR 0124). */
const UNIDAD_DE_MONEDA = { COP: "cop", USD: "usd" } as const;
type Moneda = keyof typeof UNIDAD_DE_MONEDA;

function esMoneda(moneda: string): moneda is Moneda {
  return moneda in UNIDAD_DE_MONEDA;
}

/**
 * Por qué una de las tres no cubre todas las ventas, en palabras; `undefined` si las cubre. No es la misma frase para
 * las tres: una venta con abonos en otra moneda SÍ cuenta en Vendido y queda fuera solo de Recaudado y Por cobrar; una
 * venta sin valor vendido queda fuera de las tres.
 */
export function fraseSinValorVendido(dinero: DineroDeVentas): string | undefined {
  const n = dinero.sinValorVendido;
  if (n <= 0) return undefined;
  return `${num(n)} ${n === 1 ? "venta no tiene valor vendido y no suma" : "ventas no tienen valor vendido y no suman"}.`;
}

export function fraseSinSaldo(dinero: DineroDeVentas): string | undefined {
  const n = dinero.sinSaldoCalculable;
  if (n <= 0) return undefined;
  return `${num(n)} ${n === 1 ? "venta quedó" : "ventas quedaron"} fuera porque no ${n === 1 ? "tiene" : "tienen"} valor vendido o ${n === 1 ? "tiene" : "tienen"} abonos en otra moneda.`;
}

export interface EntradaDeCifrasDeDinero {
  dinero: DineroDeVentas;
  caja: readonly CajaPorMoneda[];
  /** Lo mismo del periodo de comparación, solo si se pidió comparar. */
  anterior?: { dinero: DineroDeVentas; caja: readonly CajaPorMoneda[] } | null;
  /** Contra qué se compara, en palabras: "el periodo anterior". Nunca "periodo B". */
  referencia?: string;
  detalles?: Partial<Record<ListaDeDinero, DetalleDeCifra>>;
  evidencia?: Partial<Record<ListaDeDinero, FilasDeEvidencia>>;
  explicaciones: ExplicacionesDeDinero;
  contexto: ContextoDelHub;
}

export interface CifrasDeDinero {
  vendido: CifraDeMetrica;
  recaudado: CifraDeMetrica;
  porCobrar: CifraDeMetrica;
  /** Una por moneda, en orden alfabético de la moneda; nunca vacío. */
  entroACaja: CifraDeMetrica[];
}

/** Vendido, Recaudado y Por cobrar de un conjunto de ventas: el del periodo o el de una cohorte. */
function tresDeLasVentas(p: {
  dinero: DineroDeVentas;
  anterior?: DineroDeVentas | null;
  referencia?: string;
  lista: ReturnType<typeof listaDeDetalle>;
  explicaciones: ExplicacionesDeDinero;
  filtros: Array<readonly [string, string]>;
  periodo: string;
  enCurso: boolean;
}): Pick<CifrasDeDinero, "vendido" | "recaudado" | "porCobrar"> {
  const d = p.dinero;
  const ref = p.anterior ? p.referencia : undefined;
  const comun = { filtros: p.filtros, periodo: p.periodo, enCurso: p.enCurso, lista: p.lista };
  const sinSaldo = fraseSinSaldo(d);
  // Lo recaudado es a hoy, no por fecha de abono: la línea dice qué parte de lo vendido ya se pagó.
  const fraccion = d.vendido > 0 ? Math.min(1, d.recaudado / d.vendido) : null;
  // La resta solo se escribe con sus números cuando cuadra a la vista: un sobrepago o una venta sin saldo la descuadran.
  const restaLimpia = d.sobrepago === 0 && d.sinSaldoCalculable === 0;
  return {
    vendido: armarCifra({
      concepto: "vendido", explicacion: p.explicaciones.vendido, valor: d.vendido,
      comparacion: comparacionCon(ref, p.anterior?.vendido), parcial: fraseSinValorVendido(d), ...comun,
    }),
    recaudado: armarCifra({
      concepto: "recaudado", explicacion: p.explicaciones.recaudado, valor: d.recaudado,
      comparacion: comparacionCon(ref, p.anterior?.recaudado),
      linea: fraccion === null ? undefined : { antes: "", cifra: pct(fraccion), despues: " de lo vendido, a hoy" },
      parcial: sinSaldo,
      ...comun,
    }),
    porCobrar: armarCifra({
      concepto: "por_cobrar", explicacion: p.explicaciones.por_cobrar, valor: d.porCobrar,
      partes: restaLimpia ? [d.vendido, d.recaudado] : undefined,
      comparacion: comparacionCon(ref, p.anterior?.porCobrar),
      linea: d.sobrepago > 0 ? { antes: "", cifra: usd(d.sobrepago), despues: " de sobrepago, aparte" } : undefined,
      notas: d.sobrepago > 0
        ? [["Sobrepago", `Hay ${usd(d.sobrepago)} pagados por encima del valor vendido. Se muestran aparte y no le restan deuda a otra venta.`]]
        : undefined,
      parcial: sinSaldo,
      ...comun,
    }),
  };
}

export function cifrasDeDinero(e: EntradaDeCifrasDeDinero): CifrasDeDinero {
  const c = e.contexto;
  const filtros = filtrosDelHub(c);
  const periodo = periodoEnPalabras(c);
  const ref = e.anterior ? e.referencia : undefined;

  const actual = new Map(e.caja.map((fila) => [fila.moneda, fila.total]));
  const antes = new Map((e.anterior?.caja ?? []).map((fila) => [fila.moneda, fila.total]));
  const monedas = [...new Set([...actual.keys(), ...antes.keys()])].sort();
  if (monedas.length === 0) monedas.push("USD");
  const entroACaja = monedas.map((moneda) => {
    if (!esMoneda(moneda)) throw new Error(`Entró a caja trae una moneda que el CRM no registra: ${moneda}.`);
    return armarCifra({
      concepto: "entro_a_caja",
      explicacion: { ...e.explicaciones.entro_a_caja, unidad: UNIDAD_DE_MONEDA[moneda] },
      valor: actual.get(moneda) ?? 0,
      comparacion: comparacionCon(ref, e.anterior ? antes.get(moneda) ?? 0 : undefined),
      // La lista de abonos es una sola, con todas las monedas: su total no es el de una moneda.
      lista: monedas.length === 1
        ? listaDeDetalle(e.detalles?.caja, e.evidencia?.caja, { nombre: "abonos", articulo: "los" })
        : conTotalSinContar(listaDeDetalle(e.detalles?.caja, e.evidencia?.caja, { nombre: "abonos", articulo: "los" })),
      filtros: [...filtros, ["Moneda", moneda]],
      periodo,
      enCurso: enCurso(c),
    });
  });

  return {
    ...tresDeLasVentas({
      dinero: e.dinero,
      anterior: e.anterior?.dinero,
      referencia: e.referencia,
      lista: listaDeDetalle(e.detalles?.contratado, e.evidencia?.contratado, { nombre: "ventas", articulo: "las" }),
      explicaciones: e.explicaciones,
      filtros,
      periodo,
      enCurso: enCurso(c),
    }),
    entroACaja,
  };
}

function conTotalSinContar<T extends { total: number | null }>(lista: T | undefined): T | undefined {
  return lista ? { ...lista, total: null } : undefined;
}

// ---------------------------------------------------------------------------------------------------------------
// Ventas por cohorte: cada celda, una Cifra.

export interface EntradaDeCifrasPorCohorte {
  filas: readonly VentasDeCohorte[];
  /** La lista de ventas de cada cohorte, por su id; la arma la página solo para quien abre listas. */
  detalles?: Record<string, DetalleDeCifra>;
  explicaciones: ExplicacionesDeDinero;
  contexto: ContextoDelHub;
}

export interface CifrasDeCohorte {
  clave: string;
  cohorte: string;
  ventas: CifraDeMetrica;
  vendido: CifraDeMetrica;
  recaudado: CifraDeMetrica;
  porCobrar: CifraDeMetrica;
}

export function cifrasPorCohorte(e: EntradaDeCifrasPorCohorte): CifrasDeCohorte[] {
  const c = e.contexto;
  const periodo = periodoEnPalabras(c);
  return e.filas.map((fila) => {
    const cohorte = fila.codigo ?? "Sin cohorte";
    const filtros = filtrosDelHub({ ...c, cohorte });
    const lista = listaDeDetalle(fila.cohorteId ? e.detalles?.[fila.cohorteId] : undefined, undefined, { nombre: "ventas", articulo: "las" });
    return {
      clave: fila.cohorteId ?? "sin-cohorte",
      cohorte,
      ventas: armarCifra({
        concepto: "ventas", explicacion: e.explicaciones.ventas, valor: fila.ventas, lista, filtros, periodo, enCurso: enCurso(c),
      }),
      ...tresDeLasVentas({ dinero: fila.dinero, lista, explicaciones: e.explicaciones, filtros, periodo, enCurso: enCurso(c) }),
    };
  });
}
