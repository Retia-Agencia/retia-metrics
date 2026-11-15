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

function* recorrerCausas(error: unknown): Generator<unknown> {
  let actual: unknown = error;
  for (let i = 0; i < NIVELES_DE_CAUSA && actual != null; i++) {
    yield actual;
    actual = typeof actual === "object" ? (actual as { cause?: unknown }).cause : undefined;
  }
}

/**
 * Camina el error y su cadena de `cause` buscando el codigo SQLSTATE dado. Es la
 * base parametrizada de los detectores concretos de abajo.
 */
export function esCodigoPostgres(error: unknown, codigo: string): boolean {
  for (const actual of recorrerCausas(error)) {
    if (typeof actual === "object" && (actual as { code?: unknown }).code === codigo) {
      return true;
    }
  }
  return false;
}

const MENSAJES_DE_TIEMPO_AGOTADO = [
  "Query read timeout",
  "timeout exceeded when trying to connect",
  "unable to check out connection",
];

/** Consulta o espera de conexion cancelada por alcanzar su tope. */
export function esTiempoAgotado(error: unknown): boolean {
  if (esCodigoPostgres(error, "57014")) return true;
  for (const actual of recorrerCausas(error)) {
    if (
      actual instanceof Error &&
      MENSAJES_DE_TIEMPO_AGOTADO.some((mensaje) => actual.message.includes(mensaje))
    ) {
      return true;
    }
  }
  return false;
}

/** Violacion de indice unico (SQLSTATE `23505`). */
export function esViolacionUnica(error: unknown): boolean {
  return esCodigoPostgres(error, "23505");
}

/** Violacion de una restriccion EXCLUDE (SQLSTATE `23P01`). */
export function esViolacionExclusion(error: unknown): boolean {
  return esCodigoPostgres(error, "23P01");
}

/** Violacion de un CHECK (SQLSTATE `23514`). */
export function esViolacionCheck(error: unknown): boolean {
  return esCodigoPostgres(error, "23514");
}

/**
 * El nombre del CONSTRAINT que un error del driver reporta, o `null`. Camina la misma
 * cadena de `cause` que `esCodigoPostgres`. node-postgres y PGlite lo exponen en
 * `constraint`; `constraint_name` conserva compatibilidad con errores historicos. Sirve para
 * distinguir DOS CHECK sobre la
 * misma tabla (p. ej. las cohortes tienen `cohorts_activa_con_inicio_ventas` y
 * `cohorts_definida_si_no_es_futura`) y dar a cada uno su mensaje.
 */
export function nombreDeConstraint(error: unknown): string | null {
  for (const actual of recorrerCausas(error)) {
    if (typeof actual === "object") {
      const o = actual as { constraint_name?: unknown; constraint?: unknown };
      if (typeof o.constraint_name === "string") return o.constraint_name;
      if (typeof o.constraint === "string") return o.constraint;
    }
  }
  return null;
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
