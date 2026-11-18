import { and, asc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { deals, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { columnasUtmDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { arbolDePauta } from "@/lib/pauta/arbol";
import { atribuirEnviosDePauta, atribucionPorDeal, completoDelParcial, perteneceAlCorte, type CortePauta } from "@/lib/queries/atribucion-de-pauta";
import { objetosParaAtribucionDePauta } from "@/lib/queries/objetos-para-atribucion";
import { vigente } from "@/lib/queries/vigente";

type DealConOrigen = { id: string; submissionOrigenId: string | null };

const TAMANO_LOTE = 500;

export async function filtrarDealsDelCorte(db: Db, programId: string, corte: CortePauta, filas: readonly DealConOrigen[]) {
  const unicos = [...new Map(filas.map((fila) => [fila.id, fila])).values()];
  const ids = new Set<string>();
  for (let i = 0; i < unicos.length; i += TAMANO_LOTE) {
    for (const id of await atribuirLote(db, programId, corte, unicos.slice(i, i + TAMANO_LOTE))) ids.add(id);
  }
  return ids;
}

async function atribuirLote(db: Db, programId: string, corte: CortePauta, filas: readonly DealConOrigen[]) {
  const ids = [...new Set(filas.flatMap((d) => d.submissionOrigenId ? [d.submissionOrigenId] : []))];
  if (ids.length === 0) return new Set<string>();
  const columnas = { id: submissions.id, sourceId: submissions.sourceId, token: submissions.token,
    esParcial: submissions.esParcial, leadId: submissions.leadId, nombre: sql<null>`null`,
    fechaEnvio: submissions.fechaEnvio, createdAt: submissions.createdAt, ...columnasUtmDelEnvio };
  const originales = await db.select(columnas).from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(and(eq(sources.programId, programId), inArray(submissions.id, ids)));
  const idsParciales = originales.filter((e) => e.esParcial).map((e) => e.id);
  const parcial = alias(submissions, "submission_parcial_corte");
  const completo = alias(submissions, "submission_completo_corte");
  const parejas = idsParciales.length === 0 ? [] : await db.select({ parcialId: parcial.id, completoId: completo.id })
    .from(parcial).innerJoin(completo, completoDelParcial(parcial, completo))
    .where(inArray(parcial.id, idsParciales));
  const completos = parejas.length === 0 ? [] : await db.select(columnas).from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(and(eq(sources.programId, programId), inArray(submissions.id, parejas.map((p) => p.completoId))));
  const [arbol, objetos] = await Promise.all([arbolDePauta(db, programId), objetosParaAtribucionDePauta(db, programId)]);
  const porEnvio = atribuirEnviosDePauta([...originales, ...completos], parejas, objetos, arbol,
    { desde: "0000-01-01", hasta: "9999-12-31" }).filaPorEnvioId;
  const porDeal = atribucionPorDeal(porEnvio, filas);
  return new Set([...porDeal].filter(([, envio]) => perteneceAlCorte(envio, corte)).map(([id]) => id));
}

/** El origen puede preceder al rango operativo de la cita o la venta. */
export async function idsDeDealsDelCorte(db: Db, programId: string, corte: CortePauta): Promise<string[]> {
  return unaVezPorSolicitud(db, claveDe("idsDeDealsDelCorte", programId, corte.nivel, corte.id), async () => {
    const ids: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const filas: DealConOrigen[] = await db.select({ id: deals.id, submissionOrigenId: deals.submissionOrigenId })
        .from(deals).where(and(eq(deals.programId, programId), vigente(deals), isNotNull(deals.submissionOrigenId),
          cursor ? gt(deals.id, cursor) : undefined)).orderBy(asc(deals.id)).limit(TAMANO_LOTE);
      ids.push(...await atribuirLote(db, programId, corte, filas));
      if (filas.length < TAMANO_LOTE) return ids;
      cursor = filas.at(-1)!.id;
    }
  });
}
