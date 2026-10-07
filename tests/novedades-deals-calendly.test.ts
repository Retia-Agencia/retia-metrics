import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  calls,
  deals,
  leads,
  notificacionesCalendly,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cambiarDuenoDeal, marcarDealVisto } from "@/lib/deals/cambiar-dueno";
import {
  abrirNovedadCalendly,
  marcarNovedadCalendlyVista,
  novedadesCalendlyDeUsuario,
  registrarNovedadCalendly,
} from "@/lib/notificaciones-calendly/notificaciones";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let owner: string;
let otro: string;
let dealId: string;
let callId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  const [p2] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" }).returning();
  programId = p.id;
  otroProgramId = p2.id;
  const [u] = await db.insert(users).values({ email: "owner@retia.co", rol: "closer" }).returning();
  const [u2] = await db.insert(users).values({ email: "otro@retia.co", rol: "closer" }).returning();
  owner = u.id;
  otro = u2.id;
  const [lead] = await db.insert(leads).values({ programId, emailNormalizado: "lead@correo.co", nombre: "Lead" }).returning();
  const [deal] = await db.insert(deals).values({ programId, leadId: lead.id, etapa: "agendado", ownerUserId: owner }).returning();
  dealId = deal.id;
  const [call] = await db.insert(calls).values({ programId, dealId, origen: "calendly", huellaFila: "calendly:A", resultado: "agendada" }).returning();
  callId = call.id;
});

afterEach(async () => cerrar());

describe("novedad del dueño", () => {
  it("el legado nace visto; una reasignación enciende Nuevo y solo el dueño lo apaga", async () => {
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].ownerNovedadEn).toBeNull();

    await cambiarDuenoDeal(db, { dealId, ownerActual: owner, ownerNuevo: otro, actorId: owner, etiqueta: "Lead" });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0]).toMatchObject({ ownerUserId: otro });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].ownerNovedadEn).toBeInstanceOf(Date);

    expect(await marcarDealVisto(db, { dealId, programId, userId: owner, etiqueta: "Lead" })).toBe(false);
    expect(await marcarDealVisto(db, { dealId, programId: otroProgramId, userId: otro, etiqueta: "Lead" })).toBe(false);
    expect(await marcarDealVisto(db, { dealId, programId, userId: otro, etiqueta: "Lead" })).toBe(true);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].ownerNovedadEn).toBeNull();
  });
});

describe("cola personal de Calendly", () => {
  it("deduplica en base, separa usuario/programa y abrir marca vista", async () => {
    const entrada = { programId, dealId, callId, tipo: "cita_cancelada" as const, claveEvento: "cancelada:1:A" };
    expect(await registrarNovedadCalendly(db, entrada)).toBe(true);
    expect(await registrarNovedadCalendly(db, entrada)).toBe(false);
    expect(await db.select().from(notificacionesCalendly)).toHaveLength(1);

    expect((await novedadesCalendlyDeUsuario(db, { userId: otro, programId })).noLeidas).toHaveLength(0);
    expect((await novedadesCalendlyDeUsuario(db, { userId: owner, programId: otroProgramId })).noLeidas).toHaveLength(0);
    const propias = await novedadesCalendlyDeUsuario(db, { userId: owner, programId });
    expect(propias.noLeidas).toHaveLength(1);

    expect(await marcarNovedadCalendlyVista(db, { notificationId: propias.noLeidas[0].id, userId: otro, programId })).toBe(false);
    expect(await abrirNovedadCalendly(db, { notificationId: propias.noLeidas[0].id, userId: owner })).toBe(`/p/p/deals/${dealId}`);
    const despues = await novedadesCalendlyDeUsuario(db, { userId: owner, programId });
    expect(despues.noLeidas).toHaveLength(0);
    expect(despues.leidas).toHaveLength(1);
  });

  it("sin dueño o con objetos de otro programa no crea destinatario", async () => {
    await db.update(deals).set({ ownerUserId: null }).where(eq(deals.id, dealId));
    expect(await registrarNovedadCalendly(db, { programId, dealId, callId, tipo: "cita_nueva", claveEvento: "nueva:A" })).toBe(false);
    expect(await registrarNovedadCalendly(db, { programId: otroProgramId, dealId, callId, tipo: "cita_nueva", claveEvento: "forjada:A" })).toBe(false);
    expect(await db.select().from(notificacionesCalendly)).toHaveLength(0);
  });
});

