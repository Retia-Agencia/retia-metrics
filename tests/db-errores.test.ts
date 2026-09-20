import { describe, expect, it } from "vitest";
import { esViolacionCheck, esViolacionForanea, esViolacionUnica } from "@/lib/db/errores";

/**
 * Los detectores de codigo SQLSTATE (`lib/db/errores.ts`) caminan la cadena de `cause`
 * porque Drizzle envuelve el error del driver. El ticket 030 agrega `esViolacionForanea`
 * (23503), la RED del caso de carrera del borrado del catalogo: sin el, un `DELETE` que
 * choca contra una FK `restrict` sale como 500 en vez del 400 legible.
 *
 * Se prueba en los dos sentidos: caza el codigo aunque venga anidado en `cause`, y NO
 * confunde un codigo con otro.
 */
describe("esViolacionForanea (SQLSTATE 23503)", () => {
  it("reconoce el 23503 en el error de arriba", () => {
    expect(esViolacionForanea({ code: "23503" })).toBe(true);
  });

  it("reconoce tambien el 23001 (restrict_violation), que es como PGlite reporta el RESTRICT", () => {
    expect(esViolacionForanea({ code: "23001" })).toBe(true);
    expect(esViolacionForanea({ cause: { code: "23001" } })).toBe(true);
  });

  it("reconoce el 23503 anidado en la cadena de cause (como lo envuelve Drizzle)", () => {
    const error = new Error("update or delete violates foreign key");
    (error as { cause?: unknown }).cause = { cause: { code: "23503" } };
    expect(esViolacionForanea(error)).toBe(true);
  });

  it("NO confunde el 23503 con la violacion unica (23505) ni el check (23514)", () => {
    expect(esViolacionForanea({ code: "23505" })).toBe(false);
    expect(esViolacionForanea({ code: "23514" })).toBe(false);
    // Y al reves: los otros detectores tampoco se disparan con el 23503.
    expect(esViolacionUnica({ code: "23503" })).toBe(false);
    expect(esViolacionCheck({ code: "23503" })).toBe(false);
  });

  it("un error sin codigo no es una violacion foranea", () => {
    expect(esViolacionForanea(new Error("timeout"))).toBe(false);
    expect(esViolacionForanea(null)).toBe(false);
  });
});
