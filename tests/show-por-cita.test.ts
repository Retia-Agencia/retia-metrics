import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { armarVistaDeHoy } from "@/lib/queries/vista-hoy";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => vaciar());
afterAll(async () => cerrar());

describe("% de show por cita en Hub › Hoy", () => {
  it("se separa del % por deal y cada conteo coincide con su lista", async () => {
    const dia = "2026-10-14";
    const ahora = new Date(`${dia}T23:59:59.999-05:00`);
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tasas", nombre: "Tasas", ticketUsd: "100" }).returning();
    const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: "dos-citas@retia.co" }).returning();
    const [deal] = await db.insert(deals).values({ programId: programa.id, leadId: lead.id, etapa: "atendido" }).returning();
    // Un deal con dos citas el mismo día: por deal es 1 de 1 con show; por cita, 1 de 2.
    await db.insert(calls).values([
      { programId: programa.id, dealId: deal.id, fechaAgenda: new Date(`${dia}T09:00:00-05:00`), createdAt: new Date(`${dia}T08:00:00-05:00`), resultado: "show" },
      { programId: programa.id, dealId: deal.id, fechaAgenda: new Date(`${dia}T11:00:00-05:00`), createdAt: new Date(`${dia}T08:30:00-05:00`), resultado: "no_show" },
    ]);

    const { vista, showPorCita } = await armarVistaDeHoy({ programId: programa.id, dia, ahora }, db);
    expect(showPorCita).toMatchObject({ citasDelDia: 2, citasQueYaDebianOcurrir: 2, realizadas: 1, porcentaje: 0.5 });
    expect(vista.embudo.pctShow).toBe(1);

    const filtros = { programId: programa.id, rango: { desde: dia, hasta: dia }, hoy: dia, ahora };
    const total = async (metrica: "citas_debidas" | "shows") =>
      (await listaDeMetrica(metrica, filtros, 1, db))[0]!.filas.length;
    expect(await total("citas_debidas")).toBe(showPorCita.citasQueYaDebianOcurrir);
    expect(await total("shows")).toBe(showPorCita.realizadas);
  });

  it("una cita que todavía no llega no cuenta en el denominador", async () => {
    const dia = "2026-10-14";
    const ahora = new Date(`${dia}T10:00:00-05:00`);
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "tasas", nombre: "Tasas", ticketUsd: "100" }).returning();
    const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: "tarde@retia.co" }).returning();
    const [deal] = await db.insert(deals).values({ programId: programa.id, leadId: lead.id, etapa: "agendado" }).returning();
    await db.insert(calls).values([
      { programId: programa.id, dealId: deal.id, fechaAgenda: new Date(`${dia}T09:00:00-05:00`), resultado: "show" },
      { programId: programa.id, dealId: deal.id, fechaAgenda: new Date(`${dia}T15:00:00-05:00`) },
    ]);

    const { showPorCita } = await armarVistaDeHoy({ programId: programa.id, dia, ahora }, db);
    expect(showPorCita).toMatchObject({ citasDelDia: 2, citasQueYaDebianOcurrir: 1, realizadas: 1, porcentaje: 1 });
  });
});
