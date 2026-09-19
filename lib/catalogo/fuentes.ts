import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { programs, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { esAdministrador, type Rol } from "@/lib/auth/roles";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";
import { probarMapeoDeFuente, type ResultadoPrueba } from "@/lib/sheets/probar-fuente";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";

/**
 * Fuentes de datos por programa (ticket 016, ADR 0012, ADR 0019), sobre el molde de
 * catalogo. Revierte la desviacion declarada de editar el mapeo en
 * `scripts/seed-datos.ts` y re-sembrar: ahora un gerente conecta la hoja de un
 * programa nuevo desde `/ajustes/fuentes`, sin cambio de codigo (spec §5 criterio 4).
 *
 * La tabla `sources` tiene `id` y `activo`, asi que el molde maneja
 * crear/editar/desactivar/reactivar + `change_log` por campo que cambia. Lo que el
 * molde NO expresa vive aca:
 *
 *  - **Quien administra (ADR 0025).** Administra quien cumple `esAdministrador`:
 *    gerente Y developer. NUNCA se escribe `rol === "gerente"` ni `"developer"` a
 *    mano — es la regla dura del ADR 0025 y ya causo dos bugs en este repo. El
 *    developer es el dueño y no se le restringe nada.
 *  - **Una fuente NACE inactiva y solo se activa si su prueba pasa EN ESE MOMENTO
 *    (ticket 016 punto 5).** No se guarda una bandera "ultima prueba ok": envejeceria
 *    en cuanto cambia el mapeo o la pestana. En vez de eso, `activarFuente` corre la
 *    prueba contra la hoja real y falla con `MapeoInvalidoError` (422) si no cuadra.
 *    Misma garantia, sin estado que pueda mentir.
 *  - **Un solo esquema zod.** El `activo` NO lo escribe el llamador: lo gobiernan
 *    `activarFuente` / `desactivarFuente`. Por eso el esquema no lo incluye y en cada
 *    escritura se preserva el valor actual (crear nace inactiva).
 *
 * La base se recibe por inyeccion (por defecto la de la app) para correr los tests
 * sobre PGlite sin Neon. Este archivo NO lleva `"use server"`: es logica pura que
 * las server actions envuelven.
 */

const esquemaId = z.string().uuid("El identificador no es válido.");

/** Destinos que una fuente puede alimentar. Instancia NO: es un tipo fijo del codigo. */
export const DESTINOS_FUENTE = ["people", "calls", "sales", "ad_spend"] as const;
/** Tipos de fuente. Hoy solo hoja de calculo; `upload` existe en el enum pero no se usa. */
export const TIPOS_FUENTE = ["google_sheet", "upload"] as const;

/**
 * El mapeo de columnas: un objeto de campo → patron (texto o lista de textos). Se
 * valida como un record laxo; que los patrones cuadren con encabezados reales lo
 * decide la prueba contra la hoja, no zod. Vacio es valido: la fuente hereda todo de
 * la plantilla del programa y el defecto.
 */
const esquemaMapeo: z.ZodType<MapeoColumnas> = z.record(
  z.string(),
  z.union([z.string(), z.array(z.string())]),
);

/**
 * El unico esquema zod de una fuente.
 *
 * `activo` SI va en el esquema —el molde re-parsea la entrada y descartaria un campo
 * que no declare—, pero el llamador NUNCA lo escribe a mano: `crearFuente` lo fuerza
 * a `false` (nace inactiva) y `editarFuente` re-supplea el valor actual. Quien
 * cambia el estado de activacion es `activarFuente` / `desactivarFuente`, no la
 * edicion de datos.
 */
export const esquemaFuente = z.object({
  programId: z.string().uuid("Programa inválido."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(120, "Máximo 120 caracteres."),
  tipo: z.enum(TIPOS_FUENTE).default("google_sheet"),
  sheetId: z.string().trim().min(1, "El ID de la hoja es obligatorio."),
  tab: z.string().trim().min(1, "La pestaña es obligatoria."),
  rango: z.string().trim().min(1).default("A1:BZ"),
  destino: z.enum(DESTINOS_FUENTE).default("people"),
  mapeoColumnas: esquemaMapeo.default({}),
  activo: z.boolean().default(false),
});

export type EntradaFuente = z.input<typeof esquemaFuente>;
export type FuenteValidada = z.output<typeof esquemaFuente>;

/** Quien realiza la operacion: su id (para `change_log`) y su rol (para el guard). */
export interface Actor {
  id: string;
  rol: Rol;
}

/** Una fuente tal como la ve el llamador (fila del molde con columnas tipadas). */
export interface FuenteVista extends FilaCatalogo {
  programId: string;
  nombre: string;
  tipo: string;
  sheetId: string | null;
  tab: string | null;
  rango: string;
  destino: string;
  mapeoColumnas: MapeoColumnas;
  ultimaSync: Date | null;
  orden: number;
}

function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

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

/** Columnas de `sources` que el molde administra por el esquema. */
type CamposFuente = {
  programId: string;
  nombre: string;
  tipo: string;
  sheetId: string;
  tab: string;
  rango: string;
  destino: string;
  mapeoColumnas: MapeoColumnas;
  activo: boolean;
};

function moldeFuentes(db: Db) {
  return moldeDeCatalogo<CamposFuente>(
    {
      tabla: sources,
      nombreTabla: "sources",
      esquema: esquemaFuente as unknown as z.ZodType<CamposFuente>,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "una fuente",
    },
    db,
  );
}

/**
 * Solo administra quien cumple `esAdministrador` (gerente o developer, ADR 0025).
 * A diferencia de los productos (que un closer edita en sus programas), una fuente
 * es configuracion de infraestructura: la tocan gerente y developer, no el closer.
 * NUNCA se escribe el rol a mano: la respuesta vive en `lib/auth/roles.ts`.
 */
function exigirAdministrador(actor: Actor): void {
  if (!esAdministrador(actor.rol)) {
    throw new ErrorDeApp("No tienes permiso para administrar fuentes.", 403);
  }
}

/** Lee una fila de fuente por id (sin filtrar por activo). */
async function leerFuente(db: Db, id: string): Promise<FuenteVista | undefined> {
  const [fila] = await db.select().from(sources).where(eq(sources.id, id)).limit(1);
  return fila as FuenteVista | undefined;
}

/** La plantilla de lead del programa, para combinar el mapeo. Null si el programa no ajusta nada. */
async function plantillaDelPrograma(db: Db, programId: string): Promise<MapeoColumnas | null> {
  const [programa] = await db
    .select({ plantillaLead: programs.plantillaLead })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  if (!programa) throw new ErrorDeApp("No existe el programa.", 404);
  return (programa.plantillaLead as MapeoColumnas | null) ?? null;
}

/** Lista todas las fuentes de un programa (activas e inactivas), ordenadas por `orden`. */
export async function listarFuentes(db: Db, programId: string): Promise<FuenteVista[]> {
  const filas = await db
    .select()
    .from(sources)
    .where(eq(sources.programId, idValido(programId)))
    .orderBy(asc(sources.orden), asc(sources.nombre));
  return filas as FuenteVista[];
}

/**
 * Crea una fuente. NACE INACTIVA (ticket 016 punto 5): activarla exige una prueba
 * que pase. El molde escribe `change_log` con el `userId` del actor.
 */
export async function crearFuente(
  db: Db,
  actor: Actor,
  input: EntradaFuente,
): Promise<FuenteVista> {
  return normalizando(async () => {
    exigirAdministrador(actor);
    const datos = esquemaFuente.parse(input);
    await plantillaDelPrograma(db, datos.programId); // valida que el programa exista
    // `activo: false` va explicito para que la fuente nazca inactiva pese al default
    // `true` de la tabla. Queda registrado en `change_log`, que es lo correcto: la
    // fuente existe pero todavia no se probo.
    const fila = await moldeFuentes(db).crear(actor.id, { ...datos, activo: false });
    return fila as FuenteVista;
  });
}

/**
 * Edita los datos de una fuente. NO toca `activo`: preserva el valor actual para que
 * la edicion de datos no active ni desactive por accidente (eso es de
 * activar/desactivar). Editar el mapeo o la pestana de una fuente ACTIVA no la
 * re-prueba: la garantia es al activar, y editar deja la puerta abierta a corregir.
 */
export async function editarFuente(
  db: Db,
  actor: Actor,
  id: string,
  input: EntradaFuente,
): Promise<FuenteVista> {
  return normalizando(async () => {
    exigirAdministrador(actor);
    const objetivoId = idValido(id);
    const datos = esquemaFuente.parse(input);
    const actual = await leerFuente(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una fuente con ese id.", 404);
    const plantilla = await plantillaDelPrograma(db, datos.programId);

    // El invariante no es "se probo al activar": es **una fuente ACTIVA siempre tiene
    // un mapeo que cuadra**, y hay que defenderlo tambien por esta puerta. Sin esto,
    // activar probaba y despues bastaba EDITAR el mapeo para dejar la fuente activa y
    // rota: el mismo estado rancio que se evito al no guardar una bandera de "ultima
    // prueba ok", entrando por el otro lado.
    //
    // Se prueba con los datos NUEVOS y antes de escribir nada: si no cuadran, el
    // cambio se rechaza con 422 y la fuente sigue exactamente como estaba. No estorba
    // el caso legitimo —la hoja cambio un encabezado y el mapeo se ajusta para
    // seguirlo—, porque ese cambio SI pasa la prueba contra los encabezados reales.
    // Para cambiar una fuente activa a un estado que no cuadra hay que desactivarla
    // primero, que es decir en voz alta que el sync deje de leerla.
    if (actual.activo) {
      await probarMapeoDeFuente(
        {
          sheetId: datos.sheetId,
          tab: datos.tab,
          rango: datos.rango,
          mapeoColumnas: datos.mapeoColumnas,
        },
        plantilla,
      );
    }

    // Se re-supplea el `activo` actual para que el diff del molde no lo cuente como
    // cambio: la edicion de datos nunca cambia el estado de activacion.
    const fila = await moldeFuentes(db).editar(actor.id, objetivoId, {
      ...datos,
      activo: actual.activo,
    });
    return fila as FuenteVista;
  });
}

/**
 * Prueba el mapeo de una fuente ya guardada contra su hoja real. Herramienta de
 * edicion: no cambia `activo`. Devuelve que encabezado tomo cada campo, o lanza
 * `MapeoInvalidoError` (422) con lo que falto.
 */
export async function probarFuente(
  db: Db,
  actor: Actor,
  id: string,
): Promise<ResultadoPrueba> {
  return normalizando(async () => {
    exigirAdministrador(actor);
    const objetivoId = idValido(id);
    const actual = await leerFuente(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una fuente con ese id.", 404);
    if (!actual.sheetId || !actual.tab) {
      throw new ErrorDeApp("La fuente no tiene hoja o pestaña configurada.", 422);
    }
    const plantilla = await plantillaDelPrograma(db, actual.programId);
    return probarMapeoDeFuente(
      {
        sheetId: actual.sheetId,
        tab: actual.tab,
        rango: actual.rango,
        mapeoColumnas: actual.mapeoColumnas ?? null,
      },
      plantilla,
    );
  });
}

/**
 * Activa una fuente CORRIENDO la prueba en ese momento (ticket 016 punto 5). Si el
 * mapeo no cuadra con la hoja real, lanza `MapeoInvalidoError` (422) y la fuente
 * queda como estaba (inactiva). Solo si la prueba pasa se reactiva por el molde,
 * dejando rastro en `change_log`.
 */
export async function activarFuente(
  db: Db,
  actor: Actor,
  id: string,
): Promise<FuenteVista> {
  return normalizando(async () => {
    exigirAdministrador(actor);
    const objetivoId = idValido(id);
    const actual = await leerFuente(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una fuente con ese id.", 404);
    if (!actual.sheetId || !actual.tab) {
      throw new ErrorDeApp("La fuente no tiene hoja o pestaña configurada.", 422);
    }
    // La prueba corre ANTES de escribir nada. Si lanza (MapeoInvalidoError 422), la
    // fuente no se toca: nunca queda activa sin un mapeo que cuadre.
    const plantilla = await plantillaDelPrograma(db, actual.programId);
    await probarMapeoDeFuente(
      {
        sheetId: actual.sheetId,
        tab: actual.tab,
        rango: actual.rango,
        mapeoColumnas: actual.mapeoColumnas ?? null,
      },
      plantilla,
    );
    const fila = await moldeFuentes(db).reactivar(actor.id, objetivoId);
    return fila as FuenteVista;
  });
}

/** Desactiva una fuente (no la borra). El sync deja de leerla. */
export async function desactivarFuente(
  db: Db,
  actor: Actor,
  id: string,
): Promise<FuenteVista> {
  return normalizando(async () => {
    exigirAdministrador(actor);
    const objetivoId = idValido(id);
    const actual = await leerFuente(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una fuente con ese id.", 404);
    const fila = await moldeFuentes(db).desactivar(actor.id, objetivoId);
    return fila as FuenteVista;
  });
}
