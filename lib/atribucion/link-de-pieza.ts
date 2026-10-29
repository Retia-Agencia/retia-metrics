import { and, eq } from "drizzle-orm";
import { creadores, piezas, tiposPieza } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { UTM_MEDIUM_CONTENIDO } from "./canal";
import { campanaDePieza } from "./campana-de-pieza";
import { destinoDeCaptacion, generarLink } from "./link-de-captacion";

export { campanaDePieza };

/** Sin programa no hay link: el creador no tiene embudo (ADR 0110 punto 2). */
export const SIN_PROGRAMA_SIN_LINK =
  "Este creador no tiene programa: su contenido se planea pero no tiene link ni mide ventas. Asígnale un programa para generarlo.";

/**
 * El link de una pieza de contenido (ticket 317, ADR 0108). Sale del MISMO generador que el
 * organico y el closer (`generarLink`), sobre la fuente principal del programa de la pieza.
 * Derivado, nunca guardado (ADR 0024): cambiar la fuente cambia todos los links sin migrar.
 *
 *  - `utm_source` = la red de la pieza · `utm_medium` = `contenido` (constante del codigo)
 *  - `utm_campaign` = `<tipo>_<creador>_<aaaammdd>` (o `<tipo>_<creador>` si es permanente)
 *  - `utm_content` = el codigo opaco de la pieza; solo lo lee el emparejador, con ese medio.
 */
export async function linkDePieza(db: Db, piezaId: string): Promise<string> {
  const [fila] = await db
    .select({
      programId: piezas.programId,
      red: piezas.red,
      codigo: piezas.codigo,
      fecha: piezas.fechaPublicacion,
      permanente: piezas.permanente,
      anuladoEn: piezas.anuladoEn,
      tipo: tiposPieza.nombre,
      slug: creadores.slug,
    })
    .from(piezas)
    .innerJoin(creadores, eq(creadores.id, piezas.creadorId))
    .innerJoin(tiposPieza, eq(tiposPieza.id, piezas.tipoId))
    // Incluye las descartadas para poder decir "esta descartada" en vez de "no existe".
    .where(and(eq(piezas.id, piezaId), incluyendoAnulados(piezas)));
  if (!fila) throw new ErrorDeApp("No existe la pieza.", 404);
  if (fila.anuladoEn) throw new ErrorDeApp("La pieza está descartada: no tiene link.", 422);
  if (!fila.programId) throw new ErrorDeApp(SIN_PROGRAMA_SIN_LINK, 422);
  const destino = await destinoDeCaptacion(db, fila.programId);
  return generarLink(destino.url, {
    source: fila.red,
    medium: UTM_MEDIUM_CONTENIDO,
    campaign: campanaDePieza({ tipo: fila.tipo, creadorSlug: fila.slug, fechaPublicacion: fila.fecha, permanente: fila.permanente }),
    content: fila.codigo,
  });
}

/** El link fijo del creador: el de su pieza permanente viva en esa red. */
export async function linkFijoDelCreador(db: Db, creadorId: string, red: string): Promise<string> {
  const [fija] = await db
    .select({ id: piezas.id })
    .from(piezas)
    .where(and(eq(piezas.creadorId, creadorId), eq(piezas.red, red), eq(piezas.permanente, true), vigente(piezas)));
  if (!fija) throw new ErrorDeApp("Este creador no tiene pieza permanente en esa red.", 404);
  return linkDePieza(db, fija.id);
}
