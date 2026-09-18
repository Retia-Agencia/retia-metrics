import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearUsuario,
  editarCloserIdPropio,
  usuarioPorId,
} from "@/lib/catalogo/usuarios";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 031 — perfil propio, logica pura.
 *
 * `editarCloserIdPropio` toca SOLO la columna `closer_id` de una fila, reusando el
 * molde de catalogo (ADR 0012): asi el cambio queda en `change_log` por el mismo
 * camino que cualquier alta, sin duplicar la escritura. La AUTORIZACION no vive aca
 * (es de la server action, ver `acciones-perfil.test.ts`): este archivo prueba que la
 * escritura es correcta y deja rastro, y que un id ajeno se escribe solo si el
 * llamador lo pide (por eso la server action fija el id desde la sesion).
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerenteId: string;
let programaAId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;
  const [p] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" })
    .returning();
  programaAId = p.id;
});

afterEach(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

describe("editarCloserIdPropio", () => {
  it("carga el closerId de una fila sin closerId y lo deja en change_log", async () => {
    const [dev] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" })
      .returning();

    const fila = await editarCloserIdPropio(db, dev.id, dev.id, { closerId: "Mani" });
    expect(fila.closerId).toBe("Mani");

    const [enBase] = await db.select().from(users).where(eq(users.id, dev.id));
    expect(enBase.closerId).toBe("Mani");

    const cambios = (await logDe(dev.id)).filter((l) => l.campo === "closerId");
    expect(cambios.some((l) => l.valorNuevo === "Mani")).toBe(true);
    // El actor que registro el cambio es quien lo hizo.
    expect(cambios.every((l) => l.userId === dev.id)).toBe(true);
    expect(cambios.every((l) => l.origen === "app")).toBe(true);
  });

  it("no toca rol, email ni membresias: solo cambia closer_id", async () => {
    const creado = await crearUsuario(db, gerenteId, {
      email: "andrea@retiagrowth.com",
      nombre: "Andrea",
      rol: "closer",
      closerId: "Andrea",
      programas: [programaAId],
    });

    await editarCloserIdPropio(db, gerenteId, creado.id, { closerId: "AndreaNueva" });

    const [enBase] = await db.select().from(users).where(eq(users.id, creado.id));
    expect(enBase.closerId).toBe("AndreaNueva");
    expect(enBase.rol).toBe("closer");
    expect(enBase.email).toBe("andrea@retiagrowth.com");

    // Solo se registro el cambio de closerId, no un cambio de rol ni de email.
    const cambios = await logDe(creado.id);
    const posteriores = cambios.filter((l) => l.valorNuevo === "AndreaNueva");
    expect(posteriores).toHaveLength(1);
    expect(posteriores[0].campo).toBe("closerId");
  });

  it("vaciar el campo guarda null (sin closer_id)", async () => {
    const [dev] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", closerId: "Viejo" })
      .returning();

    const fila = await editarCloserIdPropio(db, dev.id, dev.id, { closerId: "  " });
    expect(fila.closerId).toBeNull();
  });

  it("un id que no es uuid es un 400, no un 500", async () => {
    const error = await editarCloserIdPropio(db, gerenteId, "no-es-uuid", {
      closerId: "X",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("un id inexistente es un 404", async () => {
    const UUID = "00000000-0000-0000-0000-000000000000";
    const error = await editarCloserIdPropio(db, gerenteId, UUID, { closerId: "X" }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(404);
  });
});

describe("usuarioPorId", () => {
  it("devuelve el usuario con su closerId, o null si no existe", async () => {
    const [dev] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", closerId: "Mani" })
      .returning();

    const encontrado = await usuarioPorId(dev.id, db);
    expect(encontrado?.closerId).toBe("Mani");

    const noExiste = await usuarioPorId("00000000-0000-0000-0000-000000000000", db);
    expect(noExiste).toBeNull();
  });
});
