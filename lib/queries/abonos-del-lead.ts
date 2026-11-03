import { and, desc, eq } from "drizzle-orm";
import { abonos, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

export interface AbonoDelLead {
  id: string;
  fecha: string;
  monto: string;
  moneda: string;
  concepto: "ticket" | "adicional";
  comprobanteUrl: string | null;
  comprobanteArchivoId: string | null;
}

/**
 * Los abonos vigentes de un lead, de todos sus deals vigentes, para la ficha del Lead: es donde
 * el customer success (que no abre la ficha del deal) ve lo que pagó un student y sus
 * comprobantes. Solo lectura y ningún total sale de aquí (el saldo vive en `lib/queries/saldo.ts`).
 * El programa es frontera: el abono y el deal se filtran por él.
 */
export async function abonosDelLead(db: Db, programId: string, leadId: string): Promise<AbonoDelLead[]> {
  return db
    .select({
      id: abonos.id,
      fecha: abonos.fecha,
      monto: abonos.monto,
      moneda: abonos.moneda,
      concepto: abonos.concepto,
      comprobanteUrl: abonos.comprobanteUrl,
      comprobanteArchivoId: abonos.comprobanteArchivoId,
    })
    .from(abonos)
    .innerJoin(deals, eq(deals.id, abonos.dealId))
    .where(and(eq(abonos.programId, programId), eq(deals.programId, programId), eq(deals.leadId, leadId), vigente(abonos), vigente(deals)))
    .orderBy(desc(abonos.fecha), desc(abonos.createdAt));
}
