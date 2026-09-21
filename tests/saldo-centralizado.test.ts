import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, leads, programs, sales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { saldoDeVenta } from "@/lib/queries/ventas";
import { ventasDePersona } from "@/lib/queries/personas";
import { estaPagadaCompleta } from "@/lib/queries/saldo";

/**
 * ADR 0024 — hay UNA sola definicion de lo abonado y del saldo.
 *
 * Los dos caminos que leen dinero derivado tienen que coincidir siempre:
 * - `saldoDeVenta` alimenta la reja que bloquea un sobrepago en `registrarAbono`.
 * - `ventasDePersona` alimenta lo que el closer ve en `/mi-dia` y en el historial.
 *
 * Mientras el SQL estuvo copiado en los dos archivos, nada impedia que uno cambiara
 * sin el otro: la pantalla mostraria un saldo y la reja aplicaria otro, y la
 * diferencia solo aparece cuando el dinero ya no cuadra. Este archivo es el que
 * falla si alguien vuelve a separarlos.
 */

let base: BaseDePrueba;
let db: Db;
let programaId: string;
let personId: string;

beforeAll(async () => {
  base = await crearBaseDePrueba();
  db = base.db;
}, 60_000);
afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await db.delete(abonos);
  await db.delete(sales);
  await db.delete(leads);
  await db.delete(programs);

  const [p] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaId = p.id;

  const [persona] = await db
    .insert(leads)
    .values({ programId: programaId, emailNormalizado: "lead@correo.co" })
    .returning();
  personId = persona.id;
});

/** Siembra una venta de la persona y devuelve su id. */
async function sembrarVenta(precio: string | null): Promise<string> {
  const [v] = await db
    .insert(sales)
    .values({
      personId,
      programId: programaId,
      fecha: "2026-09-15",
      precioAplicadoUsd: precio,
      moneda: "USD",
    } as never)
    .returning();
  return v.id as string;
}

/** Los dos caminos leen la MISMA venta y tienen que decir lo mismo. */
async function ambosCaminos(saleId: string) {
  const porVenta = await saldoDeVenta(saleId, db);
  const porPersona = (await ventasDePersona(personId, db)).find((v) => v.saleId === saleId);
  return { porVenta, porPersona };
}

describe("los dos caminos que leen dinero derivado coinciden (ADR 0024)", () => {
  it("con varios abonos parciales", async () => {
    const saleId = await sembrarVenta("1000.00");
    await db.insert(abonos).values([
      { saleId, programId: programaId, fecha: "2026-09-15", monto: "400.00", moneda: "USD" },
      { saleId, programId: programaId, fecha: "2026-09-20", monto: "250.50", moneda: "USD" },
    ] as never);

    const { porVenta, porPersona } = await ambosCaminos(saleId);

    expect(porPersona?.abonado).toBe(porVenta?.abonado);
    expect(porPersona?.saldo).toBe(porVenta?.saldo);
    expect(Number(porVenta?.saldo)).toBe(349.5);
  });

  it("sin ningun abono", async () => {
    const saleId = await sembrarVenta("1000.00");

    const { porVenta, porPersona } = await ambosCaminos(saleId);

    expect(porPersona?.abonado).toBe(porVenta?.abonado);
    expect(porPersona?.saldo).toBe(porVenta?.saldo);
  });

  it("sin precio de contrato: los dos dicen saldo null, ninguno inventa un cero", async () => {
    const saleId = await sembrarVenta(null);
    await db
      .insert(abonos)
      .values({
        saleId,
        programId: programaId,
        fecha: "2026-09-15",
        monto: "400.00",
        moneda: "USD",
      } as never);

    const { porVenta, porPersona } = await ambosCaminos(saleId);

    expect(porVenta?.saldo).toBeNull();
    expect(porPersona?.saldo).toBeNull();
    expect(porPersona?.abonado).toBe(porVenta?.abonado);
  });

  it("con un sobrepago, los dos ven el saldo negativo igual", async () => {
    const saleId = await sembrarVenta("500.00");
    await db
      .insert(abonos)
      .values({
        saleId,
        programId: programaId,
        fecha: "2026-09-15",
        monto: "700.00",
        moneda: "USD",
      } as never);

    const { porVenta, porPersona } = await ambosCaminos(saleId);

    expect(Number(porVenta?.saldo)).toBe(-200);
    expect(porPersona?.saldo).toBe(porVenta?.saldo);
  });
});

describe("estaPagadaCompleta", () => {
  it("sin precio de contrato no se puede afirmar que este pagada", () => {
    expect(estaPagadaCompleta(null)).toBe(false);
  });

  it("saldo en cero o negativo es pagada completa", () => {
    expect(estaPagadaCompleta("0")).toBe(true);
    expect(estaPagadaCompleta("-200.00")).toBe(true);
  });

  it("saldo positivo todavia debe", () => {
    expect(estaPagadaCompleta("349.50")).toBe(false);
  });
});
