import { construirEnvio, type EntradaEnvio } from "@/lib/ingesta/envio";
import type { CampoEnvio } from "@/lib/ingesta/envio";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";

/**
 * La logica PURA del traslado unico desde Sheets (ticket 111): que pestanas se leen y
 * como se cuentan las filas antes de escribir. No lee ni escribe la base ni la hoja;
 * de eso se encarga `scripts/trasladar-desde-sheets.ts`, que le pasa lo que ya cargo.
 *
 * Lo que NO vive aca, a proposito, porque ya existe: leer la hoja (`lib/sheets/leer.ts`),
 * convertir una fila en `EntradaEnvio` (`entradasDesdeMatriz` en
 * `lib/ingesta/adaptador-sheets.ts`), construir el Envio y aplicar los centinelas
 * (`construirEnvio`), y escribir por la puerta unica (`ingerirEntradas`). Este modulo
 * solo decide QUE fuentes se trasladan y CUENTA, que es lo que el ticket pide reportar.
 */

/**
 * Una fila de `sources` reducida a lo que el traslado necesita. El script la arma
 * seleccionando de la base; el tipo se declara aca para poder probar `fuentesATrasladar`
 * sin base.
 */
export interface FuenteDeHoja {
  id: string;
  nombre: string;
  tipo: string;
  sheetId: string | null;
  tab: string | null;
  rango: string;
  tzFechas: string;
  mapeoColumnas: unknown;
  activo: boolean;
}

/** Una fuente lista para leer: todo lo que falta es la matriz de la hoja. */
export interface FuenteListaParaLeer {
  id: string;
  nombre: string;
  sheetId: string;
  tab: string;
  rango: string;
  zona: string;
  /** El mapeo YA traducido a `CampoEnvio`, listo para `entradasDesdeMatriz`. */
  mapeo: Partial<Record<CampoEnvio, string | string[]>>;
  /** Falsa en `Formulario anterior` (`Forms viejo`, ticket 079): entra igual, no se reactiva. */
  activo: boolean;
}

export type FuenteDescartada = {
  fuente: FuenteDeHoja;
  motivo: "no_es_google_sheet" | "sin_hoja";
};

/**
 * De la llave del vocabulario de la HOJA (`MAPEO_FORMULARIO`, lo que vive en
 * `sources.mapeoColumnas` de produccion) al `CampoEnvio` que consume la ingesta.
 *
 * 🩸 La misma discrepancia de vocabularios que resolvio `lib/ingesta/mapeo-webhook.ts`
 * para el webhook (`emailNormalizado` → `correo`, etc.): si el mapeo de la fuente se
 * pasara crudo a `entradasDesdeMatriz`, sus llaves (`emailNormalizado`, `fechaAplicacion`,
 * `estado`) no casarian con ningun `CampoEnvio` y se ignorarian EN SILENCIO, dejando solo
 * el defecto. A diferencia del webhook, en una HOJA el token, la fecha y el Estado SON
 * columnas (no salen de un sobre), asi que aca `token`, `fechaAplicacion` y `estado` SI
 * se traducen. `agenda` y los campos no promovidos (`ingresoDeclarado`, `cargo`, ...) no
 * son `CampoEnvio` y se omiten: quedan crudos en `respuestas`.
 */
const HOJA_A_CAMPO_ENVIO: Record<string, CampoEnvio> = {
  token: "token",
  emailNormalizado: "correo",
  correo: "correo",
  telefono: "telefono",
  nombre: "nombre",
  fechaAplicacion: "fechaEnvio",
  fechaEnvio: "fechaEnvio",
  estado: "estadoHoja",
  estadoHoja: "estadoHoja",
  utmSource: "utmSource",
  utmMedium: "utmMedium",
  utmCampaign: "utmCampaign",
};

/**
 * Traduce el `mapeoColumnas` guardado de una fuente (vocabulario de hoja) a los ajustes
 * de `CampoEnvio` que `entradasDesdeMatriz` sabe combinar sobre `MAPEO_ENVIO`. Solo pasa
 * las llaves que son un `CampoEnvio`; el resto se ignora a proposito (no son columnas
 * promovidas). Un `mapeoColumnas` nulo o que no sea objeto devuelve `{}` (todo por
 * defecto), en vez de reventar el traslado por una fila mal formada.
 */
export function mapeoEnvioDesdeHoja(
  mapeoColumnas: unknown,
): Partial<Record<CampoEnvio, string | string[]>> {
  if (mapeoColumnas === null || typeof mapeoColumnas !== "object" || Array.isArray(mapeoColumnas)) {
    return {};
  }
  const mapeo: Partial<Record<CampoEnvio, string | string[]>> = {};
  for (const [llave, patron] of Object.entries(mapeoColumnas as MapeoColumnas)) {
    const campo = HOJA_A_CAMPO_ENVIO[llave];
    if (campo !== undefined) mapeo[campo] = patron;
  }
  return mapeo;
}

/**
 * De las fuentes de un programa, cuales se trasladan.
 *
 * **La frontera del mapa de hojas (`docs/structure.md` §10) vive aca, en el TIPO de
 * fuente, no en una lista de nombres de pestana:** solo se lee lo que es una fuente
 * `google_sheet` registrada, que apunta a la pestana FUENTE de su formulario. Las
 * vistas derivadas (`_kpis`, `Dashboard*`) y los respaldos (`BK_*`, `Copia de ...`)
 * NO son fuentes: no tienen fila en `sources`, asi que es IMPOSIBLE que el traslado
 * las lea, en vez de solo desaconsejado. Leerlas romperia el dedup o inflaria los
 * conteos.
 *
 * Se incluyen las fuentes INACTIVAS a proposito: `Formulario anterior` (`Forms viejo`)
 * quedo inactiva pero sus 55 personas exclusivas necesitan sus envios (ticket 079), y
 * las de Sheets de hoy quedaron inactivas tras el corte al webhook (28-sep). El traslado
 * lee la hoja UNA vez; no reactiva ninguna fuente.
 *
 * Una fuente `google_sheet` sin `sheetId` o sin `tab` es configuracion incompleta: se
 * descarta con motivo (error visible), nunca se adivina la pestana.
 */
export function fuentesATrasladar(fuentes: FuenteDeHoja[]): {
  listas: FuenteListaParaLeer[];
  descartadas: FuenteDescartada[];
} {
  const listas: FuenteListaParaLeer[] = [];
  const descartadas: FuenteDescartada[] = [];
  for (const f of fuentes) {
    if (f.tipo !== "google_sheet") {
      descartadas.push({ fuente: f, motivo: "no_es_google_sheet" });
      continue;
    }
    if (!f.sheetId || !f.tab) {
      descartadas.push({ fuente: f, motivo: "sin_hoja" });
      continue;
    }
    listas.push({
      id: f.id,
      nombre: f.nombre,
      sheetId: f.sheetId,
      tab: f.tab,
      rango: f.rango,
      zona: f.tzFechas,
      mapeo: mapeoEnvioDesdeHoja(f.mapeoColumnas),
      activo: f.activo,
    });
  }
  return { listas, descartadas };
}

/** Lo que el ensayo cuenta de un conjunto de entradas, ANTES de escribir. */
export interface ResumenDeEntradas {
  /** Filas de datos leidas de la hoja (ya sin la de encabezados ni las vacias). */
  filas: number;
  /** Correos unicos, con el dedup del proyecto (`normalizarEmail`): la llave del lead. */
  correosUnicos: number;
  /** Filas sin token: no llegan a ser un envio (`construirEnvio` las rechaza). */
  sinToken: number;
  /** Filas con token pero sin correo reconocible: entran como envio, sin lead por correo. */
  sinCorreo: number;
  /**
   * Filas con token cuya fecha era un CENTINELA (`1/1/0001`, `30/12/1899`) o ilegible:
   * `parsearFecha` la devuelve `null` y el envio entra como PARCIAL. Se cuenta aparte
   * porque una fecha centinela tratada como real envenena el dedup (🩸 839 de 1.034).
   */
  fechasCentinela: number;
}

/**
 * Cuenta lo que la hoja traeria, corriendo cada fila por la MISMA `construirEnvio` que
 * la escritura, para que el ensayo no invente su propia idea de "sin token" ni de
 * "centinela". No escribe nada: es el conteo que el modo ensayo reporta sin tocar la base.
 *
 * Los correos unicos se cuentan con el correo YA normalizado que produce `construirEnvio`
 * (`envio.identidad.correo`), que es la llave del dedup por `(programa, correo)`: contar
 * sobre filas crudas inflaria las tasas ~60% (AGENTS.md).
 */
export function resumirEntradas(entradas: EntradaEnvio[]): ResumenDeEntradas {
  const correos = new Set<string>();
  let sinToken = 0;
  let sinCorreo = 0;
  let fechasCentinela = 0;

  for (const e of entradas) {
    const r = construirEnvio(e);
    if (!r.ok) {
      sinToken++;
      continue;
    }
    const { envio } = r;
    if (envio.identidad.correo === null) sinCorreo++;
    else correos.add(envio.identidad.correo);
    // Una fila que trae texto de fecha pero `parsearFecha` la volvio null es un
    // centinela o algo ilegible. Una fila sin celda de fecha (parcial legitimo) no se
    // cuenta como centinela.
    const encabezadoFecha = e.campos.fechaEnvio;
    const celdaFecha = encabezadoFecha === undefined ? undefined : e.columnas[encabezadoFecha];
    const tieneTextoDeFecha = String(celdaFecha ?? "").trim() !== "";
    if (envio.fechaEnvio === null && tieneTextoDeFecha) fechasCentinela++;
  }

  return {
    filas: entradas.length,
    correosUnicos: correos.size,
    sinToken,
    sinCorreo,
    fechasCentinela,
  };
}

/**
 * Aparta las filas cuyo token el programa YA tiene como envio, venga de la fuente que
 * venga. La hoja y el webhook traen el MISMO token de respuesta de Typeform, pero la
 * idempotencia de la ingesta es por `(fuente, token, es_parcial)`: sin este filtro, lo
 * que entro por el webhook desde el 28-sep volveria a entrar como envio de la hoja y le
 * subiria las aplicaciones al lead. Esas filas no son faltantes: ya estan en el CRM.
 *
 * Una fila sin token pasa (la ingesta la rechaza y el ensayo la cuenta como `sinToken`).
 */
export function apartarLasQueYaEntraron(
  entradas: EntradaEnvio[],
  tokensDelPrograma: ReadonlySet<string>,
): { nuevas: EntradaEnvio[]; yaEnElCrm: number } {
  const nuevas: EntradaEnvio[] = [];
  let yaEnElCrm = 0;
  for (const e of entradas) {
    const r = construirEnvio(e);
    if (r.ok && tokensDelPrograma.has(r.envio.token)) yaEnElCrm++;
    else nuevas.push(e);
  }
  return { nuevas, yaEnElCrm };
}
