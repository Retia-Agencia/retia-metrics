import { eq } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { changeLog } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";

/**
 * La operacion `reemplazar` de las entidades versionadas (recursos y enlaces de
 * pago, ADR 0017). Vive en un modulo compartido porque las dos hacen exactamente
 * lo mismo y el ORDEN de las dos escrituras no es opcional (regla dura del ticket
 * 022): si dos lugares tienen que hacer lo mismo, lo hace un modulo y los dos lo
 * importan (ADR 0024).
 *
 * Reemplazar crea la fila NUEVA vigente apuntando con `reemplazaA` a la anterior, y
 * marca la anterior NO vigente. La anterior NO se borra ni se desactiva: el
 * historial es el punto (ADR 0017).
 *
 * La base tiene un indice unico PARCIAL (una sola version vigente por clave). Si se
 * inserta la fila nueva mientras la vieja sigue `vigente = true`, Postgres rechaza
 * con 23505. Por eso, dentro del mismo lote atomico (`ejecutarJuntas`): PRIMERO el
 * UPDATE que baja la vieja, DESPUES el INSERT de la nueva.
 */

/** Forma minima de una fila versionada que este helper necesita conocer. */
export interface FilaVersionada {
  id: string;
  url: string;
  vigente: boolean;
  reemplazaA: string | null;
  [columna: string]: unknown;
}

export interface OpcionesReemplazo {
  db: Db;
  /** La tabla de Drizzle. Debe tener columnas `id`, `url`, `vigente`, `reemplazaA`. */
  tabla: PgTable;
  /** Nombre real de la tabla; se guarda en `change_log.tabla`. */
  nombreTabla: string;
  /** Nombre de la entidad en singular, para los mensajes de error. */
  nombreEntidad: string;
  /** Etiqueta legible de una fila, para el change_log. */
  etiqueta: (fila: FilaVersionada) => string;
  /** userId de quien hace el cambio. */
  userId: string;
  /** id de la fila vigente a reemplazar. */
  id: string;
  /** La URL nueva, ya validada como https:// por el esquema de la entidad. */
  nuevaUrl: string;
}

/** Detecta la violacion de indice unico de Postgres (code `23505`). */
function esViolacionUnica(error: unknown): boolean {
  let actual: unknown = error;
  for (let i = 0; i < 5 && actual != null; i++) {
    if (typeof actual === "object" && (actual as { code?: unknown }).code === "23505") {
      return true;
    }
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Reemplaza la fila vigente `id` por una copia con la URL nueva. Devuelve la fila
 * nueva ya vigente. Lanza 404 si la fila no existe.
 */
export async function reemplazarVersionado(opciones: OpcionesReemplazo): Promise<FilaVersionada> {
  const { db, tabla, nombreTabla, nombreEntidad, etiqueta, userId, id, nuevaUrl } = opciones;

  const columnas = tabla as unknown as Record<string, unknown>;
  const idCol = columnas.id as never;

  const [anterior] = (await db
    .select()
    .from(tabla as never)
    .where(eq(idCol, id))) as FilaVersionada[];
  if (!anterior) throw new ErrorDeApp(`No existe ${nombreEntidad} con ese id.`, 404);

  const nuevoId = crypto.randomUUID();
  // La fila nueva copia todo lo de la anterior salvo id/vigente/reemplazaA/url.
  const { id: _viejoId, createdAt: _createdAt, ...resto } = anterior as Record<string, unknown>;
  void _viejoId;
  void _createdAt;
  const filaNueva = {
    ...resto,
    id: nuevoId,
    url: nuevaUrl,
    vigente: true,
    reemplazaA: id,
  };
  const etiquetaFila = etiqueta(filaNueva as FilaVersionada);

  try {
    await ejecutarJuntas(db, (tx) => [
      // 1) PRIMERO baja la vigente anterior: libera el cupo del indice parcial.
      (tx as Db)
        .update(tabla as never)
        .set({ vigente: false } as never)
        .where(eq(idCol, id)),
      // 2) DESPUES inserta la nueva vigente.
      (tx as Db).insert(tabla as never).values(filaNueva as never),
      // change_log: la version nueva, con la url que cambio y a quien reemplaza.
      (tx as Db).insert(changeLog).values({
        tabla: nombreTabla,
        registroId: nuevoId,
        etiqueta: etiquetaFila,
        campo: "url",
        valorAnterior: String(anterior.url),
        valorNuevo: nuevaUrl,
        origen: "app" as const,
        userId,
      }),
      (tx as Db).insert(changeLog).values({
        tabla: nombreTabla,
        registroId: nuevoId,
        etiqueta: etiquetaFila,
        campo: "reemplazaA",
        valorAnterior: null,
        valorNuevo: id,
        origen: "app" as const,
        userId,
      }),
    ]);
  } catch (error) {
    if (esViolacionUnica(error)) {
      throw new ErrorDeApp(`Ya existe otra versión vigente de ${nombreEntidad}.`, 409);
    }
    throw error;
  }

  const [creada] = (await db
    .select()
    .from(tabla as never)
    .where(eq(idCol, nuevoId))) as FilaVersionada[];
  return creada;
}
