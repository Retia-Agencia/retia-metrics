import { eq } from "drizzle-orm";
import type { ArbolDePauta } from "@/lib/atribucion/emparejar";
import { pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/** Proyección mínima del árbol de Meta que consume el emparejador de atribución. */
export async function arbolDePauta(db: Db, programId: string): Promise<ArbolDePauta> {
  const filas = await db
    .select({
      idMeta: pautaObjetos.idMeta,
      nivel: pautaObjetos.nivel,
      padreIdMeta: pautaObjetos.padreIdMeta,
      nombre: pautaObjetos.nombre,
    })
    .from(pautaObjetos)
    .where(eq(pautaObjetos.programId, programId));
  const conjuntos = new Map(
    filas.filter((fila) => fila.nivel === "conjunto" && fila.padreIdMeta)
      .map((fila) => [fila.idMeta, fila.padreIdMeta!]),
  );
  return {
    campanas: filas.filter((fila) => fila.nivel === "campana")
      .map((fila) => ({ id: fila.idMeta, nombre: fila.nombre })),
    anuncios: filas.filter((fila) => fila.nivel === "anuncio" && fila.padreIdMeta)
      .flatMap((fila) => {
        const campanaId = conjuntos.get(fila.padreIdMeta!);
        return campanaId
          ? [{ id: fila.idMeta, conjuntoId: fila.padreIdMeta!, campanaId }]
          : [];
      }),
  };
}
