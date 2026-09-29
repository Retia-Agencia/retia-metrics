import { TRANSICIONES } from "@/lib/deals/etapas";
import { requisitosDeTransicion } from "@/lib/deals/requisitos";
import type { MapaTransiciones } from "@/components/deals/transiciones";

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
  return TRANSICIONES.map((t) => ({
    de: t.de,
    a: t.a,
    quien: t.quien,
    exigeMotivo: t.exigeMotivo,
    tipoDeMotivo: t.tipoDeMotivo,
    requisitos: requisitosDeTransicion(t),
  }));
}
