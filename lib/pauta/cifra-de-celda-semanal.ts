/**
 * La celda de la tabla semanal de Pauta como Cifra (ticket 419 paso 2, `docs/diseno-cifra-y-pauta.md` §1.2 y §4.3).
 *
 * `cifraDeCeldaSemanal` recibe lo que ya calculó `cargarPautaSemanal` (el valor, su cobertura y las partes de la
 * fórmula) y lo vuelve `CifraDeMetrica` con `armarCifra`: el valor en mono, el punto de estado solo si la fila tiene
 * objetivo cargado, y debajo el cambio contra la columna anterior ("La línea pequeña"). La explicación sale del texto
 * del concepto. No consulta la base: la pantalla le pasa los objetivos y la lista ya leídos.
 */
import { armarCifra, type CifraDeMetrica, type EntradaDeCifra, type FuenteDeEstado } from "@/lib/metricas/cifra";
import { explicacionDe, VARIANTES_DE_PAUTA } from "@/lib/metricas/explicacion";
import { CONCEPTO_DE_PAUTA_SEMANAL } from "@/lib/metricas/pendientes";
import type { ObjetivoDeCohorte } from "@/lib/catalogo/objetivos";
import { DEFINICION_METRICAS_OBJETIVO, type MetricaObjetivo } from "@/lib/objetivos/metricas";
import { etiquetaDeSemana } from "@/lib/pauta/csv-tabla-semanal";
import type { CeldaPautaSemanal, ClavePautaSemanal, FilaPautaSemanal, PasoDeTablaDePauta } from "@/lib/queries/hechos/pauta-semanal";

type Rango = { desde: string; hasta: string };

/** Las filas que tienen objetivo en Programa › Objetivos (diseño §4.3: costo por agenda, ROAS, Agenda → venta). */
export const METRICAS_DE_OBJETIVO: Partial<Record<ClavePautaSemanal, MetricaObjetivo>> = {
  costo_agenda_crm: "costo_por_agenda",
  costo_agenda_meta: "costo_por_agenda",
  roas: "roas",
  agenda_venta: "conversion_agenda_venta",
  cac: "costo_por_venta",
};

/**
 * El estado de la celda contra el objetivo de Paid de la cohorte (o el de todas las áreas si no hay uno de Paid).
 * Sin objetivo no hay estado: nunca un color inventado. El objetivo de una tasa se carga en puntos (40 = 40 %) y la
 * celda la trae como fracción; aquí se ponen en la misma escala. Sin "aceptable", lo que no cumple es rezagado.
 */
export function estadoDeCeldaSemanal(
  clave: ClavePautaSemanal,
  objetivos: readonly ObjetivoDeCohorte[],
): FuenteDeEstado | undefined {
  const metrica = METRICAS_DE_OBJETIVO[clave];
  if (!metrica) return undefined;
  const candidatas = objetivos.filter((o) => o.activo && o.metrica === metrica && (o.area === null || o.area === "paid"));
  const objetivo = candidatas.find((o) => o.area === "paid") ?? candidatas.find((o) => o.area === null);
  if (!objetivo) return undefined;
  // Las celdas de costo vienen en pesos: un objetivo en otra moneda no se compara (nunca convertir en silencio).
  if (DEFINICION_METRICAS_OBJETIVO[metrica].unidad === "COP" && objetivo.moneda !== "COP") return undefined;
  const escala = DEFINICION_METRICAS_OBJETIVO[metrica].unidad === "porcentaje" ? 100 : 1;
  return {
    fuente: "objetivo",
    objetivo: objetivo.meta / escala,
    aceptable: (objetivo.aceptable ?? objetivo.meta) / escala,
    menorEsMejor: DEFINICION_METRICAS_OBJETIVO[metrica].sentido === "menor_es_mejor",
  };
}

export interface EntradaDeCeldaSemanal {
  fila: Pick<FilaPautaSemanal, "clave">;
  celda: CeldaPautaSemanal;
  rango: Rango;
  /** `true` en la columna Total del periodo; las demás son semanas o días, según el paso. */
  esTotal: boolean;
  /** Semana por defecto; por día (414) los textos dicen «día». */
  paso?: PasoDeTablaDePauta;
  /** La columna de la izquierda (la semana o el día anterior), para "La línea pequeña". El Total no compara. */
  anterior?: { celda: CeldaPautaSemanal; rango: Rango };
  hoy: string;
  objetivos: readonly ObjetivoDeCohorte[];
  programa?: string;
  cohorte?: string;
  /** La cuenta de Meta de una subfila de «Por cuenta» (416): va a los filtros de la explicación y a "Calculada con". */
  cuenta?: string;
  lista?: EntradaDeCifra["lista"];
}

/**
 * La explicación de una subfila de «Por cuenta» (416): la del concepto, con "qué mide" dicho para esa cuenta. La de
 * Inversión dice "sumando todas las cuentas del programa", que en una subfila sería falso.
 */
function explicacionDeCuenta(clave: ClavePautaSemanal, cuenta: string) {
  const base = explicacionSemanal(clave);
  const que = clave === "inversion"
    ? `Lo que se gastó en anuncios de Meta en la cuenta ${cuenta}. Las cuentas del programa suman la fila Inversión.`
    : `${base.que} Aquí, solo la cuenta ${cuenta}.`;
  return { ...base, que };
}

function explicacionSemanal(clave: ClavePautaSemanal) {
  return explicacionDe(
    CONCEPTO_DE_PAUTA_SEMANAL[clave],
    clave === "agendas_meta" ? VARIANTES_DE_PAUTA.agendas_meta : undefined,
  );
}

export function textoDePeriodoDeCelda(rango: Rango, esTotal: boolean, paso: PasoDeTablaDePauta = "semana"): string {
  if (esTotal) return `del ${etiquetaDeSemana(rango)}`;
  return paso === "dia" ? `día ${etiquetaDeSemana(rango)}` : `semana del ${etiquetaDeSemana(rango)}`;
}

export function cifraDeCeldaSemanal(e: EntradaDeCeldaSemanal): CifraDeMetrica {
  const { celda, rango } = e;
  const porDia = e.paso === "dia";
  const periodo = textoDePeriodoDeCelda(rango, e.esTotal, e.paso);
  const filtros: Array<readonly [string, string]> = [];
  if (e.programa) filtros.push(["Programa", e.programa]);
  if (e.cohorte) filtros.push(["Cohorte", e.cohorte]);
  filtros.push(["Área", "Paid"]);
  if (e.cuenta) filtros.push(["Cuenta de Meta", e.cuenta]);
  filtros.push([e.esTotal ? "Periodo" : porDia ? "Día" : "Semana", etiquetaDeSemana(rango)]);
  return armarCifra({
    concepto: e.fila.clave,
    explicacion: e.cuenta ? explicacionDeCuenta(e.fila.clave, e.cuenta) : explicacionSemanal(e.fila.clave),
    valor: celda.valor,
    motivo: celda.valor === null ? celda.cobertura.razon ?? "Faltan datos para calcularla" : undefined,
    partes: celda.partes,
    periodo,
    filtros,
    parcial: celda.valor !== null && celda.cobertura.estado === "parcial" ? celda.cobertura.razon ?? "Falta parte del dato." : undefined,
    enCurso: rango.hasta >= e.hoy,
    comparacion: !e.esTotal && e.anterior
      ? {
        referencia: `${porDia ? "el día anterior" : "la semana anterior"} (${etiquetaDeSemana(e.anterior.rango)})`,
        valor: e.anterior.celda.valor,
        etiqueta: "La línea pequeña",
      }
      : undefined,
    estado: estadoDeCeldaSemanal(e.fila.clave, e.objetivos),
    lista: e.lista,
  });
}
