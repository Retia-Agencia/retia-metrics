import { z } from "zod";
import { esAdministrador } from "@/lib/auth/roles";
import { editarDeal } from "@/lib/deals/editar-deal";
import { estaAgendada } from "@/lib/deals/resultados-de-llamada";
import { estadoParaAccionDeal, huellaDeAccionDeal } from "@/lib/deals/estado-para-accion";
import { historiaDeDeals } from "@/lib/queries/ficha-deal";
import { nombresDeUsuariosYCohortes } from "@/lib/queries/resolver-filtros";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  id_del_usuario: z.string().uuid("Dueño inválido."),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  ownerUserId: string;
}

async function ejecutar(
  db: Parameters<typeof editarDeal>[0],
  actor: Parameters<typeof editarDeal>[1],
  objetivo: Objetivo,
) {
  await editarDeal(db, actor, { dealId: objetivo.id, ownerUserId: objetivo.ownerUserId });
  return estadoParaAccionDeal(db, objetivo.id);
}

export const reasignarDealMcp: AccionMcp<typeof argumentos> = {
  clave: "reasignar_deal",
  titulo: "Reasignar deal",
  cuandoUsarla: "Cuando un administrador pasa un deal a otro closer del programa. Un closer no puede ceder su propio deal desde el MCP (ADR 0134).",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    id_del_usuario: "00000000-0000-4000-8000-000000000001",
  },
  puede: (contexto) => esAdministrador(contexto.rol),
  objetivos: (entrada) => [{ id: entrada.deal_id, ownerUserId: entrada.id_del_usuario }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const antes = await estadoParaAccionDeal(db, objetivo.id);
    const [nombres, historia] = await Promise.all([
      nombresDeUsuariosYCohortes(
        db,
        [antes?.ownerUserId, objetivo.ownerUserId].filter((id): id is string => id != null),
        [],
      ),
      antes
        ? historiaDeDeals(db, antes.programId, [objetivo.id]).then((porDeal) => porDeal.get(objetivo.id) ?? null)
        : Promise.resolve(null),
    ]);
    const prueba = await ensayar(db, (tx) => ejecutar(tx, actor, objetivo));
    const llamadaPendiente = historia?.llamadas
      .filter((llamada) => llamada.anuladoEn == null && estaAgendada(llamada.resultado))
      .sort((a, b) => (b.fechaAgenda?.getTime() ?? 0) - (a.fechaAgenda?.getTime() ?? 0))[0] ?? null;
    const dueno = (id: string | null) => id == null
      ? null
      : { id, nombre: nombres.usuarios.get(id) ?? "Sin nombre" };
    return {
      antes: antes ? { dueno: dueno(antes.ownerUserId), etapa: antes.etapa } : null,
      despues: prueba.ok && prueba.resultado
        ? { dueno: dueno(prueba.resultado.ownerUserId), etapa: prueba.resultado.etapa }
        : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: {
        llamada_pendiente: llamadaPendiente ? {
          id: llamadaPendiente.id,
          cita_en: llamadaPendiente.fechaAgenda?.toISOString() ?? null,
          closer_actual: llamadaPendiente.closerNombre,
        } : null,
        aviso: "La llamada pendiente queda a nombre del closer anterior hasta que se reagende o se reasigne en la app.",
      },
    };
  },
  huella: (db, objetivo, opciones) => huellaDeAccionDeal(db, objetivo.id, opciones),
  aplicar: (db, actor, objetivo) => ejecutar(db, actor, objetivo as Objetivo),
  eventoDeshacer: (nuevos) => nuevos.find((evento) =>
    evento.tabla === "deals" && evento.resumen.some((campo) => campo.campo === "ownerUserId")
  ),
  seDeshace: true,
  efectoExterno: false,
};
