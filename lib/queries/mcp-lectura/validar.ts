/**
 * Validación previa de `consultar_datos` (ADR 0135). NO es la barrera: la barrera es la base (rol sin acceso a
 * `public`, alcance fijado por el servidor, transacción de solo lectura, tiempo y filas topados). Esto solo
 * da errores en palabras de negocio antes de gastar una conexión, y rechaza lo obvio.
 *
 * Es un recorrido léxico: ignora comentarios, cadenas, identificadores entre comillas y bloques `$$`, y revisa
 * las palabras que quedan.
 */

const INICIOS_VALIDOS = new Set(["select", "with", "values", "table"]);

const PALABRAS_DE_ESCRITURA = new Set([
  "insert", "update", "delete", "merge", "truncate", "drop", "alter", "create", "grant", "revoke", "copy", "call", "do",
  "execute", "prepare", "deallocate", "vacuum", "analyze", "reindex", "cluster", "listen", "notify", "unlisten",
  "lock", "refresh", "comment", "set", "reset", "show", "begin", "commit", "rollback", "savepoint", "release",
  "declare", "move", "discard", "load", "import", "into",
]);

const FUNCIONES_PROHIBIDAS = new Set([
  "set_config", "fijar_alcance", "query_to_xml", "query_to_xml_and_xmlschema", "table_to_xml", "schema_to_xml",
  "database_to_xml", "cursor_to_xml", "dblink", "dblink_exec", "lo_import", "lo_export", "pg_read_file",
  "pg_read_binary_file", "pg_ls_dir", "pg_terminate_backend", "pg_cancel_backend", "current_setting",
]);

const ESQUEMAS_AJENOS = new Set(["public", "pg_catalog", "information_schema", "auth", "storage", "extensions", "pg_temp"]);

export type ResultadoDeValidacion =
  | { ok: true; sql: string; vistas: string[] }
  | { ok: false; mensaje: string };

const rechazo = (mensaje: string): ResultadoDeValidacion => ({ ok: false, mensaje });

interface Recorrido {
  palabras: string[];
  /** Posición (en el texto limpio) del primer `;`, o -1. */
  puntoYComa: number;
  /** Texto sin comentarios, con cadenas e identificadores entre comillas intactos. */
  limpio: string;
  /** Falló el cierre de una cadena, un comentario o un bloque. */
  abierto: string | null;
}

function recorrer(texto: string): Recorrido {
  const palabras: string[] = [];
  let limpio = "";
  let puntoYComa = -1;
  let i = 0;
  const n = texto.length;
  const esInicioDePalabra = (c: string) => /[A-Za-z_]/.test(c);
  const esParteDePalabra = (c: string) => /[A-Za-z0-9_$]/.test(c);
  while (i < n) {
    const c = texto[i];
    const siguiente = texto[i + 1];
    if (c === "-" && siguiente === "-") {
      while (i < n && texto[i] !== "\n") i++;
      limpio += " ";
      continue;
    }
    if (c === "/" && siguiente === "*") {
      let nivel = 1;
      i += 2;
      while (i < n && nivel > 0) {
        if (texto[i] === "/" && texto[i + 1] === "*") { nivel++; i += 2; }
        else if (texto[i] === "*" && texto[i + 1] === "/") { nivel--; i += 2; }
        else i++;
      }
      if (nivel > 0) return { palabras, puntoYComa, limpio, abierto: "un comentario /* sin cerrar" };
      limpio += " ";
      continue;
    }
    if (c === "'" || c === '"') {
      const anterior = limpio.at(-1);
      const conEscapes = c === "'" && (anterior === "e" || anterior === "E") && !/[A-Za-z0-9_]/.test(limpio.at(-2) ?? " ");
      const inicio = i;
      i++;
      let cerrada = false;
      while (i < n) {
        if (conEscapes && texto[i] === "\\") { i += 2; continue; }
        if (texto[i] === c) {
          if (texto[i + 1] === c) { i += 2; continue; }
          i++;
          cerrada = true;
          break;
        }
        i++;
      }
      if (!cerrada) return { palabras, puntoYComa, limpio, abierto: c === "'" ? "una cadena sin cerrar" : "un identificador entre comillas sin cerrar" };
      limpio += texto.slice(inicio, i);
      continue;
    }
    if (c === "$") {
      const etiqueta = /^\$[A-Za-z_]*\$/.exec(texto.slice(i));
      if (etiqueta) {
        const fin = texto.indexOf(etiqueta[0], i + etiqueta[0].length);
        if (fin === -1) return { palabras, puntoYComa, limpio, abierto: "un bloque $$ sin cerrar" };
        limpio += texto.slice(i, fin + etiqueta[0].length);
        i = fin + etiqueta[0].length;
        continue;
      }
    }
    if (c === ";" && puntoYComa === -1) puntoYComa = limpio.length;
    if (esInicioDePalabra(c)) {
      let j = i + 1;
      while (j < n && esParteDePalabra(texto[j])) j++;
      palabras.push(texto.slice(i, j).toLowerCase());
      limpio += texto.slice(i, j);
      i = j;
      continue;
    }
    limpio += c;
    i++;
  }
  return { palabras, puntoYComa, limpio, abierto: null };
}

/** Acepta un solo SELECT (o WITH … SELECT, VALUES, TABLE) y devuelve el texto sin `;` final. */
export function validarSoloSelect(texto: string, vistasConocidas: readonly string[]): ResultadoDeValidacion {
  const entrada = texto.trim();
  if (!entrada) return rechazo("Escribe una consulta SELECT.");
  const { palabras, puntoYComa, limpio, abierto } = recorrer(entrada);
  if (abierto) return rechazo(`La consulta tiene ${abierto}.`);
  const sinFinal = limpio.replace(/[\s;]+$/u, "");
  if (puntoYComa !== -1 && puntoYComa < sinFinal.length) {
    return rechazo("Solo se permite una consulta por llamada: quita el «;» del medio y envía un solo SELECT.");
  }
  for (const palabra of palabras) {
    if (PALABRAS_DE_ESCRITURA.has(palabra)) {
      return rechazo(`No se permite «${palabra.toUpperCase()}»: esta herramienta solo lee. Para cambiar datos usa preparar_accion.`);
    }
    if (FUNCIONES_PROHIBIDAS.has(palabra)) {
      return rechazo(`No se permite usar «${palabra}»: la herramienta fija sola el alcance y no permite leer ajustes ni archivos.`);
    }
    if (ESQUEMAS_AJENOS.has(palabra)) {
      return rechazo(`Solo existen las vistas del esquema mcp_lectura (no «${palabra}»). Llama definiciones_de_metricas para ver sus columnas.`);
    }
  }
  const primera = palabras[0];
  if (!primera || !INICIOS_VALIDOS.has(primera)) {
    return rechazo("Solo se permite leer: la consulta debe empezar con SELECT (o WITH … SELECT). Para cambiar datos usa preparar_accion.");
  }
  const vistas = vistasConocidas.filter((vista) => new RegExp(`(?:^|[^A-Za-z0-9_])(?:mcp_lectura\\s*\\.\\s*)?${vista}(?![A-Za-z0-9_])`, "i").test(sinFinal.replace(/'(?:[^']|'')*'/g, " ")));
  return { ok: true, sql: sinFinal, vistas };
}
