import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sostener = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/lib/auth/guards", () => ({ respuestaDeError: () => Response.json({ error: "Error interno." }, { status: 500 }) }));
vi.mock("@/lib/db", () => ({ get db() { return sostener.db; } }));
vi.mock("@/lib/format", async (original) => ({ ...(await original<typeof import("@/lib/format")>()), hoyEnBogota: () => "2026-11-06" }));

import { GET } from "@/app/api/cron/proyeccion-roas/route";
import { calls, cohorts, cuentasPublicitarias, dealEtapaHistorial, deals, gastoPauta, leads, pautaObjetos, programs, proyeccionesRoas, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { calcularProyeccionDeRoas, confirmarProyecciones, guardarProyeccionDelDia, proyectarRoas, proyeccionesConfirmadas } from "@/lib/queries/proyeccion-roas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let cohorteId: string;
let andrea: string;
let maru: string;
let anuncioDbId: string;
let secuencia = 0;
const HOY = "2026-11-06";
const AHORA = new Date("2026-11-06T12:00:00-05:00");
const RANGO = { desde: "2026-11-02", hasta: HOY };

beforeAll(async () => { ({ db, cerrar, vaciar } = await crearBaseReutilizable()); sostener.db = db; });
beforeEach(async () => {
  await vaciar();
  sostener.db = db;
  programId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "proy", nombre: "Proy", ticketUsd: "797", muestraMinimaConversion: 10 }).returning())[0].id;
  otroProgramId = (await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-proy", nombre: "Otro", ticketUsd: "1500", muestraMinimaConversion: 10 }).returning())[0].id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario" }).returning())[0].id;
  cohorteId = (await db.insert(cohorts).values({ programId, codigo: "C1", metaCupos: 10, precioUsd: "797" }).returning())[0].id;
  andrea = (await db.insert(users).values({ email: "andrea@proy.test", rol: "closer", closerId: "Andrea" }).returning())[0].id;
  maru = (await db.insert(users).values({ email: "maru@proy.test", rol: "closer", closerId: "Maru" }).returning())[0].id;
  const cuenta = (await db.insert(cuentasPublicitarias).values({ programId, idMeta: "cuenta-proy", nombre: "Cuenta", moneda: "USD", zonaHoraria: "America/Bogota" }).returning())[0];
  const objetos = await db.insert(pautaObjetos).values([
    { cuentaId: cuenta.id, programId, idMeta: "camp1", nivel: "campana", nombre: "Campaña 1", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "set1", nivel: "conjunto", padreIdMeta: "camp1", nombre: "Conjunto 1", estado: "ACTIVE" },
    { cuentaId: cuenta.id, programId, idMeta: "ad1", nivel: "anuncio", padreIdMeta: "set1", nombre: "Anuncio 1", estado: "ACTIVE" },
  ]).returning();
  anuncioDbId = objetos.find((o) => o.idMeta === "ad1")!.id;
});
afterAll(async () => cerrar());

async function gasto(dias: string[], monto = "100") {
  await db.insert(gastoPauta).values(dias.map((fecha) => ({ programId, fecha, monto, moneda: "USD", origen: "meta_api" as const, pautaObjetoId: anuncioDbId })));
}

async function envio(dia: string) {
  const lead = (await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `proy-${++secuencia}@test.co`, nombre: `Lead ${secuencia}` }).returning())[0];
  const fila = (await db.insert(submissions).values({ leadId: lead.id, sourceId, token: crypto.randomUUID(), esParcial: false,
    fechaEnvio: new Date(`${dia}T10:00:00-05:00`), createdAt: new Date(`${dia}T10:00:00-05:00`),
    utmSource: "facebook", utmMedium: "cpc", utmId: "ad1" }).returning())[0];
  return { leadId: lead.id, envioId: fila.id };
}

async function vender(dia: string, valor: string, diaVenta: string) {
  const e = await envio(dia);
  const deal = (await db.insert(deals).values({ programId, leadId: e.leadId, submissionOrigenId: e.envioId, cohortId: cohorteId,
    ownerUserId: andrea, etapa: "ganado_completo", valorVendidoUsd: valor }).returning())[0];
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date(`${diaVenta}T12:00:00-05:00`) });
  return deal;
}

/** Un envío de pauta con su deal abierto y una cita agendada para el 9-nov de este closer. */
async function citaPendiente(dia: string, closerUserId: string, cohortId: string | null = cohorteId) {
  const e = await envio(dia);
  const deal = (await db.insert(deals).values({ programId, leadId: e.leadId, submissionOrigenId: e.envioId, cohortId,
    ownerUserId: closerUserId, etapa: "agendado" }).returning())[0];
  const [cita] = await db.insert(calls).values({ programId, dealId: deal.id, resultado: "agendada", closerUserId,
    fechaAgenda: new Date("2026-11-09T10:00:00-05:00") }).returning();
  return cita;
}

/** Historia de un closer en las últimas 3 semanas: personas con cita, con show y con venta. */
async function historia(closerUserId: string, args: { personas: number; conShow: number; vendidas: number }) {
  for (let i = 0; i < args.personas; i++) {
    const lead = (await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: `hist-${++secuencia}@test.co`, nombre: `Hist ${secuencia}` }).returning())[0];
    const show = i < args.conShow;
    const vendida = i < args.vendidas;
    const deal = (await db.insert(deals).values({ programId, leadId: lead.id, ownerUserId: closerUserId, cohortId: cohorteId,
      etapa: vendida ? "ganado_completo" : "agendado", valorVendidoUsd: vendida ? "797" : null }).returning())[0];
    await db.insert(calls).values({ programId, dealId: deal.id, closerUserId, resultado: show ? "show" : "no_show",
      fechaAgenda: new Date("2026-10-22T10:00:00-05:00") });
  }
}

/** El ejemplo de Dani: gasto del 2 al 6-nov, 10 citas el 9-nov, 5 de Andrea y 5 de Maru con tasas distintas. */
async function ejemploDeDani() {
  await gasto(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  await vender("2026-11-02", "400", "2026-11-05");
  for (const [i, dia] of ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-06"].entries()) {
    await citaPendiente(dia, andrea); await citaPendiente(dia, maru); void i;
  }
  await historia(andrea, { personas: 10, conShow: 8, vendidas: 4 }); // se presenta 80 %, compra 50 %
  await historia(maru, { personas: 10, conShow: 4, vendidas: 1 }); // se presenta 40 %, compra 25 %
}

describe("ROAS proyectado (375)", () => {
  it("el ejemplo de Dani: el ROAS a hoy no cuenta el lunes 9, avisa 10 pendientes y el proyectado sale como a mano", async () => {
    await ejemploDeDani();
    const p = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: HOY, ahora: AHORA });
    expect(p.roasAHoy.valor).toBeCloseTo(400 / 500, 10);
    expect(p.roasAHoy.agendasPendientes).toBe(10);
    expect(p.citasPendientes).toBe(10);
    expect(p.ultimaCitaEn?.toISOString()).toBe(new Date("2026-11-09T10:00:00-05:00").toISOString());
    // A mano: 5 × 0,8 × 0,5 × 797 + 5 × 0,4 × 0,25 × 797 = 1594 + 398,5.
    expect(p.esperadoUsd).toBeCloseTo(1992.5, 6);
    expect(p.valor).toBeCloseTo((400 + 1992.5) / 500, 10);
    expect(p.motivo).toBeNull();
    expect(p.supuestos.porCloser.map((s) => [s.closer, s.citas, s.usaPrograma])).toEqual([["Andrea", 5, false], ["Maru", 5, false]]);
  });

  it("la cifra de citas pendientes abre una lista con las mismas 10 citas", async () => {
    await ejemploDeDani();
    const [lista] = await listaDeMetrica("pauta_meta", { programId, rango: RANGO, hoy: HOY, ahora: AHORA, nivel: "total", paso: "pendiente" }, 1, db);
    expect(lista.subtotal.cantidad).toBe(10);
    expect(lista.filas).toHaveLength(10);
    expect(new Set(lista.filas.map((f) => f.closer))).toEqual(new Set(["Andrea", "Maru"]));
  });

  it("un closer sin muestra usa la tasa del programa y lo dice", async () => {
    await gasto(["2026-11-02", "2026-11-03"]);
    await vender("2026-11-02", "400", "2026-11-03");
    await citaPendiente("2026-11-03", maru);
    await historia(andrea, { personas: 10, conShow: 8, vendidas: 4 });
    await historia(maru, { personas: 3, conShow: 1, vendidas: 0 }); // 3 < 10 personas
    const p = await calcularProyeccionDeRoas(db, { programId, rango: { desde: "2026-11-02", hasta: HOY }, hoy: HOY, ahora: AHORA });
    const [s] = p.supuestos.porCloser;
    expect(s).toMatchObject({ closer: "Maru", usaPrograma: true, muestra: 3 });
    // Programa: 13 personas, 9 con show, 4 vendidas.
    expect(s!.pShow).toBeCloseTo(9 / 13, 10);
    expect(s!.pCierre).toBeCloseTo(4 / 9, 10);
    expect(p.supuestos.programa.muestra).toBe(13);
  });

  it("con gasto parcial el proyectado es «—» con su motivo", async () => {
    await ejemploDeDani();
    await db.delete(gastoPauta).where(eq(gastoPauta.fecha, "2026-11-02")); // la venta es del envío del 2-nov
    const p = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: HOY, ahora: AHORA });
    expect(p.valor).toBeNull();
    expect(p.motivo).toContain("desde");
  });

  it("sin historial suficiente en el programa el proyectado es «—» con motivo", async () => {
    await gasto(["2026-11-02", "2026-11-03"]);
    await vender("2026-11-02", "400", "2026-11-03");
    await citaPendiente("2026-11-03", maru);
    await historia(maru, { personas: 3, conShow: 1, vendidas: 0 });
    const p = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: HOY, ahora: AHORA });
    expect(p.valor).toBeNull();
    expect(p.motivo).toContain("Sin historial suficiente");
  });

  it("una cita de una persona sin cohorte no se proyecta con un precio inventado", async () => {
    await gasto(["2026-11-02", "2026-11-03"]);
    await vender("2026-11-02", "400", "2026-11-03");
    await citaPendiente("2026-11-03", andrea, null);
    await historia(andrea, { personas: 10, conShow: 8, vendidas: 4 });
    const p = await calcularProyeccionDeRoas(db, { programId, rango: RANGO, hoy: HOY, ahora: AHORA });
    expect(p.valor).toBeNull();
    expect(p.motivo).toContain("sin cohorte");
  });

  it("la cuenta pura sin citas pendientes devuelve el ROAS a hoy", () => {
    const r = proyectarRoas({ vendidoUsd: 100, gastoUsd: 50, roasAHoy: { valor: 2, base: 1, faltan: 0, motivo: null },
      pendientes: [], porCloser: new Map(), programa: { deals: 0, conShow: 0, vendidos: 0 }, muestraMinima: 10 });
    expect(r.valor).toBe(2);
  });
});

describe("cron de la proyección (375)", () => {
  const llamar = (secreto = "bueno") => GET(new Request("http://localhost/api/cron/proyeccion-roas", { headers: { authorization: `Bearer ${secreto}` } }));
  const secretoAnterior = process.env.CRON_SECRET;
  beforeEach(() => { process.env.CRON_SECRET = "bueno"; vi.useFakeTimers({ toFake: ["Date"], now: AHORA }); });
  afterEach(() => { vi.useRealTimers(); });
  afterAll(() => { if (secretoAnterior === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secretoAnterior; });

  it("sin el secreto responde 401 y no escribe", async () => {
    expect((await llamar("otro")).status).toBe(401);
    expect(await db.select().from(proyeccionesRoas)).toHaveLength(0);
  });

  it("es idempotente por programa y día, y no reescribe lo proyectado", async () => {
    await ejemploDeDani();
    expect((await (await llamar()).json()).programas).toHaveLength(2);
    const [primera] = await db.select().from(proyeccionesRoas).where(eq(proyeccionesRoas.programId, programId));
    expect(primera).toMatchObject({ dia: HOY, desde: "2026-11-01", hasta: HOY, citasPendientes: 10, confirmadaEn: null });
    expect(Number(primera!.roasProyectado)).toBeCloseTo(4.785, 3);
    await db.update(gastoPauta).set({ monto: "1000" }); // el mundo cambia: lo guardado no
    await llamar();
    const filas = await db.select().from(proyeccionesRoas);
    expect(filas.filter((f) => f.programId === programId)).toHaveLength(1);
    expect(filas.filter((f) => f.programId === otroProgramId)).toHaveLength(1); // el otro programa tiene la suya, sin cruzar
    expect(Number(filas.find((f) => f.programId === programId)!.roasProyectado)).toBeCloseTo(4.785, 3);
  });

  it("confirma cuando la última cita pendiente tiene resultado, con el mismo rango, y no antes", async () => {
    await ejemploDeDani();
    expect(await guardarProyeccionDelDia(db, programId, HOY, AHORA)).toBe(true);
    const lunes = new Date("2026-11-09T18:00:00-05:00");
    // Antes de que ocurran las citas no se confirma.
    expect(await confirmarProyecciones(db, programId, "2026-11-09", lunes)).toBe(0);
    const citas = await db.select().from(calls).where(eq(calls.programId, programId));
    const pendientes = citas.filter((c) => c.resultado === "agendada");
    for (const [i, c] of pendientes.entries()) {
      if (i < pendientes.length - 1) await db.update(calls).set({ resultado: "no_show" }).where(eq(calls.id, c.id));
    }
    expect(await confirmarProyecciones(db, programId, "2026-11-09", lunes)).toBe(0); // falta una
    const ultima = pendientes.at(-1)!;
    await db.update(calls).set({ resultado: "no_show" }).where(eq(calls.id, ultima.id));
    expect(await confirmarProyecciones(db, programId, "2026-11-09", lunes)).toBe(1);
    expect(await confirmarProyecciones(db, programId, "2026-11-09", lunes)).toBe(0); // idempotente
    const [fila] = await db.select().from(proyeccionesRoas).where(eq(proyeccionesRoas.programId, programId));
    expect(fila!.confirmadaEn).not.toBeNull();
    expect(Number(fila!.roasReal)).toBeCloseTo(400 / 500, 4); // nadie compró: el real queda en el ROAS a hoy
    expect(Number(fila!.roasProyectado)).toBeCloseTo(4.785, 3); // lo proyectado no se reescribe
    const [guardada] = await proyeccionesConfirmadas(db, programId);
    expect(guardada).toMatchObject({ dia: HOY, citasPendientes: 10 });
  });
});
