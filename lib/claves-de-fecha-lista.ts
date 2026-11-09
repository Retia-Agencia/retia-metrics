/**
 * Las claves de la URL que mueve el filtro de fecha de una lista. Vive en `lib/` (no en el componente
 * cliente) porque lo leen paginas de servidor: un valor exportado de un archivo `"use client"` llega al
 * servidor como referencia, no como arreglo, y `[...CLAVES]` revienta al renderizar (Calls, 9-nov, 360).
 */
export const CLAVES_DE_PERIODO = ["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta"];
/** Las claves de antes del 136 (`desde`, `hasta`, `rango`): un marcador viejo no debe decidir el periodo. */
export const CLAVES_VIEJAS = ["rango", "desde", "hasta"];

/** Todas las claves de la URL que mueve este filtro: para que "Quitar todo" las limpie (ticket 202). */
export const CLAVES_DE_FECHA_LISTA = ["fecha", ...CLAVES_DE_PERIODO, ...CLAVES_VIEJAS];
