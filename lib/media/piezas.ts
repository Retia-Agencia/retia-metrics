import { randomInt } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { programasDelAlcance } from "@/lib/auth/alcance";
import { esAccesoTotal, tieneAlcanceConfigurable, trabajaContenido, type Rol } from "@/lib/auth/roles";
import { linkDePieza } from "@/lib/atribucion/link-de-pieza";
import { exigirProgramaEnAlcance } from "@/lib/catalogo/acceso-programa";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";
import { db as dbDeLaApp } from "@/lib/db";
import { esViolacionUnica } from "@/lib/db/errores";
import { creadores, piezas, tiposPieza } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { hoyEnBogota } from "@/lib/format";
import { REDES_DE_CONTENIDO } from "./redes";

/**
 * La pieza de contenido, version minima (ticket 316, ADR 0110): lo que el link necesita
 * (317) y el "ya publiqué". Los estados configurables, las tareas y el calendario esperan a
 * que media describa su pipeline (ADR 0110 punto 6): hoy `publicada_en` es el unico estado.
 *
 * Toda escritura pasa por `crearConRastro` / `editarConRastro` (ADR 0042). El programa NUNCA
 * llega del input: sale del creador, y una pieza no cambia de programa (ADR 0043).
 */

export interface ActorDeMedia {
  id: string;
  /** El rol de VISTA (ADR 0028), no `session.user.rol` crudo. */
  rol: Rol;
}

/** Alfabeto sin vocales ni 0/1/l/o: el codigo no puede formar palabras ni confundirse al leerlo. */
const ALFABETO_CODIGO = "23456789bcdfghjkmnpqrstvwxyz";
const LARGO_CODIGO = 8;

/** El codigo opaco de una pieza (ADR 0108): corto, aleatorio, sin datos personales. */
export function generarCodigoDePieza(): string {
  let codigo = "";
  for (let i = 0; i < LARGO_CODIGO; i++) codigo += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)];
  return codigo;
}

const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe ser AAAA-MM-DD.");

/** Un solo esquema para el alta; la edicion reusa los mismos campos editables. */
export const esquemaPieza = z
  .object({
    nombre: z.string().trim().min(1, "La pieza necesita un nombre.").max(80, "Máximo 80 caracteres."),
    creadorId: z.string().uuid(),
    tipoId: z.string().uuid(),
    red: z.enum(REDES_DE_CONTENIDO),
    cta: z.string().trim().max(200, "Máximo 200 caracteres.").nullish(),
    fechaPublicacion: fechaIso.nullish(),
    permanente: z.boolean().default(false),
  })
  .refine((p) => Boolean(p.fechaPublicacion) !== p.permanente, {
    message: "La pieza lleva fecha de publicación o es permanente, no ambas ni ninguna.",
  });
export type EntradaPieza = z.input<typeof esquemaPieza>;

/** Lo que una edicion puede tocar: nunca el creador ni el programa (la pieza no se muda). */
export const esquemaEdicionPieza = z
  .object({
    nombre: z.string().trim().min(1, "La pieza necesita un nombre.").max(80, "Máximo 80 caracteres."),
    tipoId: z.string().uuid(),
    red: z.enum(REDES_DE_CONTENIDO),
    cta: z.string().trim().max(200, "Máximo 200 caracteres.").nullish(),
    fechaPublicacion: fechaIso.nullish(),
    permanente: z.boolean().default(false),
  })
  .refine((p) => Boolean(p.fechaPublicacion) !== p.permanente, {
    message: "La pieza lleva fecha de publicación o es permanente, no ambas ni ninguna.",
  });
export type EdicionPieza = z.input<typeof esquemaEdicionPieza>;

/** ZodError -> 400, igual que el resto de los modulos (`lib/errors-zod.ts`). */
function validar<T>(esquema: z.ZodType<T>, entrada: unknown): T {
  const r = esquema.safeParse(entrada);
  if (!r.success) throw new ErrorDeApp(r.error.issues[0]?.message ?? "Datos inválidos.", 400);
  return r.data;
}

/**
 * Quien puede tocar el contenido de un creador. Pasa `trabajaContenido`; si el creador tiene
 * programa, ese programa tiene que estar en el alcance; si NO tiene, solo lo ve quien no
 * tiene alcance limitado (ADR 0107 punto 3, ADR 0110 punto 2).
 */
export async function exigirAccesoAlCreador(
  db: Db,
  actor: ActorDeMedia,
  creador: { programId: string | null },
): Promise<void> {
  if (!trabajaContenido(actor.rol)) throw new ErrorDeApp("No tienes permiso para gestionar contenido.", 403);
  const mensaje = "No puedes gestionar contenido de un programa fuera de tu alcance.";
  if (creador.programId) return exigirProgramaEnAlcance(db, actor, creador.programId, mensaje);
  if (esAccesoTotal(actor.rol) || !tieneAlcanceConfigurable(actor.rol)) return;
  if ((await programasDelAlcance(actor.id, db)).size > 0) {
    throw new ErrorDeApp("Un creador sin programa lo ve solo quien no tiene el alcance limitado.", 403);
  }
}

async function leerCreador(db: Db, id: string) {
  const [creador] = await db.select().from(creadores).where(eq(creadores.id, id));
  if (!creador) throw new ErrorDeApp("No existe el creador.", 404);
  return creador;
}

async function leerPieza(db: Db, id: string) {
  // Incluye las descartadas: las acciones deciden que hacer con ellas (422, o no-op idempotente).
  const [pieza] = await db.select().from(piezas).where(and(eq(piezas.id, id), incluyendoAnulados(piezas)));
  if (!pieza) throw new ErrorDeApp("No existe la pieza.", 404);
  return pieza;
}

/** La pieza que se quiere tocar, con el acceso ya verificado contra el programa de su creador. */
async function piezaAccesible(db: Db, actor: ActorDeMedia, id: string) {
  const pieza = await leerPieza(db, id);
  await exigirAccesoAlCreador(db, actor, { programId: pieza.programId });
  return pieza;
}

function etiquetaDePieza(nombre: string, creadorSlug: string, red: string): string {
  return `${nombre} · ${creadorSlug} · ${red}`;
}

/** Crea una pieza. El programa sale del creador; el codigo, del servidor. Devuelve el id. */
export async function crearPieza(actor: ActorDeMedia, entrada: EntradaPieza, db: Db = dbDeLaApp): Promise<string> {
  const datos = validar(esquemaPieza, entrada);
  const creador = await leerCreador(db, datos.creadorId);
  if (!creador.activo) throw new ErrorDeApp("El creador está desactivado.", 422);
  await exigirAccesoAlCreador(db, actor, creador);
  const [tipo] = await db.select({ activo: tiposPieza.activo }).from(tiposPieza).where(eq(tiposPieza.id, datos.tipoId));
  if (!tipo) throw new ErrorDeApp("No existe el tipo de pieza.", 404);
  if (!tipo.activo) throw new ErrorDeApp("El tipo de pieza está desactivado.", 422);

  // El codigo es aleatorio: una colision (rarisima) se reintenta; el indice unico decide.
  for (let intento = 0; intento < 5; intento++) {
    try {
      return await crearConRastro(
        {
          db,
          tabla: piezas,
          nombreTabla: "piezas",
          actorId: actor.id,
          etiqueta: etiquetaDePieza(datos.nombre, creador.slug, datos.red),
        },
        {
          programId: creador.programId,
          creadorId: creador.id,
          nombre: datos.nombre,
          tipoId: datos.tipoId,
          red: datos.red,
          cta: datos.cta || null,
          fechaPublicacion: datos.fechaPublicacion ?? null,
          permanente: datos.permanente,
          codigo: generarCodigoDePieza(),
          creadaPor: actor.id,
        },
      );
    } catch (error) {
      if (!esViolacionUnica(error)) throw error;
      const [existe] = await db
        .select({ id: piezas.id })
        .from(piezas)
        .where(and(eq(piezas.creadorId, creador.id), eq(piezas.red, datos.red), eq(piezas.permanente, true), vigente(piezas)));
      if (datos.permanente && existe) {
        throw new ErrorDeApp("Ese creador ya tiene su pieza permanente en esa red.", 409);
      }
      // Si no fue la permanente, fue el codigo: reintenta con otro.
    }
  }
  throw new ErrorDeApp("No se pudo generar un código único para la pieza.", 500);
}

/** Edita los campos de una pieza viva. Una pieza descartada no se edita. */
export async function editarPieza(actor: ActorDeMedia, id: string, entrada: EdicionPieza, db: Db = dbDeLaApp): Promise<boolean> {
  const datos = validar(esquemaEdicionPieza, entrada);
  const pieza = await piezaAccesible(db, actor, id);
  if (pieza.anuladoEn) throw new ErrorDeApp("La pieza está descartada y no se edita.", 422);
  const [creador] = await db.select({ slug: creadores.slug }).from(creadores).where(eq(creadores.id, pieza.creadorId));
  try {
    return await editarConRastro(
      {
        db,
        tabla: piezas,
        nombreTabla: "piezas",
        actorId: actor.id,
        etiqueta: etiquetaDePieza(datos.nombre, creador?.slug ?? "?", datos.red),
      },
      id,
      {
        nombre: datos.nombre,
        tipoId: datos.tipoId,
        red: datos.red,
        cta: datos.cta || null,
        fechaPublicacion: datos.fechaPublicacion ?? null,
        permanente: datos.permanente,
      },
    );
  } catch (error) {
    if (esViolacionUnica(error)) throw new ErrorDeApp("Ese creador ya tiene su pieza permanente en esa red.", 409);
    throw error;
  }
}

/** "Ya publiqué": marca el instante (idempotente: la segunda vez no cambia ni escribe nada). */
export async function marcarPublicada(actor: ActorDeMedia, id: string, db: Db = dbDeLaApp): Promise<boolean> {
  const pieza = await piezaAccesible(db, actor, id);
  if (pieza.anuladoEn) throw new ErrorDeApp("La pieza está descartada.", 422);
  if (pieza.publicadaEn) return false;
  return editarConRastro(
    { db, tabla: piezas, nombreTabla: "piezas", actorId: actor.id, etiqueta: `pieza ${pieza.codigo}` },
    id,
    { publicadaEn: new Date() },
  );
}

/**
 * Descarta una pieza: se ANULA con quien y por que, nunca se borra (ADR 0026). Una pieza
 * descartada deja de emparejar (318) pero sus leads ya atribuidos no se pierden.
 */
export async function descartarPieza(
  actor: ActorDeMedia,
  id: string,
  motivo: string,
  db: Db = dbDeLaApp,
): Promise<boolean> {
  const razon = validar(z.string().trim().min(1, "Cuéntanos por qué se descarta.").max(300), motivo);
  const pieza = await piezaAccesible(db, actor, id);
  if (pieza.anuladoEn) return false;
  return editarConRastro(
    { db, tabla: piezas, nombreTabla: "piezas", actorId: actor.id, etiqueta: `pieza ${pieza.codigo}` },
    id,
    { anuladoEn: new Date(), anuladoPor: actor.id, motivoAnulacion: razon },
  );
}

/** Las piezas vivas de un creador al que el actor accede, la mas reciente primero. */
export async function piezasDelCreador(actor: ActorDeMedia, creadorId: string, db: Db = dbDeLaApp) {
  const creador = await leerCreador(db, creadorId);
  await exigirAccesoAlCreador(db, actor, creador);
  const filas = await db
    .select()
    .from(piezas)
    .where(and(eq(piezas.creadorId, creadorId), vigente(piezas)));
  return filas.sort((a, b) => (b.fechaPublicacion ?? hoyEnBogota()).localeCompare(a.fechaPublicacion ?? hoyEnBogota()));
}

/** El link para copiar de una pieza, con el acceso verificado. Sin programa: 422 con el porque. */
export async function linkDeLaPieza(actor: ActorDeMedia, id: string, db: Db = dbDeLaApp): Promise<string> {
  await piezaAccesible(db, actor, id);
  return linkDePieza(db, id);
}

/** Los creadores que el actor ve: sin alcance limitado todos; con filas, solo los de esos programas. */
export async function creadoresVisibles(actor: ActorDeMedia, db: Db = dbDeLaApp) {
  if (!trabajaContenido(actor.rol)) throw new ErrorDeApp("No tienes permiso para gestionar contenido.", 403);
  const todos = await db.select().from(creadores).orderBy(asc(creadores.nombre));
  if (esAccesoTotal(actor.rol) || !tieneAlcanceConfigurable(actor.rol)) return todos;
  const alcance = await programasDelAlcance(actor.id, db);
  if (alcance.size === 0) return todos;
  return todos.filter((c) => c.programId !== null && alcance.has(c.programId));
}

/** ¿Ve este actor a los creadores sin programa? Solo quien no tiene el alcance limitado (ADR 0107 punto 3). */
export async function veCreadoresSinPrograma(actor: ActorDeMedia, db: Db = dbDeLaApp): Promise<boolean> {
  if (esAccesoTotal(actor.rol) || !tieneAlcanceConfigurable(actor.rol)) return true;
  return (await programasDelAlcance(actor.id, db)).size === 0;
}
