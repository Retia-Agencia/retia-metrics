import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deals, dealEtapaHistorial, gastoPauta, leads, programs, sources, submissions, tasasCambio } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => vaciar());
afterAll(async () => cerrar());

describe("paridad del gasto", () => {
  it("ROAS y semáforo comparten conversión y el costo expone la ventana incompleta", async () => {
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA, slug: "gasto-paridad", nombre: "Paridad", ticketUsd: "1000",
    }).returning();
    const [fuente] = await db.insert(sources).values({ programId: programa.id, nombre: "Formulario" }).returning();
    const [lead] = await db.insert(leads).values({
      programId: programa.id, emailNormalizado: "paridad@test.co", nombre: "Paridad",
    }).returning();
    const [envio] = await db.insert(submissions).values({
      sourceId: fuente.id, leadId: lead.id, token: "paridad", esParcial: false,
      fechaEnvio: new Date("2026-10-02T10:00:00-05:00"), utmSource: "facebook", utmMedium: "cpc",
    }).returning();
    const [deal] = await db.insert(deals).values({
      programId: programa.id, leadId: lead.id, submissionOrigenId: envio.id,
      etapa: "ganado_completo", valorVendidoUsd: "300",
    }).returning();
    await db.insert(dealEtapaHistorial).values({
      dealId: deal.id, a: "ganado_completo", fecha: new Date("2026-10-02T12:00:00-05:00"),
    });
    await db.insert(tasasCambio).values({
      vigenteDesde: "2026-10-02", vigenteHasta: "2026-10-02", pesosPorDolar: "4000", fuente: "prueba",
    });
    await db.insert(gastoPauta).values([
      { programId: programa.id, fecha: "2026-10-02", monto: "400000", moneda: "COP", origen: "manual", area: "paid", agendasMeta: 2 },
      { programId: programa.id, fecha: "2026-10-02", monto: "25", moneda: "USD", origen: "manual", area: "paid", agendasMeta: 1 },
    ]);

    const [roas, semaforo, incompleto] = await Promise.all([
      cargarRoasDePauta(db, programa.id, { desde: "2026-10-02", hasta: "2026-10-02" }, "2026-10-02"),
      costoPorAgendaDeVentana(db, { programId: programa.id, desde: "2026-10-02", hasta: "2026-10-02" }),
      costoPorAgendaDeVentana(db, { programId: programa.id, desde: "2026-10-01", hasta: "2026-10-02" }),
    ]);

    expect(semaforo.gastoTotal / 4000).toBe(roas.total.gastoUsd);
    expect(incompleto.costo).toBeNull();
    expect(incompleto.costoCobertura.faltan).toBeGreaterThan(0);
  });
});
