import { and, eq } from "drizzle-orm";
import { exigirProgramaEnAlcance } from "@/lib/catalogo/acceso-programa";
import { creadores as catalogoDeCreadores, esquemaCreador, tiposDePieza, type EntradaCreador } from "@/lib/catalogo/creadores";
import { editarConRastro } from "@/lib/crm/rastro";
import { db as dbDeLaApp } from "@/lib/db";
import { creadores, piezas } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { trabajaContenido } from "@/lib/auth/roles";
import { vigente } from "@/lib/queries/vigente";
import { crearPieza, exigirAccesoAlCreador, type ActorDeMedia } from "./piezas";

/**
 * Crear y editar creadores con la reja de media (ticket 316, ADR 0107 y 0110). El molde de
 * catalogo pone el rastro; esto pone QUIEN: solo quien `trabajaContenido`, y solo creadores
 * (y programas) dentro de su alcance. Un creador sin programa lo toca solo quien no tiene
 * alcance limitado.
 *
 * Cambiar el programa de un creador (ADR 0110 punto 2: "si entra a un programa, se le asigna
 * y mide desde ese dia"): una pieza no cambia de programa, asi que su permanente VIVA se
 * descarta con motivo automatico y se crea otra igual (tipo, red, CTA) bajo el programa nuevo,
 * con codigo nuevo, TODO en la misma transaccion. El link fijo anterior deja de emparejar
 * (aviso `pieza_desconocida`), pero las piezas viejas y sus leads ya atribuidos conservan su
 * historia. Las piezas con fecha no se mudan: quedan en el programa con el que nacieron.
 */
export const MOTIVO_CAMBIO_DE_PROGRAMA = "El creador cambió de programa.";

const MENSAJE_FUERA_DE_ALCANCE = "No puedes gestionar creadores de un programa fuera de tu alcance.";

type Transaccional = { transaction: <T>(fn: (tx: Db) => Promise<T>) => Promise<T> };

function exigirQueTrabajaContenido(actor: ActorDeMedia): void {
  if (!trabajaContenido(actor.rol)) throw new ErrorDeApp("No tienes permiso para gestionar contenido.", 403);
}

export async function crearCreador(actor: ActorDeMedia, entrada: EntradaCreador, db: Db = dbDeLaApp) {
  exigirQueTrabajaContenido(actor);
  const datos = await normalizando(async () => esquemaCreador.parse(entrada));
  if (datos.programId) await exigirProgramaEnAlcance(db, actor, datos.programId, MENSAJE_FUERA_DE_ALCANCE);
  else await exigirAccesoAlCreador(db, actor, { programId: null });
  return normalizando(() => catalogoDeCreadores(db).crear(actor.id, datos));
}

export async function editarCreador(actor: ActorDeMedia, id: string, entrada: EntradaCreador, db: Db = dbDeLaApp) {
  exigirQueTrabajaContenido(actor);
  const datos = await normalizando(async () => esquemaCreador.parse(entrada));
  const [actual] = await db.select().from(creadores).where(eq(creadores.id, id));
  if (!actual) throw new ErrorDeApp("No existe el creador.", 404);
  await exigirAccesoAlCreador(db, actor, actual);
  if (datos.programId) await exigirProgramaEnAlcance(db, actor, datos.programId, MENSAJE_FUERA_DE_ALCANCE);
  else await exigirAccesoAlCreador(db, actor, { programId: null });

  const cambiaDePrograma = (actual.programId ?? null) !== (datos.programId ?? null);
  return normalizando(() =>
    (db as unknown as Transaccional).transaction(async (tx) => {
      const editado = await catalogoDeCreadores(tx).editar(actor.id, id, datos);
      if (!cambiaDePrograma) return editado;

      const permanentes = await tx
        .select()
        .from(piezas)
        .where(and(eq(piezas.creadorId, id), eq(piezas.permanente, true), vigente(piezas)));
      for (const vieja of permanentes) {
        await editarConRastro(
          { db: tx, tabla: piezas, nombreTabla: "piezas", actorId: actor.id, etiqueta: `pieza ${vieja.codigo}` },
          vieja.id,
          { anuladoEn: new Date(), anuladoPor: actor.id, motivoAnulacion: MOTIVO_CAMBIO_DE_PROGRAMA },
        );
        // Sin programa nuevo no hay link: el creador queda con su pipeline y sin permanente.
        if (datos.programId) {
          await crearPieza(
            actor,
            { creadorId: id, tipoId: vieja.tipoId, red: vieja.red as never, cta: vieja.cta, permanente: true },
            tx,
          );
        }
      }
      return editado;
    }),
  );
}

/** Un tipo de pieza nuevo (catalogo de media). Solo quien trabaja contenido. */
export async function crearTipoDePieza(actor: ActorDeMedia, nombre: string, db: Db = dbDeLaApp) {
  exigirQueTrabajaContenido(actor);
  return normalizando(() => tiposDePieza(db).crear(actor.id, { nombre }));
}
