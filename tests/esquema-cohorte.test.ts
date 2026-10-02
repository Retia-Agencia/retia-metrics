import { describe, expect, it } from "vitest";
import { estadoCohorteEnum } from "@/lib/db/schema";

/**
 * ADR 0014: el concepto se llama "cohorte" en todo el proyecto, incluida la base.
 * Afirmamos los nombres reales que drizzle expone por su interfaz publica, para que
 * el renombre del schema (y su migracion) no puedan divergir en silencio.
 */
describe("esquema de cohorte", () => {
  it("el enum de estado se llama estado_cohorte", () => {
    expect(estadoCohorteEnum.enumName).toBe("estado_cohorte");
  });
});
