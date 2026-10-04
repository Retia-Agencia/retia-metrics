import { z } from "zod";
import { dealActividades, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { trabajaLeads } from "@/lib/auth/roles";
import { dealBloqueadoConLead } from "./leer-deal";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";
import { moverEtapa, MovimientoRechazado } from "./mover-etapa";
import { etapaTrasActividad } from "./actividad-mueve";

/**
 * Registrar una actividad de un deal: contacto, intento fallido o nota.
 *
 * - La primera actividad comercial mueve Potencial/Registrado a En gestión; un contacto
 *   logrado continúa a Contactado. Una nota nunca mueve.
 * - **`canal` es texto libre**, no catalogo: la UI sugiere WhatsApp, Llamada, Correo con un
 *   `datalist` y deja escribir otro. Si algun dia hay que reportar por canal, pasa a molde.
 * - Quien la registra sale de la sesion (`userId` = el actor), nunca del input. Un contacto
 *   siempre es de una persona (CHECK `deal_actividades_contacto_con_usuario`).
 * - Solo sobre un deal vigente. Puede quien trabaja el deal (dueño o administrador). Un deal
 *   cerrado si admite notas: "por que se perdio" se escribe DESPUES de cerrar.
 *
 * `fecha` es un INSTANTE; ausente = ahora. La arma quien llama, en Bogota (`-05:00`).
 */
export const esquemaRegistrarActividad = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  tipo: z.enum(["contacto", "nota", "intento"], { message: "El tipo tiene que ser contacto, intento o nota." }),
  canal: z.string().trim().max(60, "El canal es muy largo.").optional(),
  fecha: z.date({ message: "La fecha no es válida." }).optional(),
  nota: z.string().trim().min(1, "Escribe qué pasó.").max(4000, "La nota es muy larga."),
});
export type DatosRegistrarActividad = z.input<typeof esquemaRegistrarActividad>;

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export async function registrarActividad(db: Db, actor: ActorDeDeal, datos: DatosRegistrarActividad): Promise<string> {
  return normalizando(async () => {
    const { dealId, tipo, canal, fecha, nota } = esquemaRegistrarActividad.parse(datos);

    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal, emailLead } = await dealBloqueadoConLead(tx, dealId);
      if (deal.anuladoEn) throw new ErrorDeApp("El deal está anulado: no recibe actividades.", 409);
      const seAdueña = deal.ownerUserId == null && trabajaLeads(actor.rol);
      if (!seAdueña && !puedeTrabajarDeal(actor, deal)) {
        throw new ErrorDeApp(
          deal.ownerUserId == null
            ? "Este deal no tiene dueño: reclámalo antes de registrar una actividad."
            : "Solo el dueño del deal o un administrador registran sus actividades.",
          403,
        );
      }

      if (seAdueña) {
        await editarConRastro(
          { db: tx, tabla: deals, nombreTabla: "deals", actorId: actor.userId, etiqueta: emailLead },
          deal.id,
          { ownerUserId: actor.userId },
        );
      }

      const actividadId = await crearConRastro(
        { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: actor.userId, etiqueta: emailLead },
        {
          dealId: deal.id,
          tipo,
          canal: canal ? canal : null,
          userId: actor.userId,
          fecha: fecha ?? new Date(),
          nota,
        },
      );

      let etapa = deal.etapa;
      let pendiente = deal.pendiente;
      const sistema = { tipo: "sistema", porUsuario: actor.userId } as const;
      // A dónde va lo decide `etapaTrasActividad`, la misma regla con la que la ficha lo explica.
      const destino = tipo === "nota" ? etapa : etapaTrasActividad(etapa, tipo);
      if (destino !== etapa && etapa !== "en_gestion") {
        const hecho = await moverEtapa(tx, { dealId: deal.id, a: "en_gestion", actor: sistema });
        etapa = hecho.a;
        pendiente = hecho.pendienteA;
      }
      if (destino === "contactado" && etapa === "en_gestion") {
        const hecho = await moverEtapa(tx, { dealId: deal.id, a: "contactado", actor: sistema });
        etapa = hecho.a;
        pendiente = hecho.pendienteA;
      }
      if (tipo === "contacto" && pendiente === "proxima_cohorte") {
        try {
          await (tx as unknown as Transaccion).transaction(async (sp) =>
            moverEtapa(sp, { dealId: deal.id, a: etapa, pendiente: null, actor: sistema }),
          );
        } catch (error) {
          // ADR 0070 / A-49: el contacto queda, aunque aún no habilite retomar la cohorte.
          if (!(error instanceof MovimientoRechazado && error.faltantes.every((f) => f.codigo === "contacto"))) {
            throw error;
          }
        }
      }
      return actividadId;
    });
  });
}
