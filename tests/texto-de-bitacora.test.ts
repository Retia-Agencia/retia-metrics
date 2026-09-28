import { describe, expect, it } from "vitest";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";

/**
 * `textoDeBitacora` (bug del 28-sep): la funcion UNICA que serializa un valor de columna
 * al texto de `change_log`. Antes vivia copiada en `molde.ts` y `rastro.ts` como
 * `String(valor)`, que sobre un objeto da "[object Object]" y rompia el diff de la
 * edicion de un campo jsonb. Aca se prueba la funcion pura; el efecto sobre el diff se
 * prueba con PGlite en `tests/bitacora-jsonb.test.ts`.
 */
describe("textoDeBitacora", () => {
  it("null y undefined son null (ausente), no la cadena 'null'", () => {
    expect(textoDeBitacora(null)).toBeNull();
    expect(textoDeBitacora(undefined)).toBeNull();
  });

  it("una fecha sale como ISO 8601, no como la representacion local", () => {
    const fecha = new Date("2026-09-28T05:26:22.000Z");
    expect(textoDeBitacora(fecha)).toBe("2026-09-28T05:26:22.000Z");
  });

  it("los primitivos salen con String: number, boolean, string", () => {
    expect(textoDeBitacora(42)).toBe("42");
    expect(textoDeBitacora(0)).toBe("0");
    expect(textoDeBitacora(true)).toBe("true");
    expect(textoDeBitacora(false)).toBe("false");
    expect(textoDeBitacora(BigInt(10))).toBe("10");
    expect(textoDeBitacora("hola")).toBe("hola");
    expect(textoDeBitacora("")).toBe("");
  });

  it("un objeto sale como JSON de verdad, no como '[object Object]'", () => {
    expect(textoDeBitacora({ correo: "Correo", telefono: "Teléfono" })).toBe(
      '{"correo":"Correo","telefono":"Teléfono"}',
    );
  });

  it("un arreglo sale como JSON y conserva su orden (el orden de un arreglo es dato)", () => {
    expect(textoDeBitacora(["b", "a", "c"])).toBe('["b","a","c"]');
  });

  it("dos objetos con el mismo contenido y distinto orden de llaves dan el MISMO texto", () => {
    // Este es el punto: el diff compara textos, y no debe ver un cambio donde no lo hay.
    const a = textoDeBitacora({ correo: "x", telefono: "y", fecha: "z" });
    const b = textoDeBitacora({ fecha: "z", telefono: "y", correo: "x" });
    expect(a).toBe(b);
  });

  it("el orden estable llega a los objetos anidados, no solo al de arriba", () => {
    const a = textoDeBitacora({ mapeo: { correo: "c", telefono: "t" }, rango: "A1" });
    const b = textoDeBitacora({ rango: "A1", mapeo: { telefono: "t", correo: "c" } });
    expect(a).toBe(b);
    expect(a).toBe('{"mapeo":{"correo":"c","telefono":"t"},"rango":"A1"}');
  });

  it("los elementos de un arreglo de objetos tambien se ordenan", () => {
    expect(textoDeBitacora([{ b: 1, a: 2 }])).toBe('[{"a":2,"b":1}]');
  });

  it("un cambio REAL de contenido si produce un texto distinto", () => {
    const antes = textoDeBitacora({ correo: "Correo" });
    const despues = textoDeBitacora({ correo: "Email" });
    expect(antes).not.toBe(despues);
  });
});
