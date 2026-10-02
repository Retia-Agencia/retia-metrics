import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { deals, leads, programs } from "@/lib/db/schema";
import {
  ETAPAS,
  NOMBRE_DE_ETAPA,
  NUMERO_DE_ETAPA,
  TRANSICIONES,
  esTransicionPermitida,
  siguientesDe,
  transicion,
  type EtapaDeal,
} from "@/lib/deals/etapas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 043 — las once etapas y la tabla de transiciones (`docs/structure.md`
 * §3.1, adoptada el 24-sep).
 *
 * La matriz esperada de abajo esta escrita A MANO, con los numeros que usa
 * Comercial, copiando la tabla del documento: no se deriva de `TRANSICIONES`. Si
 * alguien toca una fila del codigo sin tocar el documento (o al reves), este test
 * es el que lo dice. Recorre las 121 combinaciones: las que estan pasan, las que
 * no estan se rechazan.
 */
const ESPERADAS: Record<number, number[]> = {
  1: [2, 4, 10], // T1, T2, P
  2: [4, 6, 7, 8, 9, 10], // T3, T4, T5, T19, P
  3: [4, 5, 10], // T6, T7, P
  4: [3, 4, 5, 10], // T8, T9, T10, P
  5: [3, 6, 7, 8, 9, 10, 11], // T29, T12, T13, T14, T20, P, T24
  6: [7, 8, 9, 10, 11], // T16, T17, T21, P, T15
  7: [2, 5, 6, 8, 10, 11], // A1 (etapa previa), T18, P
  8: [7], // A2: Completo es terminal salvo por la anulacion de un abono
  9: [2, 4, 10], // T22, T23, P
  10: [2, 4, 9], // R
  11: [4, 6, 7, 8, 9, 10], // T27, T25, T26, T28, P
};

const porNumero = new Map(ETAPAS.map((e) => [NUMERO_DE_ETAPA[e], e] as const));
const etapa = (n: number): EtapaDeal => porNumero.get(n)!;

describe("las once etapas", () => {
  it("son once, con numeros del 1 al 11 sin repetir, y todas tienen nombre", () => {
    expect(ETAPAS).toHaveLength(11);
    expect([...porNumero.keys()].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const e of ETAPAS) expect(NOMBRE_DE_ETAPA[e]).toBeTruthy();
    expect(etapa(11)).toBe("seguimiento");
  });
});

describe("la tabla de transiciones", () => {
  it("recorre las 121 combinaciones: las de la tabla pasan y el resto se rechaza", () => {
    const errores: string[] = [];
    for (let de = 1; de <= 11; de++) {
      for (let a = 1; a <= 11; a++) {
        const esperada = ESPERADAS[de].includes(a);
        if (esTransicionPermitida(etapa(de), etapa(a)) !== esperada) {
          errores.push(`${de} → ${a} deberia ${esperada ? "pasar" : "rechazarse"}`);
        }
      }
    }
    expect(errores).toEqual([]);
  });

  it("no tiene dos filas para el mismo par", () => {
    const pares = TRANSICIONES.map((t) => `${t.de}>${t.a}`);
    expect(new Set(pares).size).toBe(pares.length);
  });

  it("trae cada id del documento: T1 a T29 sin la T11, mas P, R, A1 y A2", () => {
    const ids = new Set(TRANSICIONES.map((t) => t.id));
    const esperados = [
      ...Array.from({ length: 29 }, (_, i) => `T${i + 1}`).filter((id) => id !== "T11"),
      "P",
      "R",
      "A1",
      "A2",
    ];
    expect([...ids].sort()).toEqual(esperados.sort());
  });

  it("siguientesDe coincide con la tabla", () => {
    for (let de = 1; de <= 11; de++) {
      expect(siguientesDe(etapa(de)).map((e) => NUMERO_DE_ETAPA[e]).sort((a, b) => a - b)).toEqual(ESPERADAS[de]);
    }
  });
});

describe("las reglas generales del ADR 0037", () => {
  it("Cierre Perdido es alcanzable desde las nueve abiertas y nunca desde Completo", () => {
    const hacia = ETAPAS.filter((e) => esTransicionPermitida(e, "cierre_perdido"));
    expect(hacia.map((e) => NUMERO_DE_ETAPA[e]).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 9, 11]);
    expect(esTransicionPermitida("completo", "cierre_perdido")).toBe(false);
  });

  it("un perdido se recupera solo hacia En Contacto, Agendado o Proxima Cohorte, y con motivo", () => {
    expect(siguientesDe("cierre_perdido")).toEqual(["en_contacto", "agendado", "proxima_cohorte"]);
    for (const a of siguientesDe("cierre_perdido")) expect(transicion("cierre_perdido", a)!.exigeMotivo).toBe(true);
  });

  it("a Abonado y Completo solo entra el sistema: un evento, no una mano", () => {
    for (const t of TRANSICIONES.filter((t) => ["abonado", "completo"].includes(t.a))) {
      expect(t.quien, `${t.id} ${t.de} → ${t.a}`).toBe("sistema");
    }
  });

  it("a Atendido entra el sistema al pegar el Grain o el closer sin el (ADR 0066), y nunca solo una mano", () => {
    const aAtendido = TRANSICIONES.filter((t) => t.a === "atendido");
    expect(aAtendido.map((t) => t.id).sort()).toEqual(["A1", "T10", "T7"]);
    for (const t of aAtendido.filter((t) => t.id !== "A1")) {
      expect(t.quien, `${t.id} ${t.de} → ${t.a}`).toBe("ambos");
    }
  });

  it("exigen motivo exactamente Perdido, Recuperar y los retrocesos (las anulaciones llevan el suyo en el abono)", () => {
    const conMotivo = new Set(TRANSICIONES.filter((t) => t.exigeMotivo).map((t) => t.id));
    expect([...conMotivo].sort()).toEqual(["P", "R", "T15", "T29"].sort());
  });

  it("cada flecha con lista de motivos (tipoDeMotivo) tiene su lista, y coincide con la decision de Mani (punto 2)", () => {
    // La flecha decide la lista: P pierde, T29 re-agenda, T15 se echa atras, R recupera.
    // Las anulaciones (A1, A2) no piden motivo del catalogo: su motivo es el de la anulacion
    // del abono (ADR 0026), que ya es obligatorio (Mani, 28-sep).
    const esperado: Record<string, string | null> = {
      P: "perdida",
      T29: "reagenda",
      T15: "retroceso",
      R: "recuperacion",
    };
    for (const t of TRANSICIONES.filter((t) => t.exigeMotivo)) {
      expect(t.tipoDeMotivo, `${t.id}`).toBe(esperado[t.id]);
    }
    // Y ninguna flecha SIN motivo declara una lista.
    for (const t of TRANSICIONES.filter((t) => !t.exigeMotivo)) {
      expect(t.tipoDeMotivo, `${t.id}`).toBeNull();
    }
  });

  it("la unica flecha sobre si misma es mover una cita de Agendado (T9)", () => {
    const bucles = TRANSICIONES.filter((t) => t.de === t.a);
    expect(bucles.map((t) => t.id)).toEqual(["T9"]);
  });

  it("devuelve null para un movimiento que no esta en la tabla", () => {
    expect(transicion("pendiente_setteo", "completo")).toBeNull();
    expect(transicion("atendido", "seguimiento")).toMatchObject({ id: "T24", quien: "closer" });
  });
});

describe("la base acepta la etapa nueva (migracion 0024)", () => {
  it("el enum de Postgres tiene las once, y un deal puede quedar en Seguimiento", async () => {
    const { db, cerrar } = await crearBaseDePrueba();
    try {
      const filas = await db.execute<{ valor: string }>(
        sql`select unnest(enum_range(null::etapa_deal))::text as valor`,
      );
      const enBase = ("rows" in filas ? filas.rows : filas) as { valor: string }[];
      expect(enBase.map((f) => f.valor).sort()).toEqual([...ETAPAS].sort());

      const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
      const [l] = await db
        .insert(leads)
        .values({ programId: p.id, emailNormalizado: "a@b.co" })
        .returning();
      const [d] = await db
        .insert(deals)
        .values({ leadId: l.id, programId: p.id, etapa: "seguimiento" })
        .returning();
      expect(d.etapa).toBe("seguimiento");
    } finally {
      await cerrar();
    }
  });
});
