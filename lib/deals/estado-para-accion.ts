import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { dealEtapaHistorial, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import { incluyendoAnulados } from "@/lib/queries/vigente";

export interface EstadoParaAccionDeal {
  id: string;
  programId: string;
  etapa: typeof deals.$inferSelect.etapa;
  pendiente: typeof deals.$inferSelect.pendiente;
  ownerUserId: string | null;
  cohortId: string | null;
  anuladoEn: Date | null;
  ultimoMovimientoId: string | null;
  nombreLead: string | null;
}

export async function estadoParaAccionDeal(
  db: Db,
  dealId: string,
  opciones: { bloquear?: true } = {},
): Promise<EstadoParaAccionDeal | null> {
  const consulta = db.select({
    id: deals.id,
    programId: deals.programId,
    etapa: deals.etapa,
    pendiente: deals.pendiente,
    ownerUserId: deals.ownerUserId,
    cohortId: deals.cohortId,
    anuladoEn: deals.anuladoEn,
    nombreLead: leads.nombre,
  }).from(deals).innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  const [deal] = opciones.bloquear
    ? await consulta.for("update", { of: deals })
    : await consulta;
  if (!deal) return null;
  const [ultimo] = await db.select({ id: dealEtapaHistorial.id }).from(dealEtapaHistorial)
    .where(eq(dealEtapaHistorial.dealId, dealId))
    .orderBy(desc(dealEtapaHistorial.fecha), desc(dealEtapaHistorial.id)).limit(1);
  return { ...deal, ultimoMovimientoId: ultimo?.id ?? null };
}

export async function huellaDeAccionDeal(db: Db, dealId: string, opciones: { bloquear?: true } = {}): Promise<string | null> {
  const estado = await estadoParaAccionDeal(db, dealId, opciones);
  if (!estado) return null;
  const estable = textoDeBitacora({
    etapa: estado.etapa,
    pendiente: estado.pendiente,
    ownerUserId: estado.ownerUserId,
    cohortId: estado.cohortId,
    anuladoEn: estado.anuladoEn,
    ultimoMovimientoId: estado.ultimoMovimientoId,
  });
  return createHash("sha256").update(estable ?? "null").digest("hex");
}
