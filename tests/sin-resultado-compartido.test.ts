import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { inboxDelPrograma } from "@/lib/queries/inbox";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("ticket 148: Inbox y dashboard comparten las llamadas pasadas sin resultado", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "sin-resultado", nombre: "Sin resultado", ticketUsd: "100" }).returning();
    programId = programa.id;
  }, 60_000);
  afterEach(async () => cerrar());

  it("devuelve los mismos call ids para el mismo programa y momento", async () => {
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "sin-resultado@retia.co" }).returning();
    const [deal] = await db.insert(deals).values({ programId, leadId: lead.id }).returning();
    const ahora = new Date("2026-10-04T12:00:00-05:00");
    await db.insert(calls).values([
      { programId, dealId: deal.id, fechaAgenda: new Date("2026-10-04T10:00:00-05:00"), resultado: "agendada" },
      { programId, dealId: deal.id, fechaAgenda: new Date("2026-10-04T14:00:00-05:00"), resultado: "agendada" },
      { programId, dealId: deal.id, fechaAgenda: new Date("2026-10-04T09:00:00-05:00"), resultado: "show" },
    ]);

    const inbox = await inboxDelPrograma(db, programId, "equipo", "2026-10-04", ahora);
    const [dashboard] = await listaDeMetrica("sin_resultado", {
      programId,
      rango: { desde: "2026-10-04", hasta: "2026-10-04" },
      hoy: "2026-10-04",
      ahora,
    }, 1, db);

    expect(dashboard.filas.map((fila) => fila.id)).toEqual(inbox.llamadasDeHoy.map((fila) => fila.callId));
  });
});
