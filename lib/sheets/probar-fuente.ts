import { leerPestana } from "./leer";
import {
  normalizarTexto,
  resolverColumnas,
  OBLIGATORIOS_FORMULARIO,
  type MapeoColumnas,
} from "./mapeo";
import { combinarMapeo, type OrigenDelCampo } from "./plantilla-lead";

/**
 * Probar el mapeo de una fuente contra la hoja REAL (ticket 016, ADR 0019).
 *
 * Lee los encabezados con la cuenta de servicio, combina el mapeo campo por campo
 * (fuente → plantilla del programa → defecto) y corre `resolverColumnas`. Devuelve
 * que encabezado tomo cada campo y de que nivel salio el patron, o LANZA el
 * `MapeoInvalidoError` de `mapeo.ts` (422) con el campo que falto y los encabezados
 * reales. No se adivina: un mapeo que no cuadra falla ruidosamente.
 *
 * De aca cuelga la decision del ticket 016 punto 5: NO se guarda una bandera
 * "ultima prueba ok" que envejeceria en cuanto cambia el mapeo o la pestana. En vez
 * de eso, activar una fuente corre esta prueba en ese momento (ver
 * `lib/catalogo/fuentes.ts`). El boton "Probar" de la pantalla usa lo mismo como
 * herramienta de edicion.
 */

/** Una columna resuelta: el campo, el encabezado que la alimenta y de que nivel salio. */
export interface ColumnaResuelta {
  campo: string;
  /** El encabezado real de la hoja que quedo mapeado a este campo. */
  encabezado: string;
  /** De que nivel salio el patron que gano (fuente, programa o defecto). */
  origen: OrigenDelCampo;
}

export interface ResultadoPrueba {
  columnas: ColumnaResuelta[];
}

/** Datos minimos para probar una fuente: su hoja, su pestana y su mapeo propio. */
export interface DatosParaProbar {
  sheetId: string;
  tab: string;
  rango?: string;
  mapeoColumnas: MapeoColumnas | null;
}

/**
 * Corre la prueba de mapeo. La base ya cargo la plantilla del programa; esta
 * funcion no toca la base, solo Google Sheets. Lanza `MapeoInvalidoError` (422) si
 * un campo obligatorio no encuentra columna.
 *
 * IMPORTANTE (S-13 y privacidad): esta funcion NO escribe los encabezados en logs.
 * Los encabezados son las preguntas del formulario; solo viajan en la respuesta a
 * quien pidio la prueba (un administrador autenticado), igual que el detalle de un
 * `MapeoInvalidoError` vive en `sync_runs.errores` y no en el log publico del cron.
 */
export async function probarMapeoDeFuente(
  datos: DatosParaProbar,
  plantillaLead: MapeoColumnas | null,
): Promise<ResultadoPrueba> {
  const matriz = await leerPestana(datos.sheetId, datos.tab, datos.rango);
  const encabezados = (matriz[0] ?? []).map((h) => String(h ?? "").trim());

  const { mapeo, origen } = combinarMapeo(datos.mapeoColumnas, plantillaLead);

  // Lanza MapeoInvalidoError si falta un obligatorio. No se captura aca: el llamador
  // (server action / activar) decide como presentarlo. Es un 422 con el detalle.
  const indices = resolverColumnas(encabezados, mapeo, OBLIGATORIOS_FORMULARIO);

  const columnas: ColumnaResuelta[] = [];
  for (const [campo, patron] of Object.entries(mapeo)) {
    const i = indices[campo];
    // resolverColumnas solo incluye los campos que encontro; los no obligatorios que
    // no aparecen se omiten del reporte (no hay columna que mostrar). El patron se
    // conserva por si el llamador lo quiere, pero lo que importa es el encabezado.
    void patron;
    if (i === undefined) continue;
    columnas.push({
      campo,
      encabezado: encabezados[i] ?? "",
      origen: origen[campo] ?? "defecto",
    });
  }

  // Orden estable por campo para que la pantalla no baile entre pruebas.
  columnas.sort((a, b) => normalizarTexto(a.campo).localeCompare(normalizarTexto(b.campo)));

  return { columnas };
}
