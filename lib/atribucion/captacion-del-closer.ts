import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { canales, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import type { Traza } from "./emparejar";
import { destinoDeCaptacion, generarLink } from "./link-de-captacion";

/**
 * El enlace de captacion del closer y su codigo (ticket 086, ADR 0044 puntos 1 y 2).
 *
 * El enlace va al formulario del programa con el canal del closer (`utm_source=closer`,
 * `utm_medium=referido`, los del Canal con formato `closer`), la campaña de referidos y
 * en `utm_content` un **codigo opaco** del closer. Nunca el nombre: `Maru`, `maru` y
 * `Maru Marquez` serian tres closers (ADR 0030). El closer no teclea nada.
 *
 * **Nada se guarda** (ADR 0024): el codigo se deriva del `users.id` y el enlace de la
 * fuente principal, asi que cambiar el formulario cambia todos los enlaces. La ingesta
 * resuelve el codigo contra los miembros ACTIVOS del programa del envio: un codigo de
 * alguien sin membresia ahi no le da credito en un programa ajeno (ADR 0043).
 */

/** La campaña de los enlaces de closer. Una sola: quien trajo al lead lo dice el codigo. */
export const CAMPANA_DE_REFERIDOS = "referidos";

/**
 * El codigo opaco de un closer: los primeros 12 hex del sha256 de su id con un prefijo
 * propio (no coincide con `codigoDeCloser` de las listas, que es otra pregunta). Sale en
 * minusculas y alfanumerico, asi que `sanearUtm` no lo cambia.
 */
export function codigoDeCaptacion(userId: string): string {
  return createHash("sha256").update(`captacion:${userId}`).digest("hex").slice(0, 12);
}

/**
 * De quien es un codigo, entre los candidatos (los miembros activos del programa). Un
 * codigo que no casa, o que casara con dos (colision), no es de nadie: un credito mal
 * dado no lanza ningun error, y no darlo deja el lead como "sin traido por", que es
 * lo que de verdad se sabe.
 */
export function closerDelCodigo(codigo: string | null, candidatos: readonly string[]): string | null {
  if (codigo === null) return null;
  const buscado = codigo.trim().toLowerCase();
  const casan = [...new Set(candidatos)].filter((id) => codigoDeCaptacion(id) === buscado);
  return casan.length === 1 ? casan[0] : null;
}

/**
 * Quien trajo a cada lead segun los envios de un lote: el PRIMER envio (por fecha) cuya
 * traza es del canal del closer con un codigo que resuelve. Puro: la ingesta lo llama con
 * las trazas ya emparejadas, y escribe solo donde el lead no tenia a nadie.
 */
export function traidoPorDeEnvios(
  envios: readonly { leadId: string | null; fechaEnvio: Date | null; traza: Traza }[],
  candidatos: readonly string[],
): Map<string, string> {
  // Sin fecha va al final; entre dos sin fecha se conserva el orden de llegada.
  const ms = (d: Date | null) => d?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const enOrden = [...envios].sort((a, b) => ms(a.fechaEnvio) - ms(b.fechaEnvio));
  const resultado = new Map<string, string>();
  for (const e of enOrden) {
    if (e.leadId === null || resultado.has(e.leadId)) continue;
    if (e.traza.contenido?.formato !== "closer") continue;
    const closer = closerDelCodigo(e.traza.contenido.codigoCloser, candidatos);
    if (closer) resultado.set(e.leadId, closer);
  }
  return resultado;
}

/**
 * Los usuarios ACTIVOS con membresia ACTIVA en el programa: los unicos a quienes un codigo
 * acredita. Un usuario desactivado no recibe credito aunque conserve la membresia.
 */
export async function miembrosActivos(db: Db, programId: string): Promise<string[]> {
  const filas = await db
    .select({ userId: miembrosPrograma.userId })
    .from(miembrosPrograma)
    .innerJoin(users, eq(users.id, miembrosPrograma.userId))
    .where(
      and(eq(miembrosPrograma.programId, programId), eq(miembrosPrograma.activo, true), eq(users.activo, true)),
    );
  return filas.map((f) => f.userId);
}

const SIN_PRINCIPAL =
  "Este programa todavía no tiene formulario principal. Pídele a tu gerente que lo marque en Programa → Captación.";

/** El enlace de un programa, o por que no hay. */
export type EnlaceDeCaptacion =
  | { programId: string; programa: string; ok: true; url: string; formulario: string }
  | { programId: string; programa: string; ok: false; error: string };

/**
 * Los enlaces de captacion de un usuario: uno por programa ACTIVO donde tiene membresia
 * activa. El mismo closer en dos programas tiene dos enlaces (otro formulario). Un
 * programa sin fuente principal, o sin el canal del closer activo, devuelve el motivo
 * en vez de una URL rota.
 */
export async function enlacesDeCaptacion(db: Db, userId: string): Promise<EnlaceDeCaptacion[]> {
  const [membresias, canalDelCloser] = await Promise.all([
    db
      .select({ programId: programs.id, programa: programs.nombre })
      .from(miembrosPrograma)
      .innerJoin(programs, eq(programs.id, miembrosPrograma.programId))
      .where(
        and(
          eq(miembrosPrograma.userId, userId),
          eq(miembrosPrograma.activo, true),
          eq(programs.activo, true),
        ),
      )
      .orderBy(asc(programs.nombre)),
    db
      .select({ utmSource: canales.utmSource, utmMedium: canales.utmMedium })
      .from(canales)
      .where(and(eq(canales.formato, "closer"), eq(canales.activo, true))),
  ]);
  const codigo = codigoDeCaptacion(userId);
  // Un solo canal de closer con source fijo: el link tiene que caer en el y en ningun otro.
  const canal = canalDelCloser.length === 1 ? canalDelCloser[0] : null;

  return Promise.all(
    membresias.map(async ({ programId, programa }): Promise<EnlaceDeCaptacion> => {
      if (!canal || canal.utmSource === null) {
        return {
          programId,
          programa,
          ok: false,
          error: "Falta el canal de closer (closer / referido). Pídele a tu gerente que lo active en Ajustes → Canales.",
        };
      }
      try {
        const destino = await destinoDeCaptacion(db, programId);
        const url = generarLink(destino.url, {
          source: canal.utmSource,
          medium: canal.utmMedium,
          campaign: CAMPANA_DE_REFERIDOS,
          content: codigo,
        });
        return { programId, programa, ok: true, url, formulario: destino.nombre };
      } catch (e) {
        // Quien ve esto es un closer, que no administra formularios: se le dice que pedir.
        if (e instanceof ErrorDeApp && e.status === 422) {
          return { programId, programa, ok: false, error: SIN_PRINCIPAL };
        }
        if (e instanceof ErrorDeApp) return { programId, programa, ok: false, error: e.message };
        throw e;
      }
    }),
  );
}
