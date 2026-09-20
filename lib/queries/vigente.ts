import { isNull, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";

/**
 * LA definicion de "este registro cuenta" (ADR 0026 punto 3, ADR 0024).
 *
 * Una llamada, una venta o un abono anulados desaparecen de TODA metrica. El peligro
 * de esa regla no es escribirla: es olvidarla en una consulta. Una cifra sin el
 * filtro **sale inflada y no lanza ningun error** — dos pantallas muestran numeros
 * distintos de lo mismo y nadie se entera hasta que el dinero no cuadra. Es el mismo
 * fallo que costo la primera version de `/nerd-stats` (conteos en cero, sin
 * excepcion).
 *
 * Por eso el predicado vive aca y ninguna consulta vuelve a escribir
 * `isNull(anuladoEn)` a mano. La regla la enforza `tests/vigencia-centralizada.test.ts`,
 * que recorre `lib/queries/` cadena por cadena y falla si una lee `calls`, `sales` o
 * `abonos` sin pasar por este modulo.
 */

/**
 * Las filas de `tabla` que siguen contando.
 *
 * Acepta tambien tablas que NO se anulan (`people`, `programs`…) y para ellas
 * devuelve "verdadero". No es un fallo silencioso: una tabla sin anulacion tiene
 * todas sus filas vigentes, asi que esa es la respuesta correcta a la pregunta. Lo
 * necesita `conteosPorPrograma` en `/nerd-stats`, que recibe la tabla por parametro
 * y cuenta sobre cuatro tablas distintas, solo tres de ellas anulables.
 */
export function vigente(tabla: PgTable): SQL {
  const columna = columnaDeAnulacion(tabla);
  return columna ? isNull(columna) : SIEMPRE;
}

/**
 * Marca explicita de que esta consulta **quiere** ver lo anulado, y por eso no
 * filtra. Es una condicion que no filtra nada; lo que aporta es el nombre.
 *
 * Existe por el ADR 0026 punto 4: el historial de `/personas/[id]` muestra lo anulado
 * tachado, con quien y cuando, porque "aqui hubo una venta que se anulo porque el
 * pago se cayo" es informacion, no ruido. Esconderlo ahi convertiria la anulacion en
 * un borrado con otro nombre.
 *
 * La regla es **fuera de las metricas, dentro del historial**. Escrito asi, "incluir
 * lo anulado" es una decision visible en el diff y en el grep, no un filtro que
 * alguien olvido: es justo lo que el guardian existe para distinguir.
 *
 * **Segundo uso legitimo, agregado el 20-sep (ticket 030):** contar referencias antes
 * de borrar una fila de catalogo. Esta nota estaba escrita como "este es el unico caso
 * legitimo" y dejo de ser cierta, asi que se corrige en vez de dejar que el comentario
 * mienta. La razon es buena y no afloja nada: la FK `restrict` de la base **no
 * distingue una venta viva de una anulada** —las dos bloquean el `DELETE`—, asi que
 * contar solo lo vigente daria cero y la app ofreceria borrar algo que la base va a
 * rechazar. Ademas una fila referenciada por un registro anulado SI se uso. Aqui no se
 * esta midiendo nada: se esta preguntando si alguien apunta a esta fila.
 */
export function incluyendoAnulados(tabla: PgTable): SQL {
  // El argumento no se usa: esta para que la consulta diga SOBRE QUE tabla tomo la
  // decision, y para que el guardian la vea. Un comentario no se puede grepear con
  // la misma confianza que una llamada.
  void tabla;
  return SIEMPRE;
}

/** Condicion neutra, para las tablas que no se anulan. */
const SIEMPRE = sql`true`;

/** La columna `anulado_en` de la tabla, o `undefined` si no se anula. */
function columnaDeAnulacion(tabla: PgTable): PgColumn | undefined {
  const columna = (tabla as unknown as Record<string, unknown>).anuladoEn;
  return columna as PgColumn | undefined;
}
