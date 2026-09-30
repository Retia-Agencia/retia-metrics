import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { changeLog, deals, leadContactos, leads, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionUnica } from "@/lib/db/errores";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { exigirAccesoAlPrograma, type ActorConAcceso } from "@/lib/catalogo/acceso-programa";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { vigente } from "@/lib/queries/vigente";
import { normalizarEmail } from "@/lib/sheets/mapeo";
import { recalcularResumen } from "./ingerir";

/**
 * Confirmar o separar un correo que entró por teléfono (ticket 072, ADR 0035). La ingesta
 * (`resolverIdentidad`) **une y marca**: un envío con correo nuevo y teléfono conocido se suma
 * al lead de ese teléfono y su correo queda `confirmado = false`. Aquí una persona decide:
 *
 * - **Confirmar:** es la misma persona con otro correo. La marca se quita.
 * - **Separar:** son dos personas (una familia, un número de trabajo). El correo pasa a un lead
 *   NUEVO del mismo programa, y con él **los envíos que traen ese correo exacto**: el que lo
 *   trajo y cualquier otro cuyas respuestas lo contengan, normalizado. Coincidencia exacta, no
 *   heurística (ADR 0027). Los demás envíos se quedan. Los dos resúmenes se recalculan.
 *
 * Decisiones del 29-sep (Alejo):
 * - Si un envío que habría que mover **abrió un deal vigente**, se bloquea con 409 y se dice cuál:
 *   mover una oportunidad con su historial y sus llamadas de persona lo decide un humano, no esto.
 * - Lo hace quien trabaja el programa (closer con membresía activa) o quien administra
 *   (`exigirAccesoAlPrograma`). Mani, 29-sep: también el closer (ADR 0060).
 *
 * Todo en una transacción, con su rastro en `change_log` (quién y cuándo).
 */

export const esquemaContacto = z.object({ contactoId: z.string().uuid("El contacto no es válido.") });
export type DatosContacto = z.input<typeof esquemaContacto>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

/** El correo marcado, bloqueado, y la reja de acceso a su programa. */
async function correoMarcado(tx: Db, actor: ActorConAcceso, contactoId: string) {
  const [fila] = await tx
    .select({ contacto: leadContactos, lead: leads })
    .from(leadContactos)
    .innerJoin(leads, eq(leads.id, leadContactos.leadId))
    .where(eq(leadContactos.id, contactoId))
    .for("update", { of: leadContactos });
  if (!fila) throw new ErrorDeApp("No existe ese contacto.", 404);
  await exigirAccesoAlPrograma(tx, actor, fila.contacto.programId, "No puedes gestionar leads de un programa donde no vendes.");
  if (fila.contacto.tipo !== "correo" || fila.contacto.confirmado) {
    throw new ErrorDeApp("Ese correo no está marcado como posible duplicado.", 409);
  }
  return fila;
}

function rastro(actorId: string, tabla: string, registroId: string, etiqueta: string, campo: string, antes: unknown, despues: unknown) {
  return {
    tabla,
    registroId,
    etiqueta,
    campo,
    valorAnterior: textoDeBitacora(antes),
    valorNuevo: textoDeBitacora(despues),
    origen: "app" as const,
    userId: actorId,
  };
}

export async function confirmarCorreo(db: Db, actor: ActorConAcceso, datos: DatosContacto): Promise<void> {
  return normalizando(async () => {
    const { contactoId } = esquemaContacto.parse(datos);
    await (db as unknown as Transaccion).transaction(async (tx) => {
      const { contacto, lead } = await correoMarcado(tx, actor, contactoId);
      await tx.update(leadContactos).set({ confirmado: true }).where(eq(leadContactos.id, contacto.id));
      await tx
        .insert(changeLog)
        .values(rastro(actor.id, "lead_contactos", contacto.id, lead.nombre ?? lead.emailNormalizado, "confirmado", false, true));
    });
  });
}

/** Si alguna respuesta (a cualquier profundidad) es ese correo, normalizado. */
function traeElCorreo(respuestas: unknown, correo: string): boolean {
  if (typeof respuestas === "string") return normalizarEmail(respuestas) === correo;
  if (Array.isArray(respuestas)) return respuestas.some((r) => traeElCorreo(r, correo));
  if (respuestas && typeof respuestas === "object") return Object.values(respuestas).some((r) => traeElCorreo(r, correo));
  return false;
}

export interface CorreoSeparado {
  leadNuevoId: string;
  enviosMovidos: number;
}

export async function separarCorreo(db: Db, actor: ActorConAcceso, datos: DatosContacto): Promise<CorreoSeparado> {
  return normalizando(async () => {
    const { contactoId } = esquemaContacto.parse(datos);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { contacto, lead } = await correoMarcado(tx, actor, contactoId);
      const correo = contacto.valor;

      const delLead = await tx
        .select({ id: submissions.id, respuestas: submissions.respuestas })
        .from(submissions)
        .where(eq(submissions.leadId, lead.id));
      const aMover = delLead.filter((s) => s.id === contacto.submissionId || traeElCorreo(s.respuestas, correo)).map((s) => s.id);

      if (aMover.length > 0) {
        const [abierto] = await tx
          .select({ etapa: deals.etapa })
          .from(deals)
          .where(and(inArray(deals.submissionOrigenId, aMover), vigente(deals)))
          .limit(1);
        if (abierto) {
          throw new ErrorDeApp(
            `Un envío de este correo abrió un deal (en ${NOMBRE_DE_ETAPA[abierto.etapa]}): resuelve ese deal antes de separar.`,
            409,
          );
        }
      }

      let leadNuevoId: string;
      try {
        const [nuevo] = await tx
          .insert(leads)
          .values({ programId: contacto.programId, emailNormalizado: correo })
          .returning();
        leadNuevoId = nuevo.id;
      } catch (e) {
        if (esViolacionUnica(e)) throw new ErrorDeApp("Ya existe otro lead con ese correo en el programa.", 409);
        throw e;
      }

      await tx
        .update(leadContactos)
        .set({ leadId: leadNuevoId, esPrincipal: true, confirmado: true })
        .where(eq(leadContactos.id, contacto.id));
      if (aMover.length > 0) await tx.update(submissions).set({ leadId: leadNuevoId }).where(inArray(submissions.id, aMover));

      const etiqueta = lead.nombre ?? lead.emailNormalizado;
      await tx.insert(changeLog).values([
        rastro(actor.id, "leads", leadNuevoId, correo, "emailNormalizado", null, correo),
        rastro(actor.id, "lead_contactos", contacto.id, etiqueta, "leadId", lead.id, leadNuevoId),
        ...aMover.map((id) => rastro(actor.id, "submissions", id, etiqueta, "leadId", lead.id, leadNuevoId)),
      ]);

      await recalcularResumen(tx, [lead.id, leadNuevoId], new Set([leadNuevoId]), null, actor.id);
      return { leadNuevoId, enviosMovidos: aMover.length };
    });
  });
}
