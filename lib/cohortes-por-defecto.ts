/**
 * Meta de leads por día hábil con la que nace una cohorte (decisión de Mani, 8-nov, ticket 396).
 * Es solo el valor inicial: se cambia por cohorte en Programa. Módulo puro, sin base, para que lo
 * importen la columna (`lib/db/schema.ts`), el esquema del catálogo y la pantalla.
 */
export const META_LEADS_DIA_POR_DEFECTO = 50;
