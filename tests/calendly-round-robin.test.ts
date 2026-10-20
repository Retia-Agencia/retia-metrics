import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { guardarRoundRobin } from "@/lib/calendly/round-robin";
import { asignarEventoDeMembresia } from "@/lib/catalogo/usuarios";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Un event type es de UN solo programa (ADR 0098 punto 4, ticket 289): el round robin de un
 * programa no puede ser el evento personal de nadie, y al revés. El choque entre tablas lo
 * atrapan los dos escritores (422); el choque dentro de una tabla, el índice único (409).
 */

const URL_RR = "https://calendly.com/retia/round-robin";
const RR = "https://api.calendly.com/event_types/RR";

const json = (status: number, cuerpo: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => cuerpo });

/** El fetch de resolverRoundRobin que devuelve siempre `RR` para la URL del round robin. */
function fetchResuelveRR() {
  return vi.fn()
    .mockResolvedValueOnce(json(200, { resource: { current_organization: "https://api.calendly.com/organizations/O" } }))
    .mockResolvedValueOnce(json(200, { collection: [{ user: { uri: "https://api.calendly.com/users/U" } }], pagination: {} }))
    .mockResolvedValueOnce(json(200, { collection: [{ uri: RR, scheduling_url: URL_RR }], pagination: {} }));
}

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let actorId: string;
let membresiaId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});
afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p-289", nombre: "P 289", ticketUsd: "1500" }).returning();
  programId = p.id;
  await sembrarIntegracion(db, programId, "calendly", { token: "token-289", claveFirma: "firma-289" });
  const [u] = await db.insert(users).values({ email: "nico@retia.co", nombre: "Nico", rol: "closer" }).returning();
  actorId = u.id;
  const [m] = await db.insert(miembrosPrograma).values({ programId, userId: actorId, calendlyEmail: "nico@calendly.co" }).returning();
  membresiaId = m.id;
});

describe("guardarRoundRobin", () => {
  it("guarda URL, resuelve el evento y deja change_log", async () => {
    await guardarRoundRobin(db, actorId, programId, { calendlyUrl: URL_RR, orgCompartida: true }, { fetch: fetchResuelveRR() });
    const [p] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(p.calendlyUrl).toBe(URL_RR);
    expect(p.calendlyEventType).toBe(RR);
    expect(p.calendlyOrgCompartida).toBe(true);
    const rastros = await db.select().from(changeLog).where(eq(changeLog.registroId, programId));
    expect(rastros.map((r) => r.campo).sort()).toEqual(["calendlyEventType", "calendlyOrgCompartida", "calendlyUrl"]);
  });

  it("URL vacía limpia la URL y el evento", async () => {
    await guardarRoundRobin(db, actorId, programId, { calendlyUrl: URL_RR, orgCompartida: false }, { fetch: fetchResuelveRR() });
    await guardarRoundRobin(db, actorId, programId, { calendlyUrl: "", orgCompartida: false });
    const [p] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(p.calendlyUrl).toBeNull();
    expect(p.calendlyEventType).toBeNull();
  });

  it("rechaza (422) un round robin que ya es el evento personal de alguien", async () => {
    await db.update(miembrosPrograma).set({ calendlyEventType: RR }).where(eq(miembrosPrograma.id, membresiaId));
    const error = await guardarRoundRobin(db, actorId, programId, { calendlyUrl: URL_RR, orgCompartida: false }, { fetch: fetchResuelveRR() }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error).toMatchObject({ status: 422 });
    const [p] = await db.select().from(programs).where(eq(programs.id, programId));
    expect(p.calendlyEventType).toBeNull();
  });

  it("captura la violación única entre programas como 409", async () => {
    // Otro programa ya tiene RR como su round robin.
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro-289", nombre: "Otro", ticketUsd: "797", calendlyEventType: RR }).returning();
    expect(otro.calendlyEventType).toBe(RR);
    const error = await guardarRoundRobin(db, actorId, programId, { calendlyUrl: URL_RR, orgCompartida: false }, { fetch: fetchResuelveRR() }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error).toMatchObject({ status: 409 });
  });
});

describe("asignarEventoDeMembresia: choque con el round robin de un programa", () => {
  const PERSONAL = "https://api.calendly.com/event_types/PERSONAL";

  function fetchEventosPersonales(uri: string) {
    return vi.fn()
      .mockResolvedValueOnce(json(200, { resource: { current_organization: "https://api.calendly.com/organizations/O" } }))
      .mockResolvedValueOnce(json(200, { collection: [{ user: { uri: "https://api.calendly.com/users/U" } }], pagination: {} }))
      .mockResolvedValueOnce(json(200, { collection: [{ uri, name: "30 minutos", active: true, pooling_type: null }], pagination: {} }));
  }

  it("rechaza (422) una URI que ya es el round robin de un programa", async () => {
    await db.update(programs).set({ calendlyEventType: PERSONAL }).where(eq(programs.id, programId));
    const error = await asignarEventoDeMembresia(
      db,
      actorId,
      { membresiaId, calendlyEventType: PERSONAL },
      { fetch: fetchEventosPersonales(PERSONAL) },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error).toMatchObject({ status: 422 });
  });

  it("captura la violación única entre membresías como 409", async () => {
    // Otra membresía ya tiene PERSONAL.
    const [otro] = await db.insert(users).values({ email: "otra@retia.co", rol: "closer" }).returning();
    await db.insert(miembrosPrograma).values({ programId, userId: otro.id, calendlyEmail: "otra@calendly.co", calendlyEventType: PERSONAL });
    const error = await asignarEventoDeMembresia(
      db,
      actorId,
      { membresiaId, calendlyEventType: PERSONAL },
      { fetch: fetchEventosPersonales(PERSONAL) },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect(error).toMatchObject({ status: 409 });
  });
});
