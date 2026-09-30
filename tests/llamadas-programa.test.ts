import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { llamadasDelPrograma, opcionesDeLlamadas } from "@/lib/queries/llamadas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closer: string;
let otroCloser: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "calls", nombre: "Calls", ticketUsd: "1000" }).returning();
  programId = programa.id;
  const [ana] = await db.insert(users).values({ email: "ana@retiagrowth.com", rol: "closer", nombre: "Ana" }).returning();
  const [beto] = await db.insert(users).values({ email: "beto@retiagrowth.com", rol: "closer", nombre: "Beto" }).returning();
  closer = ana.id;
  otroCloser = beto.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId, codigo: "C1", metaCupos: 10, precioUsd: "1000",
    fechaInicioClases: "2026-11-01", fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-10-30", estado: "activo",
  }).returning();
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "lead@correo.co", nombre: "Lead" }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, cohortId: cohorte.id, etapa: "agendado", ownerUserId: closer }).returning();
  await db.insert(calls).values([
    { programId, dealId: deal.id, cohortId: cohorte.id, closerUserId: closer, emailLead: lead.emailNormalizado, resultado: "show", fechaAgenda: new Date("2026-09-28T15:00:00-05:00") },
    { programId, dealId: null, origen: "calendly", emailLead: "suelta@correo.co", resultado: "agendada", fechaAgenda: new Date("2026-09-29T15:00:00-05:00") },
    { programId, dealId: null, emailLead: "otra@correo.co", closerUserId: otroCloser, resultado: "cancelada", fechaAgenda: new Date("2026-09-27T15:00:00-05:00") },
  ]);
});

afterEach(async () => { await cerrar(); });

describe("llamadasDelPrograma", () => {
  it("incluye las sueltas y acota por resultado y closer", async () => {
    const todas = await llamadasDelPrograma(db, programId);
    expect(todas).toHaveLength(3);
    expect(todas.filter((c) => c.dealId == null)).toHaveLength(2);
    // Se asigna a mano solo la de Calendly; la otra (origen de la hoja) no (078; Mani, 30-sep).
    expect(todas.filter((c) => c.porAsignar).map((c) => c.leadEmail)).toEqual(["suelta@correo.co"]);

    const filtradas = await llamadasDelPrograma(db, programId, { closerUserId: otroCloser, resultado: "cancelada" });
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0].leadEmail).toBe("otra@correo.co");
  });

  it("filtra el día de Bogotá, no la zona de la máquina", async () => {
    const filtradas = await llamadasDelPrograma(db, programId, { desde: "2026-09-29", hasta: "2026-09-29" });
    expect(filtradas.map((c) => c.leadEmail)).toEqual(["suelta@correo.co"]);
  });

  it("ofrece también al closer que solo tiene llamadas sueltas", async () => {
    const opciones = await opcionesDeLlamadas(db, programId);
    expect(opciones.closers).toEqual([
      { id: closer, nombre: "Ana" },
      { id: otroCloser, nombre: "Beto" },
    ]);
  });
});
