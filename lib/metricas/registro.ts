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
export type HechoDeMetrica = "venta" | "abono" | "lead" | "cita";

/** La dimensión que cada hecho admite: la lista blanca del módulo, por tipo (C-2). */
export interface DimensionesPorHecho {
  venta: DimensionVenta;
  abono: DimensionAbono;
  /** El lead aún no tiene módulo de hecho en `hechos/`: solo filtra por la cohorte de su deal (`filtroLeads`). */
  lead: "cohorte";
  /** La cita pasada sin resultado no se agrupa: es una lista de lo que el closer debe marcar (390). */
  cita: never;
}

/**
 * Con qué fecha se ubica el hecho en un periodo (`docs/metricas.md` §1). Siempre un día de Bogotá, y el único
 * lugar que lo convierte es `lib/queries/hechos/fechas.ts`.
 */
export type AnclaDeFecha =
  | "primera_entrada_a_venta"
  | "fecha_del_abono"
  | "primera_aplicacion"
  | "hora_de_la_cita";

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

const CITA_SIN_RESULTADO: ReferenciaAFuncion = { archivo: "lib/queries/metricas-filtros.ts", nombre: "citaVencidaSinResultado" };
const CITA_SIN_RESULTADO_EN_MEMORIA: ReferenciaAFuncion = { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "citaCuentaComoPorMarcar" };

/**
 * Los conceptos ya registrados, por clave de `lib/vocabulario-metricas.ts`. Diez (con `leads`, ticket 389, la cita sin resultado, 390, y `cupos_vendidos` y `llevamos`, 392), a propósito: el esqueleto
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
  // Cupos vendidos y Llevamos (392): la misma venta, leída en el día y acumulada hasta hoy. No tienen consulta propia.
  cupos_vendidos: ficha("venta", {
    filaDelDiccionario: "Cupos vendidos (hoy)",
    tipo: "derivada",
    de: ["ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: [],
    vigencia: ["deals"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/metricas-filtros.ts", nombre: "ventasConDiaEn" },
    gemelaTs: { archivo: "lib/deals/etapas.ts", nombre: "esEtapaVendida" },
    listas: [],
  }),
  llevamos: ficha("venta", {
    filaDelDiccionario: "Llevamos (a hoy)",
    tipo: "derivada",
    de: ["ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: [],
    vigencia: ["deals"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/ventas-de-la-cohorte.ts", nombre: "ventasDeLaCohorte" },
    listas: [],
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
  // Comisión (393): Σ valor vendido × el % congelado en el deal; por closer va al dueño del deal.
  comision: ficha("venta", {
    filaDelDiccionario: "Comisión",
    tipo: "derivada",
    de: ["vendido"],
    unidad: "dinero",
    monedas: ["usd"],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA,
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "exclusiones_contadas_aparte",
    funcionSql: { archivo: "lib/queries/comision.ts", nombre: "comisionesPorCloser" },
    gemelaTs: { archivo: "lib/queries/comision.ts", nombre: "comisionDeDeal" },
    listas: [],
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
  // Cita pasada sin resultado (353, 390): UN concepto con dos claves del vocabulario (Hoy y Inbox) hasta que el 397
  // las funda; la regla es una sola, `citaVencidaSinResultado(ahora, "excluir")` y su gemela en memoria.
  llamadas_sin_resultado: ficha("cita", {
    filaDelDiccionario: "Cita pasada sin resultado (por marcar)",
    tipo: "simple",
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    vigencia: ["calls", "deals"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: CITA_SIN_RESULTADO,
    gemelaTs: CITA_SIN_RESULTADO_EN_MEMORIA,
    listas: [],
  }),
  citas_pendientes: ficha("cita", {
    filaDelDiccionario: "Cita pasada sin resultado (por marcar)",
    tipo: "simple",
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    vigencia: ["calls", "deals"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: CITA_SIN_RESULTADO,
    gemelaTs: CITA_SIN_RESULTADO_EN_MEMORIA,
    listas: ["sin_resultado"],
  }),
} as const satisfies Partial<Record<ClaveDeMetrica, FichaDeMetrica>>;

export type ClaveRegistrada = keyof typeof REGISTRO;

export function fichaDe(clave: ClaveRegistrada): FichaDeMetrica {
  return REGISTRO[clave];
}

export function estaRegistrada(clave: ClaveDeMetrica): clave is ClaveRegistrada {
  return Object.prototype.hasOwnProperty.call(REGISTRO, clave);
}
