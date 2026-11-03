import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { gte, sql } from "drizzle-orm";
import { calls } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

/**
 * La base de prueba rechaza un `Date` crudo como lo hace postgres-js en producción
 * (`tests/helpers/base-de-prueba.ts`). Mordido en los dos sentidos: caza la plantilla `sql`
 * con un `Date` y deja pasar el operador de drizzle, fuera y dentro de una transacción.
 */
describe("guardián del Date crudo en la base de prueba", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });
  beforeEach(async () => {
    await vaciar();
  });
  afterAll(async () => {
    await cerrar();
  });

  const ahora = new Date("2026-11-03T14:00:00.000Z");

  /** drizzle envuelve el error del driver en "Failed query"; el motivo viaja en `cause`. */
  async function motivoDelRechazo(consulta: Promise<unknown>): Promise<string> {
    try {
      await consulta;
    } catch (error) {
      const mensajes: string[] = [];
      for (let actual: unknown = error; actual instanceof Error; actual = actual.cause) mensajes.push(actual.message);
      return mensajes.join(" | ");
    }
    return "no se rechazó";
  }

  it("rechaza un Date interpolado en una plantilla sql", async () => {
    expect(await motivoDelRechazo(
      db.select({ n: sql<number>`count(*)::int` }).from(calls).where(sql`${calls.fechaAgenda} > ${ahora}`),
    )).toMatch(/Date crudo/);
  });

  it("deja pasar el mismo filtro escrito con el operador de drizzle", async () => {
    const [fila] = await db.select({ n: sql<number>`count(*)::int` }).from(calls).where(gte(calls.fechaAgenda, ahora));
    expect(fila.n).toBe(0);
  });

  it("también lo rechaza dentro de una transacción", async () => {
    expect(await motivoDelRechazo(
      (db as unknown as { transaction: (f: (tx: Db) => Promise<unknown>) => Promise<unknown> }).transaction((tx) =>
        tx.select({ n: sql<number>`count(*)::int` }).from(calls).where(sql`${calls.fechaAgenda} > ${ahora}`),
      ),
    )).toMatch(/Date crudo/);
  });
});
