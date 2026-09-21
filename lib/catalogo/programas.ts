import { eq } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { changeLog, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";

/**
 * Programas (ticket 014, ADR 0012), sobre el molde de catalogo.
 *
 * Un programa es una instancia editable: el gerente lo crea desde /ajustes sin
 * tocar codigo. La tabla `programs` ya tiene `id` y `activo`, asi que el molde
 * maneja crear/editar/desactivar/reactivar + `change_log` por campo que cambia. Lo
 * que el molde NO expresa vive aca:
 *
 *  - **El slug no se puede cambiar despues de creado.** Las URLs guardadas (y las
 *    rutas `/programas/[slug]`) dependen de el; editarlo con otro slug es un 400.
 *  - **Un solo esquema zod** valida el alta y la edicion: nombre, slug con formato
 *    `^[a-z0-9-]+$`, ticket en USD y las dos URLs opcionales.
 *
 * La base se recibe por inyeccion (por defecto la de la app) para correr los tests
 * sobre PGlite sin Neon. Este archivo NO lleva `"use server"`: es logica pura que
 * las server actions envuelven, igual que `lib/catalogo/usuarios.ts`.
 */

/** id de un programa: uuid o error de validacion (400). */
const esquemaId = z.string().uuid("El identificador no es válido.");

/** Una URL opcional: vacia o nula se guarda como null; si viene, debe ser una URL valida. */
const urlOpcional = z
  .string()
  .trim()
  .url("La URL no es válida.")
  .nullable()
  .optional()
  .or(z.literal(""))
  .transform((v) => (v && v.length > 0 ? v : null));

/**
 * El unico esquema zod de un programa. Lo usan la pantalla, las server actions y
 * cualquier codigo: una sola validacion de la misma entidad.
 *
 * El slug se restringe a `^[a-z0-9-]+$` (minusculas, digitos y guion): es lo que
 * cabe en una URL sin escapar y lo que la ruta `/programas/[slug]` espera.
 */
export const esquemaPrograma = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(120, "Máximo 120 caracteres."),
  slug: z
    .string()
    .trim()
    .min(1, "El slug es obligatorio.")
    .max(60, "Máximo 60 caracteres.")
    .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones."),
  ticketUsd: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, "El ticket debe ser un monto en USD (por ejemplo 797 o 797.00)."),
  webUrl: urlOpcional,
  calendlyUrl: urlOpcional,
});

/** Entrada validada de un programa (lo que el llamador escribe). */
export type EntradaPrograma = z.input<typeof esquemaPrograma>;
/** Programa ya validado y normalizado. */
export type ProgramaValidado = z.output<typeof esquemaPrograma>;

/** Valida el id como uuid; un id invalido sale como ErrorDeApp 400, nunca como 500. */
function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

/** Molde sobre `programs`. Recibe la base por inyeccion. */
function moldePrograma(db: Db) {
  return moldeDeCatalogo<ProgramaValidado>(
    {
      tabla: programs,
      nombreTabla: "programs",
      esquema: esquemaPrograma as unknown as z.ZodType<ProgramaValidado>,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "un programa",
    },
    db,
  );
}

/** Lista todos los programas (activos e inactivos). */
export async function listarProgramas(db: Db = dbDeLaApp): Promise<FilaCatalogo[]> {
  return moldePrograma(db).listar();
}

/** Crea un programa. La entrada se valida con el esquema compartido. */
export async function crearPrograma(
  db: Db,
  actorId: string,
  input: EntradaPrograma,
): Promise<FilaCatalogo> {
  return normalizando(() => moldePrograma(db).crear(actorId, esquemaPrograma.parse(input)));
}

/**
 * Edita un programa. Valida id (uuid) y entrada. El slug es inmutable: editarlo con
 * uno distinto al guardado es un 400 con mensaje claro. El molde solo ve el slug
 * actual, asi que nunca lo reescribe.
 */
export async function editarPrograma(
  db: Db,
  actorId: string,
  id: string,
  input: EntradaPrograma,
): Promise<FilaCatalogo> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaPrograma.parse(input);
    const [actual] = await db.select().from(programs).where(eq(programs.id, objetivoId));
    if (!actual) throw new ErrorDeApp("No existe un programa con ese id.", 404);
    if (datos.slug !== actual.slug) {
      throw new ErrorDeApp(
        "El slug de un programa no se puede cambiar: las URLs guardadas dependen de él.",
        400,
      );
    }
    return moldePrograma(db).editar(actorId, objetivoId, datos);
  });
}

/** Desactiva un programa (no lo borra). Lo saca de la navegacion, conserva sus datos. */
export async function desactivarPrograma(
  db: Db,
  actorId: string,
  id: string,
): Promise<FilaCatalogo> {
  return normalizando(() => moldePrograma(db).desactivar(actorId, idValido(id)));
}

/** Reactiva un programa desactivado. */
export async function reactivarPrograma(
  db: Db,
  actorId: string,
  id: string,
): Promise<FilaCatalogo> {
  return normalizando(() => moldePrograma(db).reactivar(actorId, idValido(id)));
}

// ─────────────────────────────────────────────── plantilla de lead (ADR 0019, 016)

/**
 * El esquema de la plantilla de lead: un record de campo → patron (texto o lista),
 * igual que el mapeo de una fuente. Vacio = el programa no ajusta nada y sus fuentes
 * heredan el defecto del codigo. Que los patrones cuadren con encabezados reales lo
 * decide la prueba de la fuente, no zod.
 */
const esquemaPlantillaLead: z.ZodType<MapeoColumnas> = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

export type EntradaPlantillaLead = z.input<typeof esquemaPlantillaLead>;

/** Convierte un valor a texto para `change_log` (que guarda todo como texto). */
function aTextoLog(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = JSON.stringify(valor);
  return s === "{}" ? null : s;
}

/**
 * Edita la plantilla de lead de un programa (ADR 0019, ticket 016). Vive aparte del
 * esquema del programa a proposito: `esquemaPrograma` no la incluye para que
 * `editarPrograma` nunca la pise por accidente, y esta operacion nunca toca los
 * demas campos.
 *
 * NO usa el molde generico porque la plantilla no es una fila propia sino una
 * columna del programa; pero respeta el contrato del ADR 0012 igual: valida con un
 * solo esquema y escribe `change_log` (una fila para el campo `plantilla_lead`) en
 * el mismo lote atomico. Si nada cambia, no escribe. Una plantilla vacia se guarda
 * como `null` (el programa no ajusta nada).
 */
export async function editarPlantillaLead(
  db: Db,
  actorId: string,
  id: string,
  input: EntradaPlantillaLead,
): Promise<FilaCatalogo> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const plantilla = esquemaPlantillaLead.parse(input);
    const valor: MapeoColumnas | null = Object.keys(plantilla).length ? plantilla : null;

    const [actual] = await db.select().from(programs).where(eq(programs.id, objetivoId));
    if (!actual) throw new ErrorDeApp("No existe un programa con ese id.", 404);

    const antes = aTextoLog(actual.plantillaLead);
    const ahora = aTextoLog(valor);
    // Nada cambio: no se toca la fila ni se escribe en change_log.
    if (antes === ahora) return actual as FilaCatalogo;

    await ejecutarJuntas(db, (tx) => [
      (tx as Db)
        .update(programs)
        .set({ plantillaLead: valor })
        .where(eq(programs.id, objetivoId)),
      (tx as Db).insert(changeLog).values({
        tabla: "programs",
        registroId: objetivoId,
        etiqueta: String(actual.nombre),
        campo: "plantilla_lead",
        valorAnterior: antes,
        valorNuevo: ahora,
        origen: "app" as const,
        userId: actorId,
      }),
    ]);

    const [fila] = await db.select().from(programs).where(eq(programs.id, objetivoId));
    return fila as FilaCatalogo;
  });
}
