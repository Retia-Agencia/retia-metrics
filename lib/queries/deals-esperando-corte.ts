import { and, asc, eq, sql } from "drizzle-orm";
import { dealActividades, deals, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "./vigente";

export interface DealEsperandoCorte {
  dealId: string;
  nombreLead: string | null;
  emailLead: string;
  ownerNombre: string | null;
  textoCorte: string;
  anotadoEn: Date;
}

/** Bandeja por programa; el texto se muestra, nunca se interpreta para elegir destino. */
export async function dealsEsperandoCorte(db: Db, programId: string): Promise<DealEsperandoCorte[]> {
  const filas = await db
    .select({
      dealId: deals.id,
      nombreLead: leads.nombre,
      emailLead: leads.emailNormalizado,
      ownerNombre: users.nombre,
      textoCorte: deals.cohorteDestinoTexto,
      anotadoEn: sql<Date>`max(${dealActividades.fecha})`,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(users, eq(users.id, deals.ownerUserId))
    .innerJoin(
      dealActividades,
      and(eq(dealActividades.dealId, deals.id), sql`${dealActividades.nota} like 'Esperando corte: %'`),
    )
    .where(and(
      eq(deals.programId, programId),
      eq(deals.pendiente, "proxima_cohorte"),
      sql`${deals.cohorteDestinoId} is null`,
      vigente(deals),
    ))
    .groupBy(deals.id, leads.nombre, leads.emailNormalizado, users.nombre, deals.cohorteDestinoTexto)
    .orderBy(asc(sql`max(${dealActividades.fecha})`));
  return filas.flatMap((fila) => fila.textoCorte && fila.anotadoEn ? [{ ...fila, textoCorte: fila.textoCorte }] : []);
}
