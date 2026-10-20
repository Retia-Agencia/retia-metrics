import { and, asc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { deals, eventosMeta, leads, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { credencialesMetaCapi } from "@/lib/integraciones";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { payloadDeVenta } from "./payload";

const HORA = 60 * 60 * 1000;
const LIMITE_META = 7 * 24 * HORA - HORA;
const AISLAR_DESDE = 6 * 24 * HORA;

type Pendiente = Awaited<ReturnType<typeof pendientes>>[number];

async function pendientes(db: Db, ahora: Date) {
  return db.select({
    id: eventosMeta.id,
    programId: eventosMeta.programId,
    dealId: eventosMeta.dealId,
    eventTime: eventosMeta.eventTime,
    intentos: eventosMeta.intentos,
    valor: eventosMeta.valor,
    anuladoEn: deals.anuladoEn,
    submissionOrigenId: deals.submissionOrigenId,
    lead: {
      id: leads.id,
      emailNormalizado: leads.emailNormalizado,
      telefono: leads.telefono,
      nombre: leads.nombre,
      pais: leads.pais,
    },
  }).from(eventosMeta)
    .innerJoin(deals, eq(deals.id, eventosMeta.dealId))
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(
      incluyendoAnulados(deals),
      inArray(eventosMeta.estado, ["pendiente", "fallido"]),
      or(isNull(eventosMeta.proximoIntentoEn), lte(eventosMeta.proximoIntentoEn, ahora)),
    ))
    .orderBy(asc(eventosMeta.eventTime));
}

async function fbclidDelEvento(
  db: Db,
  evento: Pendiente,
): Promise<{ fbclid: string; capturadoEn: Date } | null> {
  const seleccion = { ...columnasUtmDelEnvio, createdAt: submissions.createdAt };
  const directa = evento.submissionOrigenId
    ? (await db.select(seleccion).from(submissions).where(eq(submissions.id, evento.submissionOrigenId)).limit(1))[0]
    : null;
  if (directa) {
    const fbclid = utmsDelEnvio(directa).fbclid;
    return fbclid ? { fbclid, capturadoEn: directa.createdAt } : null;
  }
  const [primera] = await db.select(seleccion).from(submissions)
    .innerJoin(sources, eq(sources.id, submissions.sourceId))
    .where(and(eq(submissions.leadId, evento.lead.id), eq(sources.programId, evento.programId)))
    .orderBy(asc(submissions.createdAt)).limit(1);
  if (!primera) return null;
  const fbclid = utmsDelEnvio(primera).fbclid;
  return fbclid ? { fbclid, capturadoEn: primera.createdAt } : null;
}

function lotes<T>(filas: T[], tamano: number): T[][] {
  const resultado: T[][] = [];
  for (let i = 0; i < filas.length; i += tamano) resultado.push(filas.slice(i, i + tamano));
  return resultado;
}

async function mensajeDeMeta(respuesta: Response): Promise<string> {
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (cuerpo && typeof cuerpo === "object" && "error" in cuerpo) {
    const error = (cuerpo as { error?: unknown }).error;
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return error.message.slice(0, 500);
    }
  }
  return `Meta respondió ${respuesta.status}.`.slice(0, 500);
}

export async function enviarEventosPendientes(db: Db, f: typeof fetch, ahora: Date) {
  const filas = await pendientes(db, ahora);
  const porPrograma = new Map<string, Pendiente[]>();
  let omitidos = 0;
  let vencidos = 0;

  for (const evento of filas) {
    if (evento.anuladoEn) {
      await db.update(eventosMeta).set({ estado: "omitido", razon: "anulado", updatedAt: ahora })
        .where(eq(eventosMeta.id, evento.id));
      omitidos += 1;
    } else if (ahora.getTime() - evento.eventTime.getTime() > LIMITE_META) {
      await db.update(eventosMeta).set({ estado: "vencido", razon: null, updatedAt: ahora })
        .where(eq(eventosMeta.id, evento.id));
      vencidos += 1;
    } else {
      const grupo = porPrograma.get(evento.programId) ?? [];
      grupo.push(evento);
      porPrograma.set(evento.programId, grupo);
    }
  }

  let enviados = 0;
  let fallidos = 0;
  for (const [programId, eventos] of porPrograma) {
    const credenciales = await credencialesMetaCapi(db, programId);
    if (!credenciales?.encendido) {
      await db.update(eventosMeta).set({ estado: "omitido", razon: "programa_apagado", updatedAt: ahora })
        .where(inArray(eventosMeta.id, eventos.map((evento) => evento.id)));
      omitidos += eventos.length;
      continue;
    }

    const preparados = await Promise.all(eventos.map(async (evento) => {
      const fbc = await fbclidDelEvento(db, evento);
      return {
        evento,
        fbc,
        payload: payloadDeVenta({
          deal: { id: evento.dealId, valorVendidoUsd: evento.valor },
          lead: evento.lead,
          fbc,
          eventTime: evento.eventTime,
        }),
      };
    }));
    const viejos = preparados.filter(({ evento }) => ahora.getTime() - evento.eventTime.getTime() > AISLAR_DESDE)
      .map((fila) => [fila]);
    const recientes = preparados.filter(({ evento }) => ahora.getTime() - evento.eventTime.getTime() <= AISLAR_DESDE);

    for (const lote of [...viejos, ...lotes(recientes, 500)]) {
      let respuesta: Response | null = null;
      let errorDeRed: string | null = null;
      try {
        respuesta = await f(`https://graph.facebook.com/v26.0/${credenciales.datasetId}/events`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data: lote.map((fila) => fila.payload), access_token: credenciales.token }),
        });
      } catch {
        errorDeRed = "No se pudo contactar a Meta.";
      }
      if (respuesta?.ok) {
        await db.update(eventosMeta).set({
          estado: "enviado", enviadoEn: ahora, proximoIntentoEn: null, ultimoError: null, updatedAt: ahora,
        }).where(inArray(eventosMeta.id, lote.map((fila) => fila.evento.id)));
        for (const fila of lote) {
          await db.update(eventosMeta).set({ llevoFbc: Boolean(fila.fbc) }).where(eq(eventosMeta.id, fila.evento.id));
        }
        enviados += lote.length;
      } else {
        const error = (errorDeRed ?? (respuesta ? await mensajeDeMeta(respuesta) : "No se pudo contactar a Meta."))
          .replaceAll(credenciales.token, "(oculto)").slice(0, 500);
        for (const { evento, fbc } of lote) {
          const intentos = evento.intentos + 1;
          const demora = Math.min(6 * HORA, 5 * 60 * 1000 * 2 ** (intentos - 1));
          await db.update(eventosMeta).set({
            estado: "fallido",
            intentos,
            ultimoError: error,
            proximoIntentoEn: new Date(ahora.getTime() + demora),
            llevoFbc: Boolean(fbc),
            updatedAt: ahora,
          }).where(eq(eventosMeta.id, evento.id));
        }
        fallidos += lote.length;
      }
    }
  }
  return { enviados, fallidos, vencidos, omitidos };
}
