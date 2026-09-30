import { and, eq, inArray, isNull } from "drizzle-orm";
import { deals, leads, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { envioMasReciente, type EnvioCandidato } from "@/lib/ingesta/envio-de-origen";
import { vigente } from "@/lib/queries/vigente";

/**
 * El relleno UNICO del origen de los deals que nacieron antes del ADR 0060 (ticket 115):
 * hasta el 29-sep ningun deal guardaba el envio que lo abrio (0 de 58).
 *
 * El origen de cada deal vivo sin uno es **el envio mas reciente del lead que ya existia
 * cuando se creo el deal** (`fecha_envio <= deals.created_at`), con el mismo orden que
 * `envioMasReciente`. Un envio sin fecha (el placeholder de un parcial) cuenta como previo:
 * no hay como probar que llego despues, y `envioMasReciente` ya lo pone detras de cualquier
 * fechado. Un envio posterior al deal NO: seria atribuirle a la venta un clic que la venta
 * no vio.
 *
 * Sin ningun envio previo, el deal queda en nulo y el reporte dice por que. Nunca se
 * inventa un canal.
 *
 * Idempotente: solo toca deals con el origen en nulo, asi que una segunda corrida no cambia
 * nada. Cada escritura pasa por `editarConRastro` (ADR 0042): queda en `change_log` con el
 * actor del script.
 */

export interface ReporteRellenoOrigen {
  /** Deals vivos que no tenian origen. */
  sinOrigen: number;
  /** A cuantos se les encontro (y, con `aplicar`, se les escribio) un envio de origen. */
  rellenados: number;
  /** El lead no tiene ningun envio: el deal queda en nulo. */
  sinEnvios: number;
  /** El lead tiene envios, pero todos llegaron DESPUES de crear el deal: queda en nulo. */
  sinEnviosPrevios: number;
}

export async function rellenarOrigenDeDeals(
  db: Db,
  opciones: { actorId: string; aplicar: boolean },
): Promise<ReporteRellenoOrigen> {
  const pendientes = await db
    .select({
      id: deals.id,
      leadId: deals.leadId,
      createdAt: deals.createdAt,
      etiqueta: leads.nombre,
      correo: leads.emailNormalizado,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(isNull(deals.submissionOrigenId), vigente(deals)));

  const reporte: ReporteRellenoOrigen = { sinOrigen: pendientes.length, rellenados: 0, sinEnvios: 0, sinEnviosPrevios: 0 };
  if (pendientes.length === 0) return reporte;

  // Los envios de esos leads, en UNA lectura, unidos en memoria (nada de subconsultas
  // correlacionadas, AGENTS.md). La frontera de programa la da el lead: un envio cuelga de
  // un lead, y el lead es del programa del deal (lo exige `abrirDeal`).
  const leadIds = [...new Set(pendientes.map((p) => p.leadId))];
  const envios = await db
    .select({
      leadId: submissions.leadId,
      id: submissions.id,
      fechaEnvio: submissions.fechaEnvio,
      posicionEnHoja: submissions.posicionEnHoja,
    })
    .from(submissions)
    .where(inArray(submissions.leadId, leadIds));
  const porLead = new Map<string, EnvioCandidato[]>();
  for (const e of envios) {
    if (e.leadId === null) continue;
    porLead.set(e.leadId, [...(porLead.get(e.leadId) ?? []), e]);
  }

  for (const deal of pendientes) {
    const delLead = porLead.get(deal.leadId) ?? [];
    if (delLead.length === 0) {
      reporte.sinEnvios++;
      continue;
    }
    const previos = delLead.filter((e) => e.fechaEnvio === null || e.fechaEnvio <= deal.createdAt);
    const origen = envioMasReciente(previos);
    if (origen === null) {
      reporte.sinEnviosPrevios++;
      continue;
    }
    reporte.rellenados++;
    if (!opciones.aplicar) continue;
    await editarConRastro(
      { db, tabla: deals, nombreTabla: "deals", actorId: opciones.actorId, etiqueta: deal.etiqueta ?? deal.correo },
      deal.id,
      { submissionOrigenId: origen },
    );
  }
  return reporte;
}
