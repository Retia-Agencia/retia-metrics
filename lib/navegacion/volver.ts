/**
 * "Volver a donde estaba" (ticket 174, A-57): el origen de una pantalla de detalle viaja en
 * la URL (`?desde=<ruta>`) y este modulo es la UNICA via de leerlo, armarlo y etiquetarlo.
 * Puro, sin imports de `lib/db`: entra al bundle del cliente.
 *
 * El `desde` es una ruta INTERNA (empieza por `/`, nunca `//` ni un esquema): un `desde`
 * externo o malformado es un open redirect, asi que se ignora y se cae a la lista natural
 * del objeto. Ninguna pantalla concatena `desde` a mano; lo garantiza el guardian del test.
 */

/** El tope de largo de un `desde`: una URL con muchos filtros, nunca un payload. */
const LARGO_MAXIMO = 1500;

/**
 * Valida un `desde` como ruta interna y devuelve su path+query, o `null`.
 *
 * Acepta solo cadenas que empiezan por un unico `/` (ni `//` ni `/\`, que un navegador lee
 * como host), sin esquema (`:` antes del primer `/` o `?`), sin caracteres de control ni
 * espacios, y de largo acotado.
 */
export function origenValido(desde: string | null | undefined): string | null {
  if (typeof desde !== "string") return null;
  if (desde.length === 0 || desde.length > LARGO_MAXIMO) return null;
  if (desde[0] !== "/") return null;
  // `//host` y `/\host` los lee el navegador como una URL con host: no son internos.
  if (desde[1] === "/" || desde[1] === "\\") return null;
  // Caracteres de control o espacios (incluye saltos de linea, tabs y el espacio normal).
  if (/[\u0000-\u0020\u007f]/.test(desde)) return null;
  // Un esquema (`javascript:`, `https:`) mete `:` antes de empezar el path o el query.
  const corte = desde.search(/[/?]/);
  const antesDeLaRuta = corte === -1 ? desde : desde.slice(0, corte);
  if (antesDeLaRuta.includes(":")) return null;
  return desde;
}

/**
 * Arma un enlace a un detalle con el origen pegado como `?desde=`. UNICA via: ninguna
 * pantalla concatena `desde` a mano.
 *
 * Si `origen` no es un origen valido, devuelve `href` tal cual (no se mete basura a la URL).
 * Reemplaza un `desde` previo del href para que no se acumulen.
 */
export function enlaceConVuelta(href: string, origen: string): string {
  const valido = origenValido(origen);
  if (!valido) return quitarDesde(href);
  const base = quitarDesde(href);
  const separador = base.includes("?") ? "&" : "?";
  return `${base}${separador}desde=${encodeURIComponent(valido)}`;
}

/** Quita un parametro `desde` del href si lo trae, conservando el resto del query. */
function quitarDesde(href: string): string {
  const posicion = href.indexOf("?");
  if (posicion === -1) return href;
  const ruta = href.slice(0, posicion);
  const partes = href
    .slice(posicion + 1)
    .split("&")
    .filter((p) => p !== "" && p !== "desde" && !p.startsWith("desde="));
  return partes.length > 0 ? `${ruta}?${partes.join("&")}` : ruta;
}

/** Separa el path y el query de un origen (ya validado). */
function partirRuta(origen: string): { path: string; query: string } {
  const posicion = origen.indexOf("?");
  if (posicion === -1) return { path: origen, query: "" };
  return { path: origen.slice(0, posicion), query: origen.slice(posicion + 1) };
}

/**
 * El nombre de la lista de la que vino, por su path. Lo que no se reconoce es "Atras".
 * Si el origen trae un filtro (cualquier query distinto de `pagina`, `vista`, `tab` y `seccion`), agrega
 * " · filtrados": la lista no esta en su estado natural.
 */
export function etiquetaDeOrigen(origen: string): string {
  const { path, query } = partirRuta(origen);
  const base = etiquetaDePath(path);
  return estaFiltrado(query) ? `${base} · filtrados` : base;
}

/** El nombre base por el path, sin mirar el query. */
function etiquetaDePath(path: string): string {
  // Las fichas: `/p/<slug>/deals/<id>` y `/p/<slug>/leads/<id>` (van antes que las listas).
  if (/^\/p\/[^/]+\/deals\/[^/]+$/.test(path)) return "Deal";
  if (/^\/p\/[^/]+\/leads\/[^/]+$/.test(path)) return "Lead";
  // Las listas por programa.
  if (/^\/p\/[^/]+\/deals$/.test(path)) return "Deals";
  if (/^\/p\/[^/]+\/leads$/.test(path)) return "Leads";
  if (/^\/p\/[^/]+\/students$/.test(path)) return "Students";
  if (/^\/p\/[^/]+\/dashboard\/lista$/.test(path)) return "Dashboard · lista";
  if (/^\/p\/[^/]+\/dashboard$/.test(path)) return "Dashboard";
  // Las listas sin programa en la ruta.
  if (path === "/calls" || /^\/p\/[^/]+\/calls$/.test(path)) return "Calls";
  if (path === "/inbox" || /^\/p\/[^/]+\/inbox$/.test(path)) return "Inbox";
  if (path === "/dashboard/lista") return "Dashboard · lista";
  if (path === "/dashboard") return "Dashboard";
  if (path === "/nerd-stats") return "Nerd stats";
  if (path === "/mi-espacio") return "Mi espacio";
  return "Atras";
}

/**
 * ¿El origen esta filtrado? Cualquier query cuenta como filtrado, salvo que solo traiga
 * `pagina`, `vista`, `tab` o `seccion`: pasar de pagina, cambiar la vista (Tabla/Kanban) o
 * cambiar de pestaña (Mi espacio, o la pieza `Pestanas` del 193) no cambia los filtros. No se inventan nombres de parametro: lo que
 * exista cuenta.
 */
const PARAMETROS_QUE_NO_FILTRAN = new Set(["pagina", "vista", "tab", "seccion"]);

function estaFiltrado(query: string): boolean {
  return query
    .split("&")
    .filter((p) => p !== "")
    .some((p) => !PARAMETROS_QUE_NO_FILTRAN.has(p.split("=")[0]));
}

/** El destino de "Volver": el origen si es valido, con su etiqueta; si no, el por defecto. */
export function destinoDeVolver(
  desde: string | null | undefined,
  porDefecto: { href: string; etiqueta: string },
): { href: string; etiqueta: string } {
  const valido = origenValido(desde);
  if (!valido) return porDefecto;
  return { href: valido, etiqueta: etiquetaDeOrigen(valido) };
}

/**
 * El origen de la pagina actual (path + query) desde su `searchParams`, para pasarlo por
 * props a los enlaces de lista. Un arreglo repite el parametro; `undefined` se omite.
 */
export function origenDeLaPagina(
  pathname: string,
  searchParams: Record<string, string | string[] | undefined>,
): string {
  const u = new URLSearchParams();
  for (const [clave, valor] of Object.entries(searchParams)) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) valor.forEach((v) => u.append(clave, v));
    else u.append(clave, valor);
  }
  const query = u.toString();
  return query ? `${pathname}?${query}` : pathname;
}
