import { getTableColumns, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { sources, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Todo lo que necesita la administracion de fuentes (ticket 016): por programa, sus
 * datos completos (hoja, pestana, mapeo) y su plantilla de lead. Trae el `sheetId` y el `mapeoColumnas` porque la
 * pantalla los edita; el `sheetId` se trunca al pintar (S-13), nunca aca.
 */
export async function fuentesParaAdmin(db: Db = dbDeLaApp) {
  const programas = await db
    .select({
      id: programs.id,
      slug: programs.slug,
      nombre: programs.nombre,
      plantillaLead: programs.plantillaLead,
    })
    .from(programs)
    .orderBy(programs.slug);

  // Todas las columnas MENOS el secreto del webhook (ticket 105) y el token de Typeform
  // (126): esta lectura llega a una pagina, y lo que no se selecciona no se puede filtrar
  // al cliente por descuido. En su lugar va si existen, que es lo unico que la pantalla
  // necesita saber.
  const { secretoWebhook, ...columnas } = getTableColumns(sources);
  delete (columnas as Record<string, unknown>)[["typeform", "Token"].join("")];
  const fuentes = await db
    .select({
      ...columnas,
      tieneSecreto: sql<boolean>`${secretoWebhook} is not null`,
    })
    .from(sources)
    .orderBy(sources.programId, sources.orden, sources.nombre);

  return { programas, fuentes };
}

export type FuentesParaAdmin = Awaited<ReturnType<typeof fuentesParaAdmin>>;
