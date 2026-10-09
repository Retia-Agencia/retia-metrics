import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  calls,
  cohorts,
  deals,
  dealEtapaHistorial,
  leads,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { tableroKanban, type CampoDeFechaDeDeal } from "@/lib/queries/kanban";
import type { FiltroDeFecha } from "@/lib/periodo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 225: el filtro de fecha del Kanban gana dos campos, "Llamada" y "Próximo
 * contacto".
 *
 * - "Llamada" trae los deals con al menos una llamada VIGENTE (cualquier resultado,
 *   no-show incluido; anulada excluida por `vigente(calls)`) cuya fecha de llamada
 *   cae en el rango de Bogotá.
 * - "Próximo contacto" filtra por `deals.fecha_seguimiento` en el rango.
 * - El programa es frontera: un deal de otro programa nunca aparece, aunque su
 *   llamada caiga en el rango.
 */

const HOY = "2026-10-20";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let otroSourceId: string;
let cohortId: string;
let anulador: string;
let leadN = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [otro] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p2", nombre: "P2", ticketUsd: "1000" })
    .returning();
  otroProgramId = otro.id;
  const [s] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();
  sourceId = s.id;
  const [s2] = await db.insert(sources).values({ programId: otroProgramId, nombre: "Typeform" }).returning();
  otroSourceId = s2.id;
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
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [u] = await db
    .insert(users)
    .values({ email: "ana@retia.co", rol: "closer", closerId: "ana", nombre: "Ana" })
    .returning();
  anulador = u.id;
});

afterEach(async () => {
  await cerrar();
});

interface OpcDeal {
  prog?: string;
  src?: string;
  etapa?: EtapaDeal;
  fechaSeguimiento?: string | null;
}

/** Un deal con su lead y envío. Devuelve el id del deal. */
async function deal(o: OpcDeal = {}): Promise<string> {
  const prog = o.prog ?? programId;
  const src = o.src ?? sourceId;
  const [l] = await db
    .insert(leads)
    .values({ programId: prog, emailNormalizado: `l${++leadN}@correo.co`, nombre: `Lead ${leadN}`, numAplicaciones: 1 })
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

/** Una llamada colgada de un deal, con su fecha (día de Bogotá) y resultado. */
async function llamada(dealId: string, dia: string, resultado: "agendada" | "no_show" | "show", anulada = false): Promise<void> {
  await db.insert(calls).values({
    dealId,
    programId,
    fechaLlamada: new Date(`${dia}T12:00:00-05:00`),
    resultado,
    ...(anulada ? { anuladoEn: new Date(), anuladoPor: anulador, motivoAnulacion: "error de tecleo" } : {}),
  });
}

/** El filtro de fecha ya resuelto: campo + el rango A (sin B, como una lista). */
function filtro(campo: CampoDeFechaDeDeal, desde: string, hasta: string): FiltroDeFecha<CampoDeFechaDeDeal> {
  return { campo, periodo: { preset: "custom", a: { desde, hasta }, b: null } };
}

function idsDe(tablero: Awaited<ReturnType<typeof tableroKanban>>): Set<string> {
  return new Set(tablero.columnas.flatMap((c) => c.tarjetas.map((t) => t.dealId)));
}

const AYER = "2026-10-19";

describe("filtro por fecha de llamada", () => {
  it('"Llamada · ayer" trae los deals con llamada ayer, incluido un no-show, y no las anuladas', async () => {
    const conCita = await deal();
    await llamada(conCita, AYER, "agendada");

    const conNoShow = await deal();
    await llamada(conNoShow, AYER, "no_show");

    const soloAnulada = await deal();
    await llamada(soloAnulada, AYER, "show", true);

    const fueraDeRango = await deal();
    await llamada(fueraDeRango, "2026-10-10", "show");

    const sinLlamada = await deal();

    const tablero = await tableroKanban(
      db,
      programId,
      { tipo: "todos" },
      { fecha: filtro("llamada", AYER, AYER) },
      HOY,
    );
    const ids = idsDe(tablero);
    expect(ids).toContain(conCita);
    expect(ids).toContain(conNoShow);
    expect(ids).not.toContain(soloAnulada);
    expect(ids).not.toContain(fueraDeRango);
    expect(ids).not.toContain(sinLlamada);
    expect(tablero.total).toBe(2);
  });

  it("un deal de otro programa con llamada en el rango nunca aparece", async () => {
    const propio = await deal();
    await llamada(propio, AYER, "show");

    const ajeno = await deal({ prog: otroProgramId, src: otroSourceId });
    // La llamada se cuelga del deal ajeno, con el programId del otro programa.
    await db
      .insert(calls)
      .values({ dealId: ajeno, programId: otroProgramId, fechaLlamada: new Date(`${AYER}T12:00:00-05:00`), resultado: "show" });

    const tablero = await tableroKanban(
      db,
      programId,
      { tipo: "todos" },
      { fecha: filtro("llamada", AYER, AYER) },
      HOY,
    );
    const ids = idsDe(tablero);
    expect(ids).toContain(propio);
    expect(ids).not.toContain(ajeno);
    expect(tablero.total).toBe(1);
  });
});

describe("filtro por fecha de próximo contacto", () => {
  it('"Próximo contacto · esta semana" trae los seguimientos de la semana y no los de fuera', async () => {
    const lunes = await deal({ fechaSeguimiento: "2026-10-19" });
    const viernes = await deal({ fechaSeguimiento: "2026-10-23" });
    const semanaPasada = await deal({ fechaSeguimiento: "2026-10-16" });
    const semanaQueViene = await deal({ fechaSeguimiento: "2026-10-26" });
    const sinSeguimiento = await deal({ fechaSeguimiento: null });

    const tablero = await tableroKanban(
      db,
      programId,
      { tipo: "todos" },
      { fecha: filtro("seguimiento", "2026-10-19", "2026-10-23") },
      HOY,
    );
    const ids = idsDe(tablero);
    expect(ids).toContain(lunes);
    expect(ids).toContain(viernes);
    expect(ids).not.toContain(semanaPasada);
    expect(ids).not.toContain(semanaQueViene);
    expect(ids).not.toContain(sinSeguimiento);
    expect(tablero.total).toBe(2);
  });
});
