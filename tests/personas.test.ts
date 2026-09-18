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
