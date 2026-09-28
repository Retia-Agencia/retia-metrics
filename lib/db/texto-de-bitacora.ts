/**
 * Como se escribe un valor de columna en `change_log`, que guarda todo como texto
 * (`valor_anterior` / `valor_nuevo` son `text`).
 *
 * UNA sola funcion, que importan el molde de catalogo (`lib/catalogo/molde.ts`) y el
 * rastro operativo (`lib/crm/rastro.ts`): las dos responden la MISMA pregunta —"¿como
 * se ve este valor en la bitacora?"— asi que la respuesta vive en un modulo y los dos
 * lo importan (regla dura del repo). Antes estaba copiada byte a byte en los dos, y las
 * dos copias hacian `String(valor)`, que sobre un objeto o un arreglo da la cadena
 * inutil `"[object Object]"`.
 *
 * 🩸 Ese `String(valor)` no solo ensuciaba la bitacora: rompia el DIFF de la edicion.
 * El molde y el rastro deciden que cambio comparando `aTexto(actual) !== aTexto(nuevo)`,
 * y editar un campo jsonb (por ejemplo `sources.mapeo_columnas` desde `/ajustes/fuentes`)
 * daba `"[object Object]" !== "[object Object]"` = `false`. Resultado: el cambio no se
 * registraba EN change_log y, cuando el jsonb era lo UNICO que cambiaba, el `update`
 * tampoco se escribia (el molde corta con `if (cambiados.length === 0) return actual`).
 * Un cambio real desaparecia sin lanzar ningun error.
 *
 * Las reglas, en orden:
 *
 *  - `null` / `undefined` → `null`: "este campo esta ausente". La bitacora lo distingue
 *    de una cadena vacia.
 *  - `Date` → ISO 8601 (`toISOString`): estable y comparable, nunca la representacion
 *    local dependiente de la zona del proceso.
 *  - objeto o arreglo → `JSON.stringify` con las llaves ordenadas de forma estable, en
 *    todos los niveles. El orden estable es lo que hace que el diff sea honesto: dos
 *    objetos con el mismo contenido y distinto orden de llaves NO deben parecer un
 *    cambio (un `{ a, b }` que llega como `{ b, a }` desde otra fuente no es una edicion).
 *  - lo demas (number, boolean, bigint, string) → `String(valor)`.
 */
export function textoDeBitacora(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") return JSON.stringify(ordenarEstable(valor));
  return String(valor);
}

/**
 * Devuelve una copia del valor con las llaves de todo objeto ordenadas de forma estable
 * (alfabetica), recursivamente. Los arreglos conservan su orden —el orden de un arreglo
 * SI es dato— pero sus elementos se recorren igual. Los valores primitivos y las fechas
 * se devuelven tal cual; una fecha anidada la serializa `JSON.stringify` como su ISO.
 *
 * No usa el parametro `replacer` de `JSON.stringify` porque ese solo puede filtrar u
 * ordenar por lista fija de llaves, no reordenar llaves arbitrarias de objetos anidados.
 */
function ordenarEstable(valor: unknown): unknown {
  if (valor === null || typeof valor !== "object") return valor;
  if (valor instanceof Date) return valor;
  if (Array.isArray(valor)) return valor.map(ordenarEstable);
  const entradas = Object.entries(valor as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const ordenado: Record<string, unknown> = {};
  for (const [llave, v] of entradas) ordenado[llave] = ordenarEstable(v);
  return ordenado;
}
