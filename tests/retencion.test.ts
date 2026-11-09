import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calls,
  deals,
  entregasWebhook,
  leads,
  notificacionesCalendly,
  programs,
  sobresCrudos,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  DIAS_NOTIFICACION,
  DIAS_SOBRE_PROCESADO,
  TAMANO_DE_LOTE,
  aplicarRetencion,
  purgarNotificacionesVencidas,
  purgarSobresVencidos,
} from "@/lib/retencion/retencion";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const dbHolder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return dbHolder.db;
  },
}));

vi.mock("@/lib/auth/guards", () => ({
  respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }),
}));

/** Ticket 402, ADR 0127: lo que la retencion borra, lo que jamas toca y que sea idempotente. */

const AHORA = new Date("2027-06-01T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(AHORA.getTime() - dias * DIA);

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => {
  await cerrar();
});
beforeEach(async () => {
  await vaciar();
  dbHolder.db = db;
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [s] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  sourceId = s.id;
});

async function sobre(o: { recibido: Date; error?: string | null; reprocesado?: Date | null; entrega?: boolean }) {
  const [f] = await db
    .insert(sobresCrudos)
    .values({
      sourceId,
      programId,
      cuerpo: "{}",
      error: o.error ?? null,
      recibidoEn: o.recibido,
      reprocesadoEn: o.reprocesado ?? null,
    })
    .returning();
  if (o.entrega !== false) {
    await db.insert(entregasWebhook).values({
      programId,
      sourceId,
      sobreId: f.id,
      codigoHttp: 200,
      motivo: o.error ? "fallo_ingesta" : "procesado",
      recibidoEn: o.recibido,
    });
  }
  return f.id;
}

const idsDeSobres = async () => (await db.select({ id: sobresCrudos.id }).from(sobresCrudos)).map((f) => f.id);

describe("sobres crudos y entregas", () => {
  it("borra el procesado vencido con su entrega y conserva el que esta dentro del plazo", async () => {
    const viejo = await sobre({ recibido: hace(DIAS_SOBRE_PROCESADO + 1) });
    const justo = await sobre({ recibido: hace(DIAS_SOBRE_PROCESADO - 1) });
    const reciente = await sobre({ recibido: hace(1) });
    const r = await purgarSobresVencidos(db, AHORA);
    expect(r).toEqual({ sobres: 1, entregas: 1 });
    const quedan = await idsDeSobres();
    expect(quedan).not.toContain(viejo);
    expect(quedan).toEqual(expect.arrayContaining([justo, reciente]));
    expect(await db.select().from(entregasWebhook)).toHaveLength(2);
  });

  it("NUNCA borra un sobre con error sin reprocesar, por viejo que sea", async () => {
    const pendiente = await sobre({ recibido: hace(900), error: "mapeo roto" });
    expect(await purgarSobresVencidos(db, AHORA)).toEqual({ sobres: 0, entregas: 0 });
    expect(await idsDeSobres()).toEqual([pendiente]);
  });

  it("un error reprocesado se cuenta desde el reproceso, no desde la recepcion", async () => {
    const reciente = await sobre({ recibido: hace(400), error: "x", reprocesado: hace(10) });
    const vencido = await sobre({ recibido: hace(400), error: "x", reprocesado: hace(DIAS_SOBRE_PROCESADO + 1) });
    await purgarSobresVencidos(db, AHORA);
    const quedan = await idsDeSobres();
    expect(quedan).toContain(reciente);
    expect(quedan).not.toContain(vencido);
  });

  it("borra por lotes (mas de un lote) y es idempotente", async () => {
    const n = TAMANO_DE_LOTE + 7;
    await db.insert(sobresCrudos).values(
      Array.from({ length: n }, () => ({ sourceId, programId, cuerpo: "{}", recibidoEn: hace(DIAS_SOBRE_PROCESADO + 5) })),
    );
    const guardado = await sobre({ recibido: hace(2) });
    expect((await purgarSobresVencidos(db, AHORA)).sobres).toBe(n);
    expect(await purgarSobresVencidos(db, AHORA)).toEqual({ sobres: 0, entregas: 0 });
    expect(await idsDeSobres()).toEqual([guardado]);
  });

  it("no toca lo que el sobre produjo: submissions y leads quedan", async () => {
    const [l] = await db
      .insert(leads)
      .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: "a@b.co", nombre: "A", numAplicaciones: 1 })
      .returning();
    await db.insert(submissions).values({ leadId: l.id, sourceId, token: "t1" });
    await sobre({ recibido: hace(DIAS_SOBRE_PROCESADO + 30) });
    await purgarSobresVencidos(db, AHORA);
    expect(await db.select().from(submissions)).toHaveLength(1);
    expect(await db.select().from(leads)).toHaveLength(1);
  });
});

describe("notificaciones de Calendly", () => {
  async function notificacion(creada: Date, clave: string, leida = false) {
    const [u] = await db.insert(users).values({ email: `${clave}@r.co`, rol: "closer", closerId: clave, nombre: clave }).returning();
    const [l] = await db
      .insert(leads)
      .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `${clave}@c.co`, nombre: clave, numAplicaciones: 1 })
      .returning();
    const [env] = await db.insert(submissions).values({ leadId: l.id, sourceId, token: clave }).returning();
    const [d] = await db
      .insert(deals)
      .values({ leadId: l.id, submissionOrigenId: env.id, programId, etapa: "agendado", ownerUserId: u.id })
      .returning();
    const [c] = await db
      .insert(calls)
      .values({ dealId: d.id, programId, fechaLlamada: creada, resultado: "show" })
      .returning();
    await db.insert(notificacionesCalendly).values({
      userId: u.id,
      programId,
      dealId: d.id,
      callId: c.id,
      tipo: "cita_nueva",
      claveEvento: clave,
      createdAt: creada,
      leidaEn: leida ? creada : null,
    });
  }

  it("borra las de mas de 90 dias, leidas o no, y conserva las recientes", async () => {
    await notificacion(hace(DIAS_NOTIFICACION + 1), "vieja-sin-leer");
    await notificacion(hace(DIAS_NOTIFICACION + 1), "vieja-leida", true);
    await notificacion(hace(DIAS_NOTIFICACION - 1), "reciente");
    expect(await purgarNotificacionesVencidas(db, AHORA)).toBe(2);
    const quedan = await db.select({ clave: notificacionesCalendly.claveEvento }).from(notificacionesCalendly);
    expect(quedan).toEqual([{ clave: "reciente" }]);
    expect(await purgarNotificacionesVencidas(db, AHORA)).toBe(0);
  });

  it("no toca la llamada ni el deal de la notificacion borrada", async () => {
    await notificacion(hace(DIAS_NOTIFICACION + 5), "vieja");
    await purgarNotificacionesVencidas(db, AHORA);
    expect(await db.select().from(calls)).toHaveLength(1);
    expect(await db.select().from(deals)).toHaveLength(1);
  });
});

describe("ruta del cron", () => {
  it("falla cerrado sin secreto o con uno incorrecto, y con el correcto aplica la retencion", async () => {
    const { GET } = await import("@/app/api/cron/retencion/route");
    const anterior = process.env.CRON_SECRET;
    try {
      delete process.env.CRON_SECRET;
      expect((await GET(new Request("http://localhost/api/cron/retencion"))).status).toBe(401);
      process.env.CRON_SECRET = "bueno";
      expect((await GET(new Request("http://localhost/api/cron/retencion", { headers: { authorization: "Bearer otro" } }))).status).toBe(401);
      const vencido = await sobre({ recibido: new Date(Date.now() - (DIAS_SOBRE_PROCESADO + 1) * DIA) });
      const r = await GET(new Request("http://localhost/api/cron/retencion", { headers: { authorization: "Bearer bueno" } }));
      expect(r.status).toBe(200);
      expect(await r.json()).toEqual({ sobres: 1, entregas: 1, notificaciones: 0 });
      expect(await idsDeSobres()).not.toContain(vencido);
    } finally {
      if (anterior === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = anterior;
    }
  });

  it("aplicarRetencion junta los tres conteos", async () => {
    expect(await aplicarRetencion(db, AHORA)).toEqual({ sobres: 0, entregas: 0, notificaciones: 0 });
  });
});
