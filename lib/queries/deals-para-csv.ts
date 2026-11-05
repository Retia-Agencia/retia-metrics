import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cohorts, deals, leadContactos, leads, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { AlcanceDeals } from "@/lib/auth/alcance-deals";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { vigente } from "@/lib/queries/vigente";

/**
 * Los deals vigentes de UN programa en las etapas pedidas, con lo básico del lead, para el CSV.
 * El programa es frontera (ADR 0043) y el alcance es el de la lista de deals (ADR 0075): quien
 * ve solo lo suyo descarga solo lo suyo. El teléfono sale del lead y, si falta, del contacto.
 */
export async function dealsParaCsv(db: Db, programId: string, alcance: AlcanceDeals, etapas: readonly EtapaDeal[]) {
  if (etapas.length === 0) return [];
  const dueno = alias(users, "dueno");
  const filas = await db
    .select({
      dealId: deals.id,
      leadId: deals.leadId,
      etapa: deals.etapa,
      pendiente: deals.pendiente,
      creado: deals.createdAt,
      nombre: leads.nombre,
      correo: leads.emailNormalizado,
      telefono: leads.telefono,
      pais: leads.pais,
      ciudad: leads.ciudad,
      calidad: leads.leadQuality,
      valor: leads.leadValue,
      duenoNombre: dueno.nombre,
      duenoCorreo: dueno.email,
      cohorte: cohorts.codigo,
      utmSource: submissions.utmSource,
      utmMedium: submissions.utmMedium,
      utmCampaign: submissions.utmCampaign,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(dueno, eq(dueno.id, deals.ownerUserId))
    .leftJoin(cohorts, eq(cohorts.id, deals.cohortId))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .where(
      and(
        eq(deals.programId, programId),
        inArray(deals.etapa, [...etapas]),
        alcance.tipo === "dueno" ? eq(deals.ownerUserId, alcance.userId) : undefined,
        vigente(deals),
      ),
    )
    .orderBy(asc(deals.createdAt));

  const sinTelefono = [...new Set(filas.filter((f) => !f.telefono).map((f) => f.leadId))];
  const respaldo = new Map<string, string>();
  if (sinTelefono.length > 0) {
    const contactos = await db
      .select({ leadId: leadContactos.leadId, valor: leadContactos.valor, esPrincipal: leadContactos.esPrincipal })
      .from(leadContactos)
      .where(and(eq(leadContactos.programId, programId), eq(leadContactos.tipo, "telefono"), inArray(leadContactos.leadId, sinTelefono)))
      .orderBy(asc(leadContactos.esPrincipal), asc(leadContactos.createdAt));
    // Orden ascendente por principal: el último que se escribe en el mapa es el principal.
    for (const c of contactos) respaldo.set(c.leadId, c.valor);
  }
  return filas.map((f) => ({ ...f, telefono: f.telefono ?? respaldo.get(f.leadId) ?? null }));
}
