import { and, eq } from "drizzle-orm";
import { cohorts, deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { fechaEfectivaDePago } from "@/lib/deals/pago";
import { hoyEnBogota } from "@/lib/format";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { vigente } from "@/lib/queries/vigente";

/**
 * La cartera vencida de un programa (ticket 061, ADR 0053): los deals vigentes en Abonado con
 * **saldo > 0** cuya **fecha límite de pago ya pasó**. Un deal no se cierra sin el pago
 * completo (Mani, 28-sep), así que esta es la lista a la que se le hace seguimiento.
 *
 * - **El saldo no se suma aquí:** sale de `saldosDeDeals` (ADR 0024), la misma cifra que la
 *   reja del sobrepago y que ve el closer.
 * - **La fecha efectiva** es la `fecha_limite_pago` del deal; si no la tiene, el inicio de
 *   clases de su cohorte (o el de la cohorte activa del programa): así un deal con saldo y sin
 *   fecha nunca queda sin vigilar (Mani, 28-sep). Lo que no tiene NINGUNA fecha de referencia
 *   no puede decirse vencido ni al día: se cuenta aparte en `sinFechaDeReferencia` para que la
 *   pantalla lo muestre en vez de esconderlo.
 * - **El programa es frontera** (ADR 0043): la función recibe UN programa y no admite "todos".
 * - **Vencida es estrictamente anterior a hoy** (día de Bogotá): el día de la fecha límite aún
 *   es plazo. No hay gracia ni movimiento automático: solo lista (Mani, 28-sep).
 */
export interface DealEnCartera {
  dealId: string;
  leadId: string;
  nombreLead: string | null;
  emailLead: string;
  ownerUserId: string | null;
  saldo: number;
  moneda: string | null;
  /** La fecha efectiva contra la que se midió (`YYYY-MM-DD`). */
  fechaLimite: string;
  /** Si la fecha viene del deal (`true`) o del inicio de clases de su cohorte (`false`). */
  fechaPropia: boolean;
  diasDeAtraso: number;
  acuerdoPago: string | null;
}

export interface CarteraVencida {
  vencidos: DealEnCartera[];
  /** Deals en Abonado con saldo y sin fecha de referencia alguna: ni vencidos ni al día. */
  sinFechaDeReferencia: number;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Días de calendario entre dos `YYYY-MM-DD` (b - a). Sin zonas: se compara en UTC a medianoche. */
function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / MS_POR_DIA);
}

export async function carteraVencida(db: Db, programId: string, hoy: string = hoyEnBogota()): Promise<CarteraVencida> {
  const filas = await db
    .select({
      dealId: deals.id,
      leadId: deals.leadId,
      ownerUserId: deals.ownerUserId,
      fechaLimitePago: deals.fechaLimitePago,
      acuerdoPago: deals.acuerdoPago,
      inicioDeSuCohorte: cohorts.fechaInicioClases,
      nombreLead: leads.nombre,
      emailLead: leads.emailNormalizado,
    })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(cohorts, and(eq(cohorts.id, deals.cohortId), eq(cohorts.programId, deals.programId)))
    .where(and(eq(deals.programId, programId), eq(deals.etapa, "abonado"), vigente(deals)));
  if (filas.length === 0) return { vencidos: [], sinFechaDeReferencia: 0 };

  const inicioDeLaActiva = (await cohorteActiva(programId, db))?.fechaInicioClases ?? null;
  const saldos = await saldosDeDeals(db, filas.map((f) => f.dealId));

  const vencidos: DealEnCartera[] = [];
  let sinFechaDeReferencia = 0;
  for (const f of filas) {
    const saldo = saldos.get(f.dealId);
    // Sin saldo calculable (sin producto o monedas mezcladas) no hay cartera que medir; el
    // saldo en cero es un deal pagado. En los dos casos no es cartera.
    if (!saldo || saldo.saldo === null || saldo.saldo <= 0) continue;

    const fechaLimite = fechaEfectivaDePago(f.fechaLimitePago, f.inicioDeSuCohorte, inicioDeLaActiva);
    if (fechaLimite === null) {
      sinFechaDeReferencia++;
      continue;
    }
    if (fechaLimite >= hoy) continue;
    vencidos.push({
      dealId: f.dealId,
      leadId: f.leadId,
      nombreLead: f.nombreLead,
      emailLead: f.emailLead,
      ownerUserId: f.ownerUserId,
      saldo: saldo.saldo,
      moneda: saldo.moneda,
      fechaLimite,
      fechaPropia: f.fechaLimitePago !== null,
      diasDeAtraso: diasEntre(fechaLimite, hoy),
      acuerdoPago: f.acuerdoPago,
    });
  }
  // Lo más atrasado primero: es a quien hay que perseguir antes.
  vencidos.sort((a, b) => b.diasDeAtraso - a.diasDeAtraso || a.emailLead.localeCompare(b.emailLead));
  return { vencidos, sinFechaDeReferencia };
}
