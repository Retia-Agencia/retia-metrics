import { FLECHA_CORRECCION, TRANSICIONES, TRANSICIONES_PENDIENTE, type EtapaDeal, type PendienteDeal } from "@/lib/deals/etapas";
import { requisitosDeTransicion } from "@/lib/deals/requisitos";
import type { CorreccionCliente, MapaTransiciones } from "@/components/deals/transiciones";

/**
 * Aplana la tabla de transiciones (`lib/deals/etapas.ts`) a datos planos y serializables
 * para pasarlos al Kanban del cliente (ticket 069).
 *
 * Corre SOLO en el servidor: `etapas.ts` y `requisitos.ts` importan el esquema (drizzle),
 * que no puede entrar al bundle del cliente. La salida es JSON puro —etapas como texto,
 * booleanos, listas de codigos—, sin nada de drizzle, asi que viaja como prop sin
 * arrastrar el motor al navegador.
 */
export function mapaDeTransiciones(): MapaTransiciones {
  const etapas: MapaTransiciones = TRANSICIONES.map((t) => ({
    tipo: "etapa",
    id: t.id,
    de: t.de,
    a: t.a,
    pendienteA: null,
    quien: t.quien,
    exigeMotivo: t.exigeMotivo,
    tipoDeMotivo: t.tipoDeMotivo,
    requisitos: requisitosDeTransicion(t),
  }));
  const pendientes: MapaTransiciones = TRANSICIONES_PENDIENTE.map((t) => ({
    tipo: "pendiente",
    id: t.id,
    de: t.etapa,
    a: t.etapa,
    pendienteA: t.pone,
    quien: t.quien,
    exigeMotivo: t.exigeMotivo,
    tipoDeMotivo: t.tipoDeMotivo,
    requisitos: requisitosDeTransicion(t),
  }));
  return [...etapas, ...pendientes];
}

/** Aplana la flecha sintética junto con el destino que leyó el servidor. */
export function correccionSerializable(
  de: EtapaDeal,
  destino: { a: EtapaDeal; pendiente: PendienteDeal | null } | null,
): CorreccionCliente | null {
  if (!destino) return null;
  return {
    ...destino,
    flecha: {
      tipo: "etapa",
      id: FLECHA_CORRECCION.id,
      de,
      a: destino.a,
      pendienteA: destino.pendiente,
      quien: FLECHA_CORRECCION.quien,
      exigeMotivo: FLECHA_CORRECCION.exigeMotivo,
      tipoDeMotivo: FLECHA_CORRECCION.tipoDeMotivo,
      requisitos: requisitosDeTransicion(FLECHA_CORRECCION),
    },
  };
}
