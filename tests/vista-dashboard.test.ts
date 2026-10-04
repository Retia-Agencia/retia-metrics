import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, cohorts, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { claveHistorica } from "@/lib/closers/identidad";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 005 — el armado de la vista del dashboard.
 *
 * Esto NO vuelve a probar las consultas del 004 (eso es `tests/dashboard.test.ts`):
 * prueba el pegamento, que es donde se rompen las cosas. Que el closer elegido llegue
 * a todas las consultas menos al comparativo, que el preset que sale sea el que de
 * verdad se uso, y que el selector no pierda al closer que uno acaba de elegir.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;

const HOY = "2026-09-15";

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = p.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function sembrarDosClosers() {
  const fecha = new Date("2026-09-15T14:00:00Z");
  await db.insert(calls).values([
    { programId: programaA, closerId: "Ana", fechaAgenda: fecha, resultado: "cerrada" },
    { programId: programaA, closerId: "Beto", fechaAgenda: fecha, resultado: "no_show" },
  ]);
  const [lead] = await db
    .insert(leads)
    .values({ programId: programaA, emailNormalizado: "ana@correo.co" })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({ leadId: lead.id, programId: programaA, etapa: "ganado_parcial" })
    .returning();
  await db.insert(abonos).values({
    dealId: deal.id,
    programId: programaA,
    closerId: "Ana",
    fecha: HOY,
    monto: "100.00",
    moneda: "USD",
  });
}

describe("el closer elegido acota la vista, menos el comparativo", () => {
  it("con closer, el embudo y la caja son suyos y el comparativo sigue mostrando a todos (ADR 0009)", async () => {
    await sembrarDosClosers();

    const vista = await armarVistaDelDashboard(
      { programId: programaA, hoy: HOY, preset: "hoy", claveCloser: claveHistorica("Ana") },
      db,
    );

    expect(vista.embudo.agendas).toBe(1);
    expect(vista.caja).toEqual([{ moneda: "USD", total: 100 }]);
    // El comparativo es lo que garantiza "todos ven todo": nunca se acota.
    expect(vista.comparativo.map((c) => c.closerId).sort()).toEqual(["Ana", "Beto"]);
  });
});

describe("el preset que sale es el que de verdad se uso", () => {
  it("pedir el rango de la cohorte sin cohorte activa devuelve hoy, no una ventana inventada", async () => {
    const vista = await armarVistaDelDashboard(
      { programId: programaA, hoy: HOY, preset: "cohorte" },
      db,
    );

    expect(vista.cohorte).toBeNull();
    expect(vista.seleccion.preset).toBe("hoy");
    expect(vista.seleccion.rango).toEqual({ desde: HOY, hasta: HOY });
  });

  it("con cohorte activa, el rango va del inicio de ventas a hoy (ADR 0022)", async () => {
    await db.insert(cohorts).values({
      programId: programaA,
      codigo: "C2",
      metaCupos: 30,
      precioUsd: "797.00",
      fechaInicioClases: "2026-09-22",
      fechaInicioVentas: "2026-08-14",
      fechaCierreVentas: "2026-09-21",
      estado: "activo",
    });

    const vista = await armarVistaDelDashboard(
      { programId: programaA, hoy: HOY, preset: "cohorte" },
      db,
    );

    expect(vista.seleccion.preset).toBe("cohorte");
    expect(vista.seleccion.rango).toEqual({ desde: "2026-08-14", hasta: HOY });
    expect(vista.cohorte!.codigo).toBe("C2");
  });
});

describe("el selector de closer", () => {
  it("ofrece a los closers CON CUENTA que tuvieron actividad, con su users.id como valor", async () => {
    // Un closer con cuenta que es dueño de un deal del programa: el selector lo ofrece
    // con su `users.id` como valor y su etiqueta visible (Decision 5, ticket 167). Los
    // closers solo históricos (texto sin cuenta) no se ofrecen; el comparativo los sigue
    // mostrando como filas.
    const [ana] = await db.insert(users).values({ email: "ana@retia.co", rol: "closer", closerId: "Ana" }).returning();
    const [lead] = await db.insert(leads).values({ programId: programaA, emailNormalizado: "lead@retia.co" }).returning();
    await db.insert(deals).values({ programId: programaA, leadId: lead.id, ownerUserId: ana.id, etapa: "ganado_parcial" });

    const vista = await armarVistaDelDashboard(
      { programId: programaA, hoy: HOY, preset: "custom", desde: "2026-01-01", hasta: "2026-01-31", claveCloser: ana.id },
      db,
    );

    expect(vista.closers).toEqual([{ id: ana.id, label: "Ana" }]);
    expect(vista.claveCloser).toBe(ana.id);
  });
});


it("la anterior es del mismo programa y A nuevo alimenta las consultas existentes", async () => {
  await sembrarDosClosers();
  const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1500.00" }).returning();
  const base = { metaCupos: 30, precioUsd: "797.00", estado: "cerrado" as const };
  await db.insert(cohorts).values([
    { ...base, programId: programaA, codigo: "C2", estado: "activo", fechaInicioClases: "2026-10-01", fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-09-30" },
    { ...base, programId: programaA, codigo: "C1", fechaInicioClases: "2026-09-01", fechaInicioVentas: "2026-08-03", fechaCierreVentas: "2026-08-31" },
    { ...base, programId: otro.id, codigo: "AJENA", fechaInicioClases: "2026-09-20", fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-09-19" },
  ]);
  const vista = await armarVistaDelDashboard({ programId: programaA, hoy: HOY, preset: "hoy", periodo: { preset: "cohorte_actual" } }, db);
  expect(vista.periodo.b).toEqual({ desde: "2026-08-03", hasta: "2026-08-17" });
  expect(vista.anterior).not.toBeNull();
  expect(vista.seleccion.rango).toEqual(vista.periodo.a);
  expect(vista.embudo.agendas).toBe(2);
  const previa = await armarVistaDelDashboard({ programId: programaA, hoy: HOY, preset: "hoy", periodo: { preset: "cohorte_anterior" } }, db);
  expect(previa.seleccion.rango).toEqual({ desde: "2026-08-03", hasta: "2026-08-31" });
  expect(previa.embudo.agendas).toBe(0);
  expect(previa.periodo.b).toBeNull();
  expect(previa.anterior).toBeNull();
});

it("arma contratado, comisión, descuento, ventas por cohorte y cartera", async () => {
  const [closer] = await db.insert(users).values({ email: "dinero@retia.co", rol: "closer", closerId: "Dinero" }).returning();
  const [cohorte] = await db.insert(cohorts).values({
    programId: programaA,
    codigo: "DIN",
    metaCupos: 10,
    precioUsd: "100",
    fechaInicioClases: "2026-10-01",
    fechaInicioVentas: HOY,
    fechaCierreVentas: "2026-09-30",
    estado: "activo",
  }).returning();
  const [lead] = await db.insert(leads).values({ programId: programaA, emailNormalizado: "dinero@lead.co" }).returning();
  const [deal] = await db.insert(deals).values({
    programId: programaA,
    leadId: lead.id,
    ownerUserId: closer.id,
    cohortId: cohorte.id,
    etapa: "ganado_parcial",
    valorVendidoUsd: "80",
    comisionPorcentaje: "10",
    fechaLimitePago: "2026-09-01",
  }).returning();
  const [leadSinSaldo] = await db
    .insert(leads)
    .values({ programId: programaA, emailNormalizado: "sin-saldo@lead.co" })
    .returning();
  await db.insert(deals).values({
    programId: programaA,
    leadId: leadSinSaldo.id,
    ownerUserId: closer.id,
    cohortId: cohorte.id,
    etapa: "ganado_parcial",
    valorVendidoUsd: null,
  });
  await db.insert(dealEtapaHistorial).values({ dealId: deal.id, a: "ganado_parcial", fecha: new Date("2026-09-15T10:00:00-05:00") });
  await db.insert(abonos).values({ programId: programaA, dealId: deal.id, registradoPorUserId: closer.id, fecha: HOY, monto: "30", moneda: "USD" });

  const vista = await armarVistaDelDashboard({
    programId: programaA,
    hoy: HOY,
    preset: "hoy",
    periodo: { preset: "cohorte_actual" },
    ahora: new Date("2026-09-15T12:00:00-05:00"),
  }, db);

  expect(vista.anterior).toBeNull();
  expect(vista.contratadoUsd).toBe(80);
  expect(vista.comision).toEqual({ totalUsd: 8, ventasSinComision: 0 });
  expect(vista.descuento).toEqual({ promedioPct: 0.2, promedioUsd: 20, ventas: 1 });
  expect(vista.ventasPorCohorte).toEqual([{ cohorteId: cohorte.id, codigo: "DIN", ventas: 1, contratadoUsd: 80 }]);
  expect(vista.cartera).toMatchObject({
    deals: 2,
    saldoUsd: 50,
    vencidos: 1,
    sinSaldoCalculable: 1,
  });
});
