import { inArray, sql } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { creadores as moldeCreadores } from "@/lib/catalogo/creadores";
import {
  calificaciones,
  candidatos,
  colecciones,
  descartes,
  guionesLimpios,
  referentes,
  referentesSugeridos,
  tandas,
  tematicas,
  transcripciones,
  trasladoCockpit,
  videosGrabados,
  videosReferentes,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esViolacionForanea } from "@/lib/db/errores";

/**
 * La reversa del traslado del cockpit (ticket 322; molde de `migracion:deshacer`): borra lo que
 * trajo el traslado, reconocido por su huella (`traslado_cockpit`), y nada mas. Lo que alguien
 * creo despues en el CRM no esta en la huella y no se toca.
 *
 * - Se niega, sin borrar nada, si algo creado DESPUES apunta a lo trasladado (la FK `restrict`
 *   de la base lo dice) o si un creador trasladado ya se uso: ahi es historia del negocio.
 * - Las puentes y los videos de coleccion caen con su padre (`on delete cascade`). Un video que
 *   alguien sumo a una coleccion trasladada cae con ella: la reversa es para hacerla enseguida.
 * - Corre dentro de la transaccion del llamador, que la deshace en el ensayo.
 */

/** Del hijo al padre: el orden en que las FK dejan borrar. */
const ORDEN: { nombre: string; tabla: PgTable; id: PgColumn }[] = [
  { nombre: "calificaciones", tabla: calificaciones, id: calificaciones.id },
  { nombre: "descartes", tabla: descartes, id: descartes.id },
  { nombre: "candidatos", tabla: candidatos, id: candidatos.id },
  { nombre: "videos_grabados", tabla: videosGrabados, id: videosGrabados.id },
  { nombre: "videos_referentes", tabla: videosReferentes, id: videosReferentes.id },
  { nombre: "colecciones", tabla: colecciones, id: colecciones.id },
  { nombre: "guiones_limpios", tabla: guionesLimpios, id: guionesLimpios.id },
  { nombre: "transcripciones", tabla: transcripciones, id: transcripciones.id },
  { nombre: "tandas", tabla: tandas, id: tandas.id },
  { nombre: "referentes_sugeridos", tabla: referentesSugeridos, id: referentesSugeridos.id },
  { nombre: "referentes", tabla: referentes, id: referentes.id },
  { nombre: "tematicas", tabla: tematicas, id: tematicas.id },
];

export type ResultadoReversaCockpit =
  | { estado: "deshecho"; borrado: Record<string, number> }
  | { estado: "negado"; motivo: string };

class Negado extends Error {}

export async function deshacerCockpit(tx: Db, actorId: string): Promise<ResultadoReversaCockpit> {
  const borrado: Record<string, number> = {};
  const huella = await tx.select().from(trasladoCockpit);
  const idsDe = (tabla: string) => huella.filter((h) => h.tabla === tabla).map((h) => h.filaId);

  try {
    for (const paso of ORDEN) {
      const ids = idsDe(paso.nombre);
      borrado[paso.nombre] = 0;
      for (let i = 0; i < ids.length; i += 1000) {
        const lote = ids.slice(i, i + 1000);
        const quitadas = await tx.delete(paso.tabla).where(inArray(paso.id, lote)).returning();
        borrado[paso.nombre] += quitadas.length;
      }
    }

    // Los creadores salen por el molde: si ya se usaron (una pieza, un candidato nuevo), se niega.
    const molde = moldeCreadores(tx);
    borrado.creadores = 0;
    for (const id of idsDe("creadores")) {
      const r = await molde.borrarSiNoSeUso(actorId, id);
      if (!r.borrado) throw new Negado(`un creador trasladado ya tiene ${r.referencias} referencia(s) nuevas`);
      borrado.creadores += 1;
    }

    await tx.delete(trasladoCockpit).where(sql`true`);
  } catch (e) {
    if (e instanceof Negado) return { estado: "negado", motivo: e.message };
    if (esViolacionForanea(e)) {
      return { estado: "negado", motivo: "algo creado despues del traslado apunta a lo trasladado" };
    }
    throw e;
  }
  return { estado: "deshecho", borrado };
}

/** Cuantas filas del traslado hay hoy, por tabla (para comparar contra el cockpit). */
export async function conteoDeLaHuella(tx: Db): Promise<Record<string, number>> {
  const filas = await tx
    .select({ tabla: trasladoCockpit.tabla, n: sql<number>`count(*)::int` })
    .from(trasladoCockpit)
    .groupBy(trasladoCockpit.tabla);
  return Object.fromEntries(filas.map((f) => [f.tabla, f.n]));
}

