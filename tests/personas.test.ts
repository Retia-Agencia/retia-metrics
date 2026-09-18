import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, miembrosPrograma, people, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { asignarResponsable, crearPersonaManual } from "@/lib/mutations/personas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 026 — responsable de la persona y alta manual (ADR 0021, 0011, 0005, 0003).
 *
 * La base recibe por inyeccion PGlite. beforeEach siembra un gerente, dos closers
 * con su `closerId` cargado, dos programas y las membresias: Ana vende en A, Beto
 * en B. Cada caso mira `people` y `change_log`.
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerenteId: string;
let anaUserId: string;
let betoUserId: string;
let programaA: string;
let programaB: string;

const actorGerente = () => ({ id: gerenteId, rol: "gerente" as const, closerId: null });
const actorAna = () => ({ id: anaUserId, rol: "closer" as const, closerId: "Ana" });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;

  const [ana] = await db
    .insert(users)
    .values({ email: "ana@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
    .returning();
  anaUserId = ana.id;

  const [beto] = await db
    .insert(users)
    .values({ email: "beto@retiagrowth.com", rol: "closer", nombre: "Beto", closerId: "Beto" })
    .returning();
  betoUserId = beto.id;

  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;

  const [b] = await db
    .insert(programs)
    .values({ slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;

  // Ana vende en A; Beto vende en B.
  await db.insert(miembrosPrograma).values([
    { userId: anaUserId, programId: programaA, activo: true },
    { userId: betoUserId, programId: programaB, activo: true },
  ]);
});

afterEach(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

/** Inserta una persona en un programa y devuelve su id. */
async function sembrarPersona(
  programId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const [p] = await db
    .insert(people)
    .values({ programId, emailNormalizado: "lead@correo.co", ...extra } as never)
    .returning();
  return p.id as string;
}

// ─────────────────────────────────────────────────────────── asignarResponsable

describe("asignarResponsable", () => {
  it("un closer toma una persona sin responsable y queda como responsable, con change_log de su userId", async () => {
    const personaId = await sembrarPersona(programaA);
    const persona = await asignarResponsable(db, actorAna(), { personaId, closerId: "Ana" });

    expect(persona.responsableCloserId).toBe("Ana");

    const log = await logDe(personaId);
    expect(log).toHaveLength(1);
    expect(log[0].campo).toBe("responsableCloserId");
    expect(log[0].origen).toBe("app");
    expect(log[0].userId).toBe(anaUserId);
    expect(log[0].tabla).toBe("people");
    expect(log[0].valorNuevo).toBe("Ana");
  });

  it("tomar una persona que ya tiene responsable falla con 403", async () => {
    const personaId = await sembrarPersona(programaA, { responsableCloserId: "Ana" });
    const error = await asignarResponsable(db, actorAna(), { personaId, closerId: "Ana" }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
  });

  it("un closer no puede asignarle una persona a OTRO closer (403)", async () => {
    const personaId = await sembrarPersona(programaA);
    const error = await asignarResponsable(db, actorAna(), { personaId, closerId: "Beto" }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
  });

  it("un gerente reasigna a otro closer del programa y deja bitacora con valorAnterior", async () => {
    // Ana y Beto venden en A para este caso.
    await db.insert(miembrosPrograma).values({ userId: betoUserId, programId: programaA, activo: true });
    const personaId = await sembrarPersona(programaA, { responsableCloserId: "Ana" });

    const persona = await asignarResponsable(db, actorGerente(), { personaId, closerId: "Beto" });
    expect(persona.responsableCloserId).toBe("Beto");

    const log = await logDe(personaId);
    expect(log).toHaveLength(1);
    expect(log[0].valorAnterior).toBe("Ana");
    expect(log[0].valorNuevo).toBe("Beto");
    expect(log[0].userId).toBe(gerenteId);
  });

  it("un gerente asignando a un closer INACTIVO falla con 400", async () => {
    // Ana existe en A pero inactiva.
    await db
      .update(miembrosPrograma)
      .set({ activo: false })
      .where(eq(miembrosPrograma.userId, anaUserId));
    const personaId = await sembrarPersona(programaA);
    const error = await asignarResponsable(db, actorGerente(), { personaId, closerId: "Ana" }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("un gerente asignando a un closer que no vende en ese programa falla con 400", async () => {
    // Beto vende en B, no en A.
    const personaId = await sembrarPersona(programaA);
    const error = await asignarResponsable(db, actorGerente(), { personaId, closerId: "Beto" }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("un personaId que no es uuid es un 400 (no 500)", async () => {
    const error = await asignarResponsable(db, actorGerente(), {
      personaId: "no-uuid",
      closerId: "Ana",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("una persona inexistente es un 404", async () => {
    const error = await asignarResponsable(db, actorGerente(), {
      personaId: "00000000-0000-0000-0000-000000000000",
      closerId: "Ana",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(404);
  });

  it("reasignar al mismo valor no escribe change_log", async () => {
    const personaId = await sembrarPersona(programaA, { responsableCloserId: "Ana" });
    const persona = await asignarResponsable(db, actorGerente(), { personaId, closerId: "Ana" });
    expect(persona.responsableCloserId).toBe("Ana");
    const log = await logDe(personaId);
    expect(log).toHaveLength(0);
  });

  it("un closer cuya cuenta no tiene closerId cargado recibe 400, no un 403 enganoso", async () => {
    const personaId = await sembrarPersona(programaA);
    const error = await asignarResponsable(
      db,
      { id: anaUserId, rol: "closer", closerId: null },
      { personaId, closerId: "Ana" },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    // El mensaje manda a arreglar la cuenta (precondicion del ADR 0011), no a pensar
    // que la persona es de otro closer.
    expect((error as ErrorDeApp).message).toContain("closerId");
  });

  /**
   * Ticket 028: `esCloserValidoEnPrograma` deja de filtrar `eq(users.rol, "closer")`
   * y usa `trabajaLeads` (closer + developer). Un developer con su `closerId` y una
   * membresia activa ES destino valido de un lead — es lo que hace posible que un
   * developer en vista `closer` registre y tome personas de punta a punta. El literal
   * "developer" NO vive en la consulta: la excepcion sigue en `roles.ts` (ADR 0025).
   */
  it("un developer con closerId y membresia activa es responsable valido", async () => {
    const [dev] = await db
      .insert(users)
      .values({
        email: "dev@retiagrowth.com",
        rol: "developer",
        nombre: "Dev",
        closerId: "Dev",
      })
      .returning();
    await db
      .insert(miembrosPrograma)
      .values({ userId: dev.id, programId: programaA, activo: true });

    const personaId = await sembrarPersona(programaA);
    const persona = await asignarResponsable(
      db,
      { id: dev.id, rol: "developer", closerId: "Dev" },
      { personaId, closerId: "Dev" },
    );
    expect(persona.responsableCloserId).toBe("Dev");
  });

  it("un gerente NO es destino valido aunque tuviera membresia (no trabaja leads)", async () => {
    // El gerente no trabaja leads (ADR 0003): aunque se le forzara una membresia, no
    // puede quedar como responsable de una persona. `esCloserValidoEnPrograma` lo
    // rechaza porque `trabajaLeads("gerente")` es false, con el 400 de "no vende aqui".
    await db
      .insert(miembrosPrograma)
      .values({ userId: gerenteId, programId: programaA, activo: true });
    const personaId = await sembrarPersona(programaA);
    const error = await asignarResponsable(
      db,
      actorGerente(),
      { personaId, closerId: "Gerencia" },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────── crearPersonaManual

describe("crearPersonaManual", () => {
  it("un closer crea una persona manual: entrada 'crm', el closer como responsable, change_log con su userId", async () => {
    const { persona, creada } = await crearPersonaManual(db, actorAna(), {
      programId: programaA,
      correo: "Nuevo@Correo.CO",
      nombre: "Nuevo Lead",
      telefono: "3001112233",
    });

    expect(creada).toBe(true);
    expect(persona.entrada).toBe("crm");
    expect(persona.responsableCloserId).toBe("Ana");
    expect(persona.emailNormalizado).toBe("nuevo@correo.co");
    expect(persona.nombre).toBe("Nuevo Lead");
    expect(persona.numAplicaciones).toBe(0);

    const log = await logDe(persona.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.userId === anaUserId)).toBe(true);
    expect(log.every((l) => l.tabla === "people")).toBe(true);
  });

  it("repetir el mismo correo (con mayusculas y espacios) no duplica: devuelve la existente y no agrega change_log", async () => {
    const { persona: primera, creada: primeraCreada } = await crearPersonaManual(
      db,
      actorAna(),
      { programId: programaA, correo: "dup@correo.co", nombre: "Uno" },
    );
    expect(primeraCreada).toBe(true);
    const logInicial = await logDe(primera.id);

    const { persona: segunda, creada: segundaCreada } = await crearPersonaManual(
      db,
      actorAna(),
      { programId: programaA, correo: "  DUP@Correo.CO ", nombre: "Dos" },
    );

    // `creada: false` es lo que deja a la pantalla decir "ya existia" en vez de
    // confirmar un alta que no ocurrio (hallazgo del recorrido visual, 18-sep).
    expect(segundaCreada).toBe(false);
    expect(segunda.id).toBe(primera.id);
    expect(segunda.nombre).toBe("Uno"); // no se modifico

    const filas = await db.select().from(people).where(eq(people.emailNormalizado, "dup@correo.co"));
    expect(filas).toHaveLength(1);

    const logFinal = await logDe(primera.id);
    expect(logFinal).toHaveLength(logInicial.length);
  });

  it("un gerente no puede crear persona manual (403)", async () => {
    const error = await crearPersonaManual(db, actorGerente(), {
      programId: programaA,
      correo: "x@correo.co",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
  });

  it("un closer creando en un programa donde no vende (403)", async () => {
    const error = await crearPersonaManual(db, actorAna(), {
      programId: programaB,
      correo: "x@correo.co",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
  });

  it("un correo invalido es un 400", async () => {
    const error = await crearPersonaManual(db, actorAna(), {
      programId: programaA,
      correo: "no-es-correo",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("un closer con closerId vacio recibe 400", async () => {
    const error = await crearPersonaManual(
      db,
      { id: anaUserId, rol: "closer", closerId: null },
      { programId: programaA, correo: "x@correo.co" },
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

// ────────────────────────────── vista `todo` ⊇ vista `closer` (ticket 032)

/**
 * Ticket 032 — LA propiedad que el bug violaba: **lo que se puede hacer en vista
 * `closer` se tiene que poder hacer en vista `todo`.** La vista `todo` es la
 * proyeccion mas ANCHA del developer; si fuera menos capaz que una estrecha,
 * "estrechar" (ADR 0028) dejaria de significar algo.
 *
 * En la capa de mutaciones eso se ve asi: el MISMO developer, con los MISMOS datos,
 * proyectado como `developer` (vista `todo`) y como `closer` (vista `closer`), obtiene
 * el MISMO resultado en `crearPersonaManual` y `asignarResponsable`. El bug era que
 * `crearPersonaManual` comparaba `actor.rol !== "closer"` a mano y rechazaba al
 * developer en vista `todo` con un 403, mientras la vista `closer` lo dejaba pasar.
 *
 * Sembramos un developer con su `closerId` y una membresia activa en A (que es lo que
 * `/ajustes/usuarios` le carga, ticket 028). `actorDev` es su actor en vista `todo`;
 * `actorDevComoCloser` el mismo en vista `closer` (mismo id y closerId, solo cambia el
 * rol proyectado por `rolDeVista`).
 */
describe("vista `todo` es un superconjunto de vista `closer` (ticket 032)", () => {
  let devUserId: string;
  const actorDev = () => ({ id: devUserId, rol: "developer" as const, closerId: "Dev" });
  const actorDevComoCloser = () => ({ id: devUserId, rol: "closer" as const, closerId: "Dev" });

  beforeEach(async () => {
    const [dev] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev", closerId: "Dev" })
      .returning();
    devUserId = dev.id;
    await db
      .insert(miembrosPrograma)
      .values({ userId: devUserId, programId: programaA, activo: true });
  });

  it("crear persona funciona en vista `todo`, igual que en vista `closer` (el bug del 032)", async () => {
    // Vista `todo`: es justo lo que antes fallaba con 403 "es del closer".
    const enTodo = await crearPersonaManual(db, actorDev(), {
      programId: programaA,
      correo: "dev-todo@correo.co",
      nombre: "Creada en todo",
    });
    expect(enTodo.creada).toBe(true);
    expect(enTodo.persona.entrada).toBe("crm");
    expect(enTodo.persona.responsableCloserId).toBe("Dev");

    // Vista `closer`: el mismo developer, misma operacion, otro correo. Mismo desenlace.
    const enCloser = await crearPersonaManual(db, actorDevComoCloser(), {
      programId: programaA,
      correo: "dev-closer@correo.co",
      nombre: "Creada en closer",
    });
    expect(enCloser.creada).toBe(true);
    expect(enCloser.persona.entrada).toBe("crm");
    expect(enCloser.persona.responsableCloserId).toBe("Dev");
  });

  it("tomar una persona sin responsable funciona en vista `todo` igual que en vista `closer`", async () => {
    const p1 = await sembrarPersona(programaA, { emailNormalizado: "a1@correo.co" });
    const enTodo = await asignarResponsable(db, actorDev(), { personaId: p1, closerId: "Dev" });
    expect(enTodo.responsableCloserId).toBe("Dev");

    const p2 = await sembrarPersona(programaA, { emailNormalizado: "a2@correo.co" });
    const enCloser = await asignarResponsable(db, actorDevComoCloser(), {
      personaId: p2,
      closerId: "Dev",
    });
    expect(enCloser.responsableCloserId).toBe("Dev");
  });
});
