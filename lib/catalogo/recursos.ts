import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { recursos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { esAdministrador } from "@/lib/auth/roles";
import { moldeDeCatalogo, type FilaCatalogo, type ResultadoBorrado } from "./molde";
import { reemplazarVersionado, type FilaVersionada } from "./versionar";
import { exigirAccesoAlPrograma, type ActorConAcceso } from "./acceso-programa";

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
      // Quien apunta a un recurso: el propio `reemplaza_a` (una version mas nueva
      // encadena a la anterior). Es la senal de "ya se uso" de un recurso: uno con
      // historial NO se borra, se desactiva. La FK es `set null`, asi que el `DELETE`
      // no fallaria; el conteo es lo que lo evita, que es el punto del ADR 0026.
      dependientes: [{ tabla: recursos, columna: recursos.reemplazaA }],
    },
    db,
  );
}

/** Mensajes 403 propios de recursos: uno para el programa ajeno, otro para lo global. */
const NEGADO_RECURSO = "No puedes gestionar recursos de un programa donde no vendes.";
const NEGADO_GLOBAL = "No puedes gestionar recursos globales.";

/**
 * Enforza quien puede TOCAR un recurso segun su programa (enmienda del ticket 023,
 * 19-sep, con el molde del ADR 0016).
 *
 * Un recurso de un programa: quien administra entra a cualquiera; un closer solo a
 * los programas donde tiene membresia activa. La regla vive en el modulo compartido
 * `acceso-programa.ts`, la misma que usan los productos.
 *
 * Un recurso GLOBAL (`programId` nulo) afecta a programas donde un closer no vende,
 * asi que un closer NO puede crearlo (asimetria declarada por Mani), y —supuesto que
 * este ticket deja escrito— TAMPOCO editarlo ni desactivarlo: lo que no puede crear
 * no lo puede cambiar. Solo quien administra (`esAdministrador`: gerente o developer,
 * ADR 0025) toca lo global. NO se escribe `rol === "gerente"`: el developer es el
 * dueno y no se le restringe nada (ADR 0025 punto 5).
 */
async function exigirAccesoAlRecurso(
  db: Db,
  actor: ActorConAcceso,
  programId: string | null,
): Promise<void> {
  if (programId === null) {
    if (!esAdministrador(actor.rol)) throw new ErrorDeApp(NEGADO_GLOBAL, 403);
    return;
  }
  await exigirAccesoAlPrograma(db, actor, programId, NEGADO_RECURSO);
}

/** Lee un recurso por id (sin filtrar por activo), para conocer su programa. */
async function leerRecurso(db: Db, id: string): Promise<RecursoVista | undefined> {
  const [fila] = await db.select().from(recursos).where(eq(recursos.id, id)).limit(1);
  return fila as RecursoVista | undefined;
}

/** Quien realiza la operacion: su id (para `change_log`) y su rol de vista (ADR 0028). */
export type Actor = ActorConAcceso;

/**
 * Crea un recurso vigente. El actor debe poder gestionar el programa destino
 * (administrador siempre; closer solo en sus programas activos, y NUNCA un recurso
 * global). La entrada se valida con el esquema compartido y el molde escribe
 * `change_log`. Un duplicado vigente (mismo programa/global, misma categoria y
 * titulo) choca con el indice parcial y sale como 409, no como 500.
 */
export async function crearRecurso(
  db: Db,
  actor: Actor,
  input: EntradaRecurso,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const datos = esquemaRecurso.parse(input);
    await exigirAccesoAlRecurso(db, actor, datos.programId ?? null);
    const fila = await moldeRecursos(db).crear(actor.id, datos as unknown as CamposRecurso);
    return fila as RecursoVista;
  });
}

/**
 * Edita un recurso (titulo, url, categoria, programa). Un cambio de URL puntual va
 * mejor por `reemplazar`, que conserva el historial; `editar` corrige un dato mal
 * escrito sin crear una version nueva.
 *
 * Se exige acceso tanto al programa GUARDADO como al de la ENTRADA: un closer no
 * puede sacar un recurso de su programa hacia otro donde no vende, ni convertirlo en
 * global (que no puede tocar), ni editar uno que ya es global.
 */
export async function editarRecurso(
  db: Db,
  actor: Actor,
  id: string,
  input: EntradaRecurso,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaRecurso.parse(input);
    const actual = await leerRecurso(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un recurso con ese id.", 404);
    await exigirAccesoAlRecurso(db, actor, actual.programId);
    await exigirAccesoAlRecurso(db, actor, datos.programId ?? null);
    const fila = await moldeRecursos(db).editar(actor.id, objetivoId, datos as unknown as CamposRecurso);
    return fila as RecursoVista;
  });
}

/**
 * Reemplaza la URL de un recurso conservando el historial (ADR 0017): crea la fila
 * nueva vigente apuntando a la anterior con `reemplazaA` y baja la anterior. La
 * anterior no se borra ni se desactiva. La logica (orden de escrituras + exclusion)
 * vive en `versionar.ts`. Requiere acceso al programa del recurso.
 */
export async function reemplazarRecurso(
  db: Db,
  actor: Actor,
  id: string,
  nuevaUrl: string,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const url = esquemaUrlHttps.parse(nuevaUrl);
    const actual = await leerRecurso(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un recurso con ese id.", 404);
    await exigirAccesoAlRecurso(db, actor, actual.programId);
    const fila = await reemplazarVersionado({
      db,
      tabla: recursos,
      nombreTabla: "recursos",
      nombreEntidad: "un recurso",
      etiqueta: (f: FilaVersionada) => String(f.titulo),
      userId: actor.id,
      id: objetivoId,
      nuevaUrl: url,
    });
    return fila as unknown as RecursoVista;
  });
}

/** Desactiva un recurso (no lo borra). Requiere acceso al programa del recurso. */
export async function desactivarRecurso(
  db: Db,
  actor: Actor,
  id: string,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerRecurso(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un recurso con ese id.", 404);
    await exigirAccesoAlRecurso(db, actor, actual.programId);
    const fila = await moldeRecursos(db).desactivar(actor.id, objetivoId);
    return fila as RecursoVista;
  });
}

/** Reactiva un recurso desactivado. Requiere acceso al programa del recurso. */
export async function reactivarRecurso(
  db: Db,
  actor: Actor,
  id: string,
): Promise<RecursoVista> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerRecurso(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un recurso con ese id.", 404);
    await exigirAccesoAlRecurso(db, actor, actual.programId);
    const fila = await moldeRecursos(db).reactivar(actor.id, objetivoId);
    return fila as RecursoVista;
  });
}

/**
 * Borra un recurso SOLO si nadie lo uso (ADR 0026 punto 5): sin versiones que lo
 * encadenen → `DELETE` de verdad; con historial → no borra y devuelve el conteo para
 * que la pantalla desactive y lo explique. Requiere acceso al programa del recurso.
 */
export async function borrarRecursoSiNoSeUso(
  db: Db,
  actor: Actor,
  id: string,
): Promise<ResultadoBorrado> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerRecurso(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe un recurso con ese id.", 404);
    await exigirAccesoAlRecurso(db, actor, actual.programId);

    // 🩸 El historial encadena en UNA sola direccion, y el molde solo mira esa.
    // `dependientes` cuenta quien me apunta con `reemplaza_a`, o sea "quien me
    // reemplazo a MI": la version VIGENTE, que es justo la que el usuario ve y toca,
    // nunca es reemplazada por nadie, asi que contaba CERO y se borraba aunque
    // tuviera cinco versiones detras. Y como la FK es `set null`, no fallaba: se
    // llevaba la cabeza de la cadena, dejaba las viejas huerfanas y el recurso
    // desaparecia de la pantalla (que solo muestra vigentes) sin salir de la base.
    //
    // La otra mitad de la pregunta es esta: si YO reemplace a alguien, tengo
    // historial. Un recurso solo se borra cuando no lo referencia nadie Y el no
    // referencia a nadie — que es lo que "creado por error y nunca usado" significa.
    // Lo destapo el recorrido visual; ningun test lo veia porque nadie llamaba a
    // esta funcion.
    if (actual.reemplazaA !== null) {
      const anteriores = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(recursos)
        .where(eq(recursos.id, actual.reemplazaA));
      return { borrado: false, referencias: Number(anteriores[0]?.n ?? 0) || 1 };
    }

    return moldeRecursos(db).borrarSiNoSeUso(actor.id, objetivoId);
  });
}
