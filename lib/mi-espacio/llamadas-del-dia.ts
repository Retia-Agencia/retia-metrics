import { and, asc, between, eq, isNull, ne, or, sql } from "drizzle-orm";
import { calls, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { sumarDias } from "@/lib/dias-habiles";
import { fechaAnclaCall } from "@/lib/queries/metricas-filtros";
import { vigente } from "@/lib/queries/vigente";

export type RangoMiDia = "hoy" | "manana" | "semana";

export function rangoDeMiDia(hoy: string, rango: RangoMiDia) {
  const desde = rango === "manana" ? sumarDias(hoy, 1) : hoy;
  const hasta = rango === "semana" ? sumarDias(hoy, 6) : desde;
  return { desde, hasta };
}

export async function llamadasDelCloser(
  db: Db,
  entrada: {
    programId: string;
    userId: string;
    rango: RangoMiDia;
    hoy: string;
    soloSinConfirmar?: boolean;
  },
) {
  const rango = rangoDeMiDia(entrada.hoy, entrada.rango);
  const hora = sql<Date>`coalesce(${calls.fechaAgenda}, ${calls.fechaLlamada})`.mapWith(calls.fechaAgenda);
  return db
    .select({
      callId: calls.id,
      dealId: deals.id,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      hora,
      resultado: calls.resultado,
      confirmacion: calls.confirmacion,
      linkCalendly: calls.linkCalendly,
    })
    .from(calls)
    .innerJoin(deals, and(eq(deals.id, calls.dealId), vigente(deals)))
    .innerJoin(leads, and(eq(leads.id, deals.leadId), eq(leads.programId, deals.programId)))
    .where(and(
      eq(calls.programId, entrada.programId),
      eq(deals.programId, entrada.programId),
      eq(deals.ownerUserId, entrada.userId),
      between(fechaAnclaCall(), rango.desde, rango.hasta),
      entrada.soloSinConfirmar
        ? or(isNull(calls.confirmacion), ne(calls.confirmacion, "confirmada"))
        : undefined,
      vigente(calls),
    ))
    .orderBy(asc(hora));
}

export type LlamadaDelDia = Awaited<ReturnType<typeof llamadasDelCloser>>[number];
