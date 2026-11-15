import { inArray } from "drizzle-orm";
import type { ArbolDePauta } from "@/lib/atribucion/emparejar";
import { pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

function arbolDesdeFilas(filas: {
  idMeta: string;
  nivel: "campana" | "conjunto" | "anuncio";
  padreIdMeta: string | null;
  nombre: string;
}[]): ArbolDePauta {
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
    conjuntos: [...conjuntos].map(([id, campanaId]) => ({ id, campanaId })),
  };
}

/** Proyección mínima de los árboles de Meta, en una sola consulta. */
export async function arbolesDePauta(db: Db, programIds: string[]): Promise<Map<string, ArbolDePauta>> {
  if (programIds.length === 0) return new Map();
  const filas = await db
    .select({
      programId: pautaObjetos.programId,
      idMeta: pautaObjetos.idMeta,
      nivel: pautaObjetos.nivel,
      padreIdMeta: pautaObjetos.padreIdMeta,
      nombre: pautaObjetos.nombre,
    })
    .from(pautaObjetos)
    .where(inArray(pautaObjetos.programId, programIds));
  return new Map(programIds.map((programId) => [
    programId,
    arbolDesdeFilas(filas.filter((fila) => fila.programId === programId)),
  ]));
}

/** Proyección mínima del árbol de Meta que consume el emparejador de atribución. */
export async function arbolDePauta(db: Db, programId: string): Promise<ArbolDePauta> {
  return (await arbolesDePauta(db, [programId])).get(programId)!;
}
