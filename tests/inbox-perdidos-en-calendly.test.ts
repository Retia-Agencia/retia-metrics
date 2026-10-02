import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { perdidosEnCalendly } from "@/lib/queries/inbox";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const AHORA = new Date("2026-10-02T15:00:00.000Z");

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let otraSourceId: string;
let ownerId: string;
let n = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  const [otro] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "800" })
    .returning();
  programId = programa.id;
  otroProgramId = otro.id;
  const [fuente] = await db.insert(sources).values({ programId, nombre: "Typeform", activo: true }).returning();
  const [otraFuente] = await db.insert(sources).values({ programId, nombre: "Calendly", activo: true }).returning();
  sourceId = fuente.id;
  otraSourceId = otraFuente.id;
  const [owner] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  ownerId = owner.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function crear(o: {
  minutos?: number;
  programa?: string;
  etapa?: EtapaDeal;
  owner?: string | null;
  parcial?: boolean;
  anulado?: boolean;
  token?: string;
} = {}) {
  const numero = ++n;
  const programa = o.programa ?? programId;
  const token = o.token ?? `token-${numero}`;
  const [lead] = await db
    .insert(leads)
    .values({ programId: programa, emailNormalizado: `lead${numero}@correo.co`, nombre: `Lead ${numero}` })
    .returning();
  const [envio] = await db
    .insert(submissions)
    .values({
      leadId: lead.id,
      sourceId,
      token,
      esParcial: o.parcial ?? true,
      fechaEnvio: new Date(AHORA.getTime() - (o.minutos ?? 6) * 60_000),
      utmSource: "facebook",
      utmMedium: "paid_social",
      utmCampaign: "octubre",
    })
    .returning();
  const anulacion = o.anulado
    ? { anuladoEn: AHORA, anuladoPor: ownerId, motivoAnulacion: "error de tecleo" }
    : {};
  const [deal] = await db
    .insert(deals)
    .values({
      leadId: lead.id,
      programId: programa,
      submissionOrigenId: envio.id,
      ownerUserId: o.owner ?? null,
      etapa: o.etapa ?? "calificado",
      ...anulacion,
    })
    .returning();
  return { dealId: deal.id, token };
}

async function completar(token: string, fuente: string = sourceId) {
  await db.insert(submissions).values({ sourceId: fuente, token, esParcial: false, fechaEnvio: AHORA });
}

describe("perdidosEnCalendly", () => {
  it("incluye un parcial de hace 6 minutos con sus minutos y origen", async () => {
    const { dealId } = await crear();
    const filas = await perdidosEnCalendly(db, programId, AHORA);
    expect(filas).toEqual([
      expect.objectContaining({
        dealId,
        minutos: 6,
        origen: { utmSource: "facebook", utmMedium: "paid_social", utmCampaign: "octubre", traidoPorNombre: null },
      }),
    ]);
  });

  it("excluye un parcial de hace 2 minutos", async () => {
    await crear({ minutos: 2 });
    expect(await perdidosEnCalendly(db, programId, AHORA)).toEqual([]);
  });

  it("excluye cuando llego el completo de la misma fuente y token", async () => {
    const { token } = await crear();
    await completar(token);
    expect(await perdidosEnCalendly(db, programId, AHORA)).toEqual([]);
  });

  it("no confunde un completo con el mismo token de otra fuente", async () => {
    const { dealId, token } = await crear();
    await completar(token, otraSourceId);
    expect((await perdidosEnCalendly(db, programId, AHORA)).map((fila) => fila.dealId)).toEqual([dealId]);
  });

  it("excluye deals con dueno, en otra etapa, nacidos de completo, anulados o de otro programa", async () => {
    await crear({ owner: ownerId });
    await crear({ etapa: "potencial" });
    await crear({ parcial: false });
    await crear({ anulado: true });
    await crear({ programa: otroProgramId });
    expect(await perdidosEnCalendly(db, programId, AHORA)).toEqual([]);
  });

  it("ordena dos coincidencias con el parcial mas antiguo primero", async () => {
    const reciente = await crear({ minutos: 6 });
    const antiguo = await crear({ minutos: 20 });
    expect((await perdidosEnCalendly(db, programId, AHORA)).map((fila) => fila.dealId)).toEqual([
      antiguo.dealId,
      reciente.dealId,
    ]);
  });
});
