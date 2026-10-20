import { eventosMeta } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { credencialesMetaCapi } from "@/lib/integraciones";

type DealEncolable = {
  id: string;
  programId: string;
  cortesia: boolean;
  valorVendidoUsd: string | null;
};

export function estadoInicial(input: {
  cortesia: boolean;
  valor: string | null;
  programaEncendido: boolean;
}): { estado: "pendiente" | "omitido"; razon: string | null } {
  if (input.cortesia) return { estado: "omitido", razon: "cortesia" };
  if (input.valor === null || Number(input.valor) === 0) return { estado: "omitido", razon: "sin_valor" };
  if (!input.programaEncendido) return { estado: "omitido", razon: "programa_apagado" };
  return { estado: "pendiente", razon: null };
}

/** Único escritor de eventos_meta: se llama dentro de la transacción de moverEtapa. */
export async function encolarVenta(tx: Db, deal: DealEncolable): Promise<void> {
  const credenciales = await credencialesMetaCapi(tx, deal.programId);
  const inicial = estadoInicial({
    cortesia: deal.cortesia,
    valor: deal.valorVendidoUsd,
    programaEncendido: credenciales?.encendido === true,
  });
  const ahora = new Date();
  await tx.insert(eventosMeta).values({
    programId: deal.programId,
    dealId: deal.id,
    evento: "purchase",
    eventId: deal.id,
    eventTime: ahora,
    valor: deal.valorVendidoUsd,
    estado: inicial.estado,
    razon: inicial.razon,
  }).onConflictDoNothing({ target: [eventosMeta.dealId, eventosMeta.evento] });
}
