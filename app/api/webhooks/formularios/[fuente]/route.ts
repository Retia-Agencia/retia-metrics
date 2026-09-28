import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { programs, sobresCrudos, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { normalizarEmail, type MapeoColumnas } from "@/lib/sheets/mapeo";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { resolverCitaDeEnvio } from "@/lib/calendly/resolver-cita";
import type { ResultadoCita } from "@/lib/ingesta/regla-de-deals";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import { mapeoWebhookDesdeFuente } from "@/lib/ingesta/mapeo-webhook";
import { entradaDesdeTypeform, payloadTypeformSchema } from "@/lib/ingesta/adaptador-typeform";

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
 *  4. Un envio "Con Calendly" resuelve su cita en Calendly ANTES de la transaccion
 *     (una llamada HTTP dentro retiene una conexion del pooler), con el token del
 *     programa (ADR 0057).
 *  5. `ingerirEntradas` con la regla de deals encendida (ticket 052).
 *
 * **Nunca responde con redireccion** y la ruta esta en la lista publica de `proxy.ts`
 * (un webhook no tiene sesion). La firma es la autenticacion.
 *
 * **Caja negra (Mani, 28-sep; migracion 0034):** apenas la firma cuadra se guarda el
 * cuerpo crudo de CADA envio en `sobres_crudos` con `error: null`. Si algo despues no se
 * puede procesar (sin correo, payload raro, o la ingesta lanza) se ACTUALIZA esa misma
 * fila con el error y la ruta responde 200 (una sola fila por entrega): asi el proveedor
 * no reintenta en bucle, el lead no se pierde, y el payload queda para reprocesar.
 * Registrar el sobre nunca tumba la ingesta del lead.
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

/**
 * La CAJA NEGRA (Mani, 28-sep; migracion 0034): se guarda el cuerpo crudo de CADA envio
 * con firma buena, no solo de los que fallan. `error` nulo = se proceso bien; con texto
 * = no se pudo (y la ruta responde 200 igual, para que el proveedor no reintente en
 * bucle y el lead no se pierda).
 *
 * Es UNA sola fila por entrega: se inserta apenas la firma cuadra (con `error: null`) y,
 * si algo falla despues, se ACTUALIZA esa misma fila con el error. Guardar el sobre
 * NUNCA tumba la ingesta del lead: si el insert falla, se loguea y se sigue (devuelve
 * null, y el marcado posterior intenta un insert de respaldo).
 */
async function registrarSobre(db: Db, sourceId: string, cuerpo: string): Promise<string | null> {
  try {
    const [fila] = await db
      .insert(sobresCrudos)
      .values({ sourceId, cuerpo, error: null })
      .returning();
    return fila?.id ?? null;
  } catch (e) {
    // La caja negra es un respaldo, no una reja: si no se puede escribir, el lead entra
    // igual. Se loguea y se sigue.
    console.error(`[webhook] no se pudo registrar el sobre crudo de la fuente ${sourceId}`, e);
    return null;
  }
}

/**
 * Marca el sobre de ESTA entrega con el error y responde 200. Si ya hay fila
 * (`sobreId`), la ACTUALIZA (una sola fila por entrega); si el insert inicial habia
 * fallado (`sobreId` nulo), intenta un insert de respaldo con el error. Cualquier fallo
 * al escribir se loguea y no cambia la respuesta: el proveedor no debe reintentar por
 * algo que el reintento no arregla.
 */
async function marcarSobreConError(
  db: Db,
  sobreId: string | null,
  sourceId: string,
  cuerpo: string,
  error: unknown,
): Promise<Response> {
  const mensaje = error instanceof Error ? error.message : String(error);
  try {
    if (sobreId !== null) {
      await db.update(sobresCrudos).set({ error: mensaje }).where(eq(sobresCrudos.id, sobreId));
    } else {
      await db.insert(sobresCrudos).values({ sourceId, cuerpo, error: mensaje });
    }
  } catch (e) {
    console.error(`[webhook] no se pudo marcar el sobre crudo de la fuente ${sourceId}`, e);
  }
  return Response.json({ ok: false, guardado: true }, { status: 200 });
}

/**
 * Resuelve la cita de Calendly de cada envio "Con Calendly" del lote, ANTES de la
 * transaccion de ingesta (ticket 052). Un envio es "Con Calendly" cuando el adaptador
 * le puso `linkAgenda`. Devuelve el mapa `correo normalizado -> ResultadoCita` que la
 * regla de deals consume; un envio sin link no aporta entrada.
 *
 * El token del programa se lee con una consulta PROPIA (no `listarProgramas`, que lo
 * oculta a proposito, ADR 0057). Si el programa no tiene token, la cita queda como
 * error visible con un mensaje SIN el token —no lo hay— y el deal se queda en Pendiente
 * Setteo. `globalThis.fetch` es el que usa Calendly; en los tests se reemplaza con
 * `vi.stubGlobal("fetch", ...)` para no tocar la red.
 */
async function resolverCitas(db: Db, programId: string, entradas: EntradaEnvio[]): Promise<Map<string, ResultadoCita>> {
  const citas = new Map<string, ResultadoCita>();
  const conAgenda = entradas.filter((e) => e.linkAgenda);
  if (conAgenda.length === 0) return citas;

  const [programa] = await db
    .select({ calendlyToken: programs.calendlyToken })
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  const token = programa?.calendlyToken ?? null;

  for (const entrada of conAgenda) {
    const correo = normalizarEmail(
      entrada.campos.correo ? entrada.columnas[entrada.campos.correo] : null,
    );
    if (!correo) continue; // sin correo no hay lead al que colgarle la cita
    if (!token) {
      citas.set(correo, { estado: "error", mensaje: "el programa no tiene token de Calendly configurado." });
      continue;
    }
    citas.set(correo, await resolverCitaDeEnvio({ token, correo, linkAgenda: entrada.linkAgenda }));
  }
  return citas;
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

  // 3. Firma buena. La CAJA NEGRA guarda el cuerpo crudo YA (con `error: null`): pase lo
  // que pase despues, el payload queda para reprocesar (Mani, 28-sep). Si algo falla, se
  // ACTUALIZA esta misma fila con el error (una sola fila por entrega). Registrar el
  // sobre no puede tumbar la ingesta: si el insert falla, `sobreId` queda null y se sigue.
  const sobreId = await registrarSobre(db, fila.id, cuerpo);

  // El mapeo se resuelve con la MISMA precedencia que la hoja (fuente ← plantilla del
  // programa ← defecto) y en el MISMO modulo (`combinarMapeo`, via
  // `mapeoWebhookDesdeFuente`, tarea B del ticket 106). La plantilla del programa se lee
  // aqui, no del payload. Si el programa no existe, `plantillaLead` queda nula y el mapeo
  // cae a la fuente y al defecto.
  const [programa] = await db
    .select({ plantillaLead: programs.plantillaLead })
    .from(programs)
    .where(eq(programs.id, fila.programId))
    .limit(1);
  const mapeo = mapeoWebhookDesdeFuente(
    fila.mapeoColumnas as MapeoColumnas | null,
    (programa?.plantillaLead as MapeoColumnas | null) ?? null,
  );

  let entrada;
  try {
    const payload = payloadTypeformSchema.parse(JSON.parse(cuerpo));
    entrada = entradaDesdeTypeform(payload, {
      sourceId: fila.id,
      zona: fila.tzFechas,
      mapeo,
    });
  } catch (error) {
    return marcarSobreConError(db, sobreId, fila.id, cuerpo, error);
  }

  // 4. La ingesta, con la regla de deals encendida (ticket 052). El programa sale de la
  // fuente registrada (`fila.programId`), nunca del payload.
  try {
    // La cita de Calendly de un envio "Con Calendly" se lee ANTES de la transaccion (una
    // llamada HTTP dentro retendria una conexion del pooler, AGENTS.md). El token del
    // programa se lee con una consulta PROPIA de servidor: `listarProgramas` lo oculta a
    // proposito (ADR 0057), asi que aqui se pide la columna directamente. El token no se
    // loguea ni sale en la respuesta.
    const citasPorCorreo = await resolverCitas(db, fila.programId, [entrada]);

    const resultado = await ingerirEntradas(db, fila.programId, [entrada], {
      aplicarReglaDeDeals: true,
      citasPorCorreo,
    });

    // Un envio con firma buena y correo ausente entra como envio "sin lead": no es un
    // error de la ingesta, pero tampoco hay lead que crear. Se marca el sobre con el
    // motivo para poder recuperarlo (una vez que se sepa a que persona pertenece) y se
    // responde 200. Un envio PARCIAL sin correo es normal (empezo el formulario y se
    // fue): ese no se marca con error, el sobre queda como procesado (error null).
    if (!entrada.esParcial && resultado.enviosSinLead > 0) {
      return marcarSobreConError(
        db,
        sobreId,
        fila.id,
        cuerpo,
        new Error("Envio completo sin correo: no hay lead que crear."),
      );
    }

    // Todo salio bien: el sobre ya quedo guardado con `error: null` (caja negra).
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return marcarSobreConError(db, sobreId, fila.id, cuerpo, error);
  }
}
