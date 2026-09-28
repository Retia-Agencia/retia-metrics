import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { sobresCrudos, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { MapeoColumnas } from "@/lib/sheets/mapeo";
import { procesarSobre, type MotivoProcesado } from "@/lib/ingesta/procesar-sobre";
import { registrarEntrega, type MotivoEntrega } from "@/lib/queries/entregas-webhook";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * El webhook estandar de formularios (ticket 106, ADR 0055). Un envio de Typeform
 * entra solo al CRM por aqui: la ruta verifica, `procesarSobre` traduce e ingiere.
 *
 * El camino, en orden (ADR 0055 punto 1 y 5):
 *  1. El id de la URL identifica una FUENTE. Si no es una fuente webhook ACTIVA: 404,
 *     SIN leer el cuerpo (un error visible en el log, no un lead en cualquier programa).
 *  2. Firma HMAC-SHA256 sobre el CUERPO CRUDO con el secreto de esa fuente, comparada
 *     en tiempo constante. Si no cuadra: 401 y la base no se mueve.
 *  3. `procesarSobre` (compartido con el reproceso del ticket 110) convierte el payload,
 *     resuelve la cita de Calendly e ingiere. El programa sale de la FUENTE, no del payload.
 *
 * **Nunca responde con redireccion** y la ruta esta en la lista publica de `proxy.ts`
 * (un webhook no tiene sesion). La firma es la autenticacion.
 *
 * **Caja negra (Mani, 28-sep; migracion 0034):** apenas la firma cuadra se guarda el
 * cuerpo crudo de CADA envio en `sobres_crudos` con `error: null`. Si algo despues no se
 * puede procesar (sin correo, payload raro, o la ingesta lanza) se ACTUALIZA esa misma
 * fila con el error y la ruta responde 200: asi el proveedor no reintenta en bucle, el
 * lead no se pierde, y el payload queda para reprocesar. Registrar el sobre nunca tumba
 * la ingesta del lead.
 *
 * **La salud del CRM (ticket 110):** CADA entrega —aceptada o rechazada— se registra en
 * `entregas_webhook` con su codigo HTTP y su motivo. Un rechazo va sin cuerpo (un cuerpo
 * sin firma valida es de cualquiera). Registrar la entrega NUNCA tumba la ingesta ni
 * cambia la respuesta: va en su propio try/catch, igual que el sobre.
 *
 * El id de la fuente en la URL es un dato opaco, nunca un correo (regla dura). El
 * cuerpo se lee con `req.text()`, no `req.json()`: la firma se calcula sobre los BYTES
 * exactos que llegaron.
 */

/** El header de firma de Typeform: `sha256=<base64 del HMAC>`. */
const HEADER_FIRMA = "typeform-signature";

/**
 * ¿La firma del header coincide con el HMAC-SHA256 del cuerpo crudo? Comparacion en
 * tiempo constante (`timingSafeEqual`), sobre los bytes del digest.
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

/**
 * La CAJA NEGRA: guarda el cuerpo crudo con firma buena (con `error: null`). Es UNA
 * fila por entrega; si algo falla despues se ACTUALIZA con el error. Guardar el sobre
 * NUNCA tumba la ingesta: si el insert falla, se loguea y se devuelve null.
 */
async function registrarSobre(db: Db, sourceId: string, cuerpo: string): Promise<string | null> {
  try {
    const [fila] = await db
      .insert(sobresCrudos)
      .values({ sourceId, cuerpo, error: null })
      .returning();
    return fila?.id ?? null;
  } catch (e) {
    console.error(`[webhook] no se pudo registrar el sobre crudo de la fuente ${sourceId}`, e);
    return null;
  }
}

/**
 * Marca el sobre de ESTA entrega con el error. Si ya hay fila la ACTUALIZA; si el insert
 * inicial habia fallado (`sobreId` nulo), intenta un insert de respaldo. Cualquier fallo
 * al escribir se loguea y no cambia la respuesta.
 */
async function marcarSobreConError(
  db: Db,
  sobreId: string | null,
  sourceId: string,
  cuerpo: string,
  error: string,
): Promise<void> {
  try {
    if (sobreId !== null) {
      await db.update(sobresCrudos).set({ error }).where(eq(sobresCrudos.id, sobreId));
    } else {
      await db.insert(sobresCrudos).values({ sourceId, cuerpo, error });
    }
  } catch (e) {
    console.error(`[webhook] no se pudo marcar el sobre crudo de la fuente ${sourceId}`, e);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ fuente: string }> },
) {
  const { fuente: fuenteId } = await params;
  const db = dbDeLaApp;

  // Validacion en el borde: un id que no es UUID ni siquiera puede compararse contra
  // `sources.id`. Es lo mismo que una fuente inexistente: 404, sin leer el cuerpo, y sin
  // fuente conocida (source_id/program_id nulos: la entrega es huerfana).
  if (!z.string().uuid().safeParse(fuenteId).success) {
    console.warn(`[webhook] id de fuente con forma invalida: ${fuenteId}`);
    await registrarEntrega(db, {
      programId: null,
      sourceId: null,
      sobreId: null,
      leadId: null,
      codigoHttp: 404,
      motivo: "fuente_no_encontrada",
    });
    return Response.json({ error: "No encontrado." }, { status: 404 });
  }

  // 1. La fuente. Se busca por id SIN exigir tipo/activo, para poder distinguir "el id
  // no existe" (entrega huerfana) de "existe pero no es una webhook activa" (entrega con
  // source_id/program_id, aunque el 404 sea el mismo hacia afuera).
  const [fila] = await db
    .select({
      id: sources.id,
      programId: sources.programId,
      tipo: sources.tipo,
      activo: sources.activo,
      proveedor: sources.proveedor,
      secreto: sources.secretoWebhook,
      tzFechas: sources.tzFechas,
      mapeoColumnas: sources.mapeoColumnas,
    })
    .from(sources)
    .where(eq(sources.id, fuenteId))
    .limit(1);

  const esWebhookActiva = !!fila && fila.tipo === "webhook" && fila.activo && fila.proveedor === "typeform";
  if (!esWebhookActiva) {
    console.warn(`[webhook] id no es una fuente webhook activa: ${fuenteId}`);
    await registrarEntrega(db, {
      // Si el id existe como fuente (aunque no sea webhook activa), se guarda de que
      // fuente y programa era; si no existe, quedan nulos (huerfana).
      programId: fila?.programId ?? null,
      sourceId: fila?.id ?? null,
      sobreId: null,
      leadId: null,
      codigoHttp: 404,
      motivo: "fuente_no_encontrada",
    });
    return Response.json({ error: "No encontrado." }, { status: 404 });
  }

  // Una fuente webhook activa sin secreto no deberia existir; si pasara, 401.
  if (!fila.secreto) {
    console.error(`[webhook] fuente ${fuenteId} activa sin secreto`);
    await registrarEntrega(db, {
      programId: fila.programId,
      sourceId: fila.id,
      sobreId: null,
      leadId: null,
      codigoHttp: 401,
      motivo: "sin_secreto",
    });
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  // 2. La firma sobre el CUERPO CRUDO. Se lee como texto: la firma es de los bytes.
  // "Firma ausente" (no vino el header) y "firma invalida" (vino y no cuadra) se
  // distinguen aqui (ticket 106, ticket 110): son dos problemas distintos.
  const cuerpo = await req.text();
  const header = req.headers.get(HEADER_FIRMA);
  if (!firmaValida(cuerpo, header, fila.secreto)) {
    await registrarEntrega(db, {
      programId: fila.programId,
      sourceId: fila.id,
      sobreId: null,
      leadId: null,
      codigoHttp: 401,
      motivo: header ? "firma_invalida" : "firma_ausente",
    });
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  // 3. Firma buena. La CAJA NEGRA guarda el cuerpo crudo YA. Luego `procesarSobre` (el
  // mismo camino que el reproceso del ticket 110) adapta e ingiere.
  const sobreId = await registrarSobre(db, fila.id, cuerpo);
  const resultado = await procesarSobre(
    db,
    {
      id: fila.id,
      programId: fila.programId,
      tzFechas: fila.tzFechas,
      mapeoColumnas: fila.mapeoColumnas as MapeoColumnas | null,
    },
    cuerpo,
  );

  // Si algo no se pudo procesar (sin correo, contenido invalido, fallo de ingesta) se
  // marca el sobre con el error; si salio bien, queda con `error: null` (caja negra).
  if (resultado.error !== null) {
    await marcarSobreConError(db, sobreId, fila.id, cuerpo, resultado.error);
  }

  // La entrega, con su motivo, el lead que trajo y el sobre. Registrar la entrega no
  // cambia la respuesta ni tumba la ingesta (va en su propio try dentro).
  await registrarEntrega(db, {
    programId: fila.programId,
    sourceId: fila.id,
    sobreId,
    leadId: resultado.leadId,
    codigoHttp: 200,
    motivo: motivoDeEntrega(resultado.motivo),
  });

  return Response.json({ ok: resultado.motivo === "procesado" }, { status: 200 });
}

/** Un motivo de procesamiento ES un motivo de entrega (el enum los incluye). */
function motivoDeEntrega(motivo: MotivoProcesado): MotivoEntrega {
  return motivo;
}
