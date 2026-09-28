import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { sobresCrudos, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import {
  entradaDesdeTypeform,
  payloadTypeformSchema,
  type MapeoWebhook,
} from "@/lib/ingesta/adaptador-typeform";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * El webhook estandar de formularios (ticket 106, ADR 0055). Un envio de Typeform
 * entra solo al CRM por aqui: la ruta verifica, el adaptador traduce y
 * `ingerirEntradas` escribe.
 *
 * El camino, en orden (ADR 0055 punto 1 y 5):
 *  1. El id de la URL identifica una FUENTE. Si no es una fuente webhook ACTIVA: 404,
 *     SIN leer el cuerpo (un error visible en el log, no un lead en cualquier programa).
 *  2. Firma HMAC-SHA256 sobre el CUERPO CRUDO con el secreto de esa fuente, comparada
 *     en tiempo constante. Si no cuadra: 401 y la base no se mueve.
 *  3. El adaptador convierte el payload en una `EntradaEnvio`. El programa sale de la
 *     FUENTE, nunca del payload.
 *  4. `ingerirEntradas` con la regla de deals encendida (ticket 052).
 *
 * **Nunca responde con redireccion** y la ruta esta en la lista publica de `proxy.ts`
 * (un webhook no tiene sesion). La firma es la autenticacion.
 *
 * **Un envio con firma buena que NO se puede procesar** (sin correo, payload raro, o la
 * ingesta lanza) se guarda en `sobres_crudos` y la ruta responde 200 (Mani, 27-sep):
 * asi el proveedor no reintenta en bucle y el lead no se pierde, se reprocesa despues.
 *
 * El id de la fuente en la URL es un dato opaco, nunca un correo (regla dura). El
 * cuerpo se lee con `req.text()`, no `req.json()`: la firma se calcula sobre los BYTES
 * exactos que llegaron, y volver a serializar un JSON parseado cambiaria esos bytes.
 */

/** El header de firma de Typeform: `sha256=<base64 del HMAC>`. */
const HEADER_FIRMA = "typeform-signature";

/**
 * ¿La firma del header coincide con el HMAC-SHA256 del cuerpo crudo? Comparacion en
 * tiempo constante (`timingSafeEqual`), que exige la misma longitud: se compara sobre
 * los bytes del digest, no sobre la cadena base64, para no depender de mayusculas ni
 * de un `=` de relleno.
 */
function firmaValida(cuerpoCrudo: string, header: string | null, secreto: string): boolean {
  if (!header) return false;
  const prefijo = "sha256=";
  if (!header.startsWith(prefijo)) return false;
  const enviado = header.slice(prefijo.length);

  const esperado = createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest();
  let recibido: Buffer;
  try {
    recibido = Buffer.from(enviado, "base64");
  } catch {
    return false;
  }
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado);
}

/** El mapeo de una fuente webhook, tal como lo guarda `sources.mapeoColumnas`. */
function mapeoDeFuente(mapeoColumnas: unknown): MapeoWebhook {
  if (mapeoColumnas === null || typeof mapeoColumnas !== "object") return {};
  const obj = mapeoColumnas as Record<string, unknown>;
  // El mapeo reusa `sources.mapeoColumnas` (campo → patron) y separa `agenda`, que no
  // es un campo del Envio sino el TITULO de la pregunta que el adaptador mira para el
  // agendo (ADR 0054 segunda enmienda; ADR 0012: la decision es de configuracion). Sin
  // `agenda` mapeada, el envio nunca sube a `con_calendly`.
  const { agenda, ...campos } = obj;
  return {
    campos: campos as MapeoWebhook["campos"],
    campoAgenda: typeof agenda === "string" ? agenda : undefined,
  };
}

/**
 * Guarda el sobre crudo y responde 200. Nunca lanza: si ni el sobre se puede escribir,
 * responde 200 igual (el proveedor no debe reintentar por algo que no vamos a arreglar
 * en el reintento) y deja el error en el log.
 */
async function guardarSobre(db: Db, sourceId: string, cuerpo: string, error: unknown): Promise<Response> {
  const mensaje = error instanceof Error ? error.message : String(error);
  try {
    await db.insert(sobresCrudos).values({ sourceId, cuerpo, error: mensaje });
  } catch (e) {
    console.error(`[webhook] no se pudo guardar el sobre crudo de la fuente ${sourceId}`, e);
  }
  return Response.json({ ok: false, guardado: true }, { status: 200 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fuente: string }> },
) {
  const { fuente: fuenteId } = await params;
  const db = dbDeLaApp;

  // Validacion en el borde (contrato del repo): un id que no es UUID ni siquiera puede
  // compararse contra `sources.id` (Postgres lanza 22P02 y saldria como 500). Es lo
  // mismo que una fuente inexistente: 404, sin leer el cuerpo.
  if (!z.string().uuid().safeParse(fuenteId).success) {
    console.warn(`[webhook] id de fuente con forma invalida: ${fuenteId}`);
    return Response.json({ error: "No encontrado." }, { status: 404 });
  }

  // 1. La fuente. Un id que no es una fuente webhook ACTIVA es 404, y no se lee el
  // cuerpo: el error es visible y ningun lead entra en un programa que no le toca. El
  // filtro exige tipo webhook, activo y proveedor typeform (el unico con adaptador).
  const [fila] = await db
    .select({
      id: sources.id,
      programId: sources.programId,
      proveedor: sources.proveedor,
      secreto: sources.secretoWebhook,
      tzFechas: sources.tzFechas,
      mapeoColumnas: sources.mapeoColumnas,
    })
    .from(sources)
    .where(
      and(
        eq(sources.id, fuenteId),
        eq(sources.tipo, "webhook"),
        eq(sources.activo, true),
      ),
    )
    .limit(1);

  if (!fila || fila.proveedor !== "typeform") {
    console.warn(`[webhook] id no es una fuente webhook activa: ${fuenteId}`);
    return Response.json({ error: "No encontrado." }, { status: 404 });
  }

  // Una fuente webhook activa sin secreto no deberia existir (activarla lo exige), pero
  // si pasara, se rechaza con 401 en vez de aceptar cualquier cosa sin verificar.
  if (!fila.secreto) {
    console.error(`[webhook] fuente ${fuenteId} activa sin secreto`);
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  // 2. La firma sobre el CUERPO CRUDO. Se lee como texto: la firma es de los bytes.
  const cuerpo = await req.text();
  if (!firmaValida(cuerpo, req.headers.get(HEADER_FIRMA), fila.secreto)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  // 3. A partir de aqui la firma es buena. Cualquier cosa que salga mal —payload raro,
  // sin correo, la ingesta lanza— NO se pierde: se guarda el sobre y se responde 200.
  let entrada;
  try {
    const payload = payloadTypeformSchema.parse(JSON.parse(cuerpo));
    entrada = entradaDesdeTypeform(payload, {
      sourceId: fila.id,
      zona: fila.tzFechas,
      mapeo: mapeoDeFuente(fila.mapeoColumnas),
    });
  } catch (error) {
    return guardarSobre(db, fila.id, cuerpo, error);
  }

  // 4. La ingesta, con la regla de deals encendida (ticket 052). El programa sale de la
  // fuente registrada (`fila.programId`), nunca del payload.
  try {
    const resultado = await ingerirEntradas(db, fila.programId, [entrada], {
      aplicarReglaDeDeals: true,
    });

    // Un envio con firma buena y correo ausente entra como envio "sin lead": no es un
    // error de la ingesta, pero tampoco hay lead que crear. Se guarda el sobre para
    // poder recuperarlo (una vez que se sepa a que persona pertenece) y se responde
    // 200. Un envio PARCIAL sin correo es normal (empezo el formulario y se fue): ese
    // no se guarda como sobre, ya quedo como submission.
    if (!entrada.esParcial && resultado.enviosSinLead > 0) {
      return guardarSobre(db, fila.id, cuerpo, new Error("Envio completo sin correo: no hay lead que crear."));
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return guardarSobre(db, fila.id, cuerpo, error);
  }
}
