import { leerPestana } from "./leer";
import { resolverColumnas, type MapeoColumnas } from "./mapeo";
import { MAPEO_ENVIO } from "@/lib/ingesta/adaptador-sheets";

/**
 * Lee los TOKENS de envio de una pestana de Google Sheets (ticket 110, conciliacion).
 *
 * Vive en su propio archivo a proposito: el ticket 111 (traslado) esta tocando el resto
 * de `lib/sheets/` en paralelo, y la conciliacion solo necesita la columna `token`, no
 * el envio completo. Reusa la misma resolucion de columnas por TEXTO del encabezado
 * (`resolverColumnas`, ADR 0019) y el mapeo por defecto del adaptador de hojas, para
 * que "el token de la hoja" signifique lo mismo aqui y en la ingesta.
 *
 * NO escribe en la hoja (la conciliacion es de solo lectura, ticket 110). Solo lee la
 * columna del token; el resto de la fila no importa para "¿este envio ya esta en el CRM?".
 */

/**
 * Los tokens de la pestana fuente de una hoja. Se resuelve la columna `token` por texto
 * (permitiendo el mapeo propio de la fuente encima del defecto), se recorren las filas y
 * se junta cada token no vacio. Un token repetido en la hoja (la parcial y la completa
 * comparten token) entra una sola vez: la pregunta es de presencia, no de conteo.
 */
export async function tokensDeHoja(
  sheetId: string,
  tab: string,
  opciones: { rango?: string; mapeo?: MapeoColumnas | null } = {},
): Promise<Set<string>> {
  const matriz = await leerPestana(sheetId, tab, opciones.rango);
  const encabezados = (matriz[0] ?? []).map((h) => String(h ?? "").trim());

  const mapeo = { token: MAPEO_ENVIO.token, ...(opciones.mapeo ?? {}) } as MapeoColumnas;
  // `token` es obligatorio: sin columna de token no se puede conciliar, y adivinar seria
  // peor que fallar (misma disciplina que el sync, `MapeoInvalidoError`).
  const indices = resolverColumnas(encabezados, mapeo, ["token"]);
  const i = indices.token;

  const tokens = new Set<string>();
  for (let r = 1; r < matriz.length; r++) {
    const valor = String(matriz[r]?.[i] ?? "").trim();
    if (valor !== "") tokens.add(valor);
  }
  return tokens;
}
