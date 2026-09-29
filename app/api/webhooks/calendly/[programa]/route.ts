import { eq } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import { guardarSobre, marcarSobreConError, type DuenoDelSobre } from "@/lib/ingesta/caja-negra";
import { registrarEntrega } from "@/lib/queries/entregas-webhook";
import { HEADER_FIRMA_CALENDLY, leerEventoDeCalendly, verificarFirmaCalendly } from "@/lib/calendly/evento-webhook";
import { aplicarEventoDeCalendly } from "@/lib/calendly/eventos-de-cita";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * El webhook de Calendly de un programa (ticket 096, A5 decidida por Mani el 28-sep). Mismo
 * molde que el de formularios (ADR 0055, 0058):
 *
 *  1. El id de la URL es el del PROGRAMA (opaco). El programa sale de ahi y nunca del
 *     cuerpo (ADR 0043). Si no existe: 404 sin leer el cuerpo.
 *  2. Firma con la `calendly_signing_key` del programa (la guarda "Conectar Calendly").
 *     Sin clave o sin firma buena: 401 y la base no se mueve.
 *  3. Caja negra: el cuerpo crudo va a `sobres_crudos` apenas la firma cuadra. Si despues
 *     algo falla, esa fila guarda el error y se responde 200, nunca 500: Calendly no
 *     reintenta en bucle y el evento no se pierde.
 *  4. `aplicarEventoDeCalendly` hace el resto, idempotente (Calendly reintenta).
 *
 * Cada entrega, aceptada o rechazada, va a `entregas_webhook` (ticket 110). Esta en la
 * lista publica de `proxy.ts`: un webhook no tiene sesion, la firma es la autenticacion.
 */
export async function POST(req: Request, { params }: { params: Promise<{ programa: string }> }) {
  const { programa: programaId } = await params;
  const db = dbDeLaApp;

  const rechazo = async (programId: string | null, codigoHttp: 401 | 404, motivo: Parameters<typeof registrarEntrega>[1]["motivo"]) => {
    await registrarEntrega(db, { programId, sourceId: null, sobreId: null, leadId: null, codigoHttp, motivo });
    return Response.json({ error: codigoHttp === 404 ? "No encontrado." : "No autorizado." }, { status: codigoHttp });
  };

  if (!z.string().uuid().safeParse(programaId).success) {
    return rechazo(null, 404, "fuente_no_encontrada");
  }
  const [programa] = await db
    .select({ id: programs.id, clave: programs.calendlySigningKey })
    .from(programs)
    .where(eq(programs.id, programaId))
    .limit(1);
  if (!programa) return rechazo(null, 404, "fuente_no_encontrada");
  if (!programa.clave) return rechazo(programa.id, 401, "sin_secreto");

  const cuerpo = await req.text();
  const firma = verificarFirmaCalendly(cuerpo, req.headers.get(HEADER_FIRMA_CALENDLY), programa.clave);
  if (firma !== "valida") {
    return rechazo(programa.id, 401, firma === "ausente" ? "firma_ausente" : "firma_invalida");
  }

  const dueno: DuenoDelSobre = { canal: "calendly", programId: programa.id };
  const sobreId = await guardarSobre(db, dueno, cuerpo);
  const entrega = (motivo: "procesado" | "contenido_invalido" | "fallo_ingesta") =>
    registrarEntrega(db, { programId: programa.id, sourceId: null, sobreId, leadId: null, codigoHttp: 200, motivo });

  const lectura = leerEventoDeCalendly(cuerpo);
  if (!lectura.ok) {
    await marcarSobreConError(db, sobreId, dueno, cuerpo, lectura.error);
    await entrega("contenido_invalido");
    return Response.json({ ok: false, guardado: true }, { status: 200 });
  }

  try {
    const efecto = await aplicarEventoDeCalendly(db, programa.id, lectura.evento);
    if (efecto.tipo === "desconocida") {
      console.warn(`[calendly] evento sobre una cita que el CRM no conoce (programa ${programa.id})`);
    }
  } catch (e) {
    console.error(`[calendly] no se pudo aplicar el evento (programa ${programa.id})`, e);
    const mensaje = e instanceof Error ? e.message : "Error desconocido.";
    await marcarSobreConError(db, sobreId, dueno, cuerpo, `No se pudo aplicar el evento: ${mensaje}`);
    await entrega("fallo_ingesta");
    return Response.json({ ok: false, guardado: true }, { status: 200 });
  }

  await entrega("procesado");
  return Response.json({ ok: true }, { status: 200 });
}
