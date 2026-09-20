/**
 * Deteccion de errores del driver de Postgres por su codigo SQLSTATE.
 *
 * Drizzle 0.45 envuelve el error del driver, asi que el codigo no siempre esta en
 * el error de arriba: hay que caminar la cadena de `cause` (posiblemente anidada).
 * La misma pregunta —"¿este error es de tal codigo?"— vivia copiada byte a byte en
 * cuatro modulos de mutaciones y catalogo; por la regla de AGENTS.md ("si dos
 * lugares responden la MISMA pregunta, la respuesta vive en un modulo y los dos la
 * importan") vive aca y ellos la importan.
 */

/** Cuantos niveles de `cause` se recorren antes de rendirse. */
const NIVELES_DE_CAUSA = 5;

/**
 * Camina el error y su cadena de `cause` buscando el codigo SQLSTATE dado. Es la
 * base parametrizada de los detectores concretos de abajo.
 */
export function esCodigoPostgres(error: unknown, codigo: string): boolean {
  let actual: unknown = error;
  for (let i = 0; i < NIVELES_DE_CAUSA && actual != null; i++) {
    if (typeof actual === "object" && (actual as { code?: unknown }).code === codigo) {
      return true;
    }
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}

/** Violacion de indice unico (SQLSTATE `23505`). */
export function esViolacionUnica(error: unknown): boolean {
  return esCodigoPostgres(error, "23505");
}

/** Violacion de un CHECK (SQLSTATE `23514`). */
export function esViolacionCheck(error: unknown): boolean {
  return esCodigoPostgres(error, "23514");
}

/**
 * Violacion de una llave foranea al borrar: quedan filas que apuntan a esta
 * (SQLSTATE `23503` foreign_key_violation, o `23001` restrict_violation).
 *
 * Es el codigo que la base devuelve cuando un `DELETE` choca contra una FK con accion
 * `restrict`. En el borrado del catalogo (ADR 0026 punto 5) es la RED del caso de
 * carrera: `borrarSiNoSeUso` cuenta las referencias y solo borra si son cero, pero
 * entre el conteo y el `DELETE` alguien pudo usar la fila. Sin este detector esa
 * carrera sale como 500; con el, como el 400 legible que pide el criterio del ticket
 * 030.
 *
 * Se reconocen los DOS codigos a proposito: Postgres/Neon lanza `23503`, pero PGlite
 * —la base de los tests— reporta `23001` para la misma situacion (`RESTRICT`). Los dos
 * significan lo mismo: hay filas que dependen de esta y no se puede borrar. Vive aca,
 * sobre `esCodigoPostgres`, y no como una copia local del bucle de `cause`.
 */
export function esViolacionForanea(error: unknown): boolean {
  return esCodigoPostgres(error, "23503") || esCodigoPostgres(error, "23001");
}
