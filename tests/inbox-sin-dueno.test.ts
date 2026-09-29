import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 070, parte C: `seccionesSinDueno`. Las dos listas por las que un deal consigue
 * dueño, con su orden y su frontera de programa:
 *  - Pendiente Setteo: por score desc, sin score al final, luego envío más reciente.
 *  - Unclaimed (Agendados sin dueño): por antigüedad, lo más viejo primero.
 * Un deal con dueño, uno anulado, o de otro programa, nunca aparece.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let cohortId: string;
let closer: string;
let leadN = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [p2] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "800" }).returning();
  otroProgramId = p2.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

/** Crea un lead con su deal. Devuelve el id del deal. */
async function crear(o: {
  etapa: EtapaDeal;
  programa?: string;
  puntaje?: number | null;
  fecha?: string | null;
  owner?: string | null;
  anulado?: boolean;
  createdAt?: Date;
}): Promise<string> {
  const prog = o.programa ?? programId;
  const [l] = await db
    .insert(leads)
    .values({
      programId: prog,
      emailNormalizado: `lead${++leadN}@correo.co`,
      nombre: `Lead ${leadN}`,
      puntaje: o.puntaje ?? null,
      fechaUltimaAplicacion: o.fecha == null ? null : new Date(o.fecha),
      utmSource: "facebook",
      utmMedium: "cpc",
      utmCampaign: "camp",
    })
    .returning();
  const marca = o.anulado
    ? { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error de tecleo" }
    : {};
  const [d] = await db
    .insert(deals)
    .values({
      leadId: l.id,
      programId: prog,
      cohortId: prog === programId ? cohortId : null,
      etapa: o.etapa,
      ownerUserId: o.owner ?? null,
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
      ...marca,
    })
    .returning();
  return d.id;
}

describe("seccionesSinDueno — Pendiente Setteo", () => {
  it("ordena por score desc; sin score al final; a igual banda, el envío más reciente primero", async () => {
    const bajo = await crear({ etapa: "pendiente_setteo", puntaje: 10, fecha: "2026-09-10T15:00:00Z" });
    const altoViejo = await crear({ etapa: "pendiente_setteo", puntaje: 90, fecha: "2026-09-01T15:00:00Z" });
    const altoNuevo = await crear({ etapa: "pendiente_setteo", puntaje: 90, fecha: "2026-09-20T15:00:00Z" });
    const sinScore = await crear({ etapa: "pendiente_setteo", puntaje: null, fecha: "2026-09-25T15:00:00Z" });

    const { pendienteSetteo } = await seccionesSinDueno(db, programId);
    // 90 nuevo, 90 viejo, 10, luego el sin score (aunque sea el más reciente de todos).
    expect(pendienteSetteo.map((f) => f.dealId)).toEqual([altoNuevo, altoViejo, bajo, sinScore]);
    expect(pendienteSetteo.at(-1)?.puntaje).toBeNull();
  });

  it("el origen viaja tal cual (UTM sin normalizar) y traidoPorNombre es null (086 aún no existe)", async () => {
    const dealId = await crear({ etapa: "pendiente_setteo", puntaje: 5 });
    const { pendienteSetteo } = await seccionesSinDueno(db, programId);
    const fila = pendienteSetteo.find((f) => f.dealId === dealId)!;
    expect(fila.origen).toMatchObject({ utmSource: "facebook", utmMedium: "cpc", utmCampaign: "camp", traidoPorNombre: null });
  });

  it("un deal con dueño, uno anulado, y uno de otro programa no aparecen", async () => {
    const sinDueno = await crear({ etapa: "pendiente_setteo", puntaje: 50 });
    await crear({ etapa: "pendiente_setteo", puntaje: 99, owner: closer });
    await crear({ etapa: "pendiente_setteo", puntaje: 99, anulado: true });
    await crear({ etapa: "pendiente_setteo", puntaje: 99, programa: otroProgramId });

    const { pendienteSetteo } = await seccionesSinDueno(db, programId);
    expect(pendienteSetteo.map((f) => f.dealId)).toEqual([sinDueno]);
  });

  it("una etapa distinta de pendiente_setteo no cae en esta sección", async () => {
    await crear({ etapa: "atendido", puntaje: 99 });
    const { pendienteSetteo } = await seccionesSinDueno(db, programId);
    expect(pendienteSetteo).toHaveLength(0);
  });
});

describe("seccionesSinDueno — Unclaimed (Agendados sin dueño)", () => {
  it("ordena por antigüedad: lo más viejo primero", async () => {
    const nuevo = await crear({ etapa: "agendado", createdAt: new Date("2026-09-20T10:00:00Z") });
    const viejo = await crear({ etapa: "agendado", createdAt: new Date("2026-09-01T10:00:00Z") });
    const medio = await crear({ etapa: "agendado", createdAt: new Date("2026-09-10T10:00:00Z") });

    const { unclaimed } = await seccionesSinDueno(db, programId);
    expect(unclaimed.map((f) => f.dealId)).toEqual([viejo, medio, nuevo]);
  });

  it("solo Agendados SIN dueño, vigentes, del programa", async () => {
    const sinDueno = await crear({ etapa: "agendado" });
    await crear({ etapa: "agendado", owner: closer });
    await crear({ etapa: "agendado", anulado: true });
    await crear({ etapa: "agendado", programa: otroProgramId });

    const { unclaimed } = await seccionesSinDueno(db, programId);
    expect(unclaimed.map((f) => f.dealId)).toEqual([sinDueno]);
  });

  it("un Pendiente Setteo no cae en Unclaimed, y al revés", async () => {
    const setteo = await crear({ etapa: "pendiente_setteo", puntaje: 1 });
    const agendado = await crear({ etapa: "agendado" });
    const { pendienteSetteo, unclaimed } = await seccionesSinDueno(db, programId);
    expect(pendienteSetteo.map((f) => f.dealId)).toEqual([setteo]);
    expect(unclaimed.map((f) => f.dealId)).toEqual([agendado]);
  });
});
