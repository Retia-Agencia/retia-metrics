import { and, inArray, lt, max, sql } from "drizzle-orm";
import { abonos, calls, dealActividades, dealEtapaHistorial } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";

/**
 * La última actividad por deal (UNA definición: la usan "estancado" del Inbox y el filtro de
 * fecha de la lista de deals, ticket 141), como instante: el máximo entre actividades, llamadas (por
 * creación y por cita), abonos y movimientos de etapa. El `created_at` del deal lo aporta
 * el llamador (así un deal recién creado sin ningún registro tiene una fecha base). Los
 * abonos y las llamadas se leen VIGENTES: un registro anulado no cuenta como actividad.
 *
 * `hasta` deja fuera lo que todavía no pasó (la cita agendada para el martes): la lista de deals
 * filtra por actividad OCURRIDA (ticket 141). El Inbox no lo pasa: para "estancado", una cita
 * futura sí es atención al deal.
 */
export async function ultimaActividadPorDeal(
  db: Db,
  dealIds: string[],
  deals_: { dealId: string; createdAt: Date }[],
  hasta?: Date,
): Promise<Map<string, Date>> {
  const map = new Map<string, Date>();
  const anota = (dealId: string | null, cuando: Date | null | undefined) => {
    if (dealId == null || cuando == null) return;
    if (hasta && cuando.getTime() > hasta.getTime()) return;
    const previo = map.get(dealId);
    if (!previo || cuando.getTime() > previo.getTime()) map.set(dealId, cuando);
  };

  // La base: el created_at del deal, para el que no tiene ningún otro registro.
  for (const d of deals_) anota(d.dealId, d.createdAt);
  if (dealIds.length === 0) return map;

  const [actividades, llamadas, pagos, movimientos] = await Promise.all([
    db
      .select({ dealId: dealActividades.dealId, fecha: dealActividades.fecha })
      .from(dealActividades)
      .where(and(inArray(dealActividades.dealId, dealIds), vigente(dealActividades))),
    db
      .select({ dealId: calls.dealId, createdAt: calls.createdAt, fechaAgenda: calls.fechaAgenda })
      .from(calls)
      .where(and(inArray(calls.dealId, dealIds), vigente(calls))),
    db
      .select({ dealId: abonos.dealId, fecha: abonos.fecha })
      .from(abonos)
      .where(and(inArray(abonos.dealId, dealIds), vigente(abonos))),
    db
      .select({ dealId: dealEtapaHistorial.dealId, fecha: dealEtapaHistorial.fecha })
      .from(dealEtapaHistorial)
      .where(inArray(dealEtapaHistorial.dealId, dealIds)),
  ]);

  for (const a of actividades) anota(a.dealId, a.fecha);
  for (const c of llamadas) {
    anota(c.dealId, c.createdAt);
    anota(c.dealId, c.fechaAgenda);
  }
  // `abonos.fecha` es un día de calendario (`date`): se lee a medianoche de Bogotá.
  for (const p of pagos) anota(p.dealId, p.fecha ? new Date(`${p.fecha}T00:00:00-05:00`) : null);
  for (const m of movimientos) anota(m.dealId, m.fecha);

  return map;
}

/**
 * Mitad SQL de `ultimaActividadPorDeal`. Cada fuente queda agrupada por deal para que el
 * llamador la una a `deals`; nunca ejecuta una subconsulta correlacionada por tarjeta.
 */
export function ultimaActividadSql(db: Db, hasta?: Date) {
  const limiteExclusivo = hasta ? new Date(hasta.getTime() + 1) : undefined;
  const actividades = db.select({ dealId: dealActividades.dealId, fecha: max(dealActividades.fecha).as("fecha") })
    .from(dealActividades)
    .where(and(vigente(dealActividades), limiteExclusivo ? lt(dealActividades.fecha, limiteExclusivo) : undefined))
    .groupBy(dealActividades.dealId).as("ultima_actividad_actividades");
  const llamadasCreadas = db.select({ dealId: calls.dealId, fecha: max(calls.createdAt).as("fecha") })
    .from(calls)
    .where(and(vigente(calls), limiteExclusivo ? lt(calls.createdAt, limiteExclusivo) : undefined))
    .groupBy(calls.dealId).as("ultima_actividad_llamadas_creadas");
  const llamadasAgendadas = db.select({ dealId: calls.dealId, fecha: max(calls.fechaAgenda).as("fecha") })
    .from(calls)
    .where(and(vigente(calls), limiteExclusivo ? lt(calls.fechaAgenda, limiteExclusivo) : undefined))
    .groupBy(calls.dealId).as("ultima_actividad_llamadas_agendadas");
  const diaLimite = hasta
    ? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(hasta)
    : undefined;
  const pagos = db.select({
    dealId: abonos.dealId,
    fecha: sql<Date>`max(${abonos.fecha})::timestamp at time zone 'America/Bogota'`.as("fecha"),
  }).from(abonos)
    .where(and(vigente(abonos), diaLimite ? sql`${abonos.fecha} <= ${diaLimite}` : undefined))
    .groupBy(abonos.dealId).as("ultima_actividad_pagos");
  const movimientos = db.select({ dealId: dealEtapaHistorial.dealId, fecha: max(dealEtapaHistorial.fecha).as("fecha") })
    .from(dealEtapaHistorial)
    .where(limiteExclusivo ? lt(dealEtapaHistorial.fecha, limiteExclusivo) : undefined)
    .groupBy(dealEtapaHistorial.dealId).as("ultima_actividad_movimientos");
  const fecha = sql<Date>`greatest(
    deals.created_at,
    "ultima_actividad_actividades"."fecha",
    "ultima_actividad_llamadas_creadas"."fecha",
    "ultima_actividad_llamadas_agendadas"."fecha",
    "ultima_actividad_pagos"."fecha",
    "ultima_actividad_movimientos"."fecha"
  )`.mapWith(dealActividades.fecha);
  return { actividades, llamadasCreadas, llamadasAgendadas, pagos, movimientos, fecha };
}
