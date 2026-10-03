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
 *    rutas `/p/[slug]`) dependen de el; editarlo con otro slug es un 400.
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
 * cabe en una URL sin escapar y lo que la ruta `/p/[slug]` espera.
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
  // La URL base del formulario (ADR 0057, ticket 109). Entra al molde como una URL
  // opcional mas: vacia => null. Es la misma columna que el generador de links de
  // captacion usa (ADR 0051, ticket 092). El token de Calendly NO esta aqui a
  // proposito: es un secreto y lo escribe solo `guardarTokenCalendly` (ADR 0057
  // punto 2), nunca el molde ni el `change_log`.
  formUrl: urlOpcional,
  // Porcentaje de comision vigente (ticket 133). Se congela en cada deal al vender.
  comisionPorcentaje: z
    .string()
    .trim()
    .regex(/^(\d+(\.\d{1,2})?)?$/, "La comisión debe ser un porcentaje con máximo dos decimales.")
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || Number(v) <= 100, "La comisión debe estar entre 0 y 100.")
    .transform((v) => (v && v.length > 0 ? v : null)),
  diasSinActividad: z.coerce
    .number()
    .int("Los días sin actividad deben ser un entero.")
    .min(1, "Los días sin actividad deben ser al menos 1.")
    .optional(),
});

/** Entrada validada de un programa (lo que el llamador escribe). */
export type EntradaPrograma = z.input<typeof esquemaPrograma>;
/** Programa ya validado y normalizado. */
export type ProgramaValidado = z.output<typeof esquemaPrograma>;

/**
 * Un programa tal como lo ve el llamador: la fila del molde SIN el token de Calendly,
 * mas el booleano `tieneTokenCalendly`. El token es un secreto (ADR 0057 punto 2) y
 * `moldeDeCatalogo(...).listar()` hace `select()` de TODAS las columnas, asi que la
 * fuga se tapa aqui, en UN solo lugar, antes de que salga (mismo patron que
 * `sinSecreto` en `lib/catalogo/fuentes.ts` con el secreto del webhook).
 */
export interface ProgramaVistaCatalogo extends FilaCatalogo {
  /** Si el programa ya tiene token de Calendly. El valor nunca sale de aqui. */
  tieneTokenCalendly: boolean;
  /** Si el webhook de Calendly esta conectado (hay clave de firma). La clave nunca sale de aqui. */
  webhookCalendlyConectado: boolean;
}

/**
 * Quita el token de Calendly y la clave de firma de su webhook de una fila, y expone en
 * su lugar los booleanos `tieneTokenCalendly` y `webhookCalendlyConectado`. Es el unico sitio por donde una fila de programa sale hacia
 * el llamador, para que ninguna lectura del catalogo devuelva el token (ADR 0057).
 */
function sinToken(fila: FilaCatalogo): ProgramaVistaCatalogo {
  // La clave de firma del webhook (0038) es la tercera excepcion de secretos: sale igual.
  const { calendlyToken, calendlySigningKey, ...resto } = fila;
  const tiene = (v: unknown) => typeof v === "string" && v.length > 0;
  return { ...resto, tieneTokenCalendly: tiene(calendlyToken), webhookCalendlyConectado: tiene(calendlySigningKey) };
}

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

/** Lista todos los programas (activos e inactivos), sin el token de Calendly. */
export async function listarProgramas(db: Db = dbDeLaApp): Promise<ProgramaVistaCatalogo[]> {
  const filas = await moldePrograma(db).listar();
  return filas.map(sinToken);
}

/**
 * Un programa por su id (activo o no), sin el token de Calendly ni la clave de firma, o
 * `null` si no existe. Pasa por `sinToken` como `listarProgramas`: es la lectura de la
 * ficha del programa (ticket 100), que la ve un closer, y el secreto no puede salir por
 * ahi tampoco. No decide alcance: quien llama ya resolvio que la sesion ve este programa.
 */
export async function programaPorId(db: Db, id: string): Promise<ProgramaVistaCatalogo | null> {
  return normalizando(async () => {
    const [fila] = await db.select().from(programs).where(eq(programs.id, idValido(id)));
    return fila ? sinToken(fila as FilaCatalogo) : null;
  });
}

/**
 * Crea un programa. La entrada se valida con el esquema compartido.
 *
 * Nace INACTIVO: es el default de `programs.activo` y el CHECK
 * `programs_activo_con_formulario_y_token` (migracion 0031, ADR 0057) impide que un
 * programa este activo sin Forms Link y token de Calendly. El token no entra por el
 * alta (es secreto y no pasa por el molde): se guarda con `guardarTokenCalendly` y el
 * programa se activa despues con `reactivarPrograma`, que es la reja con el 422.
 */
export async function crearPrograma(
  db: Db,
  actorId: string,
  input: EntradaPrograma,
): Promise<ProgramaVistaCatalogo> {
  return normalizando(async () => {
    const fila = await moldePrograma(db).crear(actorId, esquemaPrograma.parse(input));
    return sinToken(fila);
  });
}

/**
 * Comprueba que un programa tenga URL de formulario y token de Calendly antes de
 * quedar activo (ADR 0057 punto 1). Lanza un 422 que dice que falta y NO toca la
 * fila. La activacion vive en `reactivarPrograma`, que llama a esto primero.
 */
function exigirLinkYToken(fila: {
  formUrl: string | null;
  calendlyToken: string | null;
}): void {
  const faltan: string[] = [];
  if (!fila.formUrl) faltan.push("la URL del formulario");
  if (!fila.calendlyToken) faltan.push("el token de Calendly");
  if (faltan.length > 0) {
    throw new ErrorDeApp(
      `No se puede activar el programa sin ${faltan.join(" ni ")}. Cárgalos y vuelve a intentar.`,
      422,
    );
  }
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
): Promise<ProgramaVistaCatalogo> {
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
    // Editar un programa ACTIVO que hoy no tiene link ni token (los dos programas
    // reales estan asi) no se rompe: la reja solo aplica al ACTIVAR, no a editar los
    // datos de una fila que ya estaba activa.
    const fila = await moldePrograma(db).editar(actorId, objetivoId, datos);
    return sinToken(fila);
  });
}

/** Desactiva un programa (no lo borra). Lo saca de la navegacion, conserva sus datos. */
export async function desactivarPrograma(
  db: Db,
  actorId: string,
  id: string,
): Promise<ProgramaVistaCatalogo> {
  return normalizando(async () => {
    const fila = await moldePrograma(db).desactivar(actorId, idValido(id));
    return sinToken(fila);
  });
}

/**
 * Reactiva un programa desactivado. Aplica la reja del ADR 0057: sin URL de
 * formulario y sin token de Calendly no se activa (422), y la fila no se mueve (ni
 * `change_log`), porque la comprobacion corre ANTES de que el molde escriba nada.
 */
export async function reactivarPrograma(
  db: Db,
  actorId: string,
  id: string,
): Promise<ProgramaVistaCatalogo> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const [actual] = await db.select().from(programs).where(eq(programs.id, objetivoId));
    if (!actual) throw new ErrorDeApp("No existe un programa con ese id.", 404);
    exigirLinkYToken({
      formUrl: (actual.formUrl as string | null) ?? null,
      calendlyToken: (actual.calendlyToken as string | null) ?? null,
    });
    const fila = await moldePrograma(db).reactivar(actorId, objetivoId);
    return sinToken(fila);
  });
}

// ─────────────────────────────────────── token de Calendly (ADR 0057, ticket 109)

/** Etiqueta que guarda `change_log` en vez del token: se sabe que cambio, no a que. */
const TOKEN_OCULTO = "(oculto)";

const esquemaToken = z
  .string()
  .trim()
  .min(1, "El token de Calendly es obligatorio.");

/**
 * Guarda (o reemplaza) el token de Calendly de un programa. Es el UNICO escritor de
 * `programs.calendly_token` (ADR 0057 punto 2, mismo molde que `rotarSecretoDeFuente`
 * con el secreto del webhook, ticket 105):
 *
 *  - El token vive en la base, no en `.env.local`: crear un programa nuevo no debe
 *    pedir tocar Vercel (ADR 0012, criterio de aceptacion 4).
 *  - NUNCA pasa por el molde ni por el esquema del programa, asi que `editarPrograma`
 *    no lo puede pisar.
 *  - El rastro va en la MISMA transaccion y dice que se cambio, SIN el valor: un token
 *    en `change_log` lo leeria cualquiera que lea la bitacora.
 *  - Ninguna lectura del catalogo lo devuelve (ver `sinToken` y `listarProgramas`); a
 *    lo sumo el booleano `tieneTokenCalendly`.
 *
 * No devuelve el token: a diferencia del secreto del webhook, aqui el valor lo teclea
 * Mani (viene de Calendly), asi que no hay nada que mostrar de vuelta.
 */
export async function guardarTokenCalendly(
  db: Db,
  actorId: string,
  programaId: string,
  token: string,
): Promise<void> {
  return normalizando(async () => {
    const objetivoId = idValido(programaId);
    const valor = esquemaToken.parse(token);
    const [actual] = await db.select().from(programs).where(eq(programs.id, objetivoId));
    if (!actual) throw new ErrorDeApp("No existe un programa con ese id.", 404);
    const tenia = typeof actual.calendlyToken === "string" && actual.calendlyToken.length > 0;
    await db.transaction(async (tx) => {
      await tx.update(programs).set({ calendlyToken: valor }).where(eq(programs.id, objetivoId));
      await tx.insert(changeLog).values({
        tabla: "programs",
        registroId: objetivoId,
        etiqueta: String(actual.nombre),
        campo: "calendly_token",
        valorAnterior: tenia ? TOKEN_OCULTO : null,
        valorNuevo: TOKEN_OCULTO,
        origen: "app",
        userId: actorId,
      });
    });
  });
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
): Promise<ProgramaVistaCatalogo> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const plantilla = esquemaPlantillaLead.parse(input);
    const valor: MapeoColumnas | null = Object.keys(plantilla).length ? plantilla : null;

    const [actual] = await db.select().from(programs).where(eq(programs.id, objetivoId));
    if (!actual) throw new ErrorDeApp("No existe un programa con ese id.", 404);

    const antes = aTextoLog(actual.plantillaLead);
    const ahora = aTextoLog(valor);
    // Nada cambio: no se toca la fila ni se escribe en change_log.
    if (antes === ahora) return sinToken(actual as FilaCatalogo);

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
    return sinToken(fila as FilaCatalogo);
  });
}
