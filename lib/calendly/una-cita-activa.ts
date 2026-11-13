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
import { uuidDeHuella } from "./huella";
import type { OrigenOperativo } from "@/lib/crm/rastro";

export type CitaACancelar = { dealId: string; callId: string };
export type CancelacionDeCita = { dealId: string; llamada: typeof calls.$inferSelect };

export function esCitaActivaParaCancelar(
  llamada: typeof calls.$inferSelect,
  ahora: Date,
): boolean {
  return llamada.fechaAgenda != null
    && llamada.fechaAgenda > ahora
    && uuidDeHuella(llamada.huellaFila) !== null;
}

export function esCancelacionDeCitaActiva(
  llamada: typeof calls.$inferSelect,
  ahora: Date,
): boolean {
  return llamada.resultado === "cancelada" && esCitaActivaParaCancelar(llamada, ahora);
}

export async function reemplazarCitasAnteriores(
  tx: Db,
  entrada: { dealId: string; callIdNueva: string; ahora?: Date; origen?: OrigenOperativo },
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
        origen: entrada.origen ?? "app",
      },
      anterior.id,
      { resultado: "reagendada" },
    );
    await dejarNotaDelSistema(
      tx,
      entrada.dealId,
      `El lead reservó otra cita (${fechaHoraEnBogota(nueva.fechaAgenda)}): la del ${fechaHoraEnBogota(anterior.fechaAgenda)} quedó reagendada y se cancela en Calendly.`,
      entrada.origen ?? "app",
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
  opciones: { fetch?: FetchLike; ahora?: Date; origen?: OrigenOperativo },
): Promise<boolean> {
  const ahora = opciones.ahora ?? new Date();
  if (!esCitaActivaParaCancelar(llamada, ahora)) return false;
  const uuid = uuidDeHuella(llamada.huellaFila);
  if (uuid === null) return false;
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
    await dejarNotaDelSistema(
      db,
      dealId,
      "La cita anterior de Calendly no se pudo cancelar. Reintenta la cancelación.",
      opciones.origen ?? "app",
    );
    return true;
  }
}

export async function cancelarCitasReemplazadas(
  db: Db,
  citas: CitaACancelar[],
  opciones: { fetch?: FetchLike; ahora?: Date; origen?: OrigenOperativo } = {},
): Promise<boolean> {
  let pendiente = false;
  for (const cita of citas) {
    try {
      const [llamada] = await db.select().from(calls).where(and(eq(calls.id, cita.callId), vigente(calls)));
      if (llamada) pendiente = await cancelarCitaEnCalendly(db, cita.dealId, llamada, "Reagendada", opciones) || pendiente;
    } catch {
      // La cancelación ocurre después del commit y nunca revierte la escritura del CRM.
      pendiente = true;
    }
  }
  return pendiente;
}
