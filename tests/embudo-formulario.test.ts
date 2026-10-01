import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { areas, canales, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { embudoDelFormulario } from "@/lib/queries/embudo-formulario";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 126, parte A: el embudo del formulario por canal. La unidad es el registro (fuente,
 * token): un parcial y su completa son uno. Por la fecha del primer envío en Bogotá. Agendó es
 * el hecho del código (`con_calendly`); llegó al Calendly es agendó o calidad High (ADR 0069).
 */

const RANGO = { desde: "2026-09-01", hasta: "2026-09-30" };

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;
let otraFuenteId: string;
let leadId: string;
let otroLeadId: string;
let canalId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  [sourceId, otraFuenteId] = await Promise.all([
    db.insert(sources).values({ programId, nombre: "Typeform" }).returning().then(([f]) => f.id),
    db.insert(sources).values({ programId: q.id, nombre: "Typeform" }).returning().then(([f]) => f.id),
  ]);
  [leadId, otroLeadId] = await Promise.all([
    db.insert(leads).values({ programId, emailNormalizado: "a@c.co" }).returning().then(([l]) => l.id),
    db.insert(leads).values({ programId: q.id, emailNormalizado: "a@c.co" }).returning().then(([l]) => l.id),
  ]);
  const areaId = await db.insert(areas).values({ nombre: "Pauta" }).returning().then(([a]) => a.id);
  canalId = await db
    .insert(canales)
    .values({ nombre: "Meta", utmSource: "facebook", utmMedium: "cpc", areaId })
    .returning()
    .then(([c]) => c.id);
}, 60_000);

afterEach(async () => {
  await cerrar();
});

const meta = { utmSource: "facebook", utmMedium: "cpc", utmCampaign: "c1" };
const envio = (token: string, fecha: string, extra: Partial<typeof submissions.$inferInsert> = {}) => ({
  leadId,
  sourceId,
  token,
  esParcial: false,
  fechaEnvio: new Date(fecha),
  ...extra,
});

describe("embudoDelFormulario", () => {
  it("un parcial y su completa son UN registro, en el canal de la completa", async () => {
    await db.insert(submissions).values([
      envio("t1", "2026-09-10T15:00:00Z", { esParcial: true }),
      envio("t1", "2026-09-10T15:05:00Z", { ...meta, leadQuality: "Low" }),
    ]);
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    expect(r.total).toEqual({ dejoDatos: 1, completo: 1, llegoCalendly: 0, agendo: 0 });
    expect(r.filas.find((f) => f.canalId === canalId)).toMatchObject({ canal: "Meta", dejoDatos: 1, completo: 1 });
  });

  it("un parcial solo dejó datos y no completó", async () => {
    await db.insert(submissions).values(envio("t1", "2026-09-10T15:00:00Z", { ...meta, esParcial: true }));
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    expect(r.total).toEqual({ dejoDatos: 1, completo: 0, llegoCalendly: 0, agendo: 0 });
  });

  it("agendó es el hecho con_calendly, y quien agendó también llegó al Calendly", async () => {
    await db.insert(submissions).values(envio("t1", "2026-09-10T15:00:00Z", { ...meta, calificacion: "con_calendly" }));
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    expect(r.total).toEqual({ dejoDatos: 1, completo: 1, llegoCalendly: 1, agendo: 1 });
    expect(r.sinCalidad).toBe(0);
  });

  it("High sin agenda llegó al Calendly; Low no; sin calidad se cuenta aparte", async () => {
    await db.insert(submissions).values([
      envio("alto", "2026-09-10T15:00:00Z", { esParcial: true, leadQuality: " high " }),
      envio("bajo", "2026-09-10T15:00:00Z", { leadQuality: "Low" }),
      envio("viejo", "2026-09-10T15:00:00Z", {}),
    ]);
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    expect(r.total).toEqual({ dejoDatos: 3, completo: 2, llegoCalendly: 1, agendo: 0 });
    expect(r.sinCalidad).toBe(1);
  });

  it("no lee la variable estado: con_calendly_sin_agenda sin calidad NO llegó", async () => {
    await db.insert(submissions).values(envio("t1", "2026-09-10T15:00:00Z", { calificacion: "con_calendly_sin_agenda" }));
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    expect(r.total.llegoCalendly).toBe(0);
  });

  it("cuenta por el día del primer envío en Bogotá, y completa aunque termine después del rango", async () => {
    await db.insert(submissions).values([
      // 23:30 del 30-sep en Bogotá (ya 1-oct en UTC): dentro.
      envio("borde", "2026-10-01T04:30:00Z", { esParcial: true }),
      envio("borde", "2026-10-01T15:00:00Z", {}),
      // 19:00 del 31-ago en Bogotá (1-sep 00:00 UTC): fuera.
      envio("antes", "2026-09-01T00:00:00Z", {}),
      // Sin fecha: un centinela, no cuenta.
      { leadId, sourceId, token: "sin-fecha", esParcial: false, fechaEnvio: null },
    ]);
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    expect(r.total).toEqual({ dejoDatos: 1, completo: 1, llegoCalendly: 0, agendo: 0 });
  });

  it("el mismo token en dos fuentes son dos registros; otro programa no cuenta", async () => {
    const segunda = await db.insert(sources).values({ programId, nombre: "Dapta" }).returning().then(([f]) => f.id);
    await db.insert(submissions).values([
      envio("t1", "2026-09-10T15:00:00Z", {}),
      { ...envio("t1", "2026-09-10T15:00:00Z", {}), sourceId: segunda },
      { ...envio("t1", "2026-09-10T15:00:00Z", {}), leadId: otroLeadId, sourceId: otraFuenteId },
    ]);
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    expect(r.total.dejoDatos).toBe(2);
  });

  it("sin UTM y sin clasificar son dos filas aparte, siempre, aunque estén en cero", async () => {
    await db.insert(submissions).values(envio("t1", "2026-09-10T15:00:00Z", { utmSource: "tiktok", utmMedium: "video" }));
    const r = await embudoDelFormulario(db, { programId, rango: RANGO });
    const de = (o: string) => r.filas.find((f) => f.origen === o);
    expect(de("sin_clasificar")).toMatchObject({ dejoDatos: 1, canal: null });
    expect(de("sin_utm")).toMatchObject({ dejoDatos: 0 });
    expect(r.filas.map((f) => f.origen)).toEqual(["sin_clasificar", "sin_utm"]);
  });
});
