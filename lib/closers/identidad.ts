import { sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { users } from "@/lib/db/schema";

/**
 * Cuando dos textos nombran al MISMO closer (ADR 0030).
 *
 * `closerId` es texto copiado, no una relacion (ADR 0011): vive en `users`, en
 * `calls` y en `abonos` (`sales` y el responsable de `people` salieron con la
 * migracion 0020), y lo producen
 * dos fuentes que no se hablan — la columna Closer de las hojas, que escribe gente
 * a mano, y el formulario de la app. Comparar ese texto en crudo hace que `Mani` y
 * `mani` sean dos closers distintos en todas las metricas, **sin un solo error**:
 * el comparativo muestra dos filas, el filtro por closer devuelve la mitad, y
 * nadie se entera porque las dos cifras se ven creibles.
 *
 * Paso de verdad el 18-sep: el primer `closer_id` cargado en `production` quedo en
 * `mani` mientras el de la otra closer era `Maru`.
 *
 * **La respuesta a "¿son el mismo closer?" vive aca y en ningun otro lado** (ADR
 * 0024): quien compara en memoria usa `mismoCloser`, quien compara en SQL usa
 * `igualCloser`, y quien agrupa usa `claveDeCloser`. `tests/closer-identidad.test.ts`
 * recorre el codigo y falla si alguien vuelve a comparar la columna en crudo.
 *
 * **Lo que NO hace: cambiar como se escribe.** El texto se guarda como lo escribio
 * quien lo escribio, porque la hoja es la fuente de verdad de los leads (ADR 0004)
 * y su ortografia es suya, no nuestra. Solo la COMPARACION deja de mirar las
 * mayusculas. La garantia de que no existan dos cuentas reclamando el mismo closer
 * vive en un indice unico sobre `lower(closer_id)` (ADR 0005, migracion 0011).
 */

/**
 * Forma canonica de un `closerId` PARA COMPARAR. No es lo que se guarda ni lo que
 * se muestra.
 *
 * Minusculas, sin espacios en los bordes y con los espacios internos colapsados:
 * `"  Juan  Jose "` y `"juan jose"` son la misma persona escrita por dos manos.
 * Un texto que queda vacio es `null`, igual que "sin closer".
 */
export function normalizarCloserId(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  const limpio = valor.trim().replace(/\s+/g, " ").toLowerCase();
  return limpio.length > 0 ? limpio : null;
}

/**
 * Si dos textos nombran al mismo closer. Dos `null` son "los dos sin closer", que
 * a efectos de agrupar es lo mismo; para una comprobacion de permiso, el llamador
 * decide antes si un `null` puede pasar (hoy `closerDeLaSesion` ya lo impide).
 */
export function mismoCloser(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizarCloserId(a) === normalizarCloserId(b);
}

/**
 * Condicion SQL "esta columna es este closer", sin distinguir mayusculas.
 *
 * Se normaliza del lado de la columna con la misma receta que `normalizarCloserId`
 * (`lower` + `btrim` + colapso de espacios con `regexp_replace`) para que la
 * comparacion en SQL y la de memoria no puedan divergir. A la escala de este repo
 * (miles de filas, ADR sobre rendimiento en AGENTS.md) no tener indice funcional
 * sobre esto es irrelevante; si algun dia lo fuera, el indice se agrega aca.
 */
export function igualCloser(columna: PgColumn, valor: string): SQL {
  return sql`${claveDeCloserSql(columna)} = ${normalizarCloserId(valor)}`;
}

/**
 * La misma normalizacion de `normalizarCloserId`, expresada en SQL. Acepta una
 * columna o cualquier expresion: asi el test puede pasarle un literal y comprobar
 * contra Postgres que las dos normalizaciones no divergieron.
 */
export function claveDeCloserSql(columna: PgColumn | SQL) {
  return sql`regexp_replace(btrim(lower(${columna})), '[[:space:]]+', ' ', 'g')`;
}

/**
 * Clave para agrupar por closer en memoria, distinguiendo "sin closer" (`null`) del
 * texto vacio. El sentinel es un caracter que no puede venir de una hoja.
 */
export function claveDeCloser(valor: string | null | undefined): string {
  return normalizarCloserId(valor) ?? "\u0000sin-closer";
}

/**
 * La CLAVE de identidad de un closer para filtrar y agrupar metricas (ticket 167,
 * Decision 7). Un closer no es solo un texto: desde que `users.closer_id` es opcional
 * y las filas nuevas apuntan por FK (`abonos.registrado_por_user_id`,
 * `deals.owner_user_id`), hay DOS maneras de ser el mismo closer:
 *
 *  - **con cuenta**: su `users.id` (uuid). Es la identidad canonica.
 *  - **historica**: `historico:<texto normalizado>` para las filas viejas que solo
 *    traen el texto copiado (una llamada o un abono sin FK, un closer que ya no tiene
 *    cuenta). Nunca cae a una comparacion de texto cruda (ADR 0030): el texto se
 *    normaliza con `claveDeCloser`.
 *
 * Es exactamente la forma que ya produce `claveDeRegistradorDeAbono` en SQL
 * (`lib/queries/metricas-filtros.ts`): aqui vive su contraparte de TypeScript, para
 * que el que arma una `claveCloser` y el que la interpreta no puedan divergir.
 */
const PREFIJO_HISTORICO = "historico:";

export type ClaveCloser =
  | { tipo: "usuario"; userId: string }
  | { tipo: "historico"; clave: string };

/** La `claveCloser` de un closer con cuenta: su `users.id`. */
export function claveDeUsuario(userId: string): string {
  return userId;
}

/** La `claveCloser` de un closer solo historico (texto, sin cuenta). */
export function claveHistorica(texto: string | null | undefined): string {
  return `${PREFIJO_HISTORICO}${claveDeCloser(texto)}`;
}

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lee una `claveCloser` y dice si es una cuenta (uuid) o un historico. Un valor que
 * no es ni uuid ni `historico:...` no es una clave valida y devuelve `null`: el
 * llamador decide (hoy, no filtra, igual que un `null`).
 */
export function parsearClaveCloser(clave: string | null | undefined): ClaveCloser | null {
  if (clave == null) return null;
  if (clave.startsWith(PREFIJO_HISTORICO)) {
    return { tipo: "historico", clave: clave.slice(PREFIJO_HISTORICO.length) };
  }
  if (RE_UUID.test(clave)) return { tipo: "usuario", userId: clave };
  return null;
}

/**
 * La `claveCloser` en SQL: el `users.id` cuando la fila casa con una cuenta, y
 * `historico:<texto normalizado>` cuando no. Es la generalizacion de
 * `claveDeRegistradorDeAbono`: `columnaUserId` es la FK (puede ser `NULL`) y
 * `columnaTexto` es el texto copiado historico.
 */
export function claveCloserSql(columnaUserId: PgColumn | SQL, columnaTexto: PgColumn | SQL): SQL<string> {
  return sql<string>`case
    when ${columnaUserId} is not null then ${columnaUserId}::text
    else '${sql.raw(PREFIJO_HISTORICO)}' || coalesce(${claveDeCloserSql(columnaTexto)}, '')
  end`;
}

/**
 * Cómo se LEE un closer en el dashboard y sus listas (ticket 188): su `closer_id`, o su
 * nombre, o su correo; y para una fila histórica sin cuenta, el texto copiado de la fila.
 * Es la etiqueta, no la identidad: dos filas se juntan por `claveCloserSql`, nunca por
 * esto. Antes el comparativo usaba esta cadena y las listas solo `closer_id`, así que un
 * closer sin `closer_id` se leía con su nombre en una tabla y como "Sin closer" en su lista.
 */
export function etiquetaDeCloserSql(textoDeLaFila?: PgColumn | SQL): SQL<string | null> {
  return textoDeLaFila
    ? sql<string | null>`coalesce(${users.closerId}, ${users.nombre}, ${users.email}, ${textoDeLaFila})`
    : sql<string | null>`coalesce(${users.closerId}, ${users.nombre}, ${users.email})`;
}

/** La misma etiqueta en memoria, para lo que se calcula fuera de SQL (el embudo por etapas). */
export function etiquetaDeCloser(usuario: {
  closerId: string | null;
  nombre: string | null;
  email: string | null;
}): string | null {
  return usuario.closerId ?? usuario.nombre ?? usuario.email;
}
