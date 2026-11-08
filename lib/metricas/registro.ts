/**
 * El registro tipado de métricas (ticket 385 F4, ADR 0120): la FICHA estructurada de cada concepto del
 * diccionario `docs/metricas.md`. Es la fuente de verdad de sus campos estructurados; la prosa de la fórmula
 * sigue escrita a mano en el diccionario y un test la ata a esta ficha.
 *
 * Es un módulo PURO: solo `import type`, ninguna dependencia de `lib/db`. Así lo puede leer un componente
 * cliente, el MCP o el reporte de WhatsApp sin arrastrar la base al navegador (AGENTS.md: `Module not found: 'fs'`).
 * Las funciones se referencian por NOMBRE y archivo; `tests/registro-de-metricas.test.ts` comprueba que existen
 * y que tienen un llamador fuera de `tests/` (N7).
 *
 * El nombre visible NO vive aquí: lo da la `clave` en `lib/vocabulario-metricas.ts` (ADR 0115 N4).
 * Migración incremental: lo que aún no tiene ficha está en `./pendientes.ts` (trinquete que solo encoge).
 */
import type { DimensionAbono } from "@/lib/queries/hechos/abono";
import type { DimensionVenta } from "@/lib/queries/hechos/venta";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import type { ClaveDeMetrica } from "@/lib/vocabulario-metricas";

export type TipoDeMetrica =
  /** Un conteo o una suma directa sobre un hecho. */
  | "simple"
  /** numerador ÷ denominador, ambos conceptos del registro; devuelve su cobertura (N3). */
  | "razon"
  /** Se calcula a partir de otros conceptos ya registrados (`de`). */
  | "derivada";

/** Qué se cuenta. Cerrado a propósito: una unidad nueva es una decisión de vocabulario, no un string suelto. */
export type UnidadDeMetrica = "cupos" | "personas" | "citas" | "deals" | "dinero" | "porcentaje";

export type MonedaDeMetrica = "usd" | "cop";

/** Los hechos de `docs/metricas.md` §1 que ya tienen módulo en `lib/queries/hechos/`. */
export type HechoDeMetrica = "venta" | "abono" | "lead";

/** La dimensión que cada hecho admite: la lista blanca del módulo, por tipo (C-2). */
export interface DimensionesPorHecho {
  venta: DimensionVenta;
  abono: DimensionAbono;
  /** El lead aún no tiene módulo de hecho en `hechos/`: solo filtra por la cohorte de su deal (`filtroLeads`). */
  lead: "cohorte";
}

/**
 * Con qué fecha se ubica el hecho en un periodo (`docs/metricas.md` §1). Siempre un día de Bogotá, y el único
 * lugar que lo convierte es `lib/queries/hechos/fechas.ts`.
 */
export type AnclaDeFecha =
  | "primera_entrada_a_venta"
  | "fecha_del_abono"
  | "primera_aplicacion";

/** Las tablas cuya lectura debe pasar por `vigente()` para esta métrica (ADR 0026, 0038). */
export type TablaConVigencia = "deals" | "abonos" | "calls" | "deal_actividades";

/**
 * Cómo dice la métrica lo que NO pudo calcular (N3).
 * - `no_aplica`: un conteo directo, no hay base parcial.
 * - `exclusiones_contadas_aparte`: deja fuera filas que no se pueden valorar y las cuenta aparte, nunca las inventa.
 * - `razon_con_cobertura`: devuelve `RazonConCobertura` (`lib/cobertura.ts`).
 */
export type CoberturaDeMetrica = "no_aplica" | "exclusiones_contadas_aparte" | "razon_con_cobertura";

/** Una función del código, por nombre. `tests/registro-de-metricas.test.ts` la verifica contra el archivo. */
export interface ReferenciaAFuncion {
  archivo: string;
  nombre: string;
}

export interface FichaDeMetrica {
  /** Cómo se llama el concepto en el diccionario (`docs/metricas.md` §3.1, primera celda de su fila). */
  filaDelDiccionario: string;
  tipo: TipoDeMetrica;
  /** Solo en `derivada` y `razon`: las claves de los conceptos de los que sale. Deben estar registradas. */
  de?: readonly ClaveDeMetrica[];
  unidad: UnidadDeMetrica;
  /** Monedas en que se expresa; vacío si no es dinero. Nunca se convierten en silencio. */
  monedas: readonly MonedaDeMetrica[];
  anclaDeFecha: AnclaDeFecha;
  /** Los filtros y agrupaciones que admite, de la lista blanca del hecho. */
  dimensiones: readonly string[];
  vigencia: readonly TablaConVigencia[];
  /** ¿Se puede sumar entre programas? Solo las magnitudes en la misma unidad (ADR 0048). */
  sumaEntreProgramas: boolean;
  cobertura: CoberturaDeMetrica;
  /** La función (SQL o de servidor) canónica del concepto. */
  funcionSql: ReferenciaAFuncion;
  /** Su gemela en memoria, si el concepto la tiene (N1: una función SQL y su gemela TS). */
  gemelaTs?: ReferenciaAFuncion;
  /** Los ids de `Metrica` (`metricas-con-filas.ts`) cuya lista abre esta cifra. Un id pertenece a un solo concepto. */
  listas: readonly Metrica[];
}

/** Construye una ficha amarrando `dimensiones` a la lista blanca de su hecho. */
function ficha<H extends HechoDeMetrica>(
  _hecho: H,
  datos: Omit<FichaDeMetrica, "dimensiones"> & { dimensiones: readonly DimensionesPorHecho[H][] },
): FichaDeMetrica {
  return datos;
}

const DIMENSIONES_DE_VENTA = ["dia", "semana", "mes", "area", "canal", "cuenta", "dueno", "cohorte"] as const;
const DIMENSIONES_DE_ABONO = ["dia", "semana", "mes", "dueno", "cohorte", "moneda"] as const;

const DINERO_DE_VENTAS: ReferenciaAFuncion = { archivo: "lib/queries/dinero-de-ventas.ts", nombre: "dineroDeVentas" };
const DINERO_DE_SALDOS: ReferenciaAFuncion = { archivo: "lib/queries/dinero-de-ventas.ts", nombre: "dineroDeSaldos" };

/**
 * Los conceptos ya registrados, por clave de `lib/vocabulario-metricas.ts`. Seis (con `leads`, ticket 389), a propósito: el esqueleto
 * ejercita los tres tipos (simple, derivada y el dinero con moneda) sin tocar el área del 353 (show, cita sin
 * resultado, agenda) ni la de Pauta (355).
 */
export const REGISTRO = {
  ventas: ficha("venta", {
    filaDelDiccionario: "Ventas",
    tipo: "simple",
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA,
    vigencia: ["deals"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/metricas-filtros.ts", nombre: "ventasConDiaEn" },
    gemelaTs: { archivo: "lib/deals/etapas.ts", nombre: "esEtapaVendida" },
    listas: ["cierres"],
  }),
  vendido: ficha("venta", {
    filaDelDiccionario: "Vendido",
    tipo: "simple",
    unidad: "dinero",
    monedas: ["usd"],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA,
    vigencia: ["deals", "abonos"],
    sumaEntreProgramas: true,
    cobertura: "exclusiones_contadas_aparte",
    funcionSql: DINERO_DE_VENTAS,
    gemelaTs: DINERO_DE_SALDOS,
    listas: ["contratado"],
  }),
  recaudado: ficha("venta", {
    filaDelDiccionario: "Recaudado",
    tipo: "simple",
    unidad: "dinero",
    monedas: ["usd"],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA,
    vigencia: ["deals", "abonos"],
    sumaEntreProgramas: true,
    cobertura: "exclusiones_contadas_aparte",
    funcionSql: DINERO_DE_VENTAS,
    gemelaTs: DINERO_DE_SALDOS,
    listas: [],
  }),
  por_cobrar: ficha("venta", {
    filaDelDiccionario: "Por cobrar",
    tipo: "derivada",
    de: ["vendido", "recaudado"],
    unidad: "dinero",
    monedas: ["usd"],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA,
    vigencia: ["deals", "abonos"],
    sumaEntreProgramas: true,
    cobertura: "exclusiones_contadas_aparte",
    funcionSql: DINERO_DE_VENTAS,
    gemelaTs: DINERO_DE_SALDOS,
    listas: [],
  }),
  entro_a_caja: ficha("abono", {
    filaDelDiccionario: "Entró a caja",
    tipo: "simple",
    unidad: "dinero",
    monedas: ["usd", "cop"],
    anclaDeFecha: "fecha_del_abono",
    dimensiones: DIMENSIONES_DE_ABONO,
    vigencia: ["abonos"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/metricas-filtros.ts", nombre: "filtroCaja" },
    listas: ["caja"],
  }),
  leads: ficha("lead", {
    filaDelDiccionario: "Leads",
    tipo: "simple",
    unidad: "personas",
    monedas: [],
    anclaDeFecha: "primera_aplicacion",
    dimensiones: ["cohorte"],
    vigencia: [],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/metricas-filtros.ts", nombre: "filtroLeads" },
    gemelaTs: { archivo: "lib/ingesta/ingerir.ts", nombre: "primeraAplicacion" },
    listas: ["leads"],
  }),
} as const satisfies Partial<Record<ClaveDeMetrica, FichaDeMetrica>>;

export type ClaveRegistrada = keyof typeof REGISTRO;

export function fichaDe(clave: ClaveRegistrada): FichaDeMetrica {
  return REGISTRO[clave];
}

export function estaRegistrada(clave: ClaveDeMetrica): clave is ClaveRegistrada {
  return Object.prototype.hasOwnProperty.call(REGISTRO, clave);
}
