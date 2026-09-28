import { combinarMapeo } from "@/lib/sheets/plantilla-lead";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";
import type { CampoEnvio } from "./envio";
import type { MapeoWebhook } from "./adaptador-typeform";

/**
 * El mapeo de una fuente webhook, resuelto con la MISMA precedencia y el MISMO modulo
 * que la hoja (ticket 106, tarea B; ADR 0019, ADR 0055): la fuente gana sobre la
 * plantilla del programa, y la plantilla sobre el defecto. Reusa `combinarMapeo`; no es
 * una segunda copia de esa logica (regla de AGENTS.md: una pregunta, un modulo).
 *
 * ⚠️ **La discrepancia de vocabularios, resuelta en UN solo lugar (aqui).** El mapeo de
 * la hoja —el que ya vive en `production` en `sources.mapeoColumnas` y en
 * `programs.plantillaLead`, y el que `MAPEO_FORMULARIO` define por defecto— habla en un
 * vocabulario distinto del `CampoEnvio` que consume la ingesta:
 *
 *   hoja (`MAPEO_FORMULARIO`)          →  Envio (`CampoEnvio`)
 *   ─────────────────────────────────────────────────────────
 *   emailNormalizado                   →  correo
 *   telefono                           →  telefono
 *   nombre                             →  nombre
 *   utmSource / utmMedium / utmCampaign→  (igual)
 *   agenda                             →  campoAgenda (no es un CampoEnvio)
 *
 * Antes el webhook leia `sources.mapeoColumnas` como si sus llaves ya fueran de
 * `CampoEnvio` (`mapeoDeFuente` en la ruta): las llaves reales de produccion
 * (`emailNormalizado`, `fechaAplicacion`, `estado`, ...) no casaban con ningun
 * `CampoEnvio` y se ignoraban en SILENCIO —el correo mapeado a mano no se usaba y solo
 * salvaba el defecto—. Y nunca combinaba con la plantilla del programa, asi que la
 * pantalla que ofrece "deja un campo sin ajuste para heredarlo de la plantilla" mentia
 * para un webhook. Esta funcion cierra las dos cosas.
 *
 * **Los campos que en un webhook salen del SOBRE, no de una pregunta, se excluyen a
 * proposito** (`token`, `fechaEnvio`/`fechaAplicacion`, `estadoHoja`/`estado`): el
 * adaptador de Typeform los toma de columnas reservadas (`__token`, `__submitted_at`,
 * `__estado`), no del titulo de una pregunta. Traducirlos aqui los dejaria pisar esas
 * columnas fijas y romperia la fecha, el token o el Estado. Un envio de webhook no trae
 * "Submitted At" como pregunta.
 *
 * Funcion PURA: no toca la base. El llamador (la ruta del webhook) carga
 * `sources.mapeoColumnas` y `programs.plantillaLead` y se los pasa.
 */

/**
 * De la llave del vocabulario de la hoja al `CampoEnvio`. Solo los campos de CONTENIDO
 * que un webhook resuelve por titulo de pregunta. `agenda` va aparte (`campoAgenda`).
 *
 * Ausentes a proposito: `token`, `fechaAplicacion` y `estado` (salen del sobre o de una
 * variable, no de una pregunta) y los campos que la ingesta no promueve
 * (`ingresoDeclarado`, `porQueAplico`, `cargo`, `capacidadInvertir`, `urgencia`): quedan
 * en `respuestas`. `estadoHoja` (punto E) se maneja aparte: es el NOMBRE de la variable
 * de Estado, no un `CampoEnvio`.
 */
const HOJA_A_CAMPO_ENVIO: Record<string, CampoEnvio> = {
  emailNormalizado: "correo",
  correo: "correo",
  telefono: "telefono",
  nombre: "nombre",
  utmSource: "utmSource",
  utmMedium: "utmMedium",
  utmCampaign: "utmCampaign",
};

/** La llave del mapeo de la hoja que nombra la pregunta de agenda (ADR 0054, 2a enmienda). */
const LLAVE_AGENDA = "agenda";

/**
 * La llave del mapeo que nombra la VARIABLE de Typeform que alimenta el Estado (punto
 * E, ADR 0012). Su valor es el NOMBRE de la variable, no un titulo de pregunta. Si la
 * fuente no la trae, el adaptador usa su defecto (`estado`).
 */
const LLAVE_ESTADO = "estadoHoja";

/**
 * Lo que devuelve `mapeoWebhookDesdeFuente`: el `MapeoWebhook` que consume el adaptador,
 * pero con `campos` SIEMPRE presente (nunca undefined). Se estrecha el tipo a proposito
 * para que el llamador no tenga que guardarse contra un `campos` inexistente.
 */
export type MapeoWebhookResuelto = MapeoWebhook & { campos: NonNullable<MapeoWebhook["campos"]> };

/**
 * Combina el mapeo de la fuente con la plantilla del programa (fuente ← programa ←
 * defecto) y lo traduce al `MapeoWebhook` que consume el adaptador de Typeform.
 *
 * El `defecto` de `combinarMapeo` es `MAPEO_FORMULARIO` (el mismo que la hoja): asi un
 * campo sin ajuste en la fuente ni en la plantilla cae al patron por defecto, igual que
 * en el sync de Sheets. La traduccion descarta los campos que no son de `CampoEnvio`
 * (los del sobre y los no promovidos) sin adivinar.
 */
export function mapeoWebhookDesdeFuente(
  mapeoFuente: MapeoColumnas | null | undefined,
  plantillaLead: MapeoColumnas | null | undefined,
): MapeoWebhookResuelto {
  const { mapeo, origen } = combinarMapeo(mapeoFuente ?? null, plantillaLead ?? null);

  const campos: Partial<Record<CampoEnvio, string | string[]>> = {};
  let campoAgenda: string | undefined;
  let variableEstado: string | undefined;

  for (const [llave, patron] of Object.entries(mapeo)) {
    if (llave === LLAVE_AGENDA) {
      // 🩸 `agenda` SOLO cuenta si la puso la fuente o la plantilla del programa, NUNCA
      // el defecto del codigo (ADR 0054, 2a enmienda: cual pregunta es la de agenda es
      // CONFIGURACION, no una heuristica). `MAPEO_FORMULARIO` trae un patron de agenda
      // por defecto que le sirve a la hoja pero que aqui subiria un envio a
      // `con_calendly` sin que nadie lo configurara. `origen` lo distingue.
      if (origen[LLAVE_AGENDA] === "defecto") continue;
      // `agenda` es el TITULO de la pregunta de Calendly. Si viniera como lista, se toma
      // el primer patron: `campoAgenda` es un solo titulo (el adaptador lo resuelve
      // contra las columnas reales, insensible a acentos/mayusculas).
      campoAgenda = Array.isArray(patron) ? patron[0] : patron;
      continue;
    }
    if (llave === LLAVE_ESTADO) {
      // El NOMBRE de la variable que alimenta el Estado (punto E). No viene del defecto
      // (`MAPEO_FORMULARIO` no tiene `estadoHoja`): solo si la fuente o la plantilla lo
      // configuran. Si no, el adaptador usa su propio defecto (`estado`).
      variableEstado = Array.isArray(patron) ? patron[0] : patron;
      continue;
    }
    const campo = HOJA_A_CAMPO_ENVIO[llave];
    if (campo !== undefined) campos[campo] = patron;
  }

  return { campos, campoAgenda, variableEstado };
}
