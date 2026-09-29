import { eq } from "drizzle-orm";
import { sobresCrudos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * La CAJA NEGRA de los webhooks (ADR 0058, migraciones 0034 y 0039): apenas la firma
 * cuadra, el cuerpo crudo se guarda con `error: null`; si algo despues no se puede
 * procesar, esa MISMA fila se actualiza con el error y la ruta responde 200. La usan las
 * dos rutas que reciben webhooks: la de formularios (una fuente) y la de Calendly (el
 * programa, sin fuente).
 *
 * Guardar el sobre NUNCA tumba el procesamiento: si la escritura falla se loguea y se
 * sigue.
 */

/** De donde viene el sobre: la fuente de un formulario, o Calendly (del programa). */
export type DuenoDelSobre =
  | { canal: "formulario"; sourceId: string; programId: string }
  | { canal: "calendly"; programId: string };

function valores(dueno: DuenoDelSobre, cuerpo: string, error: string | null) {
  return {
    origen: dueno.canal,
    sourceId: dueno.canal === "formulario" ? dueno.sourceId : null,
    programId: dueno.programId,
    cuerpo,
    error,
  };
}

/** Guarda el cuerpo crudo con firma buena. Devuelve el id, o `null` si no se pudo escribir. */
export async function guardarSobre(db: Db, dueno: DuenoDelSobre, cuerpo: string): Promise<string | null> {
  try {
    const [fila] = await db.insert(sobresCrudos).values(valores(dueno, cuerpo, null)).returning();
    return fila?.id ?? null;
  } catch (e) {
    console.error(`[webhook] no se pudo registrar el sobre crudo (${dueno.canal}, programa ${dueno.programId})`, e);
    return null;
  }
}

/**
 * Marca el sobre de ESTA entrega con el error. Si ya hay fila la ACTUALIZA; si el insert
 * inicial habia fallado (`sobreId` nulo), intenta un insert de respaldo. Cualquier fallo
 * al escribir se loguea y no cambia la respuesta.
 */
export async function marcarSobreConError(
  db: Db,
  sobreId: string | null,
  dueno: DuenoDelSobre,
  cuerpo: string,
  error: string,
): Promise<void> {
  try {
    if (sobreId !== null) {
      await db.update(sobresCrudos).set({ error }).where(eq(sobresCrudos.id, sobreId));
    } else {
      await db.insert(sobresCrudos).values(valores(dueno, cuerpo, error));
    }
  } catch (e) {
    console.error(`[webhook] no se pudo marcar el sobre crudo (${dueno.canal}, programa ${dueno.programId})`, e);
  }
}
