import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  grupoDePendiente,
  pendientesDelCloserEnPrograma,
  TIPOS_DE_PENDIENTE,
} from "@/lib/mi-espacio/pendientes";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("registro y grupos de pendientes de Mi día", () => {
  it("conserva el orden, las etiquetas y qué tipos avisan a Juanito", () => {
    expect(TIPOS_DE_PENDIENTE.map(({ tipo, etiqueta, avisaJuanito }) => ({ tipo, etiqueta, avisaJuanito }))).toEqual([
      { tipo: "sin_resultado", etiqueta: "Sin resultado", avisaJuanito: true },
      { tipo: "sin_comprobante", etiqueta: "Sin comprobante", avisaJuanito: true },
      { tipo: "sin_grain", etiqueta: "Sin Grain", avisaJuanito: true },
      { tipo: "vencidos", etiqueta: "Vencido", avisaJuanito: true },
      { tipo: "reagenda", etiqueta: "Por reagendar", avisaJuanito: true },
      { tipo: "nuevos", etiqueta: "Nuevo", avisaJuanito: true },
      { tipo: "seguimiento", etiqueta: "Seguimiento", avisaJuanito: false },
      { tipo: "calendly", etiqueta: "Cambio en Calendly", avisaJuanito: false },
    ]);
  });

  it("asigna vencido, hoy y próximo con el día de Bogotá", () => {
    expect(grupoDePendiente(new Date("2026-11-24T23:30:00-05:00"), "2026-11-25")).toBe("vencido");
    expect(grupoDePendiente("2026-11-25", "2026-11-25")).toBe("hoy");
    expect(grupoDePendiente("2026-11-26", "2026-11-25")).toBe("proximo");
    expect(grupoDePendiente(null, "2026-11-25")).toBe("hoy");
  });
});

describe("ventana de seguimiento de Mi día", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let userId: string;
  let secuencia = 0;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  afterAll(async () => cerrar());

  beforeEach(async () => {
    await vaciar();
    secuencia = 0;
    programId = (await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "pendientes-mi-dia",
      nombre: "Pendientes Mi día",
      ticketUsd: "1000",
    }).returning())[0].id;
    userId = (await db.insert(users).values({ email: "pendientes@retia.test", rol: "closer" }).returning())[0].id;
  });

  async function seguimiento(fechaSeguimiento: string): Promise<string> {
    secuencia += 1;
    const lead = (await db.insert(leads).values({
      programId,
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
      emailNormalizado: `pendiente-${secuencia}@retia.test`,
      nombre: `Pendiente ${secuencia}`,
    }).returning())[0];
    const deal = (await db.insert(deals).values({
      programId,
      leadId: lead.id,
      ownerUserId: userId,
      etapa: "atendido",
      pendiente: "seguimiento",
      fechaSeguimiento,
    }).returning())[0];
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id,
      de: null,
      a: "atendido",
      fecha: new Date("2026-11-25T09:00:00-05:00"),
    });
    return deal.id;
  }

  it("incluye seguimiento hasta dia+6 y excluye el día siguiente", async () => {
    const limite = await seguimiento("2026-12-01");
    const fuera = await seguimiento("2026-12-02");
    const resultado = await pendientesDelCloserEnPrograma(db, {
      programId,
      userId,
      dia: "2026-11-25",
      ahora: new Date("2026-11-25T12:00:00-05:00"),
    });
    const ids = resultado.filas.filter((fila) => fila.tipo === "seguimiento").map((fila) => fila.dealId);
    expect(ids).toContain(limite);
    expect(ids).not.toContain(fuera);
  });
});
