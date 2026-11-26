import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { confirmadaAntesDeLaCitaSql } from "@/lib/deals/confirmacion-de-cita";
import { vigente } from "@/lib/queries/vigente";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/** Este archivo necesita PGlite: prueba el valor booleano que PostgreSQL produce para el predicado SQL. */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => vaciar());
afterAll(async () => cerrar());

describe("confirmación oportuna de una cita", () => {
  // Falla si el predicado SQL trata mal los nulos, los estados distintos o el borde temporal de la confirmación.
  it("decide bien los cuatro estados que cambian la métrica", async () => {
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "confirmacion-paridad", nombre: "Confirmación paridad", ticketUsd: "100" }).returning();
    const [lead] = await db.insert(leads).values({
      programId: programa.id,
      emailNormalizado: "confirmacion-paridad@retia.co",
      fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    }).returning();
    const [deal] = await db.insert(deals).values({ programId: programa.id, leadId: lead.id, etapa: "atendido" }).returning();
    const hora = new Date("2026-11-26T10:00:00-05:00");
    const antes = new Date("2026-11-26T09:59:00-05:00");
    const despues = new Date("2026-11-26T10:01:00-05:00");
    const sembradas = await db.insert(calls).values([
      { programId: programa.id, dealId: deal.id, fechaAgenda: hora, resultado: "show", confirmacion: null, confirmacionEn: null },
      { programId: programa.id, dealId: deal.id, fechaAgenda: hora, resultado: "show", confirmacion: "confirmada", confirmacionEn: antes },
      { programId: programa.id, dealId: deal.id, fechaAgenda: hora, resultado: "show", confirmacion: "confirmada", confirmacionEn: despues },
      { programId: programa.id, dealId: deal.id, fechaAgenda: hora, resultado: "show", confirmacion: "no_confirmada", confirmacionEn: antes },
    ]).returning();
    const esperado = new Map([
      [sembradas[0].id, false],
      [sembradas[1].id, true],
      [sembradas[2].id, false],
      [sembradas[3].id, false],
    ]);

    const filas = await db.select({
      id: calls.id,
      valorSql: confirmadaAntesDeLaCitaSql(),
    }).from(calls).where(vigente(calls));

    expect(filas).toHaveLength(4);
    for (const fila of filas) expect(fila.valorSql).toBe(esperado.get(fila.id));
  });
});
