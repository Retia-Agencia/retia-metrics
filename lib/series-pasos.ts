import { NOMBRES_DE_MES } from "@/lib/format";
import { aUtc, lunesDe, semanasDelRango, sumarDias } from "@/lib/rangos";
import type { Rango } from "@/lib/queries/dashboard";

/**
 * Los interruptores de toda gráfica del Hub (ticket 370): la unidad opcional, el paso del eje X y la forma.
 * Todo es puro y sin reloj: el que llama entrega `hoy` (Bogotá) y el rango ya resuelto por los filtros
 * del 377. El eje X de una gráfica es el periodo elegido; nada escribe un número de meses aquí.
 */
export const UNIDADES = ["cupos", "plata"] as const;
export const PASOS = ["dia", "semana", "mes"] as const;
export const FORMAS = ["paso", "acum"] as const;

export type Unidad = (typeof UNIDADES)[number];
export type Paso = (typeof PASOS)[number];
export type Forma = (typeof FORMAS)[number];

export interface ConfigDeGrafica {
  unidad: Unidad;
  paso: Paso;
  forma: Forma;
}

export const ROTULOS = {
  unidad: { cupos: "Cupos", plata: "Plata" },
  paso: { dia: "Día", semana: "Semana", mes: "Mes" },
  forma: { paso: "Por paso", acum: "Acumulado" },
} as const;

const DIAS_MAXIMOS_POR_DIA = 31;
const SEMANAS_MAXIMAS = 26;

/** Hasta 31 días, día; hasta 26 semanas, semana; más, mes. */
export function pasoPorDefecto(rango: Rango): Paso {
  const dias = (aUtc(rango.hasta) - aUtc(rango.desde)) / 86_400_000 + 1;
  if (dias <= DIAS_MAXIMOS_POR_DIA) return "dia";
  return dias <= SEMANAS_MAXIMAS * 7 ? "semana" : "mes";
}

const es = <T extends string>(lista: readonly T[], valor: string | undefined): valor is T =>
  lista.includes(valor as T);

/**
 * `?g_<clave>=plata,semana,acum`: los tres valores en cualquier orden. Un valor que no sirve se ignora y
 * rige el predeterminado: es un filtro de lectura, no una escritura.
 */
export function leerConfigDeGrafica(
  valor: string | undefined,
  predeterminada: ConfigDeGrafica,
): ConfigDeGrafica {
  const config = { ...predeterminada };
  for (const parte of (valor ?? "").split(",")) {
    const token = parte.trim();
    if (es(UNIDADES, token)) config.unidad = token;
    else if (es(PASOS, token)) config.paso = token;
    else if (es(FORMAS, token)) config.forma = token;
  }
  return config;
}

export const claveEnUrl = (clave: string) => `g_${clave}`;

export function escribirConfigDeGrafica(config: ConfigDeGrafica, opciones?: { sinUnidad?: boolean }): string {
  return opciones?.sinUnidad
    ? [config.paso, config.forma].join(",")
    : [config.unidad, config.paso, config.forma].join(",");
}

export interface Tramo extends Rango {
  /** El texto corto del eje: "4 nov", "Sem. 2 nov", "oct 2026". */
  etiqueta: string;
  /** Aún no termina: su último día natural es hoy o después. */
  enCurso: boolean;
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "4 nov": el año ya lo dice el periodo. */
export function diaCorto(dia: string): string {
  return `${Number(dia.slice(8, 10))} ${MESES_CORTOS[Number(dia.slice(5, 7)) - 1]}`;
}

export function nombreDeMes(mes: string): string {
  const nombre = NOMBRES_DE_MES[Number(mes.slice(5, 7)) - 1];
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

function finDeMes(dia: string): string {
  const [anio, mes] = dia.split("-").map(Number);
  const siguiente = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${String(mes + 1).padStart(2, "0")}-01`;
  return sumarDias(siguiente, -1);
}

/**
 * Los tramos del eje X sobre el rango, recortado a hoy (no hay datos del futuro). Semana de lunes a domingo,
 * mes calendario; el primero y el último se recortan a los bordes del rango. Un tramo cuyo último día natural
 * llega a hoy o más allá se marca "en curso": no es comparable con uno completo.
 */
export function tramosDe(rango: Rango, paso: Paso, hoy: string): Tramo[] {
  const hasta = rango.hasta < hoy ? rango.hasta : hoy;
  if (hasta < rango.desde) return [];
  const recortado = { desde: rango.desde, hasta };
  if (paso === "dia") {
    const dias: Tramo[] = [];
    for (let dia = recortado.desde; dia <= hasta; dia = sumarDias(dia, 1)) {
      dias.push({ desde: dia, hasta: dia, etiqueta: diaCorto(dia), enCurso: dia >= hoy });
    }
    return dias;
  }
  if (paso === "semana") {
    return semanasDelRango(recortado).map((semana) => ({
      ...semana,
      etiqueta: `Sem. ${diaCorto(semana.desde)}`,
      enCurso: sumarDias(lunesDe(semana.desde), 6) >= hoy,
    }));
  }
  const meses: Tramo[] = [];
  for (let inicio = recortado.desde; inicio <= hasta; inicio = sumarDias(finDeMes(inicio), 1)) {
    const fin = finDeMes(inicio);
    meses.push({
      desde: inicio,
      hasta: fin < hasta ? fin : hasta,
      etiqueta: `${nombreDeMes(inicio).slice(0, 3).toLowerCase()} ${inicio.slice(0, 4)}`,
      enCurso: fin >= hoy,
    });
  }
  return meses;
}

/** El eje lleva "(en curso)" en el tramo que aún no termina, para no leerlo como una caída. */
export function etiquetaDeTramo(tramo: Tramo): string {
  return tramo.enCurso ? `${tramo.etiqueta} (en curso)` : tramo.etiqueta;
}

/**
 * Un valor por tramo a partir de lo que pasó cada día. `Por paso` suma el tramo; `Acumulado` suma desde el
 * primer día del eje hasta el último del tramo. Más allá de `hastaDatos` (la comparación que ya se acabó) el
 * valor es `null`: nunca se prolonga una línea como si hubiera datos, y un tramo de B a medias tampoco se
 * pinta contra uno completo de A.
 */
export function valoresPorTramo(
  porDia: ReadonlyMap<string, number>,
  tramos: readonly Tramo[],
  forma: Forma,
  hastaDatos?: string,
): Array<number | null> {
  let acumulado = 0;
  return tramos.map((tramo) => {
    let delTramo = 0;
    for (let dia = tramo.desde; dia <= tramo.hasta; dia = sumarDias(dia, 1)) delTramo += porDia.get(dia) ?? 0;
    acumulado += delTramo;
    if (hastaDatos !== undefined && tramo.hasta > hastaDatos) return null;
    return forma === "acum" ? acumulado : delTramo;
  });
}

/**
 * Pone los días de B sobre los de A, día a día desde su primer día (el día N de venta de C2 contra el día N
 * de C3). Devuelve los valores de B en el calendario de A y el último día de A con datos de B.
 */
export function desplazarAlEjeDeA(
  porDiaDeB: ReadonlyMap<string, number>,
  a: Rango,
  b: Rango,
): { porDia: Map<string, number>; hastaDatos: string } {
  const salto = (aUtc(a.desde) - aUtc(b.desde)) / 86_400_000;
  const porDia = new Map<string, number>();
  for (const [dia, valor] of porDiaDeB) {
    if (dia < b.desde || dia > b.hasta) continue;
    porDia.set(sumarDias(dia, salto), valor);
  }
  return { porDia, hastaDatos: sumarDias(b.hasta, salto) };
}

const partirOrigen = (origen: string): [string, URLSearchParams] => {
  const corte = origen.indexOf("?");
  return corte === -1 ? [origen, new URLSearchParams()] : [origen.slice(0, corte), new URLSearchParams(origen.slice(corte + 1))];
};

/** La configuración de una gráfica leída de la URL de la pantalla (su `origen`, ruta con query). */
export function configDeGraficaEnOrigen(
  origen: string,
  clave: string,
  predeterminada: ConfigDeGrafica,
  opciones?: { unidadFija?: Unidad },
): ConfigDeGrafica {
  const [, query] = partirOrigen(origen);
  const leida = leerConfigDeGrafica(query.get(claveEnUrl(clave)) ?? undefined, predeterminada);
  return opciones?.unidadFija ? { ...leida, unidad: opciones.unidadFija } : leida;
}

/** El enlace que cambia UN interruptor de UNA gráfica y deja todo lo demás de la URL como está. */
export function hrefConConfigDeGrafica(
  origen: string,
  clave: string,
  config: ConfigDeGrafica,
  opciones?: { sinUnidad?: boolean },
): string {
  const [ruta, query] = partirOrigen(origen);
  query.set(claveEnUrl(clave), escribirConfigDeGrafica(config, opciones));
  return `${ruta}?${query.toString()}`;
}

/**
 * Para series que ya vienen acumuladas por punto (los hábiles de Deals contra agendas): el índice del último
 * punto cuyo día no pasa del final de cada tramo, o -1 si todavía no hay ninguno.
 */
export function indicesDeTramos(dias: readonly string[], tramos: readonly Tramo[]): number[] {
  return tramos.map((tramo) => {
    let indice = -1;
    for (let i = 0; i < dias.length && dias[i] <= tramo.hasta; i++) indice = i;
    return indice;
  });
}

/**
 * Un valor por tramo a partir de una serie acumulada por punto. `Acumulado` lee el acumulado al cierre del
 * tramo; `Por paso` resta el del tramo anterior. Un punto que falta (la comparación ya se acabó) da `null`.
 */
export function valoresDeAcumulado(
  acumulado: ReadonlyArray<number | null | undefined>,
  indices: readonly number[],
  forma: Forma,
): Array<number | null> {
  const alCierre = (indice: number) => (indice < 0 ? 0 : (acumulado[indice] ?? null));
  return indices.map((indice, k) => {
    const actual = alCierre(indice);
    if (actual === null) return null;
    if (forma === "acum") return actual;
    const anterior = k === 0 ? 0 : alCierre(indices[k - 1]);
    return anterior === null ? null : actual - anterior;
  });
}
