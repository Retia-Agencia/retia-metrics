import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { changeLog, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearUsuario,
  desactivarUsuario,
  editarUsuario,
  esquemaUsuario,
  listarUsuarios,
  parsearEntradaUsuario,
  reactivarUsuario,
} from "@/lib/catalogo/usuarios";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 015 — administrar usuarios y closers desde /ajustes.
 *
 * Es la logica pura detras de la pantalla: valida con UN esquema zod, delega los
 * campos del usuario al molde de catalogo (ADR 0012), y sincroniza las membresias
 * de programa (`miembros_programa`) — nunca borra, siempre `change_log`. Dos reglas
 * de negocio propias que el molde no expresa: un closer necesita `closerId` y al
 * menos un programa; un gerente no puede quitarse su propio rol ni desactivarse
 * (evita quedar sin administradores).
 *
 * Base PGlite nueva por test. Cada caso mira `change_log` y las membresias, asi que
 * compartir base filtraria filas entre tests.
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerenteId: string;
let programaAId: string;
let programaBId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
  const insertados = await db
    .insert(programs)
    .values([
      { slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" },
      { slug: "programa-b", nombre: "Programa B", ticketUsd: "2000" },
    ])
    .returning();
  programaAId = insertados.find((p) => p.slug === "programa-a")!.id;
  programaBId = insertados.find((p) => p.slug === "programa-b")!.id;
});

afterEach(async () => {
  await cerrar();
});

/** Filas de change_log de un registro concreto. */
async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

/** Membresias (activas o no) de un usuario. */
async function membresiasDe(userId: string) {
  return db.select().from(miembrosPrograma).where(eq(miembrosPrograma.userId, userId));
}

const closerValido = {
  email: "Andrea@Retiagrowth.com",
  nombre: "Andrea",
  rol: "closer" as const,
  closerId: "Andrea",
  calendlyEmail: "andrea@calendly.com",
  programas: [] as string[],
};

describe("esquema de usuario", () => {
  it("normaliza el correo a minusculas y sin espacios", () => {
    const datos = esquemaUsuario.parse({ ...closerValido, programas: [programaAId] });
    expect(datos.email).toBe("andrea@retiagrowth.com");
  });

  it("rechaza un correo invalido con ZodError", () => {
    expect(() =>
      esquemaUsuario.parse({ ...closerValido, email: "no-es-correo", programas: [programaAId] }),
    ).toThrow(ZodError);
  });

  it("un closer sin closerId no valida", () => {
    expect(() =>
      esquemaUsuario.parse({ ...closerValido, closerId: "", programas: [programaAId] }),
    ).toThrow(ZodError);
  });

  it("un closer sin programas no valida", () => {
    expect(() => esquemaUsuario.parse({ ...closerValido, programas: [] })).toThrow(ZodError);
  });

  it("un gerente no necesita closerId ni programas", () => {
    const datos = esquemaUsuario.parse({
      email: "otro@retiagrowth.com",
      nombre: "Otro Gerente",
      rol: "gerente",
      closerId: "",
      programas: [],
    });
    expect(datos.rol).toBe("gerente");
  });

  it("parsearEntradaUsuario expone el mismo esquema para el CLI", () => {
    const datos = parsearEntradaUsuario({
      email: "  Dana@Retiagrowth.com ",
      rol: "closer",
      closerId: "Dana",
      programas: [programaAId],
    });
    expect(datos.email).toBe("dana@retiagrowth.com");
    expect(datos.closerId).toBe("Dana");
  });
});

describe("crear usuario", () => {
  it("un gerente crea un closer con closerId y un programa; membresia activa y change_log", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      ...closerValido,
      programas: [programaAId],
    });

    expect(creado.email).toBe("andrea@retiagrowth.com");
    expect(creado.rol).toBe("closer");
    expect(creado.closerId).toBe("Andrea");
    expect(creado.activo).toBe(true);

    const membresias = await membresiasDe(creado.id);
    expect(membresias).toHaveLength(1);
    expect(membresias[0].programId).toBe(programaAId);
    expect(membresias[0].activo).toBe(true);

    // change_log del alta del usuario (una fila por campo) mas la membresia.
    const log = await logDe(creado.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.userId === gerenteId)).toBe(true);
    // El cambio de rol quedo registrado.
    expect(log.some((l) => l.campo === "rol" && l.valorNuevo === "closer")).toBe(true);
    // La membresia dejo su propia huella en change_log.
    const logMembresia = await logDe(membresias[0].id);
    expect(logMembresia.length).toBeGreaterThan(0);
    expect(logMembresia[0].tabla).toBe("miembros_programa");
  });

  it("un gerente crea otro gerente sin closerId ni programas", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      email: "mani@retiagrowth.com",
      nombre: "Mani",
      rol: "gerente",
      closerId: "",
      programas: [],
    });
    expect(creado.rol).toBe("gerente");
    expect(await membresiasDe(creado.id)).toHaveLength(0);
  });

  it("un closer sin closerId es un 400", async () => {
    const error = await crearUsuario(db, gerenteId, {
      ...closerValido,
      closerId: "",
      programas: [programaAId],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("un closer sin programa es un 400", async () => {
    const error = await crearUsuario(db, gerenteId, {
      ...closerValido,
      programas: [],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

describe("editar usuario", () => {
  it("sincroniza membresias: agrega la nueva, desactiva la removida, nunca borra", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      ...closerValido,
      programas: [programaAId],
    });

    // Cambia de programa A a programa B.
    await editarUsuario(db, gerenteId, creado.id, {
      ...closerValido,
      programas: [programaBId],
    });

    const membresias = await membresiasDe(creado.id);
    // Sigue existiendo la fila de A (no DELETE), pero inactiva; B activa.
    expect(membresias).toHaveLength(2);
    const a = membresias.find((m) => m.programId === programaAId)!;
    const b = membresias.find((m) => m.programId === programaBId)!;
    expect(a.activo).toBe(false);
    expect(b.activo).toBe(true);
  });

  it("reactiva una membresia existente en vez de duplicarla", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      ...closerValido,
      programas: [programaAId],
    });
    await editarUsuario(db, gerenteId, creado.id, { ...closerValido, programas: [programaBId] });
    await editarUsuario(db, gerenteId, creado.id, { ...closerValido, programas: [programaAId] });

    const membresias = await membresiasDe(creado.id);
    // Sigue habiendo solo dos filas (A y B); A vuelve a activa.
    expect(membresias).toHaveLength(2);
    expect(membresias.find((m) => m.programId === programaAId)!.activo).toBe(true);
    expect(membresias.find((m) => m.programId === programaBId)!.activo).toBe(false);
  });

  it("un cambio de rol queda en change_log", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      email: "sube@retiagrowth.com",
      nombre: "Sube",
      rol: "gerente",
      closerId: "",
      programas: [],
    });
    await editarUsuario(db, gerenteId, creado.id, {
      email: "sube@retiagrowth.com",
      nombre: "Sube",
      rol: "closer",
      closerId: "Sube",
      programas: [programaAId],
    });
    const log = await logDe(creado.id);
    const cambioRol = log.filter((l) => l.campo === "rol");
    expect(cambioRol.some((l) => l.valorAnterior === "gerente" && l.valorNuevo === "closer")).toBe(true);
  });

  it("un id que no es uuid es un 400", async () => {
    const error = await editarUsuario(db, gerenteId, "no-es-uuid", {
      ...closerValido,
      programas: [programaAId],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

describe("proteccion del ultimo administrador", () => {
  it("un gerente no puede quitarse a si mismo el rol de gerente", async () => {
    const error = await editarUsuario(db, gerenteId, gerenteId, {
      email: "gerente@retiagrowth.com",
      nombre: "Gerencia",
      rol: "closer",
      closerId: "Gerencia",
      programas: [programaAId],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    // Sigue siendo gerente.
    const [u] = await db.select().from(users).where(eq(users.id, gerenteId));
    expect(u.rol).toBe("gerente");
  });

  it("un gerente no puede desactivarse a si mismo", async () => {
    const error = await desactivarUsuario(db, gerenteId, gerenteId).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    const [u] = await db.select().from(users).where(eq(users.id, gerenteId));
    expect(u.activo).toBe(true);
  });

  it("un gerente SI puede pasarse a si mismo a developer (ADR 0025)", async () => {
    // No es una degradacion: developer tambien administra, asi que no se pierde
    // administracion y la salvaguarda no tiene por que bloquearlo.
    const editado = await editarUsuario(db, gerenteId, gerenteId, {
      email: "gerente@retiagrowth.com",
      nombre: "Gerencia",
      rol: "developer",
      closerId: "",
      programas: [programaAId],
    });
    expect(editado.rol).toBe("developer");
  });

  it("un developer no puede bajarse a si mismo a closer (ADR 0025)", async () => {
    await editarUsuario(db, gerenteId, gerenteId, {
      email: "gerente@retiagrowth.com",
      nombre: "Gerencia",
      rol: "developer",
      closerId: "",
      programas: [programaAId],
    });
    const error = await editarUsuario(db, gerenteId, gerenteId, {
      email: "gerente@retiagrowth.com",
      nombre: "Gerencia",
      rol: "closer",
      closerId: "Gerencia",
      programas: [programaAId],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    const [u] = await db.select().from(users).where(eq(users.id, gerenteId));
    expect(u.rol).toBe("developer");
  });

  it("un developer tampoco puede desactivarse a si mismo (ADR 0025)", async () => {
    await editarUsuario(db, gerenteId, gerenteId, {
      email: "gerente@retiagrowth.com",
      nombre: "Gerencia",
      rol: "developer",
      closerId: "",
      programas: [programaAId],
    });
    const error = await desactivarUsuario(db, gerenteId, gerenteId).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
    const [u] = await db.select().from(users).where(eq(users.id, gerenteId));
    expect(u.activo).toBe(true);
  });

  it("un gerente si puede degradar a OTRO gerente si no es el mismo", async () => {
    const otro = await crearUsuario(db, gerenteId, {
      email: "otro@retiagrowth.com",
      nombre: "Otro",
      rol: "gerente",
      closerId: "",
      programas: [],
    });
    const editado = await editarUsuario(db, gerenteId, otro.id, {
      email: "otro@retiagrowth.com",
      nombre: "Otro",
      rol: "closer",
      closerId: "Otro",
      programas: [programaAId],
    });
    expect(editado.rol).toBe("closer");
  });
});

describe("desactivar y reactivar", () => {
  it("desactivar no borra la fila, la marca inactiva y registra el cambio", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      ...closerValido,
      programas: [programaAId],
    });
    const desactivado = await desactivarUsuario(db, gerenteId, creado.id);
    expect(desactivado.activo).toBe(false);

    // La fila sigue existiendo.
    const [enBase] = await db.select().from(users).where(eq(users.id, creado.id));
    expect(enBase).toBeDefined();

    const cambiosActivo = (await logDe(creado.id)).filter((l) => l.campo === "activo");
    expect(cambiosActivo.some((l) => l.valorAnterior === "true" && l.valorNuevo === "false")).toBe(true);
  });

  it("reactivar vuelve a activar al usuario", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      ...closerValido,
      programas: [programaAId],
    });
    await desactivarUsuario(db, gerenteId, creado.id);
    const reactivado = await reactivarUsuario(db, gerenteId, creado.id);
    expect(reactivado.activo).toBe(true);
  });
});

describe("listar usuarios", () => {
  it("devuelve activos e inactivos con sus programas", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      ...closerValido,
      programas: [programaAId, programaBId],
    });
    const lista = await listarUsuarios(db);
    const andrea = lista.find((u) => u.id === creado.id);
    expect(andrea).toBeDefined();
    expect(andrea!.programas.sort()).toEqual([programaAId, programaBId].sort());
    // El gerente sembrado tambien aparece.
    expect(lista.find((u) => u.id === gerenteId)).toBeDefined();
  });
});
