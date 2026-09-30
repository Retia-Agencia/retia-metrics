import { combinarMapeo } from "@/lib/sheets/plantilla-lead";
import { MapeoInvalidoError, type MapeoColumnas } from "@/lib/sheets/mapeo";
import type { CampoEnvio } from "./envio";
import type { MapeoWebhook } from "./adaptador-typeform";

/**
 * El mapeo de una fuente webhook, resuelto con la MISMA precedencia y el MISMO modulo
 * que la hoja (ticket 106, tarea B; ADR 0019, ADR 0055): la fuente gana sobre la
 * plantilla del programa, y NO hay defecto del codigo (ticket 117). Reusa `combinarMapeo`; no es
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
  utmId: "utmId",
  utmContent: "utmContent",
  utmTerm: "utmTerm",
};

/** El webhook no hereda el defecto de la hoja (ticket 117): solo fuente y programa. */
const SIN_DEFECTO: MapeoColumnas = {};

/** La llave del mapeo de la hoja que nombra la pregunta de agenda (ADR 0054, 2a enmienda). */
const LLAVE_AGENDA = "agenda";

/**
 * La llave del mapeo que nombra la VARIABLE de Typeform que alimenta el Estado (punto
 * E, ADR 0012). Su valor es el NOMBRE de la variable, no un titulo de pregunta. Si la
 * fuente no la trae, el adaptador usa su defecto (`estado`).
 */
const LLAVE_ESTADO = "estadoHoja";

/**
 * La llave del mapeo que nombra la VARIABLE de Typeform que trae el SCORE (ticket 070,
 * decision del 29-sep). Su valor es el NOMBRE de la variable, no un titulo de pregunta.
 * Igual que `estadoHoja`, es configuracion por fuente (ADR 0012). **Sin defecto:** si la
 * fuente no la trae, el adaptador no lee ningun score y `puntaje` queda null.
 */
const LLAVE_PUNTAJE = "puntaje";
const LLAVE_LEAD_QUALITY = "leadQuality";
const LLAVE_LEAD_VALUE = "leadValue";

/**
 * Lo que devuelve `mapeoWebhookDesdeFuente`: el `MapeoWebhook` que consume el adaptador,
 * pero con `campos` SIEMPRE presente (nunca undefined). Se estrecha el tipo a proposito
 * para que el llamador no tenga que guardarse contra un `campos` inexistente.
 */
export type MapeoWebhookResuelto = MapeoWebhook & { campos: NonNullable<MapeoWebhook["campos"]> };

/**
 * Combina el mapeo de la fuente con la plantilla del programa (fuente ← programa) y lo
 * traduce al `MapeoWebhook` que consume el adaptador de Typeform.
 *
 * **Sin defecto del codigo** (ticket 117, B4 del 114): cayo al `MAPEO_FORMULARIO` de la
 * hoja, que tiene escritos los titulos de pregunta de los Typeform de hoy, y un
 * formulario nuevo con otra redaccion habria entrado con el correo de una pregunta que
 * nadie configuro. Un programa sin plantilla y una fuente sin mapeo del correo fallan
 * con `MapeoInvalidoError`, ruidosamente. La traduccion descarta los campos que no son de
 * `CampoEnvio` (los del sobre y los no promovidos) sin adivinar.
 */
export function mapeoWebhookDesdeFuente(
  mapeoFuente: MapeoColumnas | null | undefined,
  plantillaLead: MapeoColumnas | null | undefined,
  opciones: { correoPorDefecto?: boolean } = {},
): MapeoWebhookResuelto {
  const resuelto = traducirMapeo(mapeoFuente, plantillaLead);
  // El correo es la llave del lead (ADR 0005): sin saber que pregunta lo trae, cada envio
  // entraria "sin lead" en silencio. Se falla aqui, antes de leer ningun envio. La unica
  // salida es un proveedor cuyo payload trae el correo en una llave FIJA que su adaptador
  // conoce (Dapta: `email`, ticket 130); Typeform no, porque ahi el correo es un titulo de
  // pregunta que solo la configuracion sabe.
  if (resuelto.campos.correo === undefined && !opciones.correoPorDefecto) {
    throw new MapeoInvalidoError(
      "correo",
      ["(ningún patrón: ni la fuente ni la plantilla del programa dicen qué pregunta trae el correo, llave emailNormalizado)"],
      [],
    );
  }
  return resuelto;
}

/**
 * Solo el titulo de la pregunta de agenda, para quien relee un envio ya guardado ("buscar
 * llamada", 096) y no va a ingerir nada: no exige el correo.
 */
export function campoAgendaDeFuente(
  mapeoFuente: MapeoColumnas | null | undefined,
  plantillaLead: MapeoColumnas | null | undefined,
): string | undefined {
  return traducirMapeo(mapeoFuente, plantillaLead).campoAgenda;
}

function traducirMapeo(
  mapeoFuente: MapeoColumnas | null | undefined,
  plantillaLead: MapeoColumnas | null | undefined,
): MapeoWebhookResuelto {
  const { mapeo } = combinarMapeo(mapeoFuente ?? null, plantillaLead ?? null, SIN_DEFECTO);

  const campos: Partial<Record<CampoEnvio, string | string[]>> = {};
  let campoAgenda: string | undefined;
  let variableEstado: string | undefined;
  let variablePuntaje: string | undefined;
  let variableLeadQuality: string | undefined;
  let variableLeadValue: string | undefined;

  for (const [llave, patron] of Object.entries(mapeo)) {
    if (llave === LLAVE_AGENDA) {
      // `agenda` solo la pone la fuente o la plantilla del programa (ADR 0061 punto 4:
      // cual pregunta es la de agenda es CONFIGURACION, no una heuristica).
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
    if (llave === LLAVE_PUNTAJE) {
      // El NOMBRE de la variable que trae el score (ticket 070). Sin defecto en el
      // codigo: solo la fuente o la plantilla lo configuran. Si no, `puntaje` es null.
      variablePuntaje = Array.isArray(patron) ? patron[0] : patron;
      continue;
    }
    if (llave === LLAVE_LEAD_QUALITY) {
      variableLeadQuality = Array.isArray(patron) ? patron[0] : patron;
      continue;
    }
    if (llave === LLAVE_LEAD_VALUE) {
      variableLeadValue = Array.isArray(patron) ? patron[0] : patron;
      continue;
    }
    const campo = HOJA_A_CAMPO_ENVIO[llave];
    if (campo !== undefined) campos[campo] = patron;
  }

  return { campos, campoAgenda, variableEstado, variablePuntaje, variableLeadQuality, variableLeadValue };
}
