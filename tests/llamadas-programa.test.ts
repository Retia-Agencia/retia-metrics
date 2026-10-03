import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { llamadaVisiblePara } from "@/lib/auth/alcance-deals";
import { calls, cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { llamadasDelPrograma, opcionesDeLlamadas, visibilidadDeLlamada } from "@/lib/queries/llamadas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let closer: string;
let otroCloser: string;
let llamadaDealPropio: string;
let llamadaComoCloser: string;
let llamadaAjena: string;
let llamadaSuelta: string;
let llamadaOtroPrograma: string;
let dealPropio: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa, otroPrograma] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "calls", nombre: "Calls", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "calls-otro", nombre: "Calls otro", ticketUsd: "1000" },
  ]).returning();
  programId = programa.id;

  const [ana, beto] = await db.insert(users).values([
    { email: "ana@retiagrowth.com", rol: "closer", nombre: "Ana" },
    { email: "beto@retiagrowth.com", rol: "closer", nombre: "Beto" },
  ]).returning();
  closer = ana.id;
  otroCloser = beto.id;

  const datosCohorte = {
    codigo: "C1",
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioClases: "2026-11-01",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-10-30",
    estado: "activo" as const,
  };
  const [cohorte, cohorteOtroPrograma] = await db.insert(cohorts).values([
    { programId, ...datosCohorte },
    { programId: otroPrograma.id, ...datosCohorte },
  ]).returning();

  const [leadPropio, leadComoCloser, leadAjeno, leadOtroPrograma] = await db.insert(leads).values([
    { programId, emailNormalizado: "propio@correo.co", nombre: "Deal propio" },
    { programId, emailNormalizado: "como-closer@correo.co", nombre: "Como closer" },
    { programId, emailNormalizado: "ajeno@correo.co", nombre: "Ajeno" },
    { programId: otroPrograma.id, emailNormalizado: "otro-programa@correo.co", nombre: "Otro programa" },
  ]).returning();
  const [propio, comoCloser, ajeno, dealOtroPrograma] = await db.insert(deals).values([
    { programId, leadId: leadPropio.id, cohortId: cohorte.id, etapa: "agendado", ownerUserId: closer },
    { programId, leadId: leadComoCloser.id, cohortId: cohorte.id, etapa: "agendado", ownerUserId: otroCloser },
    { programId, leadId: leadAjeno.id, cohortId: cohorte.id, etapa: "agendado", ownerUserId: otroCloser },
    { programId: otroPrograma.id, leadId: leadOtroPrograma.id, cohortId: cohorteOtroPrograma.id, etapa: "agendado", ownerUserId: closer },
  ]).returning();
  dealPropio = propio.id;

  const [callPropio, callComoCloser, callAjena, callSuelta, callOtroPrograma] = await db.insert(calls).values([
    {
      programId, dealId: propio.id, cohortId: cohorte.id, closerUserId: otroCloser,
      emailLead: leadPropio.emailNormalizado, resultado: "show",
      fechaAgenda: new Date("2026-09-28T15:00:00-05:00"),
    },
    {
      programId, dealId: comoCloser.id, cohortId: cohorte.id, closerUserId: closer,
      emailLead: leadComoCloser.emailNormalizado, resultado: "show",
      fechaAgenda: new Date("2026-09-29T15:00:00-05:00"),
    },
    {
      programId, dealId: ajeno.id, cohortId: cohorte.id, closerUserId: otroCloser,
      emailLead: leadAjeno.emailNormalizado, resultado: "cancelada",
      fechaAgenda: new Date("2026-09-30T15:00:00-05:00"),
    },
    {
      programId, dealId: null, origen: "calendly", closerUserId: closer,
      emailLead: "suelta@correo.co", resultado: "agendada",
      fechaAgenda: new Date("2026-10-01T15:00:00-05:00"),
    },
    {
      programId: otroPrograma.id, dealId: dealOtroPrograma.id, cohortId: cohorteOtroPrograma.id,
      closerUserId: closer, emailLead: leadOtroPrograma.emailNormalizado, resultado: "show",
    },
  ]).returning();
  llamadaDealPropio = callPropio.id;
  llamadaComoCloser = callComoCloser.id;
  llamadaAjena = callAjena.id;
  llamadaSuelta = callSuelta.id;
  llamadaOtroPrograma = callOtroPrograma.id;
});

afterEach(async () => {
  await cerrar();
});

describe("llamadaVisiblePara", () => {
  it("deja ver todo al alcance total", () => {
    expect(llamadaVisiblePara({ tipo: "todos" }, { ownerUserId: otroCloser, closerUserId: null })).toBe(true);
  });

  it("deja ver al dueño o al closer de la llamada, pero no a un tercero", () => {
    const alcance = { tipo: "dueno", userId: closer } as const;
    expect(llamadaVisiblePara(alcance, { ownerUserId: closer, closerUserId: otroCloser })).toBe(true);
    expect(llamadaVisiblePara(alcance, { ownerUserId: otroCloser, closerUserId: closer })).toBe(true);
    expect(llamadaVisiblePara(alcance, { ownerUserId: otroCloser, closerUserId: otroCloser })).toBe(false);
  });
});

describe("llamadasDelPrograma", () => {
  it("con alcance total incluye llamadas de todos los deals y nunca sueltas", async () => {
    const filas = await llamadasDelPrograma(db, programId, { tipo: "todos" });
    expect(filas.map((fila) => fila.callId).sort()).toEqual([llamadaDealPropio, llamadaComoCloser, llamadaAjena].sort());
    expect(filas.some((fila) => fila.callId === llamadaSuelta || fila.dealId == null)).toBe(false);
  });

  it("con alcance de dueño incluye lo propio por deal o llamada y excluye lo ajeno y lo suelto", async () => {
    const filas = await llamadasDelPrograma(db, programId, { tipo: "dueno", userId: closer });
    expect(filas.map((fila) => fila.callId).sort()).toEqual([llamadaDealPropio, llamadaComoCloser].sort());
  });

  it("el filtro de closer no puede ensanchar el alcance", async () => {
    const filas = await llamadasDelPrograma(
      db,
      programId,
      { tipo: "dueno", userId: closer },
      { closerUserId: otroCloser },
    );
    expect(filas.map((fila) => fila.callId)).toEqual([llamadaDealPropio]);
    expect(filas.some((fila) => fila.callId === llamadaAjena)).toBe(false);
  });

  it("filtra el día de Bogotá, no la zona de la máquina", async () => {
    const filas = await llamadasDelPrograma(db, programId, { tipo: "todos" }, {
      desde: "2026-09-29",
      hasta: "2026-09-29",
    });
    expect(filas.map((fila) => fila.callId)).toEqual([llamadaComoCloser]);
  });

  it("mantiene las opciones de closer, incluidas las de llamadas sueltas", async () => {
    const opciones = await opcionesDeLlamadas(db, programId);
    expect(opciones.closers).toEqual([
      { id: closer, nombre: "Ana" },
      { id: otroCloser, nombre: "Beto" },
    ]);
  });
});

describe("visibilidadDeLlamada", () => {
  it("devuelve dueño, closer y deal de la llamada", async () => {
    await expect(visibilidadDeLlamada(db, programId, llamadaDealPropio)).resolves.toEqual({
      ownerUserId: closer,
      closerUserId: otroCloser,
      dealId: dealPropio,
    });
  });

  it("devuelve la suelta y no encuentra un id de otro programa", async () => {
    await expect(visibilidadDeLlamada(db, programId, llamadaSuelta)).resolves.toEqual({
      ownerUserId: null,
      closerUserId: closer,
      dealId: null,
    });
    await expect(visibilidadDeLlamada(db, programId, llamadaOtroPrograma)).resolves.toBeNull();
  });
});
