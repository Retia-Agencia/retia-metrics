import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { categoriaDe, pautaInterina, type FilaPauta } from "@/lib/queries/pauta-interina";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 093 (enmienda del 29-sep): la vista interina de Pauta. Registro = token completo
 * (DP-11), agenda = llamada vigente atribuida al envio de origen de su deal (ADR 0060), "sin
 * UTM" y "macro" como categorias aparte, y el programa como frontera (ADR 0043).
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let fuente: string;
let fuenteOtro: string;
let usuario: string;
let n = 0;

const RANGO = { desde: "2026-09-01", hasta: "2026-09-30" };
const HOY = "2026-09-29";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [q] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "800" }).returning();
  otroProgramId = q.id;
  fuente = (await db.insert(sources).values({ programId, nombre: "Typeform" }).returning())[0].id;
  fuenteOtro = (await db.insert(sources).values({ programId: otroProgramId, nombre: "Typeform" }).returning())[0].id;
  usuario = (await db.insert(users).values({ email: "mani@retia.co", rol: "developer" }).returning())[0].id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

interface OpcEnvio {
  token?: string;
  fecha?: string;
  parcial?: boolean;
  utm?: [string | null, string | null, string | null];
  respuestas?: Record<string, unknown>;
  programa?: "p" | "q";
}

async function envio(o: OpcEnvio = {}) {
  const [l] = await db
    .insert(leads)
    .values({ programId: o.programa === "q" ? otroProgramId : programId, emailNormalizado: `l${++n}@correo.co` })
    .returning();
  const [s, m, c] = o.utm ?? ["facebook", "cpc", "camp"];
  const [e] = await db
    .insert(submissions)
    .values({
      leadId: l.id,
      sourceId: o.programa === "q" ? fuenteOtro : fuente,
      token: o.token ?? `t${n}`,
      esParcial: o.parcial ?? false,
      fechaEnvio: new Date(o.fecha ?? "2026-09-10T15:00:00-05:00"),
      nombre: `Lead ${n}`,
      utmSource: s,
      utmMedium: m,
      utmCampaign: c,
      respuestas: o.respuestas ?? null,
    })
    .returning();
  return { leadId: l.id, envioId: e.id, programa: o.programa === "q" ? otroProgramId : programId };
}

async function agenda(o: { deal: { leadId: string; envioId: string | null; programa: string } | null; creada?: string; anulada?: boolean }) {
  let dealId: string | null = null;
  if (o.deal) {
    const [d] = await db
      .insert(deals)
      .values({ leadId: o.deal.leadId, programId: o.deal.programa, etapa: "agendado", submissionOrigenId: o.deal.envioId })
      .returning();
    dealId = d.id;
  }
  await db.insert(calls).values({
    programId: o.deal?.programa ?? programId,
    dealId,
    createdAt: new Date(o.creada ?? "2026-09-11T10:00:00-05:00"),
    ...(o.anulada ? { anuladoEn: new Date(), anuladoPor: usuario, motivoAnulacion: "error de tecleo" } : {}),
  });
}

const suma = (filas: FilaPauta[], campo: "registros" | "agendas", pred: (f: FilaPauta) => boolean = () => true) =>
  filas.filter(pred).reduce((s, f) => s + f[campo], 0);

describe("registros", () => {
  it("el parcial y la completa del mismo token son UN registro (DP-11)", async () => {
    const { leadId } = await envio({ token: "tk", parcial: true });
    await db.insert(submissions).values({
      leadId,
      sourceId: fuente,
      token: "tk",
      esParcial: false,
      fechaEnvio: new Date("2026-09-10T15:05:00-05:00"),
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "camp",
    });
    const v = await pautaInterina(db, programId, RANGO, {}, HOY);
    expect(v.resumen.registros).toBe(1);
    expect(suma(v.filas, "registros")).toBe(1);
  });

  it("sin UTM es su propia categoria, con conteo, y las macros se cuentan aparte", async () => {
    await envio();
    await envio({ utm: [null, null, null] });
    await envio({ utm: [null, null, null] });
    await envio({ utm: ["facebook", "cpc", "{{campaign.name}}"] });
    const v = await pautaInterina(db, programId, RANGO, {}, HOY);
    expect(v.resumen).toMatchObject({ registros: 4, sinUtm: 2, macro: 1 });
    expect(suma(v.filas, "registros", (f) => f.categoria === "sin_utm")).toBe(2);
    expect(suma(v.filas, "registros", (f) => f.categoria === "macro")).toBe(1);
    expect(suma(v.filas, "registros", (f) => f.categoria === "con_utm")).toBe(1);
  });

  it("el dia es el de Bogota: un envio de las 9pm del 30 no cae en octubre", async () => {
    await envio({ fecha: "2026-09-30T21:00:00-05:00" });
    const sep = await pautaInterina(db, programId, RANGO, {}, HOY);
    const oct = await pautaInterina(db, programId, { desde: "2026-10-01", hasta: "2026-10-31" }, {}, HOY);
    expect(sep.resumen.registros).toBe(1);
    expect(sep.filas[0].dia).toBe("2026-09-30");
    expect(oct.resumen.registros).toBe(0);
  });

  it("el programa es frontera: los envios del otro programa nunca aparecen", async () => {
    await envio();
    await envio({ programa: "q" });
    const v = await pautaInterina(db, programId, RANGO, {}, HOY);
    expect(v.resumen.registros).toBe(1);
  });
});

describe("agendas", () => {
  it("se atribuyen al envio de origen del deal; sin origen o sin deal, a su categoria; anuladas no cuentan", async () => {
    const conOrigen = await envio({ utm: ["instagram", "stories", "c1"] });
    await agenda({ deal: conOrigen });
    const sinOrigen = await envio();
    await agenda({ deal: { ...sinOrigen, envioId: null } });
    await agenda({ deal: null });
    await agenda({ deal: await envio({ utm: ["instagram", "stories", "c1"] }), anulada: true });

    const v = await pautaInterina(db, programId, RANGO, {}, HOY);
    expect(v.resumen.agendas).toBe(3);
    expect(v.resumen.agendasSinEnvioDeOrigen).toBe(2);
    expect(suma(v.filas, "agendas", (f) => f.source === "instagram" && f.campaign === "c1")).toBe(1);
    expect(suma(v.filas, "agendas", (f) => f.categoria === "sin_envio_origen")).toBe(2);
  });

  it("las agendas del otro programa no aparecen", async () => {
    const ajeno = await envio({ programa: "q" });
    await agenda({ deal: ajeno });
    const v = await pautaInterina(db, programId, RANGO, {}, HOY);
    expect(v.resumen.agendas).toBe(0);
  });
});

describe("filtros y el contador de hoy", () => {
  it("los filtros angostan la serie, pero no el resumen del rango", async () => {
    await envio({ utm: ["facebook", "cpc", "a"] });
    await envio({ utm: ["facebook", "cpc", "b"] });
    await envio({ utm: ["tiktok", "linktree", "a"] });
    await envio({ utm: [null, null, null] });

    const porCanal = await pautaInterina(db, programId, RANGO, { source: "facebook", medium: "cpc" }, HOY);
    expect(suma(porCanal.filas, "registros")).toBe(2);
    expect(porCanal.filas.every((f) => f.source === "facebook")).toBe(true);
    expect(porCanal.resumen).toMatchObject({ registros: 4, sinUtm: 1 });

    const porCampana = await pautaInterina(db, programId, RANGO, { source: "facebook", medium: "cpc", campaign: "b" }, HOY);
    expect(suma(porCampana.filas, "registros")).toBe(1);
  });

  it("hoy llegaron N sin UTM, mire el rango que mire", async () => {
    await envio({ fecha: "2026-09-29T08:00:00-05:00", utm: [null, null, null] });
    await envio({ fecha: "2026-09-29T09:00:00-05:00" });
    await envio({ fecha: "2026-09-28T09:00:00-05:00", utm: [null, null, null] });
    const v = await pautaInterina(db, programId, { desde: "2026-08-01", hasta: "2026-08-31" }, {}, HOY);
    expect(v.resumen.registros).toBe(0);
    expect(v.sinUtmHoy).toHaveLength(1);
  });
});

describe("utm_content y utm_term: crudos, de la columna o de respuestas", () => {
  it("entran a la serie tal como llegaron", async () => {
    await envio({ respuestas: { utm_content: "De_Cero_a_Tactical", utm_term: "Jptactical_FKT3" } });
    const v = await pautaInterina(db, programId, RANGO, {}, HOY);
    expect(v.filas[0]).toMatchObject({ content: "De_Cero_a_Tactical", term: "Jptactical_FKT3" });
  });

  it("una macro en utm_term tambien es macro", () => {
    expect(categoriaDe({ source: "ig", medium: "paid_social", campaign: "c", content: null, term: "{{placement}}" })).toBe("macro");
  });
});
