import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { calls, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { aplicarEventoDeCalendly } from "@/lib/calendly/eventos-de-cita";
import { registrarLlamadaDeCalendly, huellaDeCita } from "@/lib/calendly/colgar-llamada";
import type { EventoDeCalendly } from "@/lib/calendly/evento-webhook";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * El filtro por tipo de evento del webhook de Calendly (ADR 0098, ticket 289), contra
 * PGlite. En una org declarada compartida, una cita de un evento que no es del programa no
 * crea llamada y la entrega queda con `evento_de_otro_programa`; el round robin, los eventos
 * personales de los miembros y lo que el CRM ya conoce sí entran. En una org no compartida,
 * todo pasa como hoy.
 */

const RR = "https://api.calendly.com/event_types/RR";
const PERSONAL = "https://api.calendly.com/event_types/PERSONAL";
const OTRO = "https://api.calendly.com/event_types/OTRO";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let leadId: string;
let maru: string;

type CitaAgendada = Extract<EventoDeCalendly, { tipo: "agendada" }>;

let n = 0;
function agendada(parcial: Partial<CitaAgendada> = {}): CitaAgendada {
  n += 1;
  return {
    tipo: "agendada",
    uuidInvitado: `uuid-${n}`,
    inicio: new Date("2026-10-02T15:00:00.000Z"),
    correoInvitado: "ana@correo.co",
    correoHost: null,
    joinUrl: null,
    utmContent: null,
    nombreInvitado: "Ana",
    telefonoInvitado: null,
    eventType: OTRO,
    uuidAnterior: null,
    claveEvento: `invitee.created:2026-10-02T00:00:0${n}.000Z:uuid-${n}`,
    ...parcial,
  };
}

async function hayLlamada(uuid: string): Promise<boolean> {
  const [fila] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(and(eq(calls.programId, programId), eq(calls.huellaFila, huellaDeCita(uuid)), incluyendoAnulados(calls)));
  return Boolean(fila);
}

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

afterAll(async () => cerrar());

beforeEach(async () => {
  await vaciar();
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "estadox", nombre: "Second Brain", ticketUsd: "1500", calendlyOrgCompartida: true, calendlyEventType: RR })
    .returning();
  programId = p.id;
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" }).returning();
  leadId = l.id;
  await abrirDeal(db, { leadId, programId, etapa: "registrado", actor: { tipo: "sistema" } });
  const [m] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  maru = m.id;
  await db.insert(miembrosPrograma).values({ userId: maru, programId, calendlyEmail: "maru@calendly.co", calendlyEventType: PERSONAL });
});

describe("org compartida", () => {
  it("una cita de otro evento no crea llamada: efecto otro_programa", async () => {
    const evento = agendada({ eventType: OTRO });
    const efecto = await aplicarEventoDeCalendly(db, programId, evento);
    expect(efecto).toEqual({ tipo: "otro_programa", eventType: OTRO });
    expect(await hayLlamada(evento.uuidInvitado)).toBe(false);
  });

  it("una cita sin eventType tampoco entra", async () => {
    const evento = agendada({ eventType: null });
    expect(await aplicarEventoDeCalendly(db, programId, evento)).toEqual({ tipo: "otro_programa", eventType: null });
    expect(await hayLlamada(evento.uuidInvitado)).toBe(false);
  });

  it("una cita del round robin sí crea llamada", async () => {
    const evento = agendada({ eventType: RR });
    const efecto = await aplicarEventoDeCalendly(db, programId, evento);
    expect(efecto.tipo).toBe("registrada");
    expect(await hayLlamada(evento.uuidInvitado)).toBe(true);
  });

  it("una cita del evento personal de un miembro sí crea llamada", async () => {
    const evento = agendada({ eventType: PERSONAL });
    const efecto = await aplicarEventoDeCalendly(db, programId, evento);
    expect(efecto.tipo).toBe("registrada");
    expect(await hayLlamada(evento.uuidInvitado)).toBe(true);
  });

  it("una cita de otro evento cuya huella YA existe se adopta, no se descarta", async () => {
    // El 052 ya colgó la llamada de ese uuid: el CRM la conoce (ADR 0098 punto 3).
    const uuid = "uuid-conocido";
    await registrarLlamadaDeCalendly(db, programId, {
      uuidInvitado: uuid,
      inicio: new Date("2026-10-02T15:00:00.000Z"),
      correoInvitado: "ana@correo.co",
      correoHost: null,
    });
    expect(await hayLlamada(uuid)).toBe(true);
    // Un invitee.created repetido con un evento fuera del conjunto: no es otro_programa.
    const efecto = await aplicarEventoDeCalendly(db, programId, agendada({ uuidInvitado: uuid, eventType: OTRO }));
    expect(efecto.tipo).not.toBe("otro_programa");
  });

  it("una reagenda cuyo old_invitee es una llamada del programa se procesa aunque el evento sea ajeno", async () => {
    const uuidViejo = "uuid-viejo";
    await registrarLlamadaDeCalendly(db, programId, {
      uuidInvitado: uuidViejo,
      inicio: new Date("2026-10-02T15:00:00.000Z"),
      correoInvitado: "ana@correo.co",
      correoHost: null,
    });
    const efecto = await aplicarEventoDeCalendly(db, programId, agendada({ uuidInvitado: "uuid-nuevo", uuidAnterior: uuidViejo, eventType: OTRO }));
    // La reagenda mueve la MISMA llamada; nunca es otro_programa.
    expect(efecto.tipo).not.toBe("otro_programa");
    expect(await hayLlamada("uuid-nuevo")).toBe(true);
  });
});

describe("org NO compartida", () => {
  beforeEach(async () => {
    await db.update(programs).set({ calendlyOrgCompartida: false }).where(eq(programs.id, programId));
  });

  it("una cita de otro evento entra como hoy", async () => {
    const evento = agendada({ eventType: OTRO });
    const efecto = await aplicarEventoDeCalendly(db, programId, evento);
    expect(efecto.tipo).toBe("registrada");
    expect(await hayLlamada(evento.uuidInvitado)).toBe(true);
  });
});
