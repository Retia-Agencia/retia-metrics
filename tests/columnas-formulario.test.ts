import { describe, expect, it } from "vitest";
import {
  claveDeColumnas,
  COLUMNAS_POR_DEFECTO,
  guardarColumnas,
  leerColumnas,
  type AlmacenamientoLike,
} from "@/lib/leads/columnas-formulario";

/**
 * Ticket 209 — la preferencia de columnas de la lista de Leads se recuerda por usuario y programa en
 * el navegador. Módulo puro: aquí se prueba la lectura y la escritura con un `Storage` falso, y que
 * un almacenamiento ausente, roto o con basura caiga a "todo apagado" sin lanzar.
 */

/** Un localStorage en memoria para las pruebas. */
function almacenamientoFalso(inicial: Record<string, string> = {}): AlmacenamientoLike & { datos: Record<string, string> } {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => {
      datos[k] = v;
    },
  };
}

/** Un almacenamiento que revienta en cada operación (modo privado, cuota, deshabilitado). */
const almacenamientoRoto: AlmacenamientoLike = {
  getItem: () => {
    throw new Error("storage bloqueado");
  },
  setItem: () => {
    throw new Error("storage bloqueado");
  },
};

describe("claveDeColumnas", () => {
  it("lleva el usuario y el programa, para no filtrar la elección entre sesiones ni programas", () => {
    expect(claveDeColumnas("u1", "p1")).not.toBe(claveDeColumnas("u2", "p1"));
    expect(claveDeColumnas("u1", "p1")).not.toBe(claveDeColumnas("u1", "p2"));
  });
});

describe("leerColumnas", () => {
  it("sin almacenamiento devuelve el defecto (todo apagado)", () => {
    expect(leerColumnas(null, "k")).toEqual(COLUMNAS_POR_DEFECTO);
    expect(leerColumnas(undefined, "k")).toEqual(COLUMNAS_POR_DEFECTO);
  });

  it("sin valor guardado devuelve el defecto", () => {
    expect(leerColumnas(almacenamientoFalso(), "k")).toEqual(COLUMNAS_POR_DEFECTO);
  });

  it("lee la preferencia guardada", () => {
    const guardado = JSON.stringify({ canal: true, preguntas: ["¿Por qué?"] });
    expect(leerColumnas(almacenamientoFalso({ k: guardado }), "k")).toEqual({
      canal: true,
      preguntas: ["¿Por qué?"],
    });
  });

  it("un JSON inválido cae al defecto sin lanzar", () => {
    expect(leerColumnas(almacenamientoFalso({ k: "no-es-json{" }), "k")).toEqual(COLUMNAS_POR_DEFECTO);
  });

  it("una forma inesperada se normaliza al defecto", () => {
    expect(leerColumnas(almacenamientoFalso({ k: JSON.stringify([1, 2]) }), "k")).toEqual(COLUMNAS_POR_DEFECTO);
    expect(leerColumnas(almacenamientoFalso({ k: JSON.stringify(null) }), "k")).toEqual(COLUMNAS_POR_DEFECTO);
    // canal no booleano -> el defecto (visible); preguntas que no es arreglo -> vacío; entradas no string se filtran.
    expect(leerColumnas(almacenamientoFalso({ k: JSON.stringify({ canal: "sí", preguntas: "x" }) }), "k")).toEqual({
      canal: true,
      preguntas: [],
    });
    expect(
      leerColumnas(almacenamientoFalso({ k: JSON.stringify({ canal: true, preguntas: ["a", 3, null, "b"] }) }), "k"),
    ).toEqual({ canal: true, preguntas: ["a", "b"] });
  });

  it("un almacenamiento que lanza cae al defecto sin propagar el error", () => {
    expect(leerColumnas(almacenamientoRoto, "k")).toEqual(COLUMNAS_POR_DEFECTO);
  });
});

describe("guardarColumnas", () => {
  it("guarda y vuelve a leer lo mismo (ida y vuelta)", () => {
    const almacen = almacenamientoFalso();
    const clave = claveDeColumnas("u1", "p1");
    guardarColumnas(almacen, clave, { canal: true, preguntas: ["¿Qué te motivó?"] });
    expect(leerColumnas(almacen, clave)).toEqual({ canal: true, preguntas: ["¿Qué te motivó?"] });
  });

  it("sin almacenamiento no hace nada y no lanza", () => {
    expect(() => guardarColumnas(null, "k", COLUMNAS_POR_DEFECTO)).not.toThrow();
  });

  it("un almacenamiento que lanza no propaga el error", () => {
    expect(() => guardarColumnas(almacenamientoRoto, "k", { canal: true, preguntas: [] })).not.toThrow();
  });
});
