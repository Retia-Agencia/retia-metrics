import { z } from "zod";
import { recursos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";
import { reemplazarVersionado, type FilaVersionada } from "./versionar";

/**
 * Recursos como links (ADR 0017, ADR 0012), sobre el molde de catalogo.
 *
 * Un recurso es un link del equipo (brochure, pagina web, guion, formulario,
 * Calendly, Drive): se guarda el LINK, nunca el archivo. Tiene dos cosas propias
 * que el molde generico no expresa:
 *
 *  - **`vigente` + `reemplazaA` (historial).** `reemplazar(id, nuevaUrl)` crea una
 *    fila nueva vigente y baja la anterior sin borrarla. El orden de las dos
 *    escrituras y la exclusion mutua viven en `lib/catalogo/versionar.ts`.
 *  - **`programId` nulo = recurso global** (sirve para todos los programas). El
 *    indice unico parcial de la base usa `coalesce` para que dos globales vigentes
 *    con el mismo titulo y categoria SI choquen (Postgres trata dos NULL como
 *    distintos): ese choque debe salir como 409, nunca como 500.
 *
 * Un solo esquema zod. La URL solo puede ser https:// (ADR 0017). La base se recibe
 * por inyeccion (por defecto la de la app) para correr los tests sobre PGlite.
 */

/** id: uuid o error de validacion (400). */
const esquemaId = z.string().uuid("El identificador no es válido.");

/**
 * URL de un recurso o enlace de pago: obligatoria y SOLO https:// (ADR 0017). Se
 * reusa en `enlaces-pago.ts`. Un http:// se rechaza con mensaje claro.
 */
export const esquemaUrlHttps = z
  .string()
  .trim()
  .url("Debe ser una URL válida.")
  .refine((v) => v.startsWith("https://"), "La URL debe empezar por https://.");

/** El unico esquema zod de un recurso. */
export const esquemaRecurso = z.object({
  // Nulo = recurso global. `undefined` tambien se admite como global.
  programId: z.string().uuid("Programa inválido.").nullable().optional().default(null),
  categoriaId: z.string().uuid("Categoría inválida."),
  titulo: z.string().trim().min(1, "El título es obligatorio.").max(120, "Máximo 120 caracteres."),
  url: esquemaUrlHttps,
});

/** Entrada de un recurso (lo que el llamador escribe). */
export type EntradaRecurso = z.input<typeof esquemaRecurso>;
/** Recurso ya validado y normalizado. */
export type RecursoValidado = z.output<typeof esquemaRecurso>;

/** Un recurso tal como lo ve el llamador (fila del molde con columnas tipadas). */
export interface RecursoVista extends FilaCatalogo {
  programId: string | null;
  categoriaId: string;
  titulo: string;
  url: string;
  vigente: boolean;
  reemplazaA: string | null;
}

/** Columnas de `recursos` que el molde administra al crear/editar. */
type CamposRecurso = {
  programId: string | null;
  categoriaId: string;
  titulo: string;
  url: string;
};

/** Traduce un `ZodError` a un `ErrorDeApp` 400 con el primer mensaje. */
async function normalizando<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ErrorDeApp) throw error;
    if (error instanceof z.ZodError) {
      throw new ErrorDeApp(error.issues[0]?.message ?? "Petición inválida.", 400);
    }
    throw error;
  }
}

/** Valida el id como uuid; un id invalido sale como ErrorDeApp 400, nunca como 500. */
function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

/** Molde sobre `recursos`. Recibe la base por inyeccion. */
function moldeRecursos(db: Db) {
  return moldeDeCatalogo<CamposRecurso>(
    {
      tabla: recursos,
      nombreTabla: "recursos",
      esquema: esquemaRecurso as unknown as z.ZodType<CamposRecurso>,
      etiqueta: (fila) => String(fila.titulo),
      nombreEntidad: "un recurso",
    },
    db,
  );
}

/**
 * Crea un recurso vigente. La entrada se valida con el esquema compartido y el
 * molde escribe `change_log`. Un duplicado vigente (mismo programa/global, misma
 * categoria y titulo) choca con el indice parcial y sale como 409, no como 500.
 */
export async function crearRecurso(
  db: Db,
  userId: string,
  input: EntradaRecurso,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const datos = esquemaRecurso.parse(input);
    const fila = await moldeRecursos(db).crear(userId, datos as unknown as CamposRecurso);
    return fila as RecursoVista;
  });
}

/**
 * Edita un recurso (titulo, url, categoria, programa). Un cambio de URL puntual va
 * mejor por `reemplazar`, que conserva el historial; `editar` corrige un dato mal
 * escrito sin crear una version nueva.
 */
export async function editarRecurso(
  db: Db,
  userId: string,
  id: string,
  input: EntradaRecurso,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaRecurso.parse(input);
    const fila = await moldeRecursos(db).editar(userId, objetivoId, datos as unknown as CamposRecurso);
    return fila as RecursoVista;
  });
}

/**
 * Reemplaza la URL de un recurso conservando el historial (ADR 0017): crea la fila
 * nueva vigente apuntando a la anterior con `reemplazaA` y baja la anterior. La
 * anterior no se borra ni se desactiva. La logica (orden de escrituras + exclusion)
 * vive en `versionar.ts`.
 */
export async function reemplazarRecurso(
  db: Db,
  userId: string,
  id: string,
  nuevaUrl: string,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const url = esquemaUrlHttps.parse(nuevaUrl);
    const fila = await reemplazarVersionado({
      db,
      tabla: recursos,
      nombreTabla: "recursos",
      nombreEntidad: "un recurso",
      etiqueta: (f: FilaVersionada) => String(f.titulo),
      userId,
      id: objetivoId,
      nuevaUrl: url,
    });
    return fila as unknown as RecursoVista;
  });
}

/** Desactiva un recurso (no lo borra). */
export async function desactivarRecurso(
  db: Db,
  userId: string,
  id: string,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const fila = await moldeRecursos(db).desactivar(userId, idValido(id));
    return fila as RecursoVista;
  });
}

/** Reactiva un recurso desactivado. */
export async function reactivarRecurso(
  db: Db,
  userId: string,
  id: string,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const fila = await moldeRecursos(db).reactivar(userId, idValido(id));
    return fila as RecursoVista;
  });
}
