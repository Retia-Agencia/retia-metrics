import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  abonos,
  calls,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  miembrosPrograma,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { programasVisibles, type ProgramaVisible } from "@/lib/auth/alcance";
import { cajaRecaudada } from "@/lib/queries/dashboard";
import { armarVistaDeTodos } from "@/lib/queries/vista-todos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const HOY = "2026-09-15";
const RANGO = { desde: HOY, hasta: HOY };
let db: Db;
let cerrar: () => Promise<void>;
let programas: ProgramaVisible[];

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797", comisionPorcentaje: "10" },
    { ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1500", comisionPorcentaje: "5" },
  ]).returning();
  programas = programas.map(({ id, slug, nombre }) => ({ id, slug, nombre }));

  for (const [indice, programa] of programas.entries()) {
    await db.insert(cohorts).values({
      programId: programa.id,
      codigo: `C${indice + 1}`,
      metaCupos: 10 + indice,
      precioUsd: indice ? "1500" : "797",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    });
    const [lead] = await db.insert(leads).values({
      programId: programa.id,
      emailNormalizado: `persona-${indice}@retia.co`,
      fechaPrimeraAplicacion: new Date("2026-09-15T14:00:00Z"),
      fechaUltimaAplicacion: new Date("2026-09-15T14:00:00Z"),
    }).returning();
    const [deal] = await db.insert(deals).values({
      programId: programa.id,
      leadId: lead.id,
      etapa: "abonado",
      valorVendidoUsd: indice ? "1500" : "797",
      comisionPorcentaje: indice ? "5" : "10",
    }).returning();
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      de: "atendido",
      a: "abonado",
      fecha: new Date("2026-09-15T15:00:00Z"),
    });
    await db.insert(abonos).values({
      dealId: deal.id,
      programId: programa.id,
      closerId: `Closer ${indice}`,
      fecha: HOY,
      monto: indice ? "50" : "100",
      moneda: "USD",
    });
  }
  await db.insert(abonos).values({
    dealId: (await db.select({ id: deals.id }).from(deals))[0].id,
    programId: programas[0].id,
    closerId: "Closer 0",
    fecha: HOY,
    monto: "200000",
    moneda: "COP",
  });
  await db.insert(calls).values([
    { programId: programas[0].id, closerId: "Ana", fechaAgenda: new Date("2026-09-15T14:00:00Z"), resultado: "show" },
    { programId: programas[0].id, closerId: "Ana", fechaAgenda: new Date("2026-09-15T16:00:00Z"), resultado: "no_show" },
    { programId: programas[1].id, closerId: "Beto", fechaAgenda: new Date("2026-09-15T17:00:00Z"), resultado: "show" },
  ]);
}, 60_000);

afterEach(async () => cerrar());

describe("vista de todos los programas", () => {
  it("suma conteos y caja por moneda con el mismo universo de cada programa", async () => {
    const vista = await armarVistaDeTodos({ programas, hoy: HOY, periodo: { preset: "hoy" } }, db);
    const cajas = await Promise.all(programas.map((p) => cajaRecaudada({ programId: p.id, rango: RANGO }, db)));
    const usd = cajas.flat().filter((c) => c.moneda === "USD").reduce((n, c) => n + c.total, 0);

    expect(vista.a).toMatchObject({
      leads: { tipo: "conteo", valor: 2 },
      agendas: { tipo: "conteo", valor: 3 },
      shows: { tipo: "conteo", valor: 2 },
      cierres: { tipo: "conteo", valor: 2 },
    });
    expect(vista.a.caja).toEqual([
      { tipo: "dinero", moneda: "COP", valor: 200000 },
      { tipo: "dinero", moneda: "USD", valor: usd },
    ]);
  });

  it("conserva tasas, metas y comisiones como filas por programa", async () => {
    const vista = await armarVistaDeTodos({ programas, hoy: HOY, periodo: { preset: "hoy" } }, db);

    expect(vista.programas).toHaveLength(2);
    expect(vista.programas.map((p) => p.pctShow)).toEqual([
      { tipo: "tasa", valor: 0.5 },
      { tipo: "tasa", valor: 1 },
    ]);
    expect(vista.programas.map((p) => p.metaCupos?.valor)).toEqual([10, 11]);
    expect(vista.programas.map((p) => p.comision)).toEqual([
      { tipo: "dinero", moneda: "USD", valor: 79.7 },
      { tipo: "dinero", moneda: "USD", valor: 75 },
    ]);
  });

  it("un closer arma Todos solo con los programas de sus membresías activas", async () => {
    const [closer] = await db.insert(users).values({ email: "closer@retia.co", rol: "closer", closerId: "Ana" }).returning();
    await db.insert(miembrosPrograma).values({ userId: closer.id, programId: programas[0].id, activo: true });
    const visibles = await programasVisibles(closer.id, "closer", db);
    const vista = await armarVistaDeTodos({ programas: visibles, hoy: HOY, periodo: { preset: "hoy" } }, db);

    expect(visibles.map((p) => p.slug)).toEqual(["programa-a"]);
    expect(vista.programas.map((p) => p.programa.slug)).toEqual(["programa-a"]);
    expect(vista.a.leads.valor).toBe(1);
  });
});
