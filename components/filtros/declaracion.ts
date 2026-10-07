/**
 * El modelo declarativo de la barra de lista (ticket 202).
 *
 * Cada pantalla DECLARA sus filtros como datos —nombre en la URL, etiqueta, opciones,
 * el valor "todos" y si va a la vista o al popover— y la barra deriva de esa lista todo
 * lo demas: los chips a la vista, el contenido del popover, el conteo de activos, las
 * etiquetas activas y las claves que borra "Quitar todo". Un filtro nuevo es una
 * entrada, no un componente (A-105, Baymard: lo popular a la vista, el resto guardado).
 *
 * Este archivo es PURO: no importa React ni `lib/db`. Sus helpers tienen tests en
 * `tests/filtros-url.test.ts`. La barra (`barra-de-lista.tsx`) y las piezas que pintan
 * viven aparte.
 */

/** Una opcion de un filtro de seleccion simple. */
export interface OpcionDeFiltro {
  value: string;
  label: string;
}

/**
 * Un filtro declarado por una pantalla. Hoy solo hay seleccion simple (`select`); la API
 * deja sitio para agregar seleccion multiple despues sin romperla (fuera de alcance).
 */
export interface FiltroDeclarado {
  tipo: "select";
  /** El nombre del parametro en la URL. NO cambia entre versiones (enlaces guardados). */
  nombre: string;
  /** La etiqueta corta ("Deal", "Calidad"): encabeza el chip y la fila del popover. */
  etiqueta: string;
  opciones: OpcionDeFiltro[];
  /** El texto del valor "todos" (sin filtrar). Por defecto "Todos". */
  todos?: string;
  /** `true` lo pinta como chip a la vista; `false` lo guarda en el popover. */
  aVista: boolean;
  /**
   * Un filtro compuesto (el periodo, un rango de fechas) ocupa UNA entrada en la lista
   * pero limpia VARIAS claves de la URL. Si no se declara, se limpia solo `nombre`.
   */
  clavesExtra?: string[];
}

/** Lo que la barra necesita leer de la URL: el valor de un parametro, o `null`. */
export type LectorDeUrl = (nombre: string) => string | null;

/** El valor vigente de un filtro, o `null` si esta en "todos". */
export function valorDeFiltro(filtro: FiltroDeclarado, leer: LectorDeUrl): string | null {
  const valor = leer(filtro.nombre);
  return valor === null || valor === "" ? null : valor;
}

/** La etiqueta legible del valor vigente de un filtro (lo que ve el usuario en el chip). */
export function etiquetaDelValor(filtro: FiltroDeclarado, valor: string): string {
  return filtro.opciones.find((o) => o.value === valor)?.label ?? valor;
}

/** ¿Esta activo este filtro (tiene un valor distinto de "todos")? */
export function filtroActivo(filtro: FiltroDeclarado, leer: LectorDeUrl): boolean {
  return valorDeFiltro(filtro, leer) !== null;
}

/**
 * Cuantos filtros DEL POPOVER estan activos: es la `n` de "Filtros · n". Los chips a la
 * vista no cuentan, porque ya se ven; el popover guarda el resto (Baymard).
 */
export function activosEnPopover(filtros: FiltroDeclarado[], leer: LectorDeUrl): number {
  return filtros.filter((f) => !f.aVista && filtroActivo(f, leer)).length;
}

/**
 * Las claves de la URL que borra "Quitar todo" (y "Quitar filtros" del popover): el
 * `nombre` de cada filtro mas sus `clavesExtra`. Sale de las declaraciones, nunca de un
 * arreglo escrito aparte (regla 4 del ticket). Sin duplicados y en orden estable.
 */
export function clavesABorrar(filtros: FiltroDeclarado[]): string[] {
  const claves = new Set<string>();
  for (const filtro of filtros) {
    claves.add(filtro.nombre);
    for (const extra of filtro.clavesExtra ?? []) claves.add(extra);
  }
  return [...claves];
}

/** Las claves del popover (sus `nombre` + `clavesExtra`): lo que borra "Quitar filtros". */
export function clavesDelPopover(filtros: FiltroDeclarado[]): string[] {
  return clavesABorrar(filtros.filter((f) => !f.aVista));
}

/** Una etiqueta activa, para la linea de estado: su filtro, el valor y el texto legible. */
export interface EtiquetaActiva {
  nombre: string;
  etiqueta: string;
  valor: string;
  texto: string;
  /** Las claves de la URL a borrar al quitar ESTA etiqueta (nombre + extras). */
  claves: string[];
}

/**
 * Las etiquetas activas de TODOS los filtros (a la vista y del popover), en el orden de
 * la declaracion. La linea de estado las pinta con × para quitar una (regla 3).
 */
export function etiquetasActivas(filtros: FiltroDeclarado[], leer: LectorDeUrl): EtiquetaActiva[] {
  const activas: EtiquetaActiva[] = [];
  for (const filtro of filtros) {
    const valor = valorDeFiltro(filtro, leer);
    if (valor === null) continue;
    activas.push({
      nombre: filtro.nombre,
      etiqueta: filtro.etiqueta,
      valor,
      texto: etiquetaDelValor(filtro, valor),
      claves: [filtro.nombre, ...(filtro.clavesExtra ?? [])],
    });
  }
  return activas;
}

/** ¿Hay algun filtro activo (a la vista o en el popover)? Decide si se muestra "Quitar todo". */
export function hayAlgunActivo(filtros: FiltroDeclarado[], leer: LectorDeUrl): boolean {
  return filtros.some((f) => filtroActivo(f, leer));
}
