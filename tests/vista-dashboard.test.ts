import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abonos, calls, cohorts, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { armarVistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

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
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
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
    .values({ leadId: lead.id, programId: programaA, etapa: "abonado" })
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
      { programId: programaA, hoy: HOY, preset: "hoy", closerId: "Ana" },
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
  it("no pierde al closer elegido aunque en ese rango no tenga nada registrado", async () => {
    await sembrarDosClosers();

    // Un rango donde Ana no tiene ni llamadas ni ventas ni abonos. Si el selector
    // solo listara a quien aparece en el comparativo, se borraria la seleccion sola
    // y la pantalla diria "todos" mientras muestra los numeros de Ana.
    const vista = await armarVistaDelDashboard(
      { programId: programaA, hoy: HOY, preset: "custom", desde: "2026-01-01", hasta: "2026-01-31", closerId: "Ana" },
      db,
    );

    expect(vista.comparativo).toHaveLength(0);
    expect(vista.closers).toContain("Ana");
    expect(vista.closerId).toBe("Ana");
  });
});
