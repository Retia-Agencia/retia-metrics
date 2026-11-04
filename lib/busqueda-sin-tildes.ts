import { sql, type SQL, type SQLWrapper } from "drizzle-orm";

/**
 * Una sola respuesta a "¿este texto casa con lo que se buscó?": `Cesar` y `César`, o
 * `Nunez` y `Núñez`, son la misma búsqueda. `sinTildes` es la mitad de TypeScript (filtros
 * en memoria y en el cliente) y `casaSinTildes` la de SQL. Este módulo no toca la base,
 * así que un componente cliente sí lo puede importar.
 *
 * SQL usa `translate` y no la extensión `unaccent`: no pide migración y da lo mismo en
 * Postgres y en PGlite. La mayúscula con tilde va en la lista porque `lower` no la baja
 * con un locale C, y `normalize` junta la tilde que llega como carácter aparte.
 */
const CON_TILDE = "áàâäãåéèêëíìîïóòôöõúùûüñçÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇ";
const SIN_TILDE = "aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC";

/** El texto en minúsculas y sin tildes, listo para comparar. */
export function sinTildes(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** La condición SQL: la columna contiene `busqueda`, sin importar tildes ni mayúsculas. */
export function casaSinTildes(columna: SQLWrapper, busqueda: string): SQL {
  const patron = `%${sinTildes(busqueda).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return sql`lower(translate(normalize(${columna}, NFC), ${CON_TILDE}, ${SIN_TILDE})) like ${patron}`;
}
