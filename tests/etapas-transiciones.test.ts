import { describe, expect, it } from "vitest";
import { etapaDealEnum, type EtapaDeal } from "@/lib/db/schema";
import {
  idDeTransicion,
  TRANSICIONES,
  transicion,
  transicionPermitida,
} from "@/lib/deals/etapas";

/**
 * Ticket 043 — la tabla de transiciones de etapa como dato puro (structure.md §3.1,
 * adoptada por Mani el 24-sep).
 *
 * Por que un test que recorre las 121 combinaciones (11x11) y no confia en la lista:
 * una flecha de mas convierte un movimiento imposible en uno legal, y una de menos
 * bloquea uno real, y **ninguna de las dos lanza un error**. La lista esperada se
 * escribe A MANO aca, no se deriva del modulo: derivarla la haria pasar siempre,
 * incluso si el modulo entero estuviera mal.
 */

/**
 * Las etapas de las que un deal puede llegar a `abonado`, para modelar A1 (se anula
 * el unico abono y vuelve a la etapa previa). Se documenta en el modulo; aca solo se
 * enumera para el esperado.
 */
const PREVIAS_A_ABONADO: EtapaDeal[] = ["en_contacto", "atendido", "compromiso_verbal", "seguimiento"];

/** La lista blanca esperada, escrita a mano desde el diagrama, etapa por etapa. */
const PERMITIDAS: Record<EtapaDeal, EtapaDeal[]> = {
  // 1: T1, T2, P
  pendiente_setteo: ["en_contacto", "agendado", "cierre_perdido"],
  // 2: T3, T4, T5(x2), T19, P
  en_contacto: ["agendado", "compromiso_verbal", "abonado", "completo", "proxima_cohorte", "cierre_perdido"],
  // 3: T6, T7, P
  pendiente_reagenda: ["agendado", "atendido", "cierre_perdido"],
  // 4: T8, T9 (self), T10, P
  agendado: ["pendiente_reagenda", "agendado", "atendido", "cierre_perdido"],
  // 5: T12, T13, T14, T24, T20, T29, P
  atendido: ["compromiso_verbal", "abonado", "completo", "seguimiento", "proxima_cohorte", "pendiente_reagenda", "cierre_perdido"],
  // 6: T15, T16, T17, T21, P
  compromiso_verbal: ["seguimiento", "abonado", "completo", "proxima_cohorte", "cierre_perdido"],
  // 7: T18, P, A1 (a las cuatro previas)
  abonado: ["completo", "cierre_perdido", ...PREVIAS_A_ABONADO],
  // 8: A2 unicamente. Terminal: no llega a cierre_perdido.
  completo: ["abonado"],
  // 9: T22, T23, P
  proxima_cohorte: ["en_contacto", "agendado", "cierre_perdido"],
  // 10: R (solo a 2, 4, 9)
  cierre_perdido: ["en_contacto", "agendado", "proxima_cohorte"],
  // 11: T25, T26(x2), T27, T28, P
  seguimiento: ["compromiso_verbal", "abonado", "completo", "agendado", "proxima_cohorte", "cierre_perdido"],
};

const TODAS = etapaDealEnum.enumValues;

describe("la tabla cubre las 121 combinaciones (11x11)", () => {
  it("hay 11 etapas", () => {
    expect(TODAS).toHaveLength(11);
  });

  it("cada combinacion coincide con la lista esperada, en los dos sentidos", () => {
    const errores: string[] = [];
    for (const de of TODAS) {
      const permitidas = new Set(PERMITIDAS[de]);
      for (const a of TODAS) {
        const esperado = permitidas.has(a);
        const real = transicionPermitida(de, a);
        if (esperado !== real) {
          errores.push(`${de} -> ${a}: esperado ${esperado}, dio ${real}`);
        }
      }
    }
    expect(errores, errores.join("\n")).toEqual([]);
    // Y que de verdad se recorrieron las 121.
    expect(TODAS.length * TODAS.length).toBe(121);
  });

  it("una permitida devuelve una transicion con id; una prohibida devuelve undefined", () => {
    expect(idDeTransicion("pendiente_setteo", "en_contacto")).toBe("T1");
    expect(transicion("pendiente_setteo", "en_contacto")).toMatchObject({ de: "pendiente_setteo", a: "en_contacto" });
    // pendiente_setteo -> atendido no existe.
    expect(idDeTransicion("pendiente_setteo", "atendido")).toBeUndefined();
    expect(transicion("pendiente_setteo", "atendido")).toBeUndefined();
  });
});

describe("las reglas duras del punto 3", () => {
  it("completo es terminal: su unica salida es A2 hacia abonado", () => {
    const salidas = TRANSICIONES.filter((t) => t.de === "completo");
    expect(salidas).toHaveLength(1);
    expect(salidas[0]).toMatchObject({ id: "A2", de: "completo", a: "abonado", clase: "reversion" });
    // No hay una sola flecha de completo a otra etapa.
    for (const a of TODAS) {
      if (a === "abonado") continue;
      expect(transicionPermitida("completo", a), `completo -> ${a} no deberia existir`).toBe(false);
    }
  });

  it("completo nunca llega a cierre_perdido", () => {
    expect(transicionPermitida("completo", "cierre_perdido")).toBe(false);
  });

  it("cierre_perdido (P) llega desde las NUEVE etapas abiertas, no desde completo", () => {
    const abiertas: EtapaDeal[] = [
      "pendiente_setteo",
      "en_contacto",
      "pendiente_reagenda",
      "agendado",
      "atendido",
      "compromiso_verbal",
      "abonado",
      "proxima_cohorte",
      "seguimiento",
    ];
    for (const de of abiertas) {
      expect(idDeTransicion(de, "cierre_perdido"), `${de} deberia poder perderse`).toBe("P");
    }
    expect(transicionPermitida("completo", "cierre_perdido")).toBe(false);
    // Y una perdida no llega desde el propio cierre_perdido.
    expect(transicionPermitida("cierre_perdido", "cierre_perdido")).toBe(false);
  });

  it("la recuperacion R desde cierre_perdido va solo a en_contacto, agendado o proxima_cohorte", () => {
    const destinosR = TRANSICIONES.filter((t) => t.de === "cierre_perdido").map((t) => t.a).sort();
    expect(destinosR).toEqual(["agendado", "en_contacto", "proxima_cohorte"]);
    for (const t of TRANSICIONES.filter((x) => x.de === "cierre_perdido")) {
      expect(t.id).toBe("R");
      expect(t.clase).toBe("recuperacion");
    }
    // A 5-8 no se recupera a mano.
    for (const a of ["atendido", "compromiso_verbal", "abonado", "completo"] as EtapaDeal[]) {
      expect(transicionPermitida("cierre_perdido", a), `no se recupera a ${a}`).toBe(false);
    }
  });

  it("T9 es una self-transicion legal de agendado", () => {
    expect(idDeTransicion("agendado", "agendado")).toBe("T9");
  });

  it("T11 no existe (reemplazada por Seguimiento)", () => {
    expect(TRANSICIONES.some((t) => t.id === "T11")).toBe(false);
  });

  it("los retrocesos son una segunda lista explicita (T15, T29, A1, A2)", () => {
    expect(transicion("compromiso_verbal", "seguimiento")).toMatchObject({ id: "T15", clase: "reversion" });
    expect(transicion("atendido", "pendiente_reagenda")).toMatchObject({ id: "T29", clase: "reversion" });
    expect(transicion("completo", "abonado")).toMatchObject({ id: "A2", clase: "reversion" });
    // A1: abonado vuelve a cualquiera de sus cuatro etapas previas, como reversion.
    for (const previa of PREVIAS_A_ABONADO) {
      expect(transicion("abonado", previa), `A1 hacia ${previa}`).toMatchObject({ id: "A1", clase: "reversion" });
    }
  });

  it("los destinos abonado/completo se representan cada uno explicitamente", () => {
    // T5, T13/T14, T17, T26 tienen fila propia por destino.
    expect(idDeTransicion("en_contacto", "abonado")).toBe("T5");
    expect(idDeTransicion("en_contacto", "completo")).toBe("T5");
    expect(idDeTransicion("atendido", "abonado")).toBe("T13");
    expect(idDeTransicion("atendido", "completo")).toBe("T14");
    expect(idDeTransicion("compromiso_verbal", "completo")).toBe("T17");
    expect(idDeTransicion("seguimiento", "abonado")).toBe("T26");
    expect(idDeTransicion("seguimiento", "completo")).toBe("T26");
  });
});

describe("la forma de la tabla es coherente", () => {
  it("ninguna transicion nombra una etapa que no existe en el enum", () => {
    const validas = new Set<string>(TODAS);
    for (const t of TRANSICIONES) {
      expect(validas.has(t.de), `${t.id}: de=${t.de}`).toBe(true);
      expect(validas.has(t.a), `${t.id}: a=${t.a}`).toBe(true);
    }
  });

  it("la unica self-transicion es T9 (agendado -> agendado)", () => {
    const selfs = TRANSICIONES.filter((t) => t.de === t.a);
    expect(selfs).toHaveLength(1);
    expect(selfs[0]).toMatchObject({ id: "T9", de: "agendado", a: "agendado" });
  });

  it("no hay dos filas para la misma flecha de -> a", () => {
    const vistas = new Set<string>();
    for (const t of TRANSICIONES) {
      const clave = `${t.de}->${t.a}`;
      expect(vistas.has(clave), `flecha duplicada: ${clave}`).toBe(false);
      vistas.add(clave);
    }
  });
});
