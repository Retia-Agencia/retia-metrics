import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, changeLog, deals, leads, motivos, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cambioLegible, citaActiva } from "@/lib/deals/estado-de-llamada";
import { detalleDeLlamada } from "@/lib/queries/detalle-llamada";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let callId: string;
let callAnuladaId: string;
let callSueltaId: string;
let closerId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa, otroPrograma] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "detalle", nombre: "Detalle", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "detalle-otro", nombre: "Detalle otro", ticketUsd: "1200" },
  ]).returning();
  programId = programa.id;
  otroProgramId = otroPrograma.id;

  const [closer, setter, anulador] = await db.insert(users).values([
    { email: "closer@retia.test", rol: "closer", nombre: "Clara" },
    { email: "setter@retia.test", rol: "closer", nombre: "Sara" },
    { email: "gerente@retia.test", rol: "gerente", nombre: "Germán" },
  ]).returning();
  closerId = closer.id;
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: "lead@correo.co",
    nombre: "Lina Lead",
  }).returning();
  const [deal] = await db.insert(deals).values({
    programId,
    leadId: lead.id,
    etapa: "agendado",
    ownerUserId: closer.id,
    setterUserId: setter.id,
  }).returning();
  const [motivo] = await db.insert(motivos).values({ nombre: "Pidió otra fecha", tipo: "reagenda" }).returning();
  const [llamada, anulada, suelta] = await db.insert(calls).values([
    {
      programId,
      dealId: deal.id,
      closerUserId: closer.id,
      emailLead: lead.emailNormalizado,
      resultado: "reagendada",
      fechaAgenda: new Date("2026-10-02T15:00:00-05:00"),
      fechaLlamada: new Date("2026-10-02T15:10:00-05:00"),
      fechaSeguimiento: new Date("2026-10-04T10:00:00-05:00"),
      origen: "calendly",
      linkCalendly: "https://calendly.com/reunion",
      linkGrain: "https://grain.com/grabacion",
      calendlyHostEmail: closer.email,
      notas: "Pidió mover la cita.",
      motivoId: motivo.id,
    },
    {
      programId,
      dealId: deal.id,
      closerUserId: closer.id,
      resultado: "cancelada",
      origen: "crm",
      anuladoEn: new Date("2026-10-03T12:00:00-05:00"),
      anuladoPor: anulador.id,
      motivoAnulacion: "Se registró dos veces.",
    },
    {
      programId,
      dealId: null,
      origen: "calendly",
      emailLead: "suelta@correo.co",
      resultado: "agendada",
    },
  ]).returning();
  callId = llamada.id;
  callAnuladaId = anulada.id;
  callSueltaId = suelta.id;
});

afterEach(async () => { await cerrar(); });

describe("detalleDeLlamada", () => {
  it("devuelve lead, closer, setter y enlaces", async () => {
    const detalle = await detalleDeLlamada(db, programId, callId);
    expect(detalle).toMatchObject({
      id: callId,
      resultado: "reagendada",
      closer: { nombre: "Clara", email: "closer@retia.test" },
      setter: { nombre: "Sara" },
      lead: { nombre: "Lina Lead", email: "lead@correo.co" },
      linkCalendly: "https://calendly.com/reunion",
      linkGrain: "https://grain.com/grabacion",
      motivo: { nombre: "Pidió otra fecha" },
    });
  });

  it("devuelve una llamada anulada con sus datos de anulación", async () => {
    const detalle = await detalleDeLlamada(db, programId, callAnuladaId);
    expect(detalle).toMatchObject({
      anuladoEn: new Date("2026-10-03T17:00:00.000Z"),
      motivoAnulacion: "Se registró dos veces.",
      anuladoPorNombre: "Germán",
    });
  });

  it("no cruza la frontera del programa", async () => {
    await expect(detalleDeLlamada(db, otroProgramId, callId)).resolves.toBeNull();
  });

  it("ordena el historial de la llamada y excluye otro registro", async () => {
    await db.insert(changeLog).values([
      { tabla: "calls", registroId: callId, campo: "resultado", valorAnterior: "agendada", valorNuevo: "reagendada", detectadoEn: new Date("2026-10-02T18:00:00Z"), origen: "app", userId: closerId },
      { tabla: "calls", registroId: callId, campo: "closerUserId", valorAnterior: null, valorNuevo: closerId, detectadoEn: new Date("2026-10-02T18:30:00Z"), origen: "app" },
      { tabla: "calls", registroId: callId, campo: "fecha_agenda", valorAnterior: "uno", valorNuevo: "dos", detectadoEn: new Date("2026-10-02T17:00:00Z"), origen: "app" },
      { tabla: "calls", registroId: callAnuladaId, campo: "resultado", valorAnterior: "show", valorNuevo: "cancelada", detectadoEn: new Date("2026-10-02T16:00:00Z"), origen: "app" },
    ]);

    const detalle = await detalleDeLlamada(db, programId, callId);
    expect(detalle?.historial).toMatchObject([
      { campo: "fecha_agenda", userNombre: null },
      { campo: "resultado", userNombre: "Clara" },
      { campo: "closerUserId", userNombre: null },
    ]);
    expect(detalle?.nombresDelHistorial[closerId]).toBe("Clara");
  });

  it("devuelve una llamada suelta con correo y sin deal", async () => {
    const detalle = await detalleDeLlamada(db, programId, callSueltaId);
    expect(detalle).toMatchObject({ dealId: null, emailLead: "suelta@correo.co", lead: null });
  });
});

describe("cambioLegible", () => {
  const cambio = (campo: string, valorNuevo: string | null, valorAnterior: string | null = null) =>
    cambioLegible({ campo, valorAnterior, valorNuevo }, { "closer-id": "Clara" });

  it("oculta campos técnicos en camelCase y snake_case", () => {
    expect(cambio("programId", "programa")).toBeNull();
    expect(cambio("huella_fila", "huella")).toBeNull();
  });

  it("traduce el resultado", () => {
    expect(cambio("resultado", "agendada")).toEqual({ etiqueta: "Estado", anterior: null, nuevo: "Agendada" });
  });

  it("muestra las fechas en la hora de Bogotá", () => {
    expect(cambio("fechaAgenda", "2026-10-02T20:00:00.000Z")).toEqual({ etiqueta: "Cita", anterior: null, nuevo: "2 oct 2026, 15:00" });
  });

  it("resuelve el closer por nombre", () => {
    expect(cambio("closerUserId", "closer-id")).toEqual({ etiqueta: "Closer", anterior: null, nuevo: "Clara" });
  });

  it("describe la asignación a un deal sin mostrar su id", () => {
    expect(cambio("dealId", "deal-id")).toEqual({ etiqueta: "Deal", anterior: null, nuevo: "Asignada a un deal" });
  });

  it("deja pasar un campo desconocido", () => {
    expect(cambio("campo_nuevo", "nuevo", "anterior")).toEqual({ etiqueta: "campo_nuevo", anterior: "anterior", nuevo: "nuevo" });
  });
});

describe("citaActiva", () => {
  const llamada = (
    id: string,
    resultado: "agendada" | "show",
    fechaAgenda: Date | null,
    anuladoEn: Date | null = null,
  ) => ({ id, resultado, fechaAgenda, anuladoEn });

  it("ignora anuladas y no agendadas, y elige la fecha más reciente", () => {
    expect(citaActiva([
      llamada("anulada", "agendada", new Date("2026-10-10T12:00:00Z"), new Date()),
      llamada("show", "show", new Date("2026-10-11T12:00:00Z")),
      llamada("vieja", "agendada", new Date("2026-10-01T12:00:00Z")),
      llamada("nueva", "agendada", new Date("2026-10-05T12:00:00Z")),
    ])).toBe("nueva");
  });

  it("considera la fecha nula como la más antigua", () => {
    expect(citaActiva([
      llamada("sin-fecha", "agendada", null),
      llamada("con-fecha", "agendada", new Date("2026-10-01T12:00:00Z")),
    ])).toBe("con-fecha");
  });

  it("devuelve null cuando no hay una agendada vigente", () => {
    expect(citaActiva([llamada("show", "show", null)])).toBeNull();
  });
});
