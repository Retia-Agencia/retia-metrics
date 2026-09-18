import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  abonos,
  calls,
  changeLog,
  cohorts,
  miembrosPrograma,
  motivos,
  origenes,
  people,
  plataformasPago,
  productos,
  programs,
  sales,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { historialDePersona } from "@/lib/queries/personas";

/**
 * Ticket 006 — historial de una persona (ADR 0013, 0015, 0021).
 *
 * Todo sobre PGlite en memoria: una sola base para el archivo (aplicar las
 * migraciones reales tarda segundos) y `limpiar()` entre tests, igual que
 * `tests/mi-dia.test.ts`. Se afirma leyendo lo que devuelve la interfaz publica,
 * nunca la forma interna de la consulta.
 */

let base: BaseDePrueba;
let db: Db;

let programaA: string;

/** Vacia en orden de llave foranea. */
async function limpiar(): Promise<void> {
  await db.delete(changeLog);
  await db.delete(abonos);
  await db.delete(sales);
  await db.delete(calls);
  await db.delete(productos);
  await db.delete(people);
  await db.delete(cohorts);
  await db.delete(miembrosPrograma);
  await db.delete(programs);
  await db.delete(plataformasPago);
  await db.delete(motivos);
  await db.delete(origenes);
  await db.delete(users);
}

beforeAll(async () => {
  base = await crearBaseDePrueba();
  db = base.db;
}, 60_000);
afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await limpiar();
  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
});

/** Siembra una persona y devuelve su id. */
async function sembrarPersona(extra: Record<string, unknown> = {}): Promise<string> {
  const [p] = await db
    .insert(people)
    .values({
      programId: programaA,
      emailNormalizado: "lead@correo.co",
      nombre: "Lead de Prueba",
      ...extra,
    } as never)
    .returning();
  return p.id as string;
}

describe("historialDePersona", () => {
  it("una persona que no existe devuelve null (la pagina lo vuelve 404)", async () => {
    const historial = await historialDePersona(crypto.randomUUID(), db);
    expect(historial).toBeNull();
  });

  it("devuelve la persona con su programa", async () => {
    const id = await sembrarPersona();

    const historial = await historialDePersona(id, db);

    expect(historial?.persona.id).toBe(id);
    expect(historial?.persona.emailNormalizado).toBe("lead@correo.co");
    expect(historial?.persona.programaNombre).toBe("Programa A");
  });

  it("trae las llamadas de la persona, de la mas reciente a la mas vieja", async () => {
    const id = await sembrarPersona();
    await db.insert(calls).values([
      {
        personId: id,
        programId: programaA,
        resultado: "no_show",
        fechaLlamada: new Date("2026-09-10T15:00:00Z"),
      },
      {
        personId: id,
        programId: programaA,
        resultado: "show",
        fechaLlamada: new Date("2026-09-15T15:00:00Z"),
      },
    ] as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.llamadas.map((l) => l.resultado)).toEqual(["show", "no_show"]);
  });

  it("resuelve el motivo de perdida a su nombre, no a su uuid", async () => {
    const id = await sembrarPersona();
    const [motivo] = await db.insert(motivos).values({ nombre: "Sin presupuesto" }).returning();
    await db.insert(calls).values({
      personId: id,
      programId: programaA,
      resultado: "perdida",
      motivoId: motivo.id,
      fechaLlamada: new Date("2026-09-15T15:00:00Z"),
    } as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.llamadas[0]?.motivoNombre).toBe("Sin presupuesto");
  });

  it("las llamadas de otra persona no se cuelan", async () => {
    const id = await sembrarPersona();
    const otra = await sembrarPersona({ emailNormalizado: "otra@correo.co" });
    await db.insert(calls).values({
      personId: otra,
      programId: programaA,
      resultado: "show",
      fechaLlamada: new Date("2026-09-15T15:00:00Z"),
    } as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.llamadas).toEqual([]);
  });
});

describe("las ventas del historial (Done cuando: saldo pendiente de cada venta)", () => {
  /** Siembra una venta de la persona y devuelve su id. */
  async function sembrarVenta(
    personId: string,
    extra: Record<string, unknown> = {},
  ): Promise<string> {
    const [v] = await db
      .insert(sales)
      .values({
        personId,
        programId: programaA,
        fecha: "2026-09-15",
        precioAplicadoUsd: "1000.00",
        moneda: "USD",
        ...extra,
      } as never)
      .returning();
    return v.id as string;
  }

  it("el saldo es el precio del contrato menos lo abonado", async () => {
    const id = await sembrarPersona();
    const saleId = await sembrarVenta(id);
    await db.insert(abonos).values([
      { saleId, programId: programaA, fecha: "2026-09-15", monto: "400.00", moneda: "USD" },
      { saleId, programId: programaA, fecha: "2026-09-20", monto: "250.00", moneda: "USD" },
    ] as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.ventas).toHaveLength(1);
    expect(Number(historial?.ventas[0]?.abonado)).toBe(650);
    expect(Number(historial?.ventas[0]?.saldo)).toBe(350);
  });

  it("cada venta trae sus abonos en detalle, del mas viejo al mas reciente", async () => {
    const id = await sembrarPersona();
    const saleId = await sembrarVenta(id);
    const [plataforma] = await db
      .insert(plataformasPago)
      .values({ nombre: "Stripe" })
      .returning();
    await db.insert(abonos).values([
      {
        saleId,
        programId: programaA,
        fecha: "2026-09-20",
        monto: "250.00",
        moneda: "USD",
        plataformaId: plataforma.id,
      },
      { saleId, programId: programaA, fecha: "2026-09-15", monto: "400.00", moneda: "USD" },
    ] as never);

    const historial = await historialDePersona(id, db);

    const abonosDeLaVenta = historial?.ventas[0]?.abonos ?? [];
    expect(abonosDeLaVenta.map((a) => a.fecha)).toEqual(["2026-09-15", "2026-09-20"]);
    expect(abonosDeLaVenta[1]?.plataformaNombre).toBe("Stripe");
    expect(abonosDeLaVenta[0]?.plataformaNombre).toBeNull();
  });

  it("una venta sin precio de contrato tiene saldo null: no se inventa un numero", async () => {
    const id = await sembrarPersona();
    const saleId = await sembrarVenta(id, { precioAplicadoUsd: null });
    await db
      .insert(abonos)
      .values({
        saleId,
        programId: programaA,
        fecha: "2026-09-15",
        monto: "400.00",
        moneda: "USD",
      } as never);

    const historial = await historialDePersona(id, db);

    expect(historial?.ventas[0]?.saldo).toBeNull();
    expect(Number(historial?.ventas[0]?.abonado)).toBe(400);
  });

  it("una persona sin ventas trae una lista vacia, no null", async () => {
    const id = await sembrarPersona();

    const historial = await historialDePersona(id, db);

    expect(historial?.ventas).toEqual([]);
  });
});
