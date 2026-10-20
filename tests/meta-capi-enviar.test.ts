import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { deals, eventosMeta, integraciones, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { enviarEventosPendientes } from "@/lib/meta-capi/enviar";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let vaciar: () => Promise<void>;
let cerrar: () => Promise<void>;
let secuencia = 0;
const ahora = new Date("2026-10-20T15:00:00Z");

beforeAll(async () => ({ db, vaciar, cerrar } = await crearBaseReutilizable()));
beforeEach(async () => { await vaciar(); });
afterAll(async () => cerrar());

async function evento(input: { token?: string; dataset?: string; eventTime?: Date; anulado?: boolean; programId?: string } = {}) {
  secuencia += 1;
  let programId = input.programId;
  if (!programId) {
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA, slug: `envio-${secuencia}`, nombre: `Envío ${secuencia}`, ticketUsd: "1000",
    }).returning();
    programId = programa.id;
    await db.insert(integraciones).values({
      programId, tipo: "meta_capi", secretos: { token: input.token ?? `token-${secuencia}` },
      config: { datasetId: input.dataset ?? `${secuencia}`, encendido: true },
    });
  }
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `envio-${secuencia}@retia.co` }).returning();
  const [deal] = await db.insert(deals).values({
    programId, leadId: lead.id, valorVendidoUsd: "1000", anuladoEn: input.anulado ? ahora : null,
  }).returning();
  const [fila] = await db.insert(eventosMeta).values({
    programId, dealId: deal.id, evento: "purchase", eventId: deal.id,
    eventTime: input.eventTime ?? new Date(ahora.getTime() - 60_000), valor: "1000",
  }).returning();
  return fila;
}

describe("envío de la outbox de Meta", () => {
  it("marca éxito y manda cada programa únicamente con su token", async () => {
    await evento({ token: "token-a", dataset: "101" });
    await evento({ token: "token-b", dataset: "202" });
    const f = vi.fn(async (url: string | URL | Request, opciones?: RequestInit) => {
      void url;
      void opciones;
      return Response.json({ events_received: 1 });
    });
    await enviarEventosPendientes(db, f as typeof fetch, ahora);
    expect(f).toHaveBeenCalledTimes(2);
    for (const [url, opciones] of f.mock.calls) {
      const body = JSON.parse(String(opciones?.body)) as { access_token: string };
      expect(body.access_token).toBe(String(url).includes("/101/events") ? "token-a" : "token-b");
    }
    expect((await db.select().from(eventosMeta)).every((fila) => fila.estado === "enviado")).toBe(true);
  });

  it("guarda el error de Meta y programa el reintento exponencial", async () => {
    const fila = await evento();
    const f = vi.fn(async () => Response.json({ error: { message: "token vencido" } }, { status: 400 })) as typeof fetch;
    await enviarEventosPendientes(db, f, ahora);
    let [guardada] = await db.select().from(eventosMeta).where(eq(eventosMeta.id, fila.id));
    expect(guardada).toMatchObject({ estado: "fallido", intentos: 1, ultimoError: "token vencido" });
    expect(guardada.proximoIntentoEn).toEqual(new Date(ahora.getTime() + 5 * 60_000));
    await enviarEventosPendientes(db, f, guardada.proximoIntentoEn!);
    [guardada] = await db.select().from(eventosMeta).where(eq(eventosMeta.id, fila.id));
    expect(guardada.intentos).toBe(2);
    expect(guardada.proximoIntentoEn).toEqual(new Date(ahora.getTime() + 15 * 60_000));
  });

  it("vence a los siete días y omite un deal anulado sin llamar a Meta", async () => {
    await evento({ eventTime: new Date(ahora.getTime() - 7 * 24 * 60 * 60_000) });
    await evento({ anulado: true });
    const f = vi.fn(async () => Response.json({})) as typeof fetch;
    await enviarEventosPendientes(db, f, ahora);
    expect(f).not.toHaveBeenCalled();
    expect((await db.select().from(eventosMeta)).map((fila) => [fila.estado, fila.razon]))
      .toEqual(expect.arrayContaining([["vencido", null], ["omitido", "anulado"]]));
  });
});
