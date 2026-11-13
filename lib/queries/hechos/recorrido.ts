import type { Db } from "@/lib/db/tipos";
import { ETIQUETA_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { fichasDeLeads } from "@/lib/queries/ficha-lead";
import { historiaDeDeals } from "@/lib/queries/ficha-deal";

export interface EventoDeRecorrido {
  leadId: string;
  dealId: string | null;
  fecha: Date;
  tipo: "envio" | "cita" | "etapa" | "abono";
  detalle: string;
  anulado: boolean;
  monto: number | null;
  moneda: string | null;
  closer: string | null;
  respuestas?: { pregunta: string; respuesta: string }[];
}

/** Arma la traza legible de varios leads usando únicamente las lecturas de sus fichas. */
export async function recorridoDeLeads(
  db: Db,
  programId: string,
  leadIds: readonly string[],
): Promise<Map<string, EventoDeRecorrido[]>> {
  const fichas = await fichasDeLeads(db, programId, leadIds);
  const dealIds = [...fichas.values()].flatMap((ficha) => ficha.deals.map((deal) => deal.id));
  const historias = await historiaDeDeals(db, programId, dealIds);
  const salida = new Map<string, EventoDeRecorrido[]>();

  for (const ficha of fichas.values()) {
    const eventos: EventoDeRecorrido[] = ficha.envios.map((envio) => ({
      leadId: ficha.id,
      dealId: null,
      fecha: envio.fecha,
      tipo: "envio",
      detalle: `${envio.esParcial ? "Parcial" : "Completo"} · ${envio.fuente} · ${envio.canal}`,
      anulado: false,
      monto: null,
      moneda: null,
      closer: null,
      respuestas: envio.campos.flatMap(({ campo, valor }) =>
        !campo.toLocaleLowerCase().startsWith("utm ") && valor.tipo === "valor"
          ? [{ pregunta: campo, respuesta: valor.texto }]
          : [],
      ),
    }));
    for (const deal of ficha.deals) {
      const historia = historias.get(deal.id);
      if (!historia) continue;
      eventos.push(
        ...historia.llamadas.map((llamada): EventoDeRecorrido => ({
          leadId: ficha.id,
          dealId: deal.id,
          fecha: llamada.fechaAgenda ?? llamada.fechaLlamada ?? llamada.createdAt,
          tipo: "cita",
          detalle: ETIQUETA_DE_RESULTADO[llamada.resultado],
          anulado: llamada.anuladoEn !== null,
          monto: null,
          moneda: null,
          closer: llamada.closerNombre,
        })),
        ...historia.historial.map((movimiento): EventoDeRecorrido => ({
          leadId: ficha.id,
          dealId: deal.id,
          fecha: movimiento.fecha,
          tipo: "etapa",
          detalle: `De ${movimiento.de ? NOMBRE_DE_ETAPA[movimiento.de] : "Sin etapa"} a ${NOMBRE_DE_ETAPA[movimiento.a]}`,
          anulado: false,
          monto: null,
          moneda: null,
          closer: movimiento.porNombre,
        })),
        ...historia.abonos.map((abono): EventoDeRecorrido => ({
          leadId: ficha.id,
          dealId: deal.id,
          fecha: new Date(`${abono.fecha}T00:00:00-05:00`),
          tipo: "abono",
          detalle: abono.concepto === "adicional" ? `Adicional${abono.nota ? `: ${abono.nota}` : ""}` : "Ticket",
          anulado: abono.anuladoEn !== null,
          monto: Number(abono.monto),
          moneda: abono.moneda,
          closer: null,
        })),
      );
    }
    eventos.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    salida.set(ficha.id, eventos);
  }
  return salida;
}
