import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { CumplimientoVista } from "@/components/pauta/cumplimiento";
import { calls, cohorts, dealEtapaHistorial, deals, leads, objetivos, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  armarCumplimiento,
  estadoDeCumplimiento,
  leerCumplimientoDeCohorte,
  type EntradaDeCumplimiento,
} from "@/lib/metas/cumplimiento-de-cohorte";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const base: EntradaDeCumplimiento = {
  hoy: "2026-11-06",
  cohorte: {
    id: "cohorte",
    codigo: "C-412",
    metaCupos: 100,
    precioUsd: "1000",
    fechaInicioVentas: "2026-11-02",
    fechaCierreVentas: "2026-11-13",
  },
  esActiva: true,
  ventasTotales: { cantidad: 40, vendidoUsd: 40_000 },
  ventasPauta: { cantidad: 20, vendidoUsd: 20_000 },
  agendas: 40,
  metas: { agendas: 100, ventasPauta: 50, costoPorAgenda: 50_000, inversion: 5_000_000 },
  gastoCop: 2_000_000,
  proyeccion: { agendasRequeridasDia: { valor: 5, razon: null }, faltan: 60 },
};

function html(entrada: EntradaDeCumplimiento): string {
  return renderToStaticMarkup(createElement(CumplimientoVista, { datos: armarCumplimiento(entrada), slug: "programa 412" }));
}

describe("412 C: cumplimiento puro", () => {
  it("a mitad de los días hábiles, 40 % llevado contra 50 % esperado queda En seguimiento", () => {
    const resultado = estadoDeCumplimiento({ llevamos: 40, meta: 100, esperado: 50 });
    expect(resultado).toEqual({ estado: "en_seguimiento", ratio: 0.8 });
    expect(html(base)).toContain("En seguimiento");
  });

  it("30 % llevado contra 50 % esperado queda Rezagado", () => {
    const datos = armarCumplimiento({ ...base, agendas: 30 });
    expect(datos.agendas?.cupos.cumplimiento).toEqual({ estado: "rezagado", ratio: 0.6 });
    expect(renderToStaticMarkup(createElement(CumplimientoVista, { datos, slug: "p412" }))).toContain("Rezagado");
  });

  it("la meta cumplida queda En meta y ya no pide inversión", () => {
    const entrada = { ...base, agendas: 100, proyeccion: { agendasRequeridasDia: { valor: 0, razon: null }, faltan: 0 } };
    const datos = armarCumplimiento(entrada);
    expect(datos.agendas?.cupos.cumplimiento?.estado).toBe("en_meta");
    expect(html(entrada)).toContain("Meta cumplida: no hace falta más inversión");
  });

  it("sin meta de agendas devuelve null y lo explica", () => {
    const entrada = { ...base, metas: { ...base.metas, agendas: null } };
    expect(armarCumplimiento(entrada).agendas).toBeNull();
    expect(html(entrada)).toContain("Sin meta de agendas para esta cohorte");
  });

  it("después del cierre el esperado es la meta y no hay requeridos", () => {
    const datos = armarCumplimiento({ ...base, hoy: "2026-11-16" });
    expect(datos.agendas?.cupos.esperado).toBe(100);
    expect(datos.requeridos).toBeNull();
    expect(renderToStaticMarkup(createElement(CumplimientoVista, { datos, slug: "p412" }))).toContain("La cohorte ya cerró");
  });
});

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
afterAll(async () => cerrar());
beforeEach(async () => vaciar());

async function sembrarPrograma(slug: string, cantidad: number) {
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug, nombre: slug, ticketUsd: "1000" }).returning();
  const [cohorte] = await db.insert(cohorts).values({
    programId: programa.id,
    codigo: `C-${slug}`,
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioClases: "2026-12-01",
    fechaInicioVentas: "2026-11-02",
    fechaCierreVentas: "2026-11-06",
    estado: "activo",
  }).returning();
  const [fuente] = await db.insert(sources).values({ programId: programa.id, nombre: `Fuente ${slug}` }).returning();
  const ownerUserId = await duenoDePrueba(db, programa.id);
  await db.insert(objetivos).values([
    { cohortId: cohorte.id, area: null, metrica: "agendas", meta: "10", activo: true },
    { cohortId: cohorte.id, area: "paid", metrica: "cupos", meta: "10", activo: true },
  ]);
  for (let i = 0; i < cantidad; i += 1) {
    const [lead] = await db.insert(leads).values({
      programId: programa.id,
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
      emailNormalizado: `${slug}-${i}@retia.test`,
    }).returning();
    const [envio] = await db.insert(submissions).values({
      leadId: lead.id,
      sourceId: fuente.id,
      token: `${slug}-${i}`,
      utmSource: "facebook",
      utmMedium: "paid_social",
      fechaEnvio: new Date("2026-11-03T09:00:00-05:00"),
    }).returning();
    const [deal] = await db.insert(deals).values({
      programId: programa.id,
      leadId: lead.id,
      cohortId: cohorte.id,
      submissionOrigenId: envio.id,
      ownerUserId,
      etapa: "ganado_completo",
      valorVendidoUsd: "900",
    }).returning();
    await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_completo", fecha: new Date("2026-11-04T10:00:00-05:00") });
    await db.insert(calls).values({ programId: programa.id, dealId: deal.id, createdAt: new Date("2026-11-03T11:00:00-05:00") });
  }
  return { programId: programa.id, cohortId: cohorte.id };
}

it("la lectura excluye ventas y agendas de otro programa y rechaza su cohorte", async () => {
  const propio = await sembrarPrograma("propio-412", 1);
  const ajeno = await sembrarPrograma("ajeno-412", 3);
  const datos = await leerCumplimientoDeCohorte(propio.programId, propio.cohortId, "2026-11-07", db);
  expect(datos.ventasTotales?.cupos.llevamos).toBe(1);
  expect(datos.ventasPauta?.cupos.llevamos).toBe(1);
  expect(datos.agendas?.cupos.llevamos).toBe(1);
  await expect(leerCumplimientoDeCohorte(propio.programId, ajeno.cohortId, "2026-11-07", db))
    .resolves.toMatchObject({ cohorte: null });
});
