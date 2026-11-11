import { and, eq, isNotNull, notExists, sql } from "drizzle-orm";
import { calls, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "@/lib/queries/vigente";

/**
 * LA respuesta a "¿esta llamada cuenta, aunque su deal se haya anulado?" (ADR 0038, ADR 0115 N1, 11-nov).
 *
 * Anular un deal anula sus llamadas en cascada, pero una llamada vigente sobre un deal anulado puede existir
 * (creada o reactivada después, datos viejos) y ninguna métrica la cuenta: anulado no es Cierre Perdido, es un
 * error de tecleo. El hueco era sutil: unir el deal con `vigente(deals)` NO la saca, la vuelve una llamada
 * *suelta* (deal nulo) y una suelta sí cuenta; y unirlo con `incluyendoAnulados` la deja pasar entera. La barra de
 * cumplimiento y la lista de agendas dieron 4 contra 3 por eso, sin ningún error.
 *
 * Es una subconsulta cerrada que no depende de cómo se una el deal: la llamada sin deal (suelta) sigue contando y
 * la de un deal anulado no. Toda lectura de `calls` que una `deals` la aplica en su `where`;
 * `tests/llamada-sin-deal-anulado.test.ts` recorre las consultas y falla si una se olvida.
 */
export function llamadaSinDealAnulado(db: Db) {
  return notExists(
    db.select({ uno: sql`1` }).from(deals).where(and(
      eq(deals.id, calls.dealId),
      incluyendoAnulados(deals),
      // La llamada de afuera NO se filtra aquí (su vigencia la decide quien llama): la marca nombra esa decisión.
      incluyendoAnulados(calls),
      isNotNull(deals.anuladoEn),
    )),
  );
}
