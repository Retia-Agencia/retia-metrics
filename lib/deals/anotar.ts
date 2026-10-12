import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { trabajaLeads } from "@/lib/auth/roles";
import { crearConRastro } from "@/lib/crm/rastro";
import { calls, cohorts, dealActividades, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { exigirTextoDelMotivo } from "@/lib/deals/motivo-con-texto";
import { normalizando } from "@/lib/errors-zod";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { cambiarDuenoDeal } from "./cambiar-dueno";
import { pendientesParaAnotar, type EtapaDeal, type PendienteDeal } from "./etapas";
import { agregarLlamada, marcarFallida, reagendarLlamada } from "./llamadas";
import { dealBloqueadoConLead } from "./leer-deal";
import { moverEtapa } from "./mover-etapa";
import { puedeTrabajarDeal, type ActorDeDeal } from "./permiso";
import type { CambioHecho } from "./resumen-del-cambio";
import { cambiarCohorteDelDeal, type CambioDeCohorteEscrito } from "./cambiar-cohorte";

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser YYYY-MM-DD.");
const comentario = z.string().trim().max(4000, "El comentario es muy largo.").optional();

export const esquemaAnotar = z.object({
  dealId: z.string().uuid("El deal no es válido."),
  comentario,
  proximoContacto: dia.optional(),
  proximaCohorte: z.object({ cohorteDestinoId: z.string().uuid("La cohorte destino no es válida.") }).optional(),
  reagenda: z.object({
    motivoId: z.string().uuid("El motivo de re-agenda no es válido."),
    fechaLlamada: z.date({ message: "La fecha de la nueva llamada no es válida." }).optional(),
  }).optional(),
}).superRefine((datos, ctx) => {
  const cuantos = Number(datos.proximoContacto !== undefined)
    + Number(datos.proximaCohorte !== undefined)
    + Number(datos.reagenda !== undefined);
  if (cuantos > 1) ctx.addIssue({ code: "custom", message: "Una anotación solo puede dejar un pendiente." });
  if ((cuantos === 0 || datos.proximoContacto !== undefined) && !datos.comentario) {
    ctx.addIssue({ code: "custom", path: ["comentario"], message: "Escribe un comentario." });
  }
});

export type DatosAnotar = z.input<typeof esquemaAnotar>;

export interface AnotacionHecha {
  etapaAntes: EtapaDeal;
  etapaDespues: EtapaDeal;
  pendientePuesto: PendienteDeal | null;
  fecha: string | null;
  cambio: CambioHecho;
}

type Transaccion = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

export async function anotar(db: Db, actor: ActorDeDeal, entrada: DatosAnotar): Promise<AnotacionHecha> {
  return normalizando(async () => {
    const datos = esquemaAnotar.parse(entrada);
    return (db as unknown as Transaccion).transaction(async (tx) => {
      const { deal: original, emailLead } = await dealBloqueadoConLead(tx, datos.dealId);
      if (original.anuladoEn) throw new ErrorDeApp("El deal está anulado: no recibe anotaciones.", 409);

      const seAduena = original.ownerUserId == null && trabajaLeads(actor.rol);
      if (!seAduena && !puedeTrabajarDeal(actor, original)) {
        throw new ErrorDeApp(
          original.ownerUserId == null
            ? "Este deal no tiene dueño: reclámalo antes de anotar."
            : "Solo el dueño del deal o un administrador pueden anotarlo.",
          403,
        );
      }
      if (seAduena) {
        await cambiarDuenoDeal(tx, {
          dealId: original.id,
          ownerActual: null,
          ownerNuevo: actor.userId,
          actorId: actor.userId,
          etiqueta: emailLead,
        });
      }

      const opcionSolicitada: PendienteDeal | null = datos.proximoContacto !== undefined
        ? "seguimiento"
        : datos.proximaCohorte !== undefined
          ? "proxima_cohorte"
          : datos.reagenda !== undefined
            ? "reagenda"
            : null;
      if (opcionSolicitada && !pendientesParaAnotar(original.etapa, original.pendiente).includes(opcionSolicitada)) {
        throw new ErrorDeApp("Ese próximo paso no está permitido desde la etapa actual.", 409);
      }
      if (datos.reagenda) {
        await exigirTextoDelMotivo(tx, datos.reagenda.motivoId, datos.comentario);
      }

      if (!datos.proximaCohorte || datos.comentario) {
        await crearConRastro(
          { db: tx, tabla: dealActividades, nombreTabla: "deal_actividades", actorId: actor.userId, etiqueta: emailLead },
          {
            dealId: original.id,
            tipo: "nota",
            canal: null,
            userId: actor.userId,
            fecha: new Date(),
            nota: datos.comentario ?? null,
            proximoContacto: datos.proximoContacto ?? (datos.reagenda?.fechaLlamada ? fechaDeInstanteEnBogota(datos.reagenda.fechaLlamada) : null),
            pendientePuesto: datos.proximaCohorte ? null : opcionSolicitada,
          },
        );
      }

      let etapa = original.etapa;
      let pendiente: PendienteDeal | null = original.pendiente;
      let cohorteCambiada: CambioDeCohorteEscrito | null = null;
      // La fecha de agenda de la llamada que la rama de re-agenda haya CREADO (no la que
      // reagenda una existente): de ahí sale `llamadaCreada` del aviso (ticket 220).
      let fechaLlamadaCreada: Date | null = null;
      // Anotar NUNCA mueve de etapa (ticket 228, Mani 9-oct): la tarjeta Transición ya decía
      // que Anotar "deja un comentario o el próximo paso sin cambiar la etapa". Pasar de
      // Potencial/Registrado a En gestión es ahora una respuesta de "Mover a" (E1, pasó de
      // sistema a ambos), con comentario obligatorio dentro del diálogo de mover.

      if (datos.proximoContacto) {
        const mov = await moverEtapa(tx, {
          dealId: original.id,
          a: etapa,
          pendiente: "seguimiento",
          actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
          datos: { fechaSeguimiento: datos.proximoContacto },
        });
        pendiente = mov.pendienteA;
      } else if (datos.proximaCohorte) {
        const [destino] = await tx
          .select()
          .from(cohorts)
          .where(eq(cohorts.id, datos.proximaCohorte.cohorteDestinoId));
        if (!destino || destino.programId !== original.programId) {
          throw new ErrorDeApp("La cohorte destino no existe o es de otro programa.", 422);
        }
        if (destino.id === original.cohortId) {
          throw new ErrorDeApp("La cohorte destino tiene que ser distinta a la actual.", 422);
        }
        if (destino.estado !== "futuro") {
          throw new ErrorDeApp("Próxima cohorte solo admite una cohorte futura.", 409);
        }
        cohorteCambiada = await cambiarCohorteDelDeal(tx, {
          deal: original,
          destino,
          actorId: actor.userId,
          etiqueta: emailLead,
          limpiarProximaCohorte: true,
          userIdDeNota: null,
          nota: (origen, codigoDestino) =>
            `Cohorte cambiada por Próxima cohorte: ${origen} → ${codigoDestino}. El deal ya cuenta en ${codigoDestino}.`,
        });
        pendiente = null;
      } else if (datos.reagenda) {
        if (original.etapa === "agendado") {
          const [llamada] = await tx
            .select({ id: calls.id })
            .from(calls)
            .where(and(eq(calls.dealId, original.id), eq(calls.resultado, "agendada"), vigente(calls)))
            .orderBy(desc(calls.createdAt));
          if (!llamada) throw new ErrorDeApp("No hay una llamada agendada para re-agendar.", 409);
          if (datos.reagenda.fechaLlamada) {
            await reagendarLlamada(tx, actor, {
              callId: llamada.id,
              fechaAgenda: datos.reagenda.fechaLlamada,
              motivoId: datos.reagenda.motivoId,
            }, datos.comentario);
            pendiente = null;
          } else {
            await marcarFallida(tx, actor, {
              callId: llamada.id,
              resultado: "no_show",
              motivoId: datos.reagenda.motivoId,
            });
            pendiente = "reagenda";
          }
        } else {
          const mov = await moverEtapa(tx, {
            dealId: original.id,
            a: etapa,
            pendiente: "reagenda",
            motivoId: datos.reagenda.motivoId,
            actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
          });
          pendiente = mov.pendienteA;
          if (datos.reagenda.fechaLlamada) {
            const llamada = await agregarLlamada(tx, actor, {
              dealId: original.id,
              fechaAgenda: datos.reagenda.fechaLlamada,
            });
            fechaLlamadaCreada = datos.reagenda.fechaLlamada;
            if (llamada.movioAAgendado) {
              etapa = "agendado";
              pendiente = null;
            }
          }
        }
      }

      // El aviso se arma desde lo que quedó ESCRITO en el deal al final de la transacción.
      const [final] = await tx
        .select({ etapa: deals.etapa, pendiente: deals.pendiente, fechaSeguimiento: deals.fechaSeguimiento })
        .from(deals)
        .where(and(eq(deals.id, original.id), incluyendoAnulados(deals)));
      if (!final) throw new ErrorDeApp("No existe el deal.", 404);

      const cambio: CambioHecho = {
        etapaAntes: original.etapa,
        etapaDespues: final.etapa,
        pendienteAntes: original.pendiente,
        pendienteDespues: final.pendiente,
        fechaPendiente: final.pendiente === "seguimiento" ? final.fechaSeguimiento : null,
        llamadaCreada: fechaLlamadaCreada ? { fecha: fechaLlamadaCreada } : null,
        abonoRegistrado: null,
        cohorteCambiada: cohorteCambiada
          ? { de: cohorteCambiada.origenCodigo, a: cohorteCambiada.destinoCodigo }
          : null,
      };

      return {
        etapaAntes: original.etapa,
        etapaDespues: etapa,
        pendientePuesto: pendiente,
        fecha: datos.proximoContacto ?? (datos.reagenda?.fechaLlamada ? fechaDeInstanteEnBogota(datos.reagenda.fechaLlamada) : null),
        cambio,
      };
    });
  });
}
