import { eq } from "drizzle-orm";
import { resolverCanal, type CanalActivo } from "@/lib/atribucion/canal";
import { areas, canales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Rango } from "@/lib/queries/dashboard";
import { pautaInterina, type FilaPauta } from "@/lib/queries/pauta-interina";

/**
 * Registros contra agendas por canal (ticket 088, la vista de Media): cuántos registros trae
 * cada canal y cuántas agendas produce. Ejemplo de Alejo: *TikTok trae muchos registros y pocas
 * agendas.*
 *
 * NO define registro ni agenda: reagrupa la serie de `pautaInterina` (093), donde viven las dos
 * definiciones (`docs/analytics.md` §6). Así esta tabla y la de Pauta no pueden dar cifras
 * distintas. El denominador sale de los ENVÍOS, no de los deals: un registro cuyo Estado no
 * abrió deal sigue siendo un registro, o la tasa de un canal malo daría 100%.
 *
 * El canal lo dice el catálogo (`resolverCanal`, ticket 101). "Sin UTM", "sin clasificar" y
 * "sin envío de origen" (una agenda cuyo deal no nació de un envío) son filas aparte, siempre,
 * con su conteo.
 */

export type OrigenPorCanal = "canal" | "sin_clasificar" | "sin_utm" | "sin_envio_origen";

export interface FilaPorCanal {
  origen: OrigenPorCanal;
  canalId: string | null;
  canal: string | null;
  area: string | null;
  registros: number;
  agendas: number;
}

export interface RegistrosYAgendasPorCanal {
  filas: FilaPorCanal[];
  total: { registros: number; agendas: number };
}

const HUERFANOS = ["sin_clasificar", "sin_utm", "sin_envio_origen"] as const;

/** La reagrupación, pura: la serie de Pauta y el catálogo entran como datos. */
export function agruparPorCanal(
  serie: readonly FilaPauta[],
  catalogo: readonly CanalActivo[],
  nombreDeArea: ReadonlyMap<string, string>,
): RegistrosYAgendasPorCanal {
  const filas = new Map<string, FilaPorCanal>();
  const total = { registros: 0, agendas: 0 };
  for (const f of serie) {
    let fila: FilaPorCanal;
    if (f.categoria === "sin_envio_origen") {
      fila = filas.get("sin_envio_origen") ?? vacia("sin_envio_origen");
    } else {
      const r = resolverCanal(f, catalogo);
      const clave = r.tipo === "canal" ? r.canal.id : r.tipo;
      fila =
        filas.get(clave) ??
        (r.tipo === "canal"
          ? { ...vacia("canal"), canalId: r.canal.id, canal: r.canal.nombre, area: nombreDeArea.get(r.canal.areaId) ?? null }
          : vacia(r.tipo));
    }
    fila.registros += f.registros;
    fila.agendas += f.agendas;
    total.registros += f.registros;
    total.agendas += f.agendas;
    filas.set(fila.canalId ?? fila.origen, fila);
  }
  for (const h of HUERFANOS) if (!filas.has(h)) filas.set(h, vacia(h));

  const orden: Record<OrigenPorCanal, number> = { canal: 0, sin_clasificar: 1, sin_utm: 2, sin_envio_origen: 3 };
  return {
    filas: [...filas.values()].sort(
      (a, b) => orden[a.origen] - orden[b.origen] || b.registros - a.registros || (a.canal ?? "").localeCompare(b.canal ?? ""),
    ),
    total,
  };
}

function vacia(origen: OrigenPorCanal): FilaPorCanal {
  return { origen, canalId: null, canal: null, area: null, registros: 0, agendas: 0 };
}

/** Por programa, siempre: sin `programId` no hay consulta (ADR 0043). */
export async function registrosYAgendasPorCanal(
  db: Db,
  programId: string,
  rango: Rango,
  hoy: string,
): Promise<RegistrosYAgendasPorCanal> {
  const [pauta, catalogo, listaAreas] = await Promise.all([
    pautaInterina(db, programId, rango, {}, hoy),
    db.select().from(canales).where(eq(canales.activo, true)),
    db.select({ id: areas.id, nombre: areas.nombre }).from(areas),
  ]);
  return agruparPorCanal(pauta.filas, catalogo, new Map(listaAreas.map((a) => [a.id, a.nombre])));
}
