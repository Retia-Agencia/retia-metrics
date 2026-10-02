import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { deals, leads, programs } from "@/lib/db/schema";
import {
  ETAPAS, NOMBRE_DE_ETAPA, TRANSICIONES, TRANSICIONES_PENDIENTE,
  aceptaAbono, esTransicionPermitida, siguientesDe, transicion, type EtapaDeal,
} from "@/lib/deals/etapas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/** Matriz manual del ticket 142: cubre las 121 combinaciones sin derivarse del motor. */
const ESPERADAS: Readonly<Record<EtapaDeal, readonly EtapaDeal[]>> = {
  potencial: ["registrado", "calificado", "en_gestion", "agendado", "cierre_perdido"],
  registrado: ["calificado", "en_gestion", "agendado", "cierre_perdido"],
  en_gestion: ["contactado", "calificado", "agendado", "cierre_perdido"],
  contactado: ["calificado", "agendado", "compromiso_verbal", "ganado_parcial", "ganado_completo", "cierre_perdido"],
  calificado: ["agendado", "compromiso_verbal", "ganado_parcial", "ganado_completo", "cierre_perdido"],
  agendado: ["agendado", "atendido", "cierre_perdido"],
  atendido: ["agendado", "compromiso_verbal", "ganado_parcial", "ganado_completo", "cierre_perdido"],
  compromiso_verbal: ["contactado", "calificado", "atendido", "ganado_parcial", "ganado_completo", "cierre_perdido"],
  ganado_parcial: ["contactado", "calificado", "atendido", "compromiso_verbal", "ganado_completo", "cierre_perdido"],
  ganado_completo: ["ganado_parcial"],
  cierre_perdido: ["en_gestion", "agendado"],
};

describe("las once etapas", () => {
  it("son once, no se repiten y todas tienen nombre", () => {
    expect(ETAPAS).toHaveLength(11);
    expect(new Set(ETAPAS).size).toBe(11);
    for (const etapa of ETAPAS) expect(NOMBRE_DE_ETAPA[etapa]).toBeTruthy();
  });
});

describe("la tabla de transiciones", () => {
  it("recorre las 121 combinaciones: las de la tabla pasan y el resto se rechaza", () => {
    const errores: string[] = [];
    for (const de of ETAPAS) for (const a of ETAPAS) {
      const esperada = ESPERADAS[de].includes(a);
      if (esTransicionPermitida(de, a) !== esperada) errores.push(`${de} → ${a} deberia ${esperada ? "pasar" : "rechazarse"}`);
    }
    expect(errores).toEqual([]);
  });

  it("no tiene dos filas para el mismo par", () => {
    const pares = TRANSICIONES.map((t) => `${t.de}>${t.a}`);
    expect(new Set(pares).size).toBe(pares.length);
  });

  it("trae cada id del documento: S1 a S3, E1 a E13, RETRO, P, R, A1 y A2", () => {
    const ids = new Set(TRANSICIONES.map((t) => t.id));
    const esperados = ["S1", "S2", "S3", ...Array.from({ length: 13 }, (_, i) => `E${i + 1}`), "RETRO", "P", "R", "A1", "A2"];
    expect([...ids].sort()).toEqual(esperados.sort());
  });

  it("siguientesDe coincide con la tabla", () => {
    for (const de of ETAPAS) expect(new Set(siguientesDe(de))).toEqual(new Set(ESPERADAS[de]));
  });
});

describe("las reglas generales del motor", () => {
  it("acepta abonos solo donde hay una flecha de pago o ya está en Pago Parcial", () => {
    expect(aceptaAbono("en_gestion")).toBe(false);
    expect(aceptaAbono("agendado")).toBe(false);
    expect(aceptaAbono("atendido")).toBe(true);
    expect(aceptaAbono("ganado_parcial")).toBe(true);
  });

  it("Cierre Perdido es alcanzable desde las nueve abiertas y nunca desde Ganado Pagado Completo", () => {
    const hacia = ETAPAS.filter((etapa) => esTransicionPermitida(etapa, "cierre_perdido"));
    expect(new Set(hacia)).toEqual(new Set([
      "potencial", "registrado", "en_gestion", "contactado", "calificado", "agendado",
      "atendido", "compromiso_verbal", "ganado_parcial",
    ]));
    expect(esTransicionPermitida("ganado_completo", "cierre_perdido")).toBe(false);
  });

  it("un perdido se recupera solo hacia En gestión o Agendado, y con motivo", () => {
    expect(new Set(siguientesDe("cierre_perdido"))).toEqual(new Set(["en_gestion", "agendado"]));
    for (const a of siguientesDe("cierre_perdido")) expect(transicion("cierre_perdido", a)!.exigeMotivo).toBe(true);
  });

  it("a Ganado Pago Parcial y Ganado Pagado Completo solo entra el sistema", () => {
    for (const t of TRANSICIONES.filter((t) => ["ganado_parcial", "ganado_completo"].includes(t.a))) {
      expect(t.quien, `${t.id} ${t.de} → ${t.a}`).toBe("sistema");
    }
  });

  it("a Atendido entra una cita, un retroceso o la anulacion de un abono, con el actor de cada flecha", () => {
    const aAtendido = TRANSICIONES.filter((t) => t.a === "atendido");
    expect(new Set(aAtendido.map((t) => t.id))).toEqual(new Set(["E8", "RETRO", "A1"]));
    expect(aAtendido.find((t) => t.id === "E8")?.quien).toBe("ambos");
    expect(aAtendido.find((t) => t.id === "RETRO")?.quien).toBe("closer");
    expect(aAtendido.find((t) => t.id === "A1")?.quien).toBe("sistema");
  });

  it("exigen motivo exactamente Perdido, Recuperar, Retroceso y Re-agenda manual", () => {
    const todas = [...TRANSICIONES, ...TRANSICIONES_PENDIENTE];
    expect(new Set(todas.filter((t) => t.exigeMotivo).map((t) => t.id))).toEqual(new Set(["P", "R", "RETRO", "PR2"]));
  });

  it("cada flecha con lista de motivos tiene la lista correcta y las demas no declaran una", () => {
    const esperado: Record<string, string> = { P: "perdida", R: "recuperacion", RETRO: "retroceso", PR2: "reagenda" };
    const todas = [...TRANSICIONES, ...TRANSICIONES_PENDIENTE];
    for (const t of todas.filter((t) => t.exigeMotivo)) expect(t.tipoDeMotivo, t.id).toBe(esperado[t.id]);
    for (const t of todas.filter((t) => !t.exigeMotivo)) expect(t.tipoDeMotivo, t.id).toBeNull();
  });

  it("la unica flecha de etapa sobre si misma es reprogramar una cita Agendada (E7)", () => {
    expect(TRANSICIONES.filter((t) => t.de === t.a).map((t) => t.id)).toEqual(["E7"]);
  });

  it("devuelve null para un movimiento que no esta en la tabla", () => {
    expect(transicion("registrado", "ganado_completo")).toBeNull();
    expect(transicion("atendido", "atendido")).toBeNull();
  });
});

describe("la base acepta el modelo del ticket 142", () => {
  it("el enum de Postgres tiene las once etapas, y un deal puede quedar Atendido con Seguimiento", async () => {
    const { db, cerrar } = await crearBaseDePrueba();
    try {
      const filas = await db.execute<{ valor: string }>(sql`select unnest(enum_range(null::etapa_deal))::text as valor`);
      const enBase = ("rows" in filas ? filas.rows : filas) as { valor: string }[];
      expect(enBase.map((f) => f.valor).sort()).toEqual([...ETAPAS].sort());
      const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
      const [l] = await db.insert(leads).values({ programId: p.id, emailNormalizado: "a@b.co" }).returning();
      const [d] = await db.insert(deals).values({ leadId: l.id, programId: p.id, etapa: "atendido", pendiente: "seguimiento" }).returning();
      expect(d).toMatchObject({ etapa: "atendido", pendiente: "seguimiento" });
    } finally {
      await cerrar();
    }
  });
});

import "./142-nuevas-deal-etapas";
