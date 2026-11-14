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
import type { DimensionAgenda } from "@/lib/queries/hechos/agenda";
import type { DimensionCita } from "@/lib/queries/hechos/cita";
import type { DimensionEnvio } from "@/lib/queries/hechos/envio";
import type { DimensionVenta } from "@/lib/queries/hechos/venta";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import type { ClaveDeConcepto } from "@/lib/vocabulario-metricas";

export type TipoDeMetrica =
  /** Un conteo o una suma directa sobre un hecho. */
  | "simple"
  /** Un valor que escribe una persona (objetivo, ajuste de la pantalla): nadie lo calcula. `funcionSql` es quien lo lee. */
  | "parametro"
  /** numerador ÷ denominador, ambos conceptos del registro; devuelve su cobertura (N3). */
  | "razon"
  /** Se calcula a partir de otros conceptos ya registrados (`de`). */
  | "derivada";

/** Qué se cuenta. Cerrado a propósito: una unidad nueva es una decisión de vocabulario, no un string suelto. */
export type UnidadDeMetrica = "cupos" | "personas" | "citas" | "deals" | "dinero" | "porcentaje" | "veces" | "dias";

export type MonedaDeMetrica = "usd" | "cop";

/** Dimensiones de la caja (abonos). Sin módulo en `hechos/` desde el 10-nov (403 F4: no tenía llamador); la caja se lee por `filtroCaja`. */
export type DimensionAbono = "dia" | "semana" | "mes" | "dueno" | "cohorte" | "moneda";

/** Los hechos de `docs/metricas.md` §1; todos tienen módulo en `lib/queries/hechos/` salvo `abono` (ver `DimensionAbono`). */
export type HechoDeMetrica = "venta" | "abono" | "envio" | "agenda" | "lead" | "cita" | "gasto" | "deal" | "plan";

/** Dimensiones del gasto de pauta. `hechos/gasto.ts` no tiene lista blanca propia: la tabla semanal solo agrupa por día y semana. */
export type DimensionGasto = "dia" | "semana";

/** Deals creados desde un formulario: se ubican por el día del envío que los abrió y se filtran por cohorte. Sin módulo propio en `hechos/`. */
export type DimensionDeal = "dia" | "semana" | "mes" | "cohorte";

/** Objetivos y su reparto (cohorte, mes, semana, día): se leen por cohorte o por mes. Sin módulo propio en `hechos/`. */
export type DimensionPlan = "cohorte" | "mes";

/** La dimensión que cada hecho admite: la lista blanca del módulo, por tipo (C-2). */
export interface DimensionesPorHecho {
  venta: DimensionVenta;
  abono: DimensionAbono;
  envio: DimensionEnvio;
  agenda: DimensionAgenda;
  /** El lead aún no tiene módulo de hecho en `hechos/`: solo filtra por la cohorte de su deal (`filtroLeads`). */
  lead: "cohorte";
  cita: DimensionCita;
  gasto: DimensionGasto;
  deal: DimensionDeal;
  plan: DimensionPlan;
}

/**
 * Con qué fecha se ubica el hecho en un periodo (`docs/metricas.md` §1). Siempre un día de Bogotá, y el único
 * lugar que lo convierte es `lib/queries/hechos/fechas.ts`.
 */
export type AnclaDeFecha =
  | "primera_entrada_a_venta"
  | "fecha_del_abono"
  | "fecha_del_envio"
  | "fecha_de_creacion_de_la_cita"
  | "primera_aplicacion"
  | "hora_de_la_cita"
  | "fecha_del_gasto"
  /** Un objetivo o ajuste que fija una persona: no se ubica en un periodo. */
  | "sin_fecha";

/** Las tablas cuya lectura debe pasar por `vigente()` para esta métrica (ADR 0026, 0038). */
export type TablaConVigencia = "deals" | "abonos" | "calls" | "deal_actividades";

/**
 * Cómo dice la métrica lo que NO pudo calcular (N3).
 * - `no_aplica`: un conteo directo, no hay base parcial.
 * - `exclusiones_contadas_aparte`: deja fuera filas que no se pueden valorar y las cuenta aparte, nunca las inventa.
 * - `razon_con_cobertura`: devuelve `RazonConCobertura` (`lib/cobertura.ts`).
 */
export type CoberturaDeMetrica = "no_aplica" | "exclusiones_contadas_aparte" | "razon_con_cobertura";

export type CriterioDeCloser =
  | "quien_tomo_la_llamada"
  | "dueno_del_deal"
  | "quien_registro_el_abono";

/** Una función del código, por nombre. `tests/registro-de-metricas.test.ts` la verifica contra el archivo. */
export interface ReferenciaAFuncion {
  archivo: string;
  nombre: string;
}

/**
 * La forma de la fórmula, para escribirla como matemática en la explicación (ticket 419, diseño de la Cifra §2):
 * razón = fracción apilada, suma = "Σ", conteo = "número de …", resta = "A − B", producto = "A × B".
 */
export type FormaDeFormula = "razon" | "suma" | "conteo" | "resta" | "producto";

/**
 * La fórmula en palabras de negocio, nunca en términos del código. `terminos` va en orden: en una razón,
 * [numerador, denominador]; en una resta o un producto, [A, B]; en una suma o un conteo, uno solo.
 */
export interface FormulaDeMetrica {
  forma: FormaDeFormula;
  terminos: readonly string[];
  /** La razón se multiplica por 1.000 (CPM). */
  por1000?: boolean;
}

/** Un nombre de la fórmula y su explicación en una línea, para Gerencia y Pauta. */
export interface VariableDeMetrica {
  nombre: string;
  explicacion: string;
}

export interface FichaDeMetrica {
  /**
   * La explicación que abre toda cifra (ticket 419, DM-9). Opcionales mientras se llenan: los de Pauta los
   * escribe el 419 y el resto el 403 F4. Ningún texto lleva rutas, funciones, tickets ni ids (lo vigila un guardián).
   */
  /** Qué mide, en una frase de negocio. */
  que?: string;
  formula?: FormulaDeMetrica;
  variables?: readonly VariableDeMetrica[];
  /** Cómo la llama el Excel de Pauta, si la llama distinto ("% de presentación a zoom"). */
  aliasExcel?: string;
  /** Cómo se llama el concepto en el diccionario (`docs/metricas.md` §3.1, primera celda de su fila). */
  filaDelDiccionario: string;
  tipo: TipoDeMetrica;
  /** Solo en `derivada` y `razon`: las claves de los conceptos de los que sale. Deben estar registradas. */
  de?: readonly ClaveDeConcepto[];
  unidad: UnidadDeMetrica;
  /** Monedas en que se expresa; vacío si no es dinero. Nunca se convierten en silencio. */
  monedas: readonly MonedaDeMetrica[];
  anclaDeFecha: AnclaDeFecha;
  /** Los filtros y agrupaciones que admite, de la lista blanca del hecho. */
  dimensiones: readonly string[];
  /** Qué relación atribuye la métrica a un closer, cuando aplica. */
  criterioDeCloser?: CriterioDeCloser;
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

const PAUTA_SEMANAL: ReferenciaAFuncion = { archivo: "lib/queries/hechos/pauta-semanal.ts", nombre: "cargarPautaSemanal" };

const LEER_PROYECCION: ReferenciaAFuncion = { archivo: "lib/queries/proyeccion.ts", nombre: "leerProyeccion" };
const META_DE_HOY: ReferenciaAFuncion = { archivo: "lib/dias-habiles.ts", nombre: "metaDeHoy" };
const ARMAR_METAS_DEL_MES: ReferenciaAFuncion = { archivo: "lib/queries/metas.ts", nombre: "armarMetasDelMes" };
const LEER_COHORTES_Y_VENTAS: ReferenciaAFuncion = { archivo: "lib/queries/metas.ts", nombre: "leerCohortesYVentas" };

const CITA_SIN_RESULTADO: ReferenciaAFuncion = { archivo: "lib/queries/metricas-filtros.ts", nombre: "citaVencidaSinResultado" };
const CITA_SIN_RESULTADO_EN_MEMORIA: ReferenciaAFuncion = { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "citaCuentaComoPorMarcar" };

/**
 * Los conceptos ya registrados, por clave de `lib/vocabulario-metricas.ts`. Los que faltan están en `./pendientes.ts`
 * (trinquete que solo encoge); un concepto con varias claves (p. ej. `nacio_*`) comparte ficha.
 */
export const REGISTRO = {
  registros: ficha("envio", {
    filaDelDiccionario: "Envíos",
    tipo: "simple",
    unidad: "personas",
    monedas: [],
    anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana", "mes", "area", "canal", "cuenta", "campana", "fuente", "utm_source", "utm_medium", "categoria"],
    vigencia: [],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/hechos/envio.ts", nombre: "filtroDeEnvios" },
    listas: ["registros"],
  }),
  agendadas: ficha("agenda", {
    filaDelDiccionario: "Agendadas",
    tipo: "simple",
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "fecha_de_creacion_de_la_cita",
    dimensiones: ["dia", "semana", "mes", "hora", "area", "canal", "cuenta", "utm_source", "utm_medium", "categoria", "tiene_envio", "dueno", "cohorte", "etapa"],
    criterioDeCloser: "dueno_del_deal",
    vigencia: ["calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/hechos/agenda.ts", nombre: "agrupar" },
    listas: ["agendas_creadas"],
  }),
  citas: ficha("cita", {
    filaDelDiccionario: "Citas",
    tipo: "simple",
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: ["dia", "semana", "mes", "area", "canal", "cuenta", "dueno", "cohorte", "etapa", "ocurrio"],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/dashboard.ts", nombre: "embudoDelRango" },
    listas: ["agendas", "citas_debidas", "citas_sin_marcar", "agendas_futuras"],
  }),
  shows: ficha("cita", {
    filaDelDiccionario: "Realizadas",
    tipo: "simple",
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: ["dia", "semana", "mes", "area", "canal", "cuenta", "dueno", "cohorte", "etapa"],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "ocurrioSql" },
    gemelaTs: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "ocurrio" },
    listas: ["shows", "shows_sin_grain", "atendidos_sin_valor", "atendidos_sin_grain"],
  }),
  no_asistio: ficha("cita", {
    filaDelDiccionario: "No asistió",
    tipo: "simple",
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: ["dia", "semana", "mes", "area", "canal", "cuenta", "dueno", "cohorte", "etapa"],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "noAsistioSql" },
    gemelaTs: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "noAsistio" },
    listas: ["no_shows"],
  }),
  asistencia: ficha("cita", {
    filaDelDiccionario: "Asistencia",
    tipo: "razon",
    de: ["shows", "no_asistio"],
    unidad: "porcentaje",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls", "deals"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/queries/tasas-del-grupo.ts", nombre: "grupoDeCitas" },
    gemelaTs: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "showPorDeal" },
    listas: ["grupo_citas", "grupo_pendientes", "grupo_sin_show"],
  }),
  cierre_de_ventas: ficha("cita", {
    filaDelDiccionario: "Cierre de ventas",
    tipo: "razon",
    de: ["ventas", "shows"],
    unidad: "porcentaje",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls", "deals"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/queries/tasas-del-grupo.ts", nombre: "grupoDeCitas" },
    gemelaTs: { archivo: "lib/queries/tasas-del-grupo.ts", nombre: "calcularTasasDelGrupo" },
    listas: ["grupo_shows", "grupo_vendidos"],
  }),
  ventas: ficha("venta", {
    filaDelDiccionario: "Ventas",
    tipo: "simple",
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA,
    criterioDeCloser: "dueno_del_deal",
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
    criterioDeCloser: "dueno_del_deal",
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
    criterioDeCloser: "dueno_del_deal",
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
    criterioDeCloser: "dueno_del_deal",
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
    criterioDeCloser: "dueno_del_deal",
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
    criterioDeCloser: "dueno_del_deal",
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
    criterioDeCloser: "quien_registro_el_abono",
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
    criterioDeCloser: "dueno_del_deal",
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
  // La misma cita, leída en el día (Hoy) o sin las canceladas: no tienen consulta propia (403 F4).
  citas_del_dia: ficha("cita", {
    filaDelDiccionario: "Citas del día",
    tipo: "derivada",
    de: ["citas"],
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/dashboard.ts", nombre: "embudoDelRango" },
    listas: [],
  }),
  citas_realizadas: ficha("cita", {
    filaDelDiccionario: "Realizadas",
    tipo: "derivada",
    de: ["shows"],
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "ocurrioSql" },
    gemelaTs: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "ocurrio" },
    listas: [],
  }),
  citas_canceladas: ficha("cita", {
    filaDelDiccionario: "Canceladas",
    tipo: "simple",
    unidad: "citas",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/dashboard.ts", nombre: "embudoDelRango" },
    listas: ["canceladas"],
  }),
  // % de show por cita (D-C): la otra pregunta del show, por cita y no por deal. Una sola regla, `showPorCita`.
  show_por_cita: ficha("cita", {
    filaDelDiccionario: "% de show por cita",
    tipo: "derivada",
    de: ["shows", "citas"],
    unidad: "porcentaje",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls"],
    sumaEntreProgramas: false,
    cobertura: "exclusiones_contadas_aparte",
    funcionSql: { archivo: "lib/queries/tasa-show-por-cita.ts", nombre: "showPorCitaDelRango" },
    gemelaTs: { archivo: "lib/deals/resultados-de-llamada.ts", nombre: "showPorCita" },
    listas: [],
  }),
  // De cita a venta (D-C): show × cierre del mismo grupo de citas; no tiene consulta propia, sale de `grupoDeCitas`.
  cita_a_venta: ficha("cita", {
    filaDelDiccionario: "De cita a venta",
    tipo: "derivada",
    de: ["asistencia", "cierre_de_ventas"],
    unidad: "porcentaje",
    monedas: [],
    anclaDeFecha: "hora_de_la_cita",
    dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada",
    vigencia: ["calls", "deals"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/queries/tasas-del-grupo.ts", nombre: "grupoDeCitas" },
    gemelaTs: { archivo: "lib/queries/tasas-del-grupo.ts", nombre: "calcularTasasDelGrupo" },
    listas: [],
  }),
  // Cómo nació la venta (G-10): UNA regla con tres desenlaces, `comoNacioLaVenta` (su caso de borde, el show posterior
  // a la venta, lo prueba `tests/reporte-diario.test.ts`). Tres claves del vocabulario, una ficha.
  nacio_agenda_del_dia: ficha("venta", {
    filaDelDiccionario: "Cómo nació la venta",
    tipo: "derivada",
    de: ["ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: [],
    criterioDeCloser: "dueno_del_deal",
    vigencia: ["deals", "calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/reporte-diario.ts", nombre: "comoNacioLaVenta" },
    listas: [],
  }),
  nacio_seguimiento: ficha("venta", {
    filaDelDiccionario: "Cómo nació la venta",
    tipo: "derivada",
    de: ["ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: [],
    criterioDeCloser: "dueno_del_deal",
    vigencia: ["deals", "calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/reporte-diario.ts", nombre: "comoNacioLaVenta" },
    listas: [],
  }),
  nacio_sin_llamada: ficha("venta", {
    filaDelDiccionario: "Cómo nació la venta",
    tipo: "derivada",
    de: ["ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: [],
    criterioDeCloser: "dueno_del_deal",
    vigencia: ["deals", "calls"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/reporte-diario.ts", nombre: "comoNacioLaVenta" },
    listas: [],
  }),
  // ── Objetivos, ritmo y deals desde formulario (403 F4): lo que el Hub escribe o reparte, ya con ficha. ──
  // Objetivo (`meta`) y Objetivo de la cohorte son el MISMO valor con dos claves del vocabulario: `cohorts.meta_cupos`, que escribe una persona.
  meta: ficha("plan", {
    filaDelDiccionario: "Objetivo de la cohorte",
    tipo: "parametro",
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: ["cohorte"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: LEER_COHORTES_Y_VENTAS,
    listas: [],
  }),
  objetivo_cohorte: ficha("plan", {
    filaDelDiccionario: "Objetivo de la cohorte",
    tipo: "parametro",
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: ["cohorte"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: LEER_COHORTES_Y_VENTAS,
    listas: [],
  }),
  // Leads por día que la cohorte se propuso; la declara una persona y nunca se sustituye por el requerido calculado.
  objetivo_de_leads: ficha("plan", {
    filaDelDiccionario: "Objetivo de leads",
    tipo: "parametro",
    unidad: "personas",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: ["cohorte"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/proyeccion.ts", nombre: "metaDeLeads" },
    listas: [],
  }),
  dias_del_ritmo: ficha("plan", {
    filaDelDiccionario: "Días para medir el ritmo",
    tipo: "parametro",
    unidad: "dias",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: [],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/proyeccion.ts", nombre: "ventanaRitmoDeUrl" },
    listas: [],
  }),
  citas_minimas: ficha("plan", {
    filaDelDiccionario: "Mínimo para confiar en una tasa",
    tipo: "parametro",
    unidad: "personas",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: [],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/proyeccion.ts", nombre: "alcanzaMuestra" },
    listas: [],
  }),
  objetivo_mes: ficha("plan", {
    filaDelDiccionario: "Objetivo del mes",
    tipo: "derivada",
    de: ["objetivo_cohorte"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: ["cohorte", "mes"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: ARMAR_METAS_DEL_MES,
    listas: [],
  }),
  objetivo_semana: ficha("plan", {
    filaDelDiccionario: "Objetivo de la semana",
    tipo: "derivada",
    de: ["objetivo_mes", "ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: ["mes"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: ARMAR_METAS_DEL_MES,
    listas: [],
  }),
  esperado_a_hoy: ficha("plan", {
    filaDelDiccionario: "Esperado a hoy",
    tipo: "derivada",
    de: ["objetivo_cohorte"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "sin_fecha",
    dimensiones: ["cohorte"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/dias-habiles.ts", nombre: "esperadoLineal" },
    listas: [],
  }),
  faltan: ficha("plan", {
    filaDelDiccionario: "Faltan",
    tipo: "derivada",
    de: ["objetivo_cohorte", "ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: ["cohorte"],
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: LEER_PROYECCION,
    listas: [],
  }),
  por_dia_habil: ficha("plan", {
    filaDelDiccionario: "Por día hábil",
    tipo: "derivada",
    de: ["faltan"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: ["cohorte"],
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: META_DE_HOY,
    listas: [],
  }),
  // Misma regla de reparto que Por día hábil (`metaDeHoy`), aplicada al objetivo del mes en el reporte diario.
  objetivo_del_dia: ficha("plan", {
    filaDelDiccionario: "Objetivo del día",
    tipo: "derivada",
    de: ["objetivo_mes", "ventas"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: ["cohorte"],
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "no_aplica",
    funcionSql: META_DE_HOY,
    listas: [],
  }),
  proyeccion: ficha("plan", {
    filaDelDiccionario: "Proyección",
    tipo: "derivada",
    de: ["ventas", "faltan"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: ["cohorte"],
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: LEER_PROYECCION,
    listas: [],
  }),
  // Se calcula hacia atrás desde el objetivo con las tasas medidas hoy; con muestra insuficiente da «—» con su razón (N3).
  leads_que_hacen_falta: ficha("plan", {
    filaDelDiccionario: "Leads que hacen falta (por día)",
    tipo: "derivada",
    de: ["objetivo_cohorte", "asistencia", "cierre_de_ventas"],
    unidad: "personas",
    monedas: [],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: ["cohorte"],
    vigencia: ["deals", "calls"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: LEER_PROYECCION,
    listas: [],
  }),
  deals_desde_completo: ficha("deal", {
    filaDelDiccionario: "Deals creados desde un formulario",
    tipo: "simple",
    unidad: "deals",
    monedas: [],
    anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana", "mes", "cohorte"],
    vigencia: ["deals"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/metricas-filtros.ts", nombre: "filtroDealsDesde" },
    listas: ["deals_desde_completo"],
  }),
  deals_desde_parcial: ficha("deal", {
    filaDelDiccionario: "Deals creados desde un formulario",
    tipo: "simple",
    unidad: "deals",
    monedas: [],
    anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana", "mes", "cohorte"],
    vigencia: ["deals"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/metricas-filtros.ts", nombre: "filtroDealsDesde" },
    listas: ["deals_desde_parcial"],
  }),
  // Cupos con caja (370): cada venta con un abono vigente en el periodo cuenta UNA vez, el día de su primer abono del periodo.
  cupos_con_caja: ficha("abono", {
    filaDelDiccionario: "Cupos con caja",
    tipo: "derivada",
    de: ["ventas", "entro_a_caja"],
    unidad: "cupos",
    monedas: [],
    anclaDeFecha: "fecha_del_abono",
    dimensiones: ["dia", "semana", "mes", "dueno", "cohorte"],
    criterioDeCloser: "quien_registro_el_abono",
    vigencia: ["deals", "abonos"],
    sumaEntreProgramas: true,
    cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/series-dinero.ts", nombre: "leerSeriesDeDinero" },
    listas: [],
  }),
  // ── Pauta (403 F2): conceptos de la tabla semanal que no son del vocabulario del Hub (`ClaveDePauta`). ──
  // Inversión (D-E): gasto de Meta en COP; una semana sin gasto cargado es «—» con motivo, no 0.
  inversion: ficha("gasto", {
    filaDelDiccionario: "Inversión de la tabla semanal",
    tipo: "simple",
    unidad: "dinero",
    monedas: ["cop"],
    anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["dia", "semana"],
    vigencia: [],
    sumaEntreProgramas: true,
    cobertura: "razon_con_cobertura",
    funcionSql: PAUTA_SEMANAL,
    listas: [],
  }),
  // Costo por agenda del Hub: gasto de campañas con propósito agenda ÷ agendas del CRM de área Paid (la misma cifra de «Agendadas»).
  costo_agenda_crm: ficha("gasto", {
    filaDelDiccionario: "Costo por agenda del Hub",
    tipo: "razon",
    de: ["inversion", "agendadas"],
    unidad: "dinero",
    monedas: ["cop"],
    anclaDeFecha: "fecha_de_creacion_de_la_cita",
    dimensiones: ["dia", "semana"],
    vigencia: ["calls"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/queries/hechos/costo-agenda-crm.ts", nombre: "costoPorAgendaDelCrm" },
    listas: [],
  }),
  // Costo por venta (CAC, 415): la celda Inversión ÷ la celda Ventas del mismo periodo; sin ventas o sin inversión es «—».
  cac: ficha("gasto", {
    filaDelDiccionario: "Costo por venta (CAC)",
    tipo: "razon",
    de: ["inversion", "ventas"],
    unidad: "dinero",
    monedas: ["cop"],
    anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: ["dia", "semana"],
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/pauta/costo-por-venta.ts", nombre: "costoPorVenta" },
    listas: [],
  }),
  // Costo por agenda del semáforo: la misma pregunta con las agendas que reporta Meta (pueden diferir del CRM, DA-4).
  costo_agenda_meta: ficha("gasto", {
    filaDelDiccionario: "Costo por agenda del semáforo",
    tipo: "derivada",
    de: ["inversion"],
    unidad: "dinero",
    monedas: ["cop"],
    anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["dia", "semana"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/semaforo/costo-por-agenda.ts", nombre: "costoPorAgendaDeVentana" },
    listas: [],
  }),
  // ROAS (D-B): ventas de la cohorte de registro de Paid (semana del envío, no de la venta) ÷ gasto en USD de cada día.
  roas: ficha("gasto", {
    filaDelDiccionario: "ROAS",
    tipo: "razon",
    de: ["vendido", "inversion"],
    unidad: "veces",
    monedas: [],
    anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana"],
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/queries/roas-de-pauta.ts", nombre: "cargarRoasDePauta" },
    listas: [],
  }),
  profit: ficha("gasto", {
    filaDelDiccionario: "Profit",
    tipo: "derivada",
    de: ["vendido", "inversion"],
    unidad: "dinero",
    monedas: ["usd"],
    anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana"],
    vigencia: ["deals"],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: PAUTA_SEMANAL,
    listas: [],
  }),
  // Las cinco de abajo salen de columnas de `gasto_pauta` que Meta informa: nunca promedian porcentajes y dicen «parcial» si Meta omitió filas.
  cpm: ficha("gasto", {
    filaDelDiccionario: "CPM",
    tipo: "simple",
    unidad: "dinero",
    monedas: ["cop"],
    anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["dia", "semana"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: PAUTA_SEMANAL,
    listas: [],
  }),
  ctr: ficha("gasto", {
    filaDelDiccionario: "CTR",
    tipo: "simple",
    unidad: "porcentaje",
    monedas: [],
    anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["dia", "semana"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: PAUTA_SEMANAL,
    listas: [],
  }),
  llegada_landing: ficha("gasto", {
    filaDelDiccionario: "Llegada a la landing",
    tipo: "simple",
    unidad: "porcentaje",
    monedas: [],
    anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["dia", "semana"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: PAUTA_SEMANAL,
    listas: [],
  }),
  conversion_landing: ficha("gasto", {
    filaDelDiccionario: "Conversión de la landing",
    tipo: "razon",
    de: ["registros"],
    unidad: "porcentaje",
    monedas: [],
    anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: PAUTA_SEMANAL,
    listas: [],
  }),
  frecuencia: ficha("gasto", {
    filaDelDiccionario: "Frecuencia",
    tipo: "simple",
    unidad: "veces",
    monedas: [],
    anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["dia"],
    vigencia: [],
    sumaEntreProgramas: false,
    cobertura: "razon_con_cobertura",
    funcionSql: PAUTA_SEMANAL,
    listas: [],
  }),
} as const satisfies Partial<Record<ClaveDeConcepto, FichaDeMetrica>>;

export type ClaveRegistrada = keyof typeof REGISTRO;

export function fichaDe(clave: ClaveRegistrada): FichaDeMetrica {
  return REGISTRO[clave];
}

export function estaRegistrada(clave: ClaveDeConcepto): clave is ClaveRegistrada {
  return Object.prototype.hasOwnProperty.call(REGISTRO, clave);
}
