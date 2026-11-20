import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  calls,
  cohorts,
  deals,
  dealEtapaHistorial,
  leads,
  programs,
  sources,
  submissions,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { tableroKanban } from "@/lib/queries/kanban";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/** Ticket 364: la proyeccion de la tarjeta del Kanban trae el link y el origen de la cita activa. */

const HOY = "2026-10-20";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let sourceId: string;
let cohortId: string;
let leadN = 0;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [s] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  sourceId = s.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-11-15",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-11-14",
    })
    .returning();
  cohortId = c.id;
});

afterAll(async () => {
  await cerrar();
});

interface OpcDeal {
  etapa?: EtapaDeal;
  fechaSeguimiento?: string | null;
}

/** Un deal con su lead y envío. Devuelve el id del deal. */
async function deal(o: OpcDeal = {}): Promise<string> {
  const prog = programId;
  const src = sourceId;
  const [l] = await db
    .insert(leads)
    .values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId: prog, emailNormalizado: `l${++leadN}@correo.co`, nombre: `Lead ${leadN}`, numAplicaciones: 1 })
    .returning();
  const [env] = await db
    .insert(submissions)
    .values({ leadId: l.id, sourceId: src, token: `t${leadN}`, utmSource: "meta", utmMedium: "cpc" })
    .returning();
  const etapa = o.etapa ?? "contactado";
  const [d] = await db
    .insert(deals)
    .values({
      leadId: l.id,
      submissionOrigenId: env.id,
      programId: prog,
      cohortId: prog === programId ? cohortId : null,
      etapa,
      ownerUserId: null,
      valorVendidoUsd: "1000.00",
      fechaSeguimiento: o.fechaSeguimiento ?? null,
    })
    .returning();
  await db
    .insert(dealEtapaHistorial)
    .values({ dealId: d.id, de: null, a: etapa, fecha: new Date(`${HOY}T12:00:00-05:00`) });
  return d.id;
}


/** Una cita agendada y vigente colgada de un deal. */
async function citaActiva(dealId: string, origen: "calendly" | "crm", linkCalendly: string | null): Promise<void> {
  await db.insert(calls).values({
    dealId,
    programId,
    fechaAgenda: new Date("2026-10-22T15:00:00-05:00"),
    resultado: "agendada",
    origen,
    linkCalendly,
  });
}

function tarjetaDe(tablero: Awaited<ReturnType<typeof tableroKanban>>, dealId: string) {
  const tarjeta = tablero.columnas.flatMap((c) => c.tarjetas).find((t) => t.dealId === dealId);
  if (!tarjeta) throw new Error("la tarjeta no esta en el tablero");
  return tarjeta;
}

describe("ticket 364: la tarjeta del Kanban trae el link y el origen de la cita activa", () => {
  it("con y sin link, de Calendly y manual, y nada si no hay cita", async () => {
    const calendlyConLink = await deal({ etapa: "agendado" });
    await citaActiva(calendlyConLink, "calendly", "https://calendly.com/d/abc/invitees/uuid-1");
    const manualConLink = await deal({ etapa: "agendado" });
    await citaActiva(manualConLink, "crm", "https://meet.google.com/abc-defg-hij");
    const manualSinLink = await deal({ etapa: "agendado" });
    await citaActiva(manualSinLink, "crm", null);
    const sinCita = await deal({ etapa: "agendado" });

    const tablero = await tableroKanban(db, programId, { tipo: "todos" }, {}, HOY);

    expect(tarjetaDe(tablero, calendlyConLink).llamada).toMatchObject({
      linkCalendly: "https://calendly.com/d/abc/invitees/uuid-1",
      origen: "calendly",
    });
    expect(tarjetaDe(tablero, manualConLink).llamada).toMatchObject({
      linkCalendly: "https://meet.google.com/abc-defg-hij",
      origen: "crm",
    });
    expect(tarjetaDe(tablero, manualSinLink).llamada).toMatchObject({ linkCalendly: null, origen: "crm" });
    expect(tarjetaDe(tablero, sinCita).llamada).toBeNull();
  });
});
