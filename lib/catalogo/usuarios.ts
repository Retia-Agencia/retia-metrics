import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { changeLog, miembrosPrograma, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { esAdministrador, ROLES } from "@/lib/auth/roles";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";

/**
 * Usuarios y closers (ticket 015, ADR 0012), sobre el molde de catalogo.
 *
 * Un usuario es una instancia editable: el gerente da de alta closers y otros
 * gerentes desde la app, sin CLI (Mani, 16-sep). La tabla `users` ya tiene `id` y
 * `activo`, asi que el molde maneja la fila del usuario (crear/editar/desactivar/
 * reactivar + `change_log` por campo que cambia). Lo que el molde NO expresa vive
 * aca:
 *
 *  - **Membresias de programa.** `programas` es un arreglo, no una columna: al
 *    guardar se sincroniza `miembros_programa` (activa/inserta las elegidas,
 *    desactiva las quitadas — nunca DELETE, ADR 0012), y cada cambio va a
 *    `change_log` con el `userId` de quien lo hizo.
 *  - **Regla de negocio del rol.** Un closer necesita `closerId` (ADR 0011) y al
 *    menos un programa; un gerente no necesita ninguno. Lo enforza el esquema zod.
 *  - **Proteccion del ultimo administrador.** Un gerente no puede quitarse su
 *    propio rol ni desactivarse (evita quedar sin administradores). Es un 400.
 *
 * La base se recibe por inyeccion (por defecto la de la app) para correr los tests
 * sobre PGlite sin Neon. Este archivo NO lleva `"use server"`: es logica pura que
 * las server actions envuelven, igual que `lib/catalogo/operaciones.ts`.
 */

/** id de un usuario: uuid o error de validacion (400). */
const esquemaId = z.string().uuid("El identificador no es válido.");

/**
 * El unico esquema zod de un usuario. Lo usan la pantalla, las server actions y el
 * CLI de emergencia (`npm run usuarios`): una sola validacion de la misma entidad.
 *
 * `email` se normaliza a minusculas y sin espacios (es la llave del allowlist). La
 * regla del rol se aplica con `superRefine`: un closer necesita `closerId` y al
 * menos un programa; un gerente no necesita ninguno.
 */
export const esquemaUsuario = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "El correo es obligatorio.")
      .email("El correo no es válido."),
    nombre: z
      .string()
      .trim()
      .max(120, "Máximo 120 caracteres.")
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    rol: z.enum(ROLES),
    /** closer_id de la BBDD (ADR 0011). Vacio se guarda como null. */
    closerId: z
      .string()
      .trim()
      .max(80, "Máximo 80 caracteres.")
      .optional()
      .default("")
      .transform((v) => (v && v.length > 0 ? v : null)),
    calendlyEmail: z
      .string()
      .trim()
      .toLowerCase()
      .email("El correo de Calendly no es válido.")
      .optional()
      .or(z.literal(""))
      .transform((v) => (v && v.length > 0 ? v : null)),
    /** Programas donde el usuario vende. Cada uno es un uuid de `programs`. */
    programas: z.array(z.string().uuid("Programa inválido.")).default([]),
  })
  .superRefine((datos, ctx) => {
    if (datos.rol === "closer") {
      if (!datos.closerId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["closerId"],
          message: "Un closer necesita su closer_id de la BBDD.",
        });
      }
      if (datos.programas.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["programas"],
          message: "Un closer necesita al menos un programa.",
        });
      }
    }
  });

/** Entrada validada de un usuario (lo que el llamador escribe). */
export type EntradaUsuario = z.input<typeof esquemaUsuario>;
/** Usuario ya validado y normalizado. */
export type UsuarioValidado = z.output<typeof esquemaUsuario>;

/**
 * Valida y normaliza la entrada de un usuario con el esquema compartido. Lo usa el
 * CLI de emergencia (`scripts/usuarios.ts`), que necesita la misma validacion que
 * la pantalla sin tocar la base. Acepta `unknown` a proposito: el CLI arma la
 * entrada con argumentos de linea de comandos (todos `string`), y es el esquema
 * quien decide si el rol es valido, no el tipo. Lanza `ZodError` si no valida.
 */
export function parsearEntradaUsuario(input: unknown): UsuarioValidado {
  return esquemaUsuario.parse(input);
}

/** Valida el id como uuid; un id invalido sale como ErrorDeApp 400, nunca como 500. */
function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

/**
 * Traduce un `ZodError` a un `ErrorDeApp` 400 con el primer mensaje. El molde y el
 * esquema lanzan `ZodError`; el llamador (server action / CLI) recibe siempre un
 * `ErrorDeApp` con `status`.
 */
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

/** Columnas de `users` que el molde administra (todo menos `programas`). */
type CamposUsuario = {
  email: string;
  nombre: string | null;
  rol: (typeof ROLES)[number];
  closerId: string | null;
  calendlyEmail: string | null;
};

/** Molde sobre `users` para la fila del usuario. Recibe la base por inyeccion. */
function moldeUsuarios(db: Db) {
  return moldeDeCatalogo<CamposUsuario>(
    {
      tabla: users,
      nombreTabla: "users",
      // El molde revalida en runtime, pero aca la entrada ya viene validada por
      // `esquemaUsuario`; este esquema solo describe la forma de las columnas que
      // el molde escribe (sin `programas`, que se sincroniza aparte).
      esquema: z.object({
        email: z.string(),
        nombre: z.string().nullable(),
        rol: z.enum(ROLES),
        closerId: z.string().nullable(),
        calendlyEmail: z.string().nullable(),
      }) as unknown as z.ZodType<CamposUsuario>,
      etiqueta: (fila) => String(fila.email),
      nombreEntidad: "un usuario",
    },
    db,
  );
}

/** Separa los campos de la fila `users` del arreglo de programas. */
function separar(datos: UsuarioValidado): { campos: CamposUsuario; programas: string[] } {
  const { programas, ...campos } = datos;
  return { campos, programas };
}

/**
 * Sincroniza `miembros_programa` de un usuario contra la lista de programas
 * elegida. Activa/inserta los elegidos, desactiva los quitados — nunca DELETE. Cada
 * cambio (alta, reactivacion, desactivacion) deja una fila en `change_log`. El id
 * de cada membresia nueva se genera en codigo para que quepa en el mismo lote
 * (`ejecutarJuntas`, ADR 0020).
 */
async function sincronizarMembresias(
  db: Db,
  actorId: string,
  userId: string,
  etiqueta: string,
  programasElegidos: readonly string[],
): Promise<void> {
  const existentes = await db
    .select()
    .from(miembrosPrograma)
    .where(eq(miembrosPrograma.userId, userId));
  const porPrograma = new Map(existentes.map((m) => [m.programId, m]));
  const elegidos = new Set(programasElegidos);

  const escrituras: ((tx: Db) => Promise<unknown>)[] = [];

  // Alta o reactivacion de los elegidos.
  for (const programId of elegidos) {
    const actual = porPrograma.get(programId);
    if (!actual) {
      const id = crypto.randomUUID();
      escrituras.push((tx) =>
        tx.insert(miembrosPrograma).values({ id, userId, programId, activo: true }),
      );
      escrituras.push((tx) =>
        tx.insert(changeLog).values({
          tabla: "miembros_programa",
          registroId: id,
          etiqueta,
          campo: "activo",
          valorAnterior: null,
          valorNuevo: "true",
          origen: "app" as const,
          userId: actorId,
        }),
      );
    } else if (!actual.activo) {
      escrituras.push((tx) =>
        tx
          .update(miembrosPrograma)
          .set({ activo: true })
          .where(eq(miembrosPrograma.id, actual.id)),
      );
      escrituras.push((tx) =>
        tx.insert(changeLog).values({
          tabla: "miembros_programa",
          registroId: actual.id,
          etiqueta,
          campo: "activo",
          valorAnterior: "false",
          valorNuevo: "true",
          origen: "app" as const,
          userId: actorId,
        }),
      );
    }
  }

  // Desactivacion de las que ya no estan elegidas (nunca se borran).
  for (const actual of existentes) {
    if (!elegidos.has(actual.programId) && actual.activo) {
      escrituras.push((tx) =>
        tx
          .update(miembrosPrograma)
          .set({ activo: false })
          .where(eq(miembrosPrograma.id, actual.id)),
      );
      escrituras.push((tx) =>
        tx.insert(changeLog).values({
          tabla: "miembros_programa",
          registroId: actual.id,
          etiqueta,
          campo: "activo",
          valorAnterior: "true",
          valorNuevo: "false",
          origen: "app" as const,
          userId: actorId,
        }),
      );
    }
  }

  if (escrituras.length === 0) return;
  await ejecutarJuntas(db, (tx) => escrituras.map((f) => f(tx)));
}

/** Programas activos (uuids) donde vende un usuario. */
async function programasDe(db: Db, userId: string): Promise<string[]> {
  const filas = await db
    .select()
    .from(miembrosPrograma)
    .where(and(eq(miembrosPrograma.userId, userId), eq(miembrosPrograma.activo, true)));
  return filas.map((m) => m.programId);
}

/**
 * Impide que un administrador logueado se degrade o se desactive a si mismo: es la
 * salvaguarda contra quedarse sin administradores. Solo aplica cuando el objetivo
 * es el propio actor.
 *
 * Administrador son hoy dos roles, `gerente` y `developer` (ADR 0025), asi que la
 * pregunta se le hace a `esAdministrador` y no a un literal: pasar de uno al otro es
 * legitimo (no se pierde administracion) y se permite; lo que se bloquea es caer a
 * `closer` o desactivarse, que son las dos formas de cerrarse la puerta desde
 * adentro.
 */
async function protegerAdministrador(
  db: Db,
  actorId: string,
  objetivoId: string,
  opciones: { rolNuevo?: (typeof ROLES)[number]; desactivando?: boolean },
): Promise<void> {
  if (actorId !== objetivoId) return;
  const [actor] = await db.select().from(users).where(eq(users.id, actorId));
  if (!actor || !esAdministrador(actor.rol)) return;

  if (opciones.desactivando) {
    throw new ErrorDeApp("No puedes desactivarte a ti mismo.", 400);
  }
  if (opciones.rolNuevo && !esAdministrador(opciones.rolNuevo)) {
    throw new ErrorDeApp("No puedes quitarte a ti mismo el rol de administrador.", 400);
  }
}

/** Un usuario con sus programas activos, para la pantalla. */
export interface UsuarioConProgramas extends FilaCatalogo {
  email: string;
  nombre: string | null;
  rol: (typeof ROLES)[number];
  closerId: string | null;
  calendlyEmail: string | null;
  programas: string[];
}

/** Lista todos los usuarios (activos e inactivos) con sus programas activos. */
export async function listarUsuarios(db: Db = dbDeLaApp): Promise<UsuarioConProgramas[]> {
  const filas = await db.select().from(users);
  const membresias = await db.select().from(miembrosPrograma);
  const activasPorUsuario = new Map<string, string[]>();
  for (const m of membresias) {
    if (!m.activo) continue;
    const lista = activasPorUsuario.get(m.userId) ?? [];
    lista.push(m.programId);
    activasPorUsuario.set(m.userId, lista);
  }
  return filas.map((u) => ({
    id: u.id,
    activo: u.activo,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    closerId: u.closerId,
    calendlyEmail: u.calendlyEmail,
    programas: activasPorUsuario.get(u.id) ?? [],
  }));
}

/** Crea un usuario y sus membresias. La entrada se valida con el esquema compartido. */
export async function crearUsuario(
  db: Db,
  actorId: string,
  input: EntradaUsuario,
): Promise<UsuarioConProgramas> {
  return normalizando(async () => {
    const datos = esquemaUsuario.parse(input);
    const { campos, programas } = separar(datos);
    const fila = await moldeUsuarios(db).crear(actorId, campos);
    await sincronizarMembresias(db, actorId, fila.id, campos.email, programas);
    return {
      ...(fila as UsuarioConProgramas),
      programas: await programasDe(db, fila.id),
    };
  });
}

/** Edita un usuario y sincroniza sus membresias. Valida id (uuid) y entrada. */
export async function editarUsuario(
  db: Db,
  actorId: string,
  id: string,
  input: EntradaUsuario,
): Promise<UsuarioConProgramas> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaUsuario.parse(input);
    await protegerAdministrador(db, actorId, objetivoId, { rolNuevo: datos.rol });
    const { campos, programas } = separar(datos);
    const fila = await moldeUsuarios(db).editar(actorId, objetivoId, campos);
    await sincronizarMembresias(db, actorId, objetivoId, campos.email, programas);
    return {
      ...(fila as UsuarioConProgramas),
      programas: await programasDe(db, objetivoId),
    };
  });
}

/** Desactiva un usuario (no lo borra). Valida id (uuid). No puede desactivarse a si mismo. */
export async function desactivarUsuario(
  db: Db,
  actorId: string,
  id: string,
): Promise<UsuarioConProgramas> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    await protegerAdministrador(db, actorId, objetivoId, { desactivando: true });
    const fila = await moldeUsuarios(db).desactivar(actorId, objetivoId);
    return {
      ...(fila as UsuarioConProgramas),
      programas: await programasDe(db, objetivoId),
    };
  });
}

/** Reactiva un usuario desactivado. Valida id (uuid). */
export async function reactivarUsuario(
  db: Db,
  actorId: string,
  id: string,
): Promise<UsuarioConProgramas> {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const fila = await moldeUsuarios(db).reactivar(actorId, objetivoId);
    return {
      ...(fila as UsuarioConProgramas),
      programas: await programasDe(db, objetivoId),
    };
  });
}
