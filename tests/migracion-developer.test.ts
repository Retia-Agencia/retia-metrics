import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 024 — la migracion 0012 suma el valor `developer` al enum `rol`.
 *
 * Para un enum de Postgres, sumar un valor es `ALTER TYPE ... ADD VALUE`. Este test
 * prueba, sobre PGlite (mismas migraciones reales que produccion, ADR 0020), que la
 * migracion aplica y que se puede insertar un usuario con rol `developer` — o sea,
 * que el valor quedo en el enum.
 */

let db: Db;
let cerrar: () => Promise<void>;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
});

afterEach(async () => {
  await cerrar();
});

describe("migracion 0012: rol developer", () => {
  it("permite crear un usuario con rol developer", async () => {
    const [creado] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" })
      .returning();
    expect(creado.rol).toBe("developer");

    const [leido] = await db.select().from(users).where(eq(users.id, creado.id));
    expect(leido.rol).toBe("developer");
  });
});
