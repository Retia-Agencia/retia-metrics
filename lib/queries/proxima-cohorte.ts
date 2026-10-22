import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { cohorts, dealActividades, deals, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { vigente } from "./vigente";

export const vistaProximaCohorteSchema = z.enum(["sin_asignar", "asignada"]);
export type VistaProximaCohorte = z.infer<typeof vistaProximaCohorteSchema>;

export function vistaProximaCohorte(valor: unknown): VistaProximaCohorte {
  const resultado = vistaProximaCohorteSchema.safeParse(valor);
  return resultado.success ? resultado.data : "sin_asignar";
}

export interface DealProximaCohorte {
  dealId: string;
  nombreLead: string | null;
  cohorteOrigenCodigo: string | null;
  etapa: EtapaDeal;
  cohorteDestinoCodigo: string | null;
  cohorteDestinoTexto: string | null;
  ownerNombre: string | null;
  esperaDesde: Date;
}

export async function dealsDeProximaCohorte(
  db: Db,
  programId: string,
  vista: VistaProximaCohorte = "sin_asignar",
): Promise<DealProximaCohorte[]> {
  const filas = await db
    .select({
      dealId: deals.id,
      nombreLead: leads.nombre,
      cohorteOrigenCodigo: cohorts.codigo,
      etapa: deals.etapa,
      cohorteDestinoId: deals.cohorteDestinoId,
      cohorteDestinoTexto: deals.cohorteDestinoTexto,
      ownerNombre: users.nombre,
      updatedAt: deals.updatedAt,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(cohorts, eq(cohorts.id, deals.cohortId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .where(and(
      eq(deals.programId, programId),
      eq(deals.pendiente, "proxima_cohorte"),
      vista === "sin_asignar" ? isNull(deals.cohorteDestinoId) : isNotNull(deals.cohorteDestinoId),
      vigente(deals),
    ));
  if (filas.length === 0) return [];

  const ids = filas.map((fila) => fila.dealId);
  const notas = await db
    .select({ dealId: dealActividades.dealId, fecha: sql<Date>`max(${dealActividades.fecha})` })
    .from(dealActividades)
    .where(and(
      inArray(dealActividades.dealId, ids),
      isNull(dealActividades.userId),
      or(
        sql`${dealActividades.nota} like 'Esperando corte: %'`,
        sql`${dealActividades.nota} like 'Esperando cohorte: %'`,
        sql`${dealActividades.nota} like 'Cohorte asignada: %'`,
      ),
    ))
    .groupBy(dealActividades.dealId);
  const fechaPorDeal = new Map(notas.map((nota) => [nota.dealId, new Date(nota.fecha)]));
  const destinos = await db
    .select({ id: cohorts.id, codigo: cohorts.codigo })
    .from(cohorts)
    .where(inArray(cohorts.id, filas.flatMap((fila) => fila.cohorteDestinoId ? [fila.cohorteDestinoId] : [])));
  const codigoPorId = new Map(destinos.map((destino) => [destino.id, destino.codigo]));

  return filas.map((fila) => ({
    dealId: fila.dealId,
    nombreLead: fila.nombreLead,
    cohorteOrigenCodigo: fila.cohorteOrigenCodigo,
    etapa: fila.etapa,
    cohorteDestinoCodigo: fila.cohorteDestinoId ? codigoPorId.get(fila.cohorteDestinoId) ?? null : null,
    cohorteDestinoTexto: fila.cohorteDestinoTexto,
    ownerNombre: fila.ownerNombre,
    esperaDesde: fechaPorDeal.get(fila.dealId) ?? fila.updatedAt,
  })).sort((a, b) => a.esperaDesde.getTime() - b.esperaDesde.getTime());
}
