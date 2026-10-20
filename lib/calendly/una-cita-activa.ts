import { and, eq, gt, ne } from "drizzle-orm";
import { calls } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { editarConRastro } from "@/lib/crm/rastro";
import { vigente } from "@/lib/queries/vigente";
import { dejarNotaDelSistema } from "@/lib/deals/nota-del-sistema";
import { fechaHoraEnBogota } from "@/lib/format";
import { registrarNovedadCalendly } from "@/lib/notificaciones-calendly/notificaciones";
import { citaDeCalendly, type FetchLike } from "./cita";
import { cancelarCita, tokenDeCalendlyDelPrograma } from "./escritura";

export type CitaACancelar = { dealId: string; callId: string };

export async function reemplazarCitasAnteriores(
  tx: Db,
  entrada: { dealId: string; callIdNueva: string; ahora?: Date },
): Promise<CitaACancelar[]> {
  const ahora = entrada.ahora ?? new Date();
  const [nueva] = await tx
    .select({
      id: calls.id,
      programId: calls.programId,
      fechaAgenda: calls.fechaAgenda,
      resultado: calls.resultado,
    })
    .from(calls)
    .where(and(eq(calls.id, entrada.callIdNueva), eq(calls.dealId, entrada.dealId), vigente(calls)));
  if (!nueva?.fechaAgenda || nueva.resultado !== "agendada" || nueva.fechaAgenda <= ahora) return [];

  const anteriores = await tx
    .select({ id: calls.id, fechaAgenda: calls.fechaAgenda, emailLead: calls.emailLead })
    .from(calls)
    .where(
      and(
        eq(calls.dealId, entrada.dealId),
        eq(calls.resultado, "agendada"),
        gt(calls.fechaAgenda, ahora),
        ne(calls.id, entrada.callIdNueva),
        vigente(calls),
      ),
    );

  const reemplazadas: CitaACancelar[] = [];
  for (const anterior of anteriores) {
    if (!anterior.fechaAgenda) continue;
    await editarConRastro(
      {
        db: tx,
        tabla: calls,
        nombreTabla: "calls",
        actorId: null,
        etiqueta: anterior.emailLead ?? anterior.id,
      },
      anterior.id,
      { resultado: "reagendada" },
    );
    await dejarNotaDelSistema(
      tx,
      entrada.dealId,
      `El lead reservó otra cita (${fechaHoraEnBogota(nueva.fechaAgenda)}): la del ${fechaHoraEnBogota(anterior.fechaAgenda)} quedó reagendada y se cancela en Calendly.`,
    );
    await registrarNovedadCalendly(tx, {
      programId: nueva.programId,
      dealId: entrada.dealId,
      callId: entrada.callIdNueva,
      tipo: "cita_reagendada",
      claveEvento: `reemplazo:${anterior.id}`,
    });
    reemplazadas.push({ dealId: entrada.dealId, callId: anterior.id });
  }

  return reemplazadas;
}

export async function cancelarCitaEnCalendly(
  db: Db,
  dealId: string,
  llamada: typeof calls.$inferSelect,
  motivo: "Reagendada" | "Cancelada",
  opciones: { fetch?: FetchLike; ahora?: Date },
): Promise<boolean> {
  const ahora = opciones.ahora ?? new Date();
  if (!llamada.fechaAgenda || llamada.fechaAgenda <= ahora || !llamada.huellaFila?.startsWith("calendly:")) return false;
  const uuid = llamada.huellaFila.slice("calendly:".length);
  try {
    const token = await tokenDeCalendlyDelPrograma(db, llamada.programId);
    const cita = await citaDeCalendly({
      token,
      correo: llamada.emailLead ?? "",
      uuidInvitado: uuid,
      fetch: opciones.fetch,
      ahora,
    });
    if (!cita) throw new Error("No se encontró la cita anterior en Calendly.");
    await cancelarCita(token, cita.eventUri, motivo, opciones.fetch);
    return false;
  } catch {
    await dejarNotaDelSistema(db, dealId, "La cita anterior de Calendly no se pudo cancelar. Reintenta la cancelación.");
    return true;
  }
}

export async function cancelarCitasReemplazadas(
  db: Db,
  citas: CitaACancelar[],
  opciones: { fetch?: FetchLike; ahora?: Date } = {},
): Promise<void> {
  for (const cita of citas) {
    try {
      const [llamada] = await db.select().from(calls).where(and(eq(calls.id, cita.callId), vigente(calls)));
      if (llamada) await cancelarCitaEnCalendly(db, cita.dealId, llamada, "Reagendada", opciones);
    } catch {
      // La cancelación ocurre después del commit y nunca revierte la escritura del CRM.
    }
  }
}
