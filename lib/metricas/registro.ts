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
export type DimensionDeal = "dia" | "semana" | "mes" | "cohorte" | "escalon" | "etapa" | "dueno";

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
  que: string;
  formula: FormulaDeMetrica;
  variables: readonly VariableDeMetrica[];
  /** Cómo la llama el Excel de Pauta, si la llama distinto ("% de presentación a zoom"). */
  aliasExcel?: string;
  /** El concepto admite objetivo en Programa › Objetivos. */
  admiteObjetivo?: boolean;
  /** Unidades de las dos partes que se sustituyen en la fórmula. */
  unidadesDePartes?: readonly [import("@/lib/metricas/cifra").UnidadDeCifra, import("@/lib/metricas/cifra").UnidadDeCifra];
  /** Los promedios que se muestran con un decimal lo declaran una vez en la ficha. */
  decimales?: 1;
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

type CamposDeExplicacion = Pick<FichaDeMetrica,
  "que" | "formula" | "variables" | "aliasExcel" | "admiteObjetivo" | "unidadesDePartes" | "decimales"
>;
type FichaBase = Omit<FichaDeMetrica, keyof CamposDeExplicacion>;

/** Construye una ficha amarrando `dimensiones` a la lista blanca de su hecho. */
function ficha<H extends HechoDeMetrica>(
  _hecho: H,
  datos: Omit<FichaBase, "dimensiones"> & { dimensiones: readonly DimensionesPorHecho[H][] },
): FichaBase {
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
const REGISTRO_BASE = {
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
    listas: ["grupo_pendientes", "grupo_sin_show"],
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
    listas: ["grupo_shows"],
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
  ventas_por_escalon: ficha("deal", {
    filaDelDiccionario: "Ventas por escalón",
    tipo: "derivada", de: ["ventas", "shows"], unidad: "deals", monedas: [], anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: ["dia", "semana", "cohorte", "escalon"], vigencia: ["deals", "calls", "abonos"],
    sumaEntreProgramas: false, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/escalera.ts", nombre: "escalonDeDeal" }, listas: ["escalera"],
  }),
  escalera_sin_resultado: ficha("deal", {
    filaDelDiccionario: "Cita pasada sin resultado en la escalera",
    tipo: "derivada", de: ["ventas_por_escalon"], unidad: "deals", monedas: [], anclaDeFecha: "hora_de_la_cita",
    dimensiones: ["dia", "semana", "cohorte", "escalon"], vigencia: ["deals", "calls"],
    sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/escalera.ts", nombre: "escalonDeDeal" }, listas: [],
  }),
  grupo_de_citas: ficha("cita", {
    filaDelDiccionario: "Grupo de citas",
    tipo: "simple", unidad: "deals", monedas: [], anclaDeFecha: "hora_de_la_cita", dimensiones: [],
    criterioDeCloser: "quien_tomo_la_llamada", vigencia: ["deals", "calls"], sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/tasas-del-grupo.ts", nombre: "grupoDeCitas" }, listas: ["grupo_citas"],
  }),
  con_show_y_vendidos_hoy: ficha("cita", {
    filaDelDiccionario: "Con show y vendidos hoy",
    tipo: "derivada", de: ["grupo_de_citas", "shows", "ventas"], unidad: "deals", monedas: [], anclaDeFecha: "hora_de_la_cita",
    dimensiones: [], criterioDeCloser: "quien_tomo_la_llamada", vigencia: ["deals", "calls"],
    sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/tasas-del-grupo.ts", nombre: "grupoDeCitas" }, listas: ["grupo_vendidos"],
  }),
  deals_abiertos: ficha("deal", {
    filaDelDiccionario: "Deals abiertos",
    tipo: "simple", unidad: "deals", monedas: [], anclaDeFecha: "sin_fecha", dimensiones: ["etapa", "cohorte"],
    vigencia: ["deals"], sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/embudo-etapas.ts", nombre: "calcularEmbudoEtapas" }, listas: ["etapa_abiertos"],
  }),
  deals_sin_dueno: ficha("deal", {
    filaDelDiccionario: "Deals sin dueño",
    tipo: "derivada", de: ["deals_abiertos"], unidad: "deals", monedas: [], anclaDeFecha: "sin_fecha", dimensiones: ["etapa", "dueno", "cohorte"],
    criterioDeCloser: "dueno_del_deal", vigencia: ["deals"], sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/embudo-etapas.ts", nombre: "calcularEmbudoEtapas" }, listas: ["etapa_sin_dueno"],
  }),
  descuento_promedio: ficha("venta", {
    filaDelDiccionario: "Descuento promedio en USD",
    tipo: "derivada", de: ["vendido", "ventas"], unidad: "dinero", monedas: ["usd"], anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA, criterioDeCloser: "dueno_del_deal", vigencia: ["deals"],
    sumaEntreProgramas: true, cobertura: "exclusiones_contadas_aparte",
    funcionSql: { archivo: "lib/queries/saldo.ts", nombre: "descuentoDeDeal" }, listas: [],
  }),
  descuento_promedio_porcentaje: ficha("venta", {
    filaDelDiccionario: "Descuento promedio en porcentaje",
    tipo: "derivada", de: ["descuento_promedio"], unidad: "porcentaje", monedas: [], anclaDeFecha: "primera_entrada_a_venta",
    dimensiones: DIMENSIONES_DE_VENTA, criterioDeCloser: "dueno_del_deal", vigencia: ["deals"],
    sumaEntreProgramas: false, cobertura: "exclusiones_contadas_aparte",
    funcionSql: { archivo: "lib/queries/saldo.ts", nombre: "descuentoDeDeal" }, listas: [],
  }),
  presupuesto: ficha("plan", {
    filaDelDiccionario: "Presupuesto usado",
    tipo: "derivada", de: ["inversion"], unidad: "dinero", monedas: ["cop"], anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["cohorte"], vigencia: [], sumaEntreProgramas: true, cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/metas/cumplimiento-de-cohorte.ts", nombre: "armarCumplimiento" }, listas: [],
  }),
  agendas_dia: ficha("agenda", {
    filaDelDiccionario: "Agendas por día (real)",
    tipo: "derivada", de: ["agendadas"], unidad: "citas", monedas: [], anclaDeFecha: "fecha_de_creacion_de_la_cita",
    dimensiones: ["cohorte"], vigencia: ["calls"], sumaEntreProgramas: false, cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/metas/cumplimiento-de-cohorte.ts", nombre: "armarCumplimiento" }, listas: [],
  }),
  agendas_req: ficha("plan", {
    filaDelDiccionario: "Agendas requeridas por día",
    tipo: "derivada", de: ["objetivo_cohorte", "asistencia", "cierre_de_ventas"], unidad: "citas", monedas: [], anclaDeFecha: "sin_fecha",
    dimensiones: ["cohorte"], vigencia: ["deals", "calls"], sumaEntreProgramas: false, cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/metas/cumplimiento-de-cohorte.ts", nombre: "armarCumplimiento" }, listas: [],
  }),
  inversion_req: ficha("gasto", {
    filaDelDiccionario: "Inversión por día necesaria",
    tipo: "derivada", de: ["agendas_req", "costo_agenda_crm"], unidad: "dinero", monedas: ["cop"], anclaDeFecha: "fecha_del_gasto",
    dimensiones: ["dia"], vigencia: [], sumaEntreProgramas: false, cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/metas/cumplimiento-de-cohorte.ts", nombre: "armarCumplimiento" }, listas: [],
  }),
  roas_proy: ficha("gasto", {
    filaDelDiccionario: "ROAS proyectado",
    tipo: "derivada", de: ["roas", "asistencia", "cierre_de_ventas"], unidad: "veces", monedas: [], anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana"], vigencia: ["deals", "calls"], sumaEntreProgramas: false, cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/queries/proyeccion-roas.ts", nombre: "calcularProyeccionDeRoas" }, listas: [],
  }),
  envios_sin_id: ficha("envio", {
    filaDelDiccionario: "Registros de pauta sin anuncio",
    tipo: "simple", unidad: "personas", monedas: [], anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana", "mes", "area", "canal", "cuenta", "campana", "fuente", "utm_source", "utm_medium", "categoria"],
    vigencia: [], sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/roas-de-pauta.ts", nombre: "cargarRoasDePauta" }, listas: [],
  }),
  registros_sin_utm: ficha("envio", {
    filaDelDiccionario: "Registros sin origen",
    tipo: "simple", unidad: "personas", monedas: [], anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana", "mes", "area", "canal", "cuenta", "campana", "fuente", "utm_source", "utm_medium", "categoria"],
    vigencia: [], sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/traza-por-anuncio.ts", nombre: "trazaPorAnuncio" }, listas: [],
  }),
  ventas_sin_anuncio: ficha("venta", {
    filaDelDiccionario: "Ventas sin anuncio identificado",
    tipo: "derivada", de: ["ventas", "envios_sin_id"], unidad: "cupos", monedas: [], anclaDeFecha: "fecha_del_envio",
    dimensiones: DIMENSIONES_DE_VENTA, criterioDeCloser: "dueno_del_deal", vigencia: ["deals"], sumaEntreProgramas: true, cobertura: "no_aplica",
    funcionSql: { archivo: "lib/queries/roas-de-pauta.ts", nombre: "cargarRoasDePauta" }, listas: [],
  }),
  embudo: ficha("envio", {
    filaDelDiccionario: "Dejó datos · Llegó al Calendly",
    tipo: "razon", de: ["registros"], unidad: "personas", monedas: [], anclaDeFecha: "fecha_del_envio",
    dimensiones: ["dia", "semana", "mes", "area", "canal", "cuenta", "campana", "fuente", "utm_source", "utm_medium", "categoria"],
    vigencia: [], sumaEntreProgramas: false, cobertura: "razon_con_cobertura",
    funcionSql: { archivo: "lib/queries/embudo-formulario.ts", nombre: "embudoDelFormulario" }, listas: [],
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
} as const satisfies Partial<Record<ClaveDeConcepto, FichaBase>>;

const texto = (
  que: string,
  forma: FormaDeFormula,
  terminos: readonly string[],
  variables: readonly VariableDeMetrica[],
  extras: Omit<Partial<CamposDeExplicacion>, "que" | "formula" | "variables"> = {},
): CamposDeExplicacion => ({ que, formula: { forma, terminos }, variables, ...extras });

const ABONADO_O_COMPLETO: VariableDeMetrica = {
  nombre: "Abonado o Completo",
  explicacion: "El cliente ya pagó al menos un abono. Un deal en cualquier otra etapa no es venta.",
};
const DIAS_HABILES: VariableDeMetrica = {
  nombre: "Días hábiles",
  explicacion: "De lunes a viernes; los festivos cuentan como hábiles.",
};

const TEXTOS: Record<keyof typeof REGISTRO_BASE, CamposDeExplicacion> = {
  registros: texto(
    "Cuántos formularios completos llegaron.", "conteo", ["formularios completos enviados en el periodo"],
    [{ nombre: "Completo", explicacion: "La persona terminó el formulario. Una persona que aplica dos veces son dos envíos; cuenta el día del envío." }],
  ),
  agendadas: texto(
    "Cuántas citas se reservaron, de personas que llegaron por anuncios.", "conteo", ["citas reservadas en el periodo por personas de pauta"],
    [
      { nombre: "Cita reservada", explicacion: "La llamada que el lead apartó en el calendario. Cuenta el día en que la reservó, no el día de la llamada." },
      { nombre: "Persona de pauta", explicacion: "Llegó por el enlace de un anuncio pago." },
    ],
  ),
  citas: texto(
    "Cuántas citas con closer caen en el periodo, sin contar las canceladas.", "conteo", ["citas del periodo que no se cancelaron"],
    [{ nombre: "Cita", explicacion: "La llamada agendada con un closer; cuenta el día de la cita, no el día en que se reservó." }],
  ),
  shows: texto(
    "Cuántas citas del periodo ocurrieron de verdad, con la llamada atendida.", "conteo", ["citas del periodo con llamada atendida"],
    [{ nombre: "Atendida", explicacion: "El closer marcó show, compromiso de pago, cerrada o perdida. La cancelada, la no asistida y la que sigue sin resultado no cuentan." }],
  ),
  no_asistio: texto(
    "Cuántas citas del periodo ya se resolvieron y la persona no se presentó.", "conteo", ["citas del periodo marcadas como no asistió"],
    [{ nombre: "No asistió", explicacion: "Solo la marcada como no asistió. La cancelada y la cita sin resultado no cuentan." }],
  ),
  asistencia: texto(
    "De las personas del grupo de citas, qué parte tuvo su cita realizada.", "razon", ["Realizadas", "Citas del grupo"],
    [
      { nombre: "Realizadas", explicacion: "Personas con una cita atendida: show, compromiso de pago, cerrada o perdida." },
      { nombre: "Citas del grupo", explicacion: "Personas con al menos una cita que ya debía ocurrir; sin reagendadas, cortesías ni anulados." },
      { nombre: "Sin marcar", explicacion: "Las citas pasadas que siguen sin resultado quedan fuera y se avisan como parcial." },
    ],
    { aliasExcel: "% de show / % presentación a zoom", unidadesDePartes: ["conteo", "conteo"] },
  ),
  cierre_de_ventas: texto(
    "De los deals de pauta que asistieron a su cita, qué parte ya compró.", "razon", ["Deals que asistieron y compraron", "Deals que asistieron"],
    [
      { nombre: "Deals que asistieron y compraron", explicacion: "De los deals que asistieron, los que hoy están en Abonado o Completo, aunque hayan comprado después del periodo." },
      { nombre: "Deals que asistieron", explicacion: "Deals del grupo con al menos una cita a la que la persona asistió, según lo marcó el closer." },
      { nombre: "Sin marcar", explicacion: "Citas cuya hora ya pasó y el closer no ha dicho qué pasó. Quedan fuera del grupo y la cifra se avisa como parcial." },
    ],
    { aliasExcel: "% de cierre zoom a cliente", unidadesDePartes: ["conteo", "conteo"] },
  ),
  ventas: texto(
    "Cuántos deals de personas de pauta pasaron a Abonado o Completo.", "conteo", ["deals en Abonado o Completo, por la fecha de la venta"],
    [ABONADO_O_COMPLETO],
  ),
  cupos_vendidos: texto(
    "Cuántas ventas se cerraron hoy.", "conteo", ["ventas de hoy"],
    [{ nombre: "Venta", explicacion: "Cada deal vendido cuenta como un cupo." }],
  ),
  llevamos: texto(
    "Cuántas ventas lleva el periodo desde que empezó hasta hoy.", "conteo", ["ventas desde el inicio del periodo hasta hoy"],
    [{ nombre: "Periodo", explicacion: "Puede ser la semana, el mes o la cohorte; para una cohorte cuenta también ventas anteriores a la apertura de su venta." }],
  ),
  vendido: texto(
    "Cuánto se vendió, en dólares: el valor pactado con el cliente, no lo que ya entró a caja.", "suma", ["valor vendido de cada venta de pauta"],
    [{ nombre: "Valor vendido", explicacion: "El precio pactado, en USD. Lo ya pagado es Recaudado y lo que falta es Por cobrar." }],
  ),
  recaudado: texto(
    "Cuánto de lo vendido ya se pagó.", "suma", ["abonos del programa de esas mismas ventas, a hoy"],
    [{ nombre: "Abonos del programa", explicacion: "Los pagos del programa hasta hoy; los adicionales no entran. Una venta con abonos en otra moneda queda aparte." }],
  ),
  por_cobrar: texto(
    "Cuánto falta por pagar de lo vendido.", "resta", ["Vendido", "Recaudado"],
    [{ nombre: "Saldo", explicacion: "Se calcula venta por venta. Un sobrepago se muestra aparte y no resta deuda a otra venta." }],
    { unidadesDePartes: ["usd", "usd"] },
  ),
  entro_a_caja: texto(
    "Cuánta plata entró en el periodo.", "suma", ["abonos del periodo, por moneda"],
    [{ nombre: "Abono", explicacion: "Un pago registrado, incluidos los adicionales. Cuenta el día del pago; cada moneda se muestra aparte y los anulados no cuentan." }],
  ),
  comision: texto(
    "Cuánto se le debe pagar al closer por sus ventas, en USD.", "suma", ["valor vendido × porcentaje de comisión de cada venta"],
    [{ nombre: "Porcentaje de comisión", explicacion: "El del programa, fijado en la venta cuando entra a Abonado o Completo. Va al dueño del deal." }],
  ),
  leads: texto(
    "Cuántas personas distintas aplicaron por primera vez en el periodo.", "conteo", ["personas cuya primera aplicación cae en el periodo"],
    [{ nombre: "Persona", explicacion: "Un correo distinto dentro del programa. La primera aplicación también puede ser un parcial; el alta manual no cuenta." }],
  ),
  citas_pendientes: texto(
    "Citas cuya hora ya pasó y el closer no marcó cómo terminaron.", "conteo", ["citas pasadas que siguen en agendada"],
    [{ nombre: "Sin resultado", explicacion: "Es un dato que falta, no una inasistencia. Solo cuenta deals no cerrados; la cita suelta vive en el Inbox." }],
  ),
  citas_del_dia: texto(
    "Cuántas citas hay hoy, sin contar las canceladas.", "conteo", ["citas de hoy que no se cancelaron"],
    [{ nombre: "Hoy", explicacion: "Es la cifra Citas con el periodo de un solo día." }],
  ),
  citas_canceladas: texto(
    "Cuántas citas de hoy se cancelaron.", "conteo", ["citas de hoy con resultado cancelado"],
    [{ nombre: "Canceladas", explicacion: "No cuentan en Citas ni en Asistencia." }],
  ),
  show_por_cita: texto(
    "De las citas que ya debían ocurrir, qué parte ocurrió.", "razon", ["Citas que ocurrieron", "Citas que ya debían ocurrir"],
    [{ nombre: "Citas que ya debían ocurrir", explicacion: "Las no canceladas cuya hora ya pasó. Las que siguen sin marcar se avisan como parcial." }],
    { unidadesDePartes: ["conteo", "conteo"] },
  ),
  cita_a_venta: texto(
    "De las personas del grupo de citas, qué parte terminó en venta.", "razon", ["Ventas", "Agendadas del grupo"],
    [
      { nombre: "Ventas", explicacion: "Personas del grupo que tuvieron su llamada y hoy están en Abonado o Completo." },
      { nombre: "Agendadas del grupo", explicacion: "Las personas del mismo grupo de citas de Asistencia." },
    ],
    { aliasExcel: "% de cierre agenda a cliente", admiteObjetivo: true, unidadesDePartes: ["conteo", "conteo"] },
  ),
  nacio_agenda_del_dia: texto(
    "De las ventas del día, cuántas salieron de una llamada hecha ese mismo día.", "conteo", ["ventas del día con llamada realizada el día de la venta"],
    [{ nombre: "Llamada realizada", explicacion: "Show, compromiso de pago, cerrada o perdida. Cada venta cae en una sola forma de nacimiento." }],
  ),
  nacio_seguimiento: texto(
    "De las ventas del día, cuántas salieron de una llamada de un día anterior.", "conteo", ["ventas del día cuya última llamada realizada fue un día anterior"],
    [{ nombre: "Seguimiento", explicacion: "Una llamada posterior a la venta no la explica." }],
  ),
  nacio_sin_llamada: texto(
    "De las ventas del día, cuántas no tienen ninguna llamada realizada.", "conteo", ["ventas del día sin llamada realizada hasta ese día"],
    [{ nombre: "Sin llamada", explicacion: "No se inventa un origen para una venta sin deal." }],
  ),
  meta: texto(
    "Cuántos cupos quiere vender la empresa en la cohorte.", "conteo", ["lo escribe quien administra el programa en Configuración de Hoy"],
    [{ nombre: "Cupos", explicacion: "Ventas. No se reparte entre closers: un closer aporta ventas, no tiene objetivo propio." }],
  ),
  objetivo_cohorte: texto(
    "Cuántos cupos quiere vender la empresa en toda la cohorte.", "conteo", ["lo escribe quien administra el programa en Configuración de Hoy"],
    [{ nombre: "Objetivo", explicacion: "Es el valor del que se reparten el esperado, lo que falta y la proyección." }],
  ),
  objetivo_de_leads: texto(
    "Cuántos leads por día se propuso conseguir la cohorte.", "conteo", ["lo escribe quien administra el programa en Configuración de Hoy"],
    [{ nombre: "Leads", explicacion: "Personas nuevas del día. Nunca se reemplaza por Leads que hacen falta, que se calcula aparte." }],
  ),
  dias_del_ritmo: texto(
    "Cuántos días hábiles hacia atrás se miran para medir qué tan rápido se vende y se convierte.", "conteo", ["lo elige quien administra el programa en Configuración de Hoy"],
    [{ nombre: "Opciones", explicacion: "5, 10 o 20 días; por defecto 10." }],
  ),
  citas_minimas: texto(
    "Cuántas personas con cita hacen falta para usar una tasa medida al proyectar.", "conteo", ["lo escribe quien administra el programa en Configuración de Hoy"],
    [{ nombre: "Muestra mínima", explicacion: "Por defecto 20. Con menos personas, la tasa no se usa y la cifra sale «—» con su razón." }],
  ),
  objetivo_mes: texto(
    "Cuántos cupos de la cohorte tocan en el mes.", "producto", ["Objetivo de cada cohorte", "proporción de días hábiles del mes dentro de su venta"],
    [{ nombre: "Reparto", explicacion: "Se reparte por días hábiles y se suman las cohortes del programa que venden en el mes." }],
  ),
  objetivo_semana: texto(
    "Cuántos cupos toca vender de lunes a domingo.", "suma", ["parte semanal del Objetivo del mes más lo que faltó antes"],
    [{ nombre: "Compensación", explicacion: "Incluye lo que faltó vender en semanas anteriores del mes." }],
  ),
  esperado_a_hoy: texto(
    "Cuántas ventas debería llevar la cohorte hoy si vendiera parejo.", "producto", ["Objetivo ÷ Días hábiles de la venta", "Días hábiles transcurridos"],
    [{ nombre: "Días hábiles de la venta", explicacion: "Los lunes a viernes entre apertura y cierre. Antes de abrir es 0; después del cierre es el objetivo entero." }],
  ),
  faltan: texto(
    "Cuántas ventas faltan para el objetivo.", "resta", ["Objetivo", "Llevamos"],
    [{ nombre: "Faltan", explicacion: "No baja de cero. Llevamos son las ventas de la cohorte hasta hoy." }],
  ),
  por_dia_habil: texto(
    "Cuántas ventas hay que cerrar por día hábil que queda para llegar.", "razon", ["Faltan al abrir hoy", "Días hábiles que quedan, contando hoy"],
    [{ nombre: "Al abrir hoy", explicacion: "Las ventas de hoy no se descuentan. Pasado el cierre da el faltante entero." }, DIAS_HABILES],
    { decimales: 1, unidadesDePartes: ["conteo", "conteo"] },
  ),
  objetivo_del_dia: texto(
    "Cuántas ventas hay que cerrar hoy para ir al ritmo del objetivo.", "razon", ["Objetivo menos ventas hasta ayer", "Días hábiles que quedan, contando hoy"],
    [{ nombre: "Objetivo", explicacion: "El del mes. Las ventas de hoy no se descuentan; el último día hábil da el faltante entero." }, DIAS_HABILES],
    { decimales: 1 },
  ),
  proyeccion: texto(
    "Cuántas ventas tendrá la cohorte al cierre si se mantiene el ritmo de hoy.", "suma", ["Llevamos más Ritmo × Días hábiles que quedan"],
    [{ nombre: "Ritmo", explicacion: "Ventas por día hábil de los últimos 5, 10 o 20 días hábiles, recortados a la apertura de la venta." }],
  ),
  leads_que_hacen_falta: texto(
    "Cuántos leads por día se necesitan para llegar al objetivo de cupos, con las tasas que se miden hoy.", "razon", ["Ventas por día necesarias", "Cierre de ventas × Asistencia × Conversión de lead a cita"],
    [{ nombre: "Tasas", explicacion: "Se miden en la ventana de Días para medir el ritmo. Con menos que el mínimo, no se usan y la cifra sale «—» con su razón." }],
    { decimales: 1 },
  ),
  deals_desde_completo: texto(
    "Cuántos deals se abrieron a partir de un formulario terminado.", "conteo", ["deals creados en el periodo desde un formulario completo"],
    [{ nombre: "Completo", explicacion: "La persona tiene al menos un envío terminado hasta el fin del periodo; cuenta el día del envío que abrió el deal." }],
  ),
  deals_desde_parcial: texto(
    "Cuántos deals se abrieron a partir de un formulario dejado a medias.", "conteo", ["deals creados en el periodo desde un formulario parcial"],
    [{ nombre: "Parcial", explicacion: "Hasta el fin del periodo, la persona solo tiene envíos incompletos; cuenta el día del envío que abrió el deal." }],
  ),
  cupos_con_caja: texto(
    "Cuántas ventas recibieron al menos un pago en el periodo.", "conteo", ["ventas con al menos un abono en el periodo"],
    [{ nombre: "Cupo con caja", explicacion: "Cada venta cuenta una vez, el día de su primer abono del periodo. Los anulados no cuentan." }],
  ),
  ventas_por_escalon: texto(
    "Cómo se distribuyen los deals entre los siete escalones de la conversión.", "conteo", ["deals de cada escalón"],
    [
      { nombre: "Pagó en la llamada", explicacion: "El primer abono vigente del programa fue el mismo día de la última cita atendida que no es posterior al pago." },
      { nombre: "Pagó rápido", explicacion: "El primer abono llegó dentro del corte de días hábiles que definió el programa, después de la cita atendida." },
      { nombre: "Pagó después", explicacion: "El primer abono llegó más tarde que el corte. Sin corte, Pagó rápido se junta aquí." },
      { nombre: "Pagó sin llamada registrada", explicacion: "La venta no tiene una cita atendida anterior o igual al primer abono, o no tiene un abono vigente del programa." },
      { nombre: "Atendió y no compró", explicacion: "Tuvo al menos una cita atendida y no está vendido." },
      { nombre: "Agendó y no se presentó", explicacion: "Tuvo una cita vencida sin atender, ninguna atendida y no está vendido. Las citas futuras, sin resultado o reagendadas aún no cuentan." },
      { nombre: "Dejó datos y sin cita ocurrida", explicacion: "No tiene una cita atendida ni vencida y no está vendido; incluye los deals que solo tienen citas pendientes." },
      { nombre: "Cerró en la llamada", explicacion: "Agrupa Pagó en la llamada." },
      { nombre: "Cerró con seguimiento", explicacion: "Agrupa Pagó rápido y Pagó después." },
      { nombre: "No cerró", explicacion: "Agrupa Atendió y no compró." },
      { nombre: "Ventas sin llamada registrada", explicacion: "Agrupa Pagó sin llamada registrada." },
      { nombre: "No llegaron a la llamada", explicacion: "Agrupa Agendó y no se presentó y Dejó datos y sin cita ocurrida." },
    ],
  ),
  escalera_sin_resultado: texto(
    "Cuántos deals no vendidos tienen una cita pasada que sigue sin resultado; es una marca aparte del escalón.", "conteo", ["deals no vendidos con cita pasada sin resultado"],
    [{ nombre: "Marca aparte", explicacion: "El deal conserva su escalón. La marca evita leerlo como falta de asistencia cuando el closer todavía no registró qué ocurrió." }],
  ),
  grupo_de_citas: texto(
    "Cuántos deals forman el grupo sobre el que se calculan Asistencia, Cierre de ventas y De cita a venta.", "conteo", ["deals vigentes con al menos una cita que ya debía ocurrir en el periodo"],
    [{ nombre: "Grupo de citas", explicacion: "No incluye cortesías ni anulados. Una reagendada no entra: la representa la cita nueva. Cada deal cuenta una vez." }],
  ),
  con_show_y_vendidos_hoy: texto(
    "Cuántos deals del grupo tuvieron show y hoy están vendidos.", "conteo", ["deals del grupo con show que hoy están en Abonado o Completo"],
    [{ nombre: "Vendidos hoy", explicacion: "Si un deal se pierde después, deja de contar. Un vendido sin show en el grupo no entra." }],
  ),
  deals_abiertos: texto(
    "Cuántos deals siguen abiertos en cada etapa del embudo.", "conteo", ["deals abiertos en la etapa"],
    [{ nombre: "Abierto", explicacion: "Llegó a la etapa y todavía no la dejó por una etapa posterior ni por un cierre." }],
  ),
  deals_sin_dueno: texto(
    "Cuántos deals abiertos no tienen una persona responsable.", "conteo", ["deals abiertos sin dueño"],
    [{ nombre: "Sin dueño", explicacion: "El deal no tiene responsable asignado; se muestra por su etapa y antigüedad." }],
  ),
  descuento_promedio: texto(
    "Cuántos dólares se descontaron en promedio frente al precio de lista de la cohorte.", "resta", ["Precio de lista de la cohorte", "Valor vendido"],
    [{ nombre: "Promedio", explicacion: "Promedio simple de las ventas con precio de lista y valor vendido. Una venta a la que le falte uno de los dos queda fuera." }],
    { unidadesDePartes: ["usd", "usd"] },
  ),
  descuento_promedio_porcentaje: texto(
    "Qué porcentaje del precio de lista se descontó en promedio por venta.", "razon", ["Precio de lista menos Valor vendido", "Precio de lista"],
    [{ nombre: "Promedio", explicacion: "Promedio simple del porcentaje de cada venta con precio de lista y valor vendido. Nunca se combina entre programas." }],
    { unidadesDePartes: ["usd", "usd"] },
  ),
  inversion: texto(
    "Lo que se gastó en anuncios de Meta, sumando todas las cuentas del programa.", "suma", ["gasto de cada día en Meta"],
    [
      { nombre: "Gasto de cada día", explicacion: "Lo que Meta reporta como gastado ese día, en pesos. Entran todas las campañas: agenda, lanzamiento y otras." },
      { nombre: "Semana sin gasto cargado", explicacion: "Si el gasto todavía no se cargó, sale «—» y la fecha desde la que hay gasto. Cero solo cuando el gasto cargado sumó cero." },
    ],
  ),
  costo_agenda_crm: texto(
    "Cuánto costó, en promedio, cada cita que trajo la pauta.", "razon", ["Gasto en campañas de agenda", "Agendadas de pauta"],
    [
      { nombre: "Gasto en campañas de agenda", explicacion: "Solo campañas cuyo objetivo es agendar; lanzamientos y tráfico a Instagram se muestran aparte." },
      { nombre: "Agendadas de pauta", explicacion: "Citas reservadas por personas que llegaron por anuncios, contadas en el CRM." },
    ],
    { admiteObjetivo: true, unidadesDePartes: ["cop", "conteo"] },
  ),
  cac: texto(
    "Cuánto se invirtió en pauta por cada venta de pauta. También se le dice CAC.", "razon", ["Inversión", "Ventas de pauta"],
    [
      { nombre: "Inversión", explicacion: "Todo lo gastado en Meta en el periodo, sumando todas las campañas." },
      { nombre: "Ventas de pauta", explicacion: "Deals de personas de pauta en Abonado o Completo en el periodo." },
    ],
    { admiteObjetivo: true, unidadesDePartes: ["cop", "conteo"] },
  ),
  costo_agenda_meta: texto(
    "El mismo costo por agenda, pero dividiendo por las agendas que ve Meta en vez de las del CRM.", "razon", ["Gasto en campañas de agenda", "Agendas de Meta"],
    [{ nombre: "Agendas de Meta", explicacion: "Las que reporta el pixel. Si difiere mucho del costo del CRM, la medición tiene un problema." }],
    { unidadesDePartes: ["cop", "conteo"] },
  ),
  roas: texto(
    "Cuántos dólares vendidos trajo cada dólar invertido.", "razon", ["Vendido de pauta", "Inversión en dólares"],
    [
      { nombre: "Vendido de pauta", explicacion: "El valor vendido de las ventas de pauta. Cuenta en la semana del registro, aunque haya comprado después." },
      { nombre: "Inversión en dólares", explicacion: "El gasto de cada día en pesos dividido por la tasa de cambio de ese día." },
      { nombre: "Parcial", explicacion: "Si alguna venta viene de un día sin gasto cargado, el ROAS sale como parcial o «—»: dividir esa venta por un gasto que falta lo inflaría." },
    ],
    { admiteObjetivo: true, unidadesDePartes: ["usd", "usd"] },
  ),
  profit: texto(
    "Lo vendido en pauta menos lo invertido, los dos en dólares.", "resta", ["Vendido de pauta", "Inversión en dólares"],
    [
      { nombre: "Vendido de pauta", explicacion: "Cuenta en la semana en que la persona se registró, no en la semana de la venta." },
      { nombre: "Inversión en dólares", explicacion: "El gasto de cada día en pesos dividido por la tasa de cambio de ese día." },
    ],
    { unidadesDePartes: ["usd", "usd"] },
  ),
  cpm: {
    ...texto(
      "Cuánto cuesta que Meta muestre los anuncios mil veces.", "razon", ["Inversión", "Impresiones"],
      [{ nombre: "Impresiones", explicacion: "Veces que Meta mostró los anuncios." }],
      { unidadesDePartes: ["cop", "conteo"] },
    ),
    formula: { forma: "razon", terminos: ["Inversión", "Impresiones"], por1000: true },
  },
  ctr: texto(
    "De las veces que se mostró un anuncio, qué parte terminó en un clic al enlace.", "razon", ["Clics al enlace", "Impresiones"],
    [{ nombre: "Clics al enlace", explicacion: "Los que llevan a la landing; no cuentan likes ni clics al perfil." }],
    { unidadesDePartes: ["conteo", "conteo"] },
  ),
  llegada_landing: texto(
    "De los clics al enlace, qué parte terminó de cargar la página.", "razon", ["Vistas de la landing", "Clics al enlace"],
    [{ nombre: "Vistas de la landing", explicacion: "Meta cuenta una cuando la página terminó de cargar." }],
    { unidadesDePartes: ["conteo", "conteo"] },
  ),
  conversion_landing: texto(
    "De quienes vieron la página, qué parte se registró en el formulario.", "razon", ["Registros de pauta", "Vistas de la landing"],
    [{ nombre: "Registros de pauta", explicacion: "Formularios enviados que llegaron al CRM desde anuncios." }],
    { unidadesDePartes: ["conteo", "conteo"] },
  ),
  frecuencia: texto(
    "Cuántas veces, en promedio, vio los anuncios cada persona.", "razon", ["Impresiones", "Personas alcanzadas"],
    [{ nombre: "Personas alcanzadas", explicacion: "Personas distintas que vieron algún anuncio. Meta solo la da día por día; en una semana sale «—»." }],
    { decimales: 1, unidadesDePartes: ["conteo", "conteo"] },
  ),
  presupuesto: texto(
    "Cuánto de la inversión planeada para la cohorte ya se gastó.", "suma", ["gasto de cada día desde que abrió la venta de la cohorte"],
    [{ nombre: "Inversión planeada", explicacion: "El presupuesto de la cohorte, cargado por Pauta o Gerencia en Programa › Objetivos." }],
  ),
  agendas_dia: texto(
    "Cuántas citas se reservan, en promedio, por día hábil de la venta de la cohorte.", "razon", ["Agendadas de la cohorte", "Días hábiles transcurridos"],
    [DIAS_HABILES], { decimales: 1, unidadesDePartes: ["conteo", "conteo"] },
  ),
  agendas_req: texto(
    "Cuántas citas por día hacen falta, de hoy al cierre, para llegar al objetivo de ventas de la cohorte.", "razon", ["Ventas por día necesarias", "Cierre de ventas × Asistencia"],
    [{ nombre: "Ventas por día necesarias", explicacion: "Las ventas que faltaban al abrir hoy, repartidas entre los días hábiles que quedan." }, DIAS_HABILES],
    { decimales: 1 },
  ),
  inversion_req: texto(
    "Cuánto habría que invertir por día para conseguir las agendas necesarias.", "producto", ["Agendas por día necesarias", "Costo por agenda"],
    [{ nombre: "Costo por agenda", explicacion: "Se calcula con el objetivo de la cohorte y con el promedio real de la cohorte." }],
    { unidadesDePartes: ["decimal", "cop"] },
  ),
  roas_proy: texto(
    "El ROAS que se espera cuando ocurran las citas de pauta que faltan.", "razon", ["Vendido a hoy más valor esperado de las citas pendientes", "Inversión en dólares"],
    [
      { nombre: "Valor esperado de una cita", explicacion: "Probabilidad de que ocurra × probabilidad de que cierre × precio de la cohorte." },
      { nombre: "Probabilidades", explicacion: "Las del closer dueño en las últimas 3 semanas; con muy pocas citas se usa la del programa." },
    ],
    { unidadesDePartes: ["usd", "usd"] },
  ),
  envios_sin_id: texto(
    "Registros que llegaron por un anuncio pago pero sin el dato de cuál anuncio fue.", "conteo", ["registros de pauta sin anuncio identificado"],
    [{ nombre: "Anuncio", explicacion: "Meta lo agrega al enlace cuando el anuncio usa la plantilla de Retia." }],
  ),
  registros_sin_utm: texto(
    "Registros que llegaron sin decir de dónde vienen. No se pueden recuperar: se corrige el enlace hacia adelante.", "conteo", ["registros sin fuente ni medio en el enlace"],
    [{ nombre: "Origen", explicacion: "La plataforma, el tipo de tráfico y la campaña que decía el enlace." }],
  ),
  ventas_sin_anuncio: texto(
    "Ventas de pauta en las que no se sabe qué anuncio trajo a la persona.", "conteo", ["ventas de pauta cuyo registro llegó sin anuncio identificado"],
    [{ nombre: "Anuncio", explicacion: "Meta lo agrega al enlace cuando el anuncio usa la plantilla de Retia." }],
  ),
  embudo: texto(
    "Cuántas personas llegaron a este paso del formulario.", "razon", ["Personas en este paso", "Personas que abrieron el formulario"],
    [{ nombre: "Abrieron el formulario", explicacion: "Personas que cargaron la primera pregunta." }],
    { unidadesDePartes: ["conteo", "conteo"] },
  ),
};

type RegistroCompleto = {
  readonly [K in keyof typeof REGISTRO_BASE]: Readonly<(typeof REGISTRO_BASE)[K] & CamposDeExplicacion>;
};

export const REGISTRO = Object.fromEntries(
  Object.entries(REGISTRO_BASE).map(([clave, base]) => [clave, { ...base, ...TEXTOS[clave as keyof typeof TEXTOS] }]),
) as RegistroCompleto;

export type ClaveRegistrada = keyof typeof REGISTRO;

export function fichaDe(clave: ClaveRegistrada): FichaDeMetrica {
  return REGISTRO[clave];
}

export function estaRegistrada(clave: ClaveDeConcepto): clave is ClaveRegistrada {
  return Object.prototype.hasOwnProperty.call(REGISTRO, clave);
}
