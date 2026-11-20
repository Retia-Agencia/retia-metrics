import type { AtribucionDePauta } from "@/lib/queries/atribucion-de-pauta";
import { and, eq, inArray } from "drizzle-orm";
import { deals } from "@/lib/db/schema";
import {
  dealsDelEmbudoComercial,
  pasosDelEmbudoComercial,
  type DealParaEmbudoComercial,
  type PasoDelEmbudoComercial,
} from "@/lib/queries/embudo-comercial";
import type { Db } from "@/lib/db/tipos";
import type { Alcance } from "@/lib/queries/dashboard";
import { atribucionDePautaPorDeal } from "@/lib/queries/deals-del-corte-de-pauta";
import { vigente } from "@/lib/queries/vigente";

/** El nivel por el que se agrupa la tabla por campaña y anuncio del embudo comercial (458). */
export type NivelDeEmbudoComercial = "campana" | "anuncio";

/** Una fila de la tabla: un objeto de Meta (o la fila sin atribución) con sus cuatro pasos. */
export interface GrupoDelEmbudoComercial {
  /** El id de Meta del objeto; `null` para la fila de deals sin atribución. */
  idMeta: string | null;
  nombre: string;
  pasos: PasoDelEmbudoComercial[];
}

const ID_Y_NOMBRE: Record<NivelDeEmbudoComercial, (a: AtribucionDePauta) => { id: string | null; nombre: string | null }> = {
  campana: (a) => ({ id: a.campanaId, nombre: a.campanaNombre }),
  anuncio: (a) => ({ id: a.anuncioId, nombre: a.anuncioNombre }),
};

export const SIN_CAMPANA_IDENTIFICADA = "Sin campaña identificada";

/**
 * Agrupa los deals del embudo comercial por campaña o anuncio y arma los cuatro pasos de cada grupo con la MISMA
 * aritmética que el bloque de Comercial (`pasosDelEmbudoComercial`), para que la suma de los grupos sea el total.
 * Puro: recibe los deals ya leídos y su atribución por deal. Los deals sin atribución al nivel van a una sola fila
 * «Sin campaña identificada» al final.
 */
export function agruparEmbudoComercialPorPauta(
  deals: readonly DealParaEmbudoComercial[],
  atribucionPorDeal: ReadonlyMap<string, AtribucionDePauta>,
  nivel: NivelDeEmbudoComercial,
): GrupoDelEmbudoComercial[] {
  const leer = ID_Y_NOMBRE[nivel];
  const grupos = new Map<string, { nombre: string; deals: DealParaEmbudoComercial[] }>();
  const sinAtribucion: DealParaEmbudoComercial[] = [];
  for (const deal of deals) {
    const atribucion = atribucionPorDeal.get(deal.dealId);
    const dato = atribucion ? leer(atribucion) : { id: null, nombre: null };
    if (dato.id === null) {
      sinAtribucion.push(deal);
      continue;
    }
    const grupo = grupos.get(dato.id) ?? { nombre: dato.nombre ?? dato.id, deals: [] };
    grupo.deals.push(deal);
    grupos.set(dato.id, grupo);
  }
  const filas: GrupoDelEmbudoComercial[] = [...grupos.entries()]
    .map(([idMeta, { nombre, deals: delGrupo }]) => ({ idMeta, nombre, pasos: pasosDelEmbudoComercial(delGrupo) }))
    .sort((a, b) => (b.pasos[0]!.cantidad - a.pasos[0]!.cantidad) || a.nombre.localeCompare(b.nombre));
  if (sinAtribucion.length > 0) {
    filas.push({ idMeta: null, nombre: SIN_CAMPANA_IDENTIFICADA, pasos: pasosDelEmbudoComercial(sinAtribucion) });
  }
  return filas;
}

/** Carga los deals del embudo comercial y su atribución por deal, y agrupa por campaña o anuncio (458). */
export async function cargarEmbudoComercialPorPauta(
  db: Db,
  alcance: Alcance,
  nivel: NivelDeEmbudoComercial,
): Promise<GrupoDelEmbudoComercial[]> {
  const delEmbudo = await dealsDelEmbudoComercial(db, alcance);
  if (delEmbudo.length === 0) return [];
  const origenes = await db.select({ id: deals.id, submissionOrigenId: deals.submissionOrigenId })
    .from(deals)
    .where(and(eq(deals.programId, alcance.programId), inArray(deals.id, delEmbudo.map((d) => d.dealId)), vigente(deals)));
  const atribucion = await atribucionDePautaPorDeal(db, alcance.programId, origenes);
  return agruparEmbudoComercialPorPauta(delEmbudo, atribucion, nivel);
}
