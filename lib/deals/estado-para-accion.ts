import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { abonos, calls, dealEtapaHistorial, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { saldosDeDeals } from "@/lib/queries/saldo";

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

export async function estadoParaAccionLlamada(db: Db, callId: string, opciones: { bloquear?: true } = {}) {
  const consulta = db.select({
    id: calls.id, dealId: calls.dealId, resultado: calls.resultado, linkGrain: calls.linkGrain,
    fechaAgenda: calls.fechaAgenda, anuladoEn: calls.anuladoEn,
  }).from(calls).where(and(eq(calls.id, callId), incluyendoAnulados(calls)));
  const [fila] = opciones.bloquear ? await consulta.for("update", { of: calls }) : await consulta;
  return fila ?? null;
}

export async function estadoParaAccionAbono(db: Db, abonoId: string, opciones: { bloquear?: true } = {}) {
  const consulta = db.select({
    id: abonos.id, dealId: abonos.dealId, monto: abonos.monto,
    plataformaId: abonos.plataformaId, anuladoEn: abonos.anuladoEn,
  }).from(abonos).where(and(eq(abonos.id, abonoId), incluyendoAnulados(abonos)));
  const [fila] = opciones.bloquear ? await consulta.for("update", { of: abonos }) : await consulta;
  return fila ?? null;
}

export async function huellaDeAccionLlamada(db: Db, dealId: string, callId: string, opciones: { bloquear?: true } = {}): Promise<string | null> {
  const deal = await huellaDeAccionDeal(db, dealId, opciones);
  const llamada = await estadoParaAccionLlamada(db, callId, opciones);
  if (!deal || !llamada || llamada.dealId !== dealId) return null;
  return createHash("sha256").update(`${deal}\u0000${textoDeBitacora(llamada) ?? "null"}`).digest("hex");
}

export async function huellaDeAccionLlamadaSuelta(
  db: Db,
  dealId: string,
  callId: string,
  opciones: { bloquear?: true } = {},
): Promise<string | null> {
  const deal = await huellaDeAccionDeal(db, dealId, opciones);
  const llamada = await estadoParaAccionLlamada(db, callId, opciones);
  if (!deal || !llamada || llamada.dealId !== null) return null;
  return createHash("sha256").update(`${deal}\u0000${textoDeBitacora(llamada) ?? "null"}`).digest("hex");
}

export async function huellaDeAccionAbono(db: Db, dealId: string, abonoId: string, opciones: { bloquear?: true } = {}): Promise<string | null> {
  const deal = await huellaDeAccionAbonos(db, dealId, opciones);
  const abono = await estadoParaAccionAbono(db, abonoId, opciones);
  if (!deal || !abono || abono.dealId !== dealId) return null;
  return createHash("sha256").update(`${deal}\u0000${textoDeBitacora(abono) ?? "null"}`).digest("hex");
}

export async function huellaDeAccionAbonos(
  db: Db,
  dealId: string,
  opciones: { bloquear?: true } = {},
): Promise<string | null> {
  const deal = await huellaDeAccionDeal(db, dealId, opciones);
  if (!deal) return null;
  const consulta = db.select({ id: abonos.id }).from(abonos)
    .where(and(eq(abonos.dealId, dealId), vigente(abonos)));
  const filas = opciones.bloquear
    ? await consulta.for("update", { of: abonos })
    : await consulta;
  const saldo = (await saldosDeDeals(db, [dealId])).get(dealId);
  const estable = textoDeBitacora({
    deal,
    saldo: saldo?.saldo ?? null,
    abonado: saldo?.abonado ?? null,
    abonos: filas.map((fila) => fila.id).sort(),
  });
  return createHash("sha256").update(estable ?? "null").digest("hex");
}
