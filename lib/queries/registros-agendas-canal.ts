import { resolverCanal, type Area } from "@/lib/atribucion/canal";
import type { Db } from "@/lib/db/tipos";
import type { Rango } from "@/lib/queries/dashboard";
import { pautaInterina, type FilaPauta } from "@/lib/queries/pauta-interina";

/**
 * Registros contra agendas por canal (ticket 088, la vista de Media). No define registro
 * ni agenda: reagrupa la serie de `pautaInterina`, donde viven ambas definiciones.
 */

export type OrigenPorCanal = "canal" | "sin_utm" | "sin_envio_origen";

export interface FilaPorCanal {
  origen: OrigenPorCanal;
  canalClave: string | null;
  canal: string | null;
  area: Area | null;
  registros: number;
  agendas: number;
}

export interface RegistrosYAgendasPorCanal {
  filas: FilaPorCanal[];
  total: { registros: number; agendas: number };
}

const HUERFANOS = ["sin_utm", "sin_envio_origen"] as const;

/** La reagrupación pura recibe la serie de Pauta como datos. */
export function agruparPorCanal(serie: readonly FilaPauta[]): RegistrosYAgendasPorCanal {
  const filas = new Map<string, FilaPorCanal>();
  const total = { registros: 0, agendas: 0 };
  for (const f of serie) {
    let fila: FilaPorCanal;
    let clave: string;
    if (f.categoria === "sin_envio_origen") {
      clave = "sin_envio_origen";
      fila = filas.get(clave) ?? vacia("sin_envio_origen");
    } else {
      const r = resolverCanal(f);
      const origen = r.regla === "sin_utm" ? "sin_utm" : "canal";
      clave = origen === "canal" ? `canal:${r.area}:${r.canal?.clave ?? ""}` : origen;
      fila = filas.get(clave) ?? (origen === "canal"
        ? {
            ...vacia("canal"),
            canalClave: r.canal?.clave ?? null,
            canal: r.canal?.nombre ?? "(sin utm_source)",
            area: r.area,
          }
        : { ...vacia("sin_utm"), area: "sin_utm" });
    }
    fila.registros += f.registros;
    fila.agendas += f.agendas;
    total.registros += f.registros;
    total.agendas += f.agendas;
    filas.set(clave, fila);
  }
  for (const h of HUERFANOS) if (!filas.has(h)) filas.set(h, h === "sin_utm" ? { ...vacia(h), area: "sin_utm" } : vacia(h));

  const orden: Record<OrigenPorCanal, number> = { canal: 0, sin_utm: 1, sin_envio_origen: 2 };
  return {
    filas: [...filas.values()].sort(
      (a, b) =>
        orden[a.origen] - orden[b.origen] ||
        b.registros - a.registros ||
        (a.canal ?? "").localeCompare(b.canal ?? "") ||
        (a.area ?? "").localeCompare(b.area ?? ""),
    ),
    total,
  };
}

function vacia(origen: OrigenPorCanal): FilaPorCanal {
  return { origen, canalClave: null, canal: null, area: null, registros: 0, agendas: 0 };
}

/** Por programa, siempre: sin `programId` no hay consulta (ADR 0043). */
export async function registrosYAgendasPorCanal(
  db: Db,
  programId: string,
  rango: Rango,
  hoy: string,
): Promise<RegistrosYAgendasPorCanal> {
  const pauta = await pautaInterina(db, programId, rango, {}, hoy);
  return agruparPorCanal(pauta.filas);
}
