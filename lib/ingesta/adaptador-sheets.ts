import { resolverColumnas, ZONA_BOGOTA, type MapeoColumnas } from "@/lib/sheets/mapeo";
import type { CampoEnvio, EntradaEnvio } from "./envio";

/**
 * El adaptador de Google Sheets (ticket 048): convierte una pestana en entradas de la
 * ingesta. Todo lo que es propio de una HOJA vive aqui y en ningun otro lado (la
 * posicion, los encabezados, el rango); lo que es propio de un ENVIO vive en
 * `construirEnvio`, que no sabe de donde vino la entrada.
 */

/** Donde buscar cada campo en los formularios de hoy. Se resuelve por texto (ADR 0019). */
export const MAPEO_ENVIO: Record<CampoEnvio, string> = {
  token: "token",
  correo: "correo electronico",
  telefono: "whatsapp",
  fechaEnvio: "submitted at",
  estadoHoja: "estado",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
};

/**
 * Sin estas columnas no hay envio que construir, y el sync se detiene con
 * `MapeoInvalidoError` en vez de adivinar. Es sobre la COLUMNA, no la celda: un parcial
 * abandonado antes del correo es un envio legitimo con la celda vacia.
 */
export const OBLIGATORIOS_ENVIO: CampoEnvio[] = ["token", "correo", "fechaEnvio"];

export interface OpcionesDeFuente {
  sourceId: string;
  /** `sources.tz_fechas`. Bogota si no se dice (ticket 053). */
  zona?: string;
  mapeo?: Partial<Record<CampoEnvio, string | string[]>>;
}

export function entradasDesdeMatriz(matriz: unknown[][], fuente: OpcionesDeFuente): EntradaEnvio[] {
  const crudos = (matriz[0] ?? []).map((h) => String(h ?? "").trim());

  // Se lee hasta el ultimo encabezado no vacio: una columna nueva entra sola, y lo que
  // haya mas a la derecha sin encabezado no es parte del formulario.
  let ultimo = crudos.length - 1;
  while (ultimo >= 0 && crudos[ultimo] === "") ultimo--;
  const encabezados = llavesUnicas(crudos.slice(0, ultimo + 1));

  const mapeo = { ...MAPEO_ENVIO, ...fuente.mapeo } as MapeoColumnas;
  const indices = resolverColumnas(crudos.slice(0, ultimo + 1), mapeo, OBLIGATORIOS_ENVIO);
  const campos: Partial<Record<CampoEnvio, string>> = {};
  for (const [campo, i] of Object.entries(indices)) campos[campo as CampoEnvio] = encabezados[i];

  const entradas: EntradaEnvio[] = [];
  for (let r = 1; r < matriz.length; r++) {
    const fila = matriz[r] ?? [];
    if (!fila.some((c) => String(c ?? "").trim() !== "")) continue;
    const columnas: Record<string, unknown> = {};
    encabezados.forEach((h, i) => {
      columnas[h] = fila[i] ?? "";
    });
    entradas.push({
      sourceId: fuente.sourceId,
      zona: fuente.zona ?? ZONA_BOGOTA,
      // La fila real de la hoja: la matriz empieza en la 1, que es el encabezado.
      posicion: r + 1,
      columnas,
      campos,
    });
  }
  return entradas;
}

/**
 * Dos columnas con el mismo encabezado se pisarian en `respuestas` sin error (🩸 las
 * hojas de gestion tienen encabezados corridos). La segunda se llama "Notas (2)". Una
 * columna sin encabezado entre otras con encabezado conserva su dato con un nombre
 * que dice lo que es.
 */
function llavesUnicas(encabezados: string[]): string[] {
  const vistos = new Map<string, number>();
  return encabezados.map((h, i) => {
    const base = h === "" ? `(sin encabezado, columna ${i + 1})` : h;
    const n = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, n);
    return n === 1 ? base : `${base} (${n})`;
  });
}
