import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { vigente } from "@/lib/queries/vigente";

/**
 * `otrosProgramasDelCorreo` (ticket 091, ADR 0043 punto 6): la UNICA visibilidad cruzada de un
 * lead. Dice que el mismo correo tambien es lead de otro programa, con la etapa de su deal, para
 * que la ficha del Lead lo avise.
 *
 * - **Es una consulta, no una tabla** (ADR 0043 punto 5): `leads` ya guarda el correo normalizado,
 *   y una tabla `personas` construiria el puente por el que un `join` cruza la frontera. Medido el
 *   21-sep: 5 correos de 4.818.
 * - **Ninguna metrica la usa.** La llama solo la ficha del Lead; `tests/otros-programas-del-correo.test.ts`
 *   recorre el codigo y falla si otro modulo la importa. Que la pantalla muestre el hecho no
 *   significa que el embudo lo sume.
 * - **La proyeccion es del llamador:** la funcion devuelve el hecho; que parte ve cada sesion
 *   (el nombre del programa, la etapa, el enlace) lo decide la pantalla con la funcion de alcance.
 * - No une, no fusiona y no comparte id entre los dos leads.
 */

export interface LeadEnOtroPrograma {
  programId: string;
  programaNombre: string;
  programaSlug: string;
  leadId: string;
  /** El deal vigente que importa: el abierto si hay; si no, el mas reciente. `null` sin deals. */
  deal: { etapa: EtapaDeal; cerrado: boolean } | null;
}

const CERRADAS: readonly EtapaDeal[] = ["ganado_completo", "cierre_perdido"];

/** Los leads con ESE correo (ya normalizado) en programas distintos de `programaActualId`. */
export async function otrosProgramasDelCorreo(
  db: Db,
  emailNormalizado: string,
  programaActualId: string,
): Promise<LeadEnOtroPrograma[]> {
  const otros = await db
    .select({
      leadId: leads.id,
      programId: leads.programId,
      programaNombre: programs.nombre,
      programaSlug: programs.slug,
    })
    .from(leads)
    .innerJoin(programs, eq(programs.id, leads.programId))
    .where(and(eq(leads.emailNormalizado, emailNormalizado), ne(leads.programId, programaActualId)))
    .orderBy(programs.nombre);
  if (otros.length === 0) return [];

  // Un deal anulado no es un estado del negocio (ADR 0038): no se avisa con su etapa.
  const dealsFilas = await db
    .select({ leadId: deals.leadId, etapa: deals.etapa, createdAt: deals.createdAt })
    .from(deals)
    .where(and(inArray(deals.leadId, otros.map((o) => o.leadId)), vigente(deals)))
    .orderBy(desc(deals.createdAt));

  return otros.map((o) => {
    const suyos = dealsFilas.filter((d) => d.leadId === o.leadId);
    const elegido = suyos.find((d) => !CERRADAS.includes(d.etapa)) ?? suyos[0];
    return {
      ...o,
      deal: elegido ? { etapa: elegido.etapa, cerrado: CERRADAS.includes(elegido.etapa) } : null,
    };
  });
}
