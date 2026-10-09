/**
 * La preferencia de columnas extra de la lista de Leads (ticket 209): qué respuestas del
 * formulario mostrar, más si se muestra "Canal". Se recuerda POR usuario y programa en el
 * navegador (localStorage), nunca en la base: es una comodidad de vista, no un dato del negocio.
 *
 * Módulo PURO, sin imports de `lib/db`: entra al bundle del cliente. Toda lectura y escritura va
 * envuelta en try/catch; si el almacenamiento falla (modo privado, cuota, deshabilitado), se cae
 * a la preferencia por defecto (Canal visible, respuestas apagadas) sin romper la pantalla.
 */

/** Qué columnas extra están visibles. Por defecto la lista arranca como siempre: Canal visible y ninguna respuesta. */
export interface ColumnasFormulario {
  /** La columna "Canal" (une el selector, ticket 209; se puede ocultar). */
  canal: boolean;
  /** Las preguntas del formulario elegidas, por su texto tal como llegó (nunca escrito en código). */
  preguntas: string[];
}

export const COLUMNAS_POR_DEFECTO: ColumnasFormulario = { canal: true, preguntas: [] };

/**
 * La clave de localStorage: lleva el id del usuario y del programa para que la elección de uno no
 * se filtre a otra sesión ni a otro programa (el programa es frontera).
 */
export function claveDeColumnas(userId: string, programId: string): string {
  return `retia:leads:columnas:${userId}:${programId}`;
}

/** Un `Storage` como el `window.localStorage`, pasado por fuera para poder probarlo. */
export type AlmacenamientoLike = Pick<Storage, "getItem" | "setItem">;

/**
 * Lee la preferencia guardada. Un almacenamiento ausente o roto, un JSON inválido o una forma
 * inesperada caen a `COLUMNAS_POR_DEFECTO`: nunca lanza.
 */
export function leerColumnas(
  almacenamiento: AlmacenamientoLike | null | undefined,
  clave: string,
): ColumnasFormulario {
  if (!almacenamiento) return COLUMNAS_POR_DEFECTO;
  try {
    const crudo = almacenamiento.getItem(clave);
    if (!crudo) return COLUMNAS_POR_DEFECTO;
    const dato = JSON.parse(crudo) as unknown;
    if (dato === null || typeof dato !== "object") return COLUMNAS_POR_DEFECTO;
    const obj = dato as Record<string, unknown>;
    const canal = typeof obj.canal === "boolean" ? obj.canal : COLUMNAS_POR_DEFECTO.canal;
    const preguntas = Array.isArray(obj.preguntas)
      ? obj.preguntas.filter((p): p is string => typeof p === "string")
      : [];
    return { canal, preguntas };
  } catch {
    return COLUMNAS_POR_DEFECTO;
  }
}

/** Guarda la preferencia. Si el almacenamiento falla, no hace nada (y no lanza). */
export function guardarColumnas(
  almacenamiento: AlmacenamientoLike | null | undefined,
  clave: string,
  columnas: ColumnasFormulario,
): void {
  if (!almacenamiento) return;
  try {
    almacenamiento.setItem(clave, JSON.stringify(columnas));
  } catch {
    // Modo privado, cuota llena o almacenamiento deshabilitado: la vista sigue, sin recordar.
  }
}
