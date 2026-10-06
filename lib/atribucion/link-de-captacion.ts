import { and, asc, eq } from "drizzle-orm";
import { sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";

/**
 * EL generador de links de captacion (ticket 092, ADR 0051, ADR 0068). Uno solo para el
 * organico y para el enlace del closer (086): el destino es la fuente del programa y los
 * UTM se pegan encima. El link es **derivado, nunca guardado** (ADR 0024): cambiar la
 * fuente principal o su URL cambia todos los links sin migrar nada.
 *
 * Los links de Meta no salen de aqui: los arma Meta con las macros de la plantilla de
 * Pauta (ADR 0062). Una segunda concatenacion de "URL mas parametros" en otro archivo es
 * el olor (AGENTS.md, contrato "Como se arma un link de captacion").
 */

/** Los UTM que lleva un link. `source` y `medium` salen del Canal tal cual; el resto se sanea. */
export interface UtmsDelLink {
  source: string;
  medium: string;
  campaign: string;
  content?: string | null;
  term?: string | null;
}

/**
 * La forma de un valor libre (campana, content, term): minusculas, sin tildes, `snake_case`,
 * sin espacios (ADR 0051). Lo que no es letra o digito pasa a `_`, y los `_` de los bordes
 * se quitan. `source` y `medium` NO pasan por aqui: son los del Canal, y el emparejador los
 * compara contra ese catalogo; reescribirlos (un punto en `l.instagram.com`) romperia el par.
 */
export function sanearUtm(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Pega los UTM al destino. Respeta lo que el destino ya traia en su query, pero **borra
 * todo `utm_*` que trajera**: un `utm_id` copiado de un link de pauta haria que el
 * emparejador atribuyera el envio organico a ese anuncio de Meta. Los UTM del link son
 * solo los que dice este llamado. Un campo opcional vacio no se escribe. Una campana que
 * queda vacia al sanearla es un error: un link sin campana no se puede atribuir a nada.
 */
export function generarLink(destino: string, utms: UtmsDelLink): string {
  const url = new URL(destino);
  for (const llave of [...url.searchParams.keys()]) {
    if (llave.toLowerCase().startsWith("utm_")) url.searchParams.delete(llave);
  }
  const source = utms.source.trim().toLowerCase();
  const medium = utms.medium.trim().toLowerCase();
  const campaign = sanearUtm(utms.campaign);
  if (source === "" || medium === "") {
    throw new ErrorDeApp("El link necesita el canal (utm_source y utm_medium).", 400);
  }
  if (campaign === "") throw new ErrorDeApp("El link necesita una campaña.", 400);

  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", medium);
  url.searchParams.set("utm_campaign", campaign);
  for (const [llave, valor] of [
    ["utm_content", utms.content],
    ["utm_term", utms.term],
  ] as const) {
    const saneado = valor ? sanearUtm(valor) : "";
    if (saneado === "") url.searchParams.delete(llave);
    else url.searchParams.set(llave, saneado);
  }
  return url.toString();
}

/** A donde va un link: la fuente y su URL publica. */
export interface DestinoDeCaptacion {
  fuenteId: string;
  nombre: string;
  url: string;
}

/**
 * Las fuentes de un programa que se pueden repartir (activas y con URL publica), con la
 * principal primero. Es la lista del selector del builder; vacia, el programa no genera links.
 */
export async function destinosDelPrograma(
  db: Db,
  programId: string,
): Promise<(DestinoDeCaptacion & { principal: boolean })[]> {
  const filas = await db
    .select({ id: sources.id, nombre: sources.nombre, url: sources.urlPublica, principal: sources.principal })
    .from(sources)
    .where(and(eq(sources.programId, programId), eq(sources.activo, true)))
    .orderBy(asc(sources.orden), asc(sources.nombre));
  return filas
    .filter((f): f is typeof f & { url: string } => f.url !== null)
    .map((f) => ({ fuenteId: f.id, nombre: f.nombre, url: f.url, principal: f.principal }))
    .sort((a, b) => Number(b.principal) - Number(a.principal));
}

/**
 * El destino de un link del programa (ADR 0068 puntos 3 y 4): la fuente principal por
 * defecto, u otra fuente activa y repartible del MISMO programa si se escoge. Sin
 * principal no hay link y se dice (422), en vez de producir una URL rota. Una fuente de
 * otro programa no existe para este (404, ADR 0043).
 */
export async function destinoDeCaptacion(
  db: Db,
  programId: string,
  fuenteId?: string,
): Promise<DestinoDeCaptacion> {
  const destinos = await destinosDelPrograma(db, programId);
  // Sin principal no se genera NINGUN link, tampoco escogiendo otra fuente (ADR 0068 punto
  // 4): la principal es la decision de a donde va la captacion del programa, y sin ella
  // cada quien repartiria un formulario distinto.
  const principal = destinos.find((d) => d.principal);
  if (!principal) {
    throw new ErrorDeApp(
      "Este programa no tiene fuente principal: no hay a dónde mandar un link de captación. Márcala en Programa → Captación → Formularios.",
      422,
    );
  }
  if (fuenteId === undefined) {
    return { fuenteId: principal.fuenteId, nombre: principal.nombre, url: principal.url };
  }
  const escogida = destinos.find((d) => d.fuenteId === fuenteId);
  if (!escogida) {
    throw new ErrorDeApp("Esa fuente no está activa con URL del formulario en este programa.", 404);
  }
  return { fuenteId: escogida.fuenteId, nombre: escogida.nombre, url: escogida.url };
}
