import { describe, expect, it } from "vitest";
import { cohorts } from "@/lib/db/schema";

/**
 * ADR 0014: el concepto se llama "cohorte" en todo el proyecto, incluida la base.
 * Afirmamos los nombres reales que drizzle expone por su interfaz publica, para que
 * el renombre del schema (y su migracion) no puedan divergir en silencio.
 */
describe("esquema de cohorte", () => {
  it("el esquema no expone una columna de estado manual", () => {
    expect("estado" in cohorts).toBe(false);
  });
});
