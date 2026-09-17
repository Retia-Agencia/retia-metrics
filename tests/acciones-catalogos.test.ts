import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 013: las operaciones detras de la pantalla de catalogos. Cada operacion
 * pasa por `requireRole("gerente")` en el servidor (ADR 0003: un closer nunca
 * entra), valida con el esquema zod del catalogo y llama al molde (que ya escribe
 * change_log). El id se valida como uuid: un id que no es uuid es un error de
 * validacion, nunca un 500 del driver (deuda del ticket 011, se arregla aca).
 *
 * `auth` se mockea para simular la sesion; la base es PGlite en memoria. Las
 * operaciones reciben la base por inyeccion para poder correr sin Neon.
 */

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

const sesionGerente = {
  user: { id: "", email: "gerente@retiagrowth.com", rol: "gerente", closerId: null },
};
const sesionCloser = {
  user: { id: "u-2", email: "closer@retiagrowth.com", rol: "closer", closerId: "andrea" },
};

let db: Db;
let cerrar: () => Promise<void>;
let userId: string;

beforeEach(async () => {
  auth.mockReset();
  ({ db, cerrar } = await crearBaseDePrueba());
  const [u] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente" })
    .returning();
  userId = u.id;
  // La sesion del gerente lleva el id real recien insertado (FK de change_log).
  sesionGerente.user.id = userId;
});

afterEach(async () => {
  await cerrar();
});

async function ops() {
  return import("@/lib/catalogo/operaciones");
}

const UUID_INEXISTENTE = "00000000-0000-0000-0000-000000000000";

describe("operaciones de catalogos — barrera de rol (ADR 0003)", () => {
  it("un closer es rechazado en crear, renombrar, desactivar y reactivar", async () => {
    auth.mockResolvedValue(sesionCloser);
    const { crearItem, renombrarItem, desactivarItem, reactivarItem } = await ops();

    for (const llamada of [
      () => crearItem(db, "plataformas", { nombre: "Wise" }),
      () => renombrarItem(db, "plataformas", UUID_INEXISTENTE, { nombre: "Wise" }),
      () => desactivarItem(db, "plataformas", UUID_INEXISTENTE),
      () => reactivarItem(db, "plataformas", UUID_INEXISTENTE),
    ]) {
      const error = await llamada().catch((e) => e);
      expect(error).toBeInstanceOf(ErrorDeApp);
      expect((error as ErrorDeApp).status).toBe(403);
    }
  });

  it("sin sesion es rechazado (401)", async () => {
    auth.mockResolvedValue(null);
    const { crearItem } = await ops();
    const error = await crearItem(db, "plataformas", { nombre: "Wise" }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(401);
  });
});

describe("operaciones de catalogos — el gerente administra", () => {
  beforeEach(() => auth.mockResolvedValue(sesionGerente));

  it("crear agrega la fila y deja change_log con el userId del gerente", async () => {
    const { crearItem, listarItems } = await ops();
    const creada = await crearItem(db, "plataformas", { nombre: "Wise" });
    expect(creada.nombre).toBe("Wise");
    expect(creada.activo).toBe(true);

    const items = await listarItems(db, "plataformas");
    expect(items.find((i) => i.id === creada.id)).toBeDefined();

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, creada.id));
    expect(log).toHaveLength(1);
    expect(log[0].origen).toBe("app");
    expect(log[0].userId).toBe(userId);
    expect(log[0].tabla).toBe("plataformas_pago");
  });

  it("renombrar registra el cambio en change_log", async () => {
    const { crearItem, renombrarItem } = await ops();
    const creada = await crearItem(db, "motivos", { nombre: "Miedo" });
    await renombrarItem(db, "motivos", creada.id, { nombre: "Mucho miedo" });

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, creada.id));
    const cambioNombre = log.filter((l) => l.campo === "nombre" && l.valorAnterior === "Miedo");
    expect(cambioNombre).toHaveLength(1);
    expect(cambioNombre[0].valorNuevo).toBe("Mucho miedo");
  });

  it("desactivar marca inactivo y reactivar lo vuelve activo, ambos en change_log", async () => {
    const { crearItem, desactivarItem, reactivarItem, listarItems } = await ops();
    const creada = await crearItem(db, "origenes", { nombre: "Webinar" });

    const desactivada = await desactivarItem(db, "origenes", creada.id);
    expect(desactivada.activo).toBe(false);

    const reactivada = await reactivarItem(db, "origenes", creada.id);
    expect(reactivada.activo).toBe(true);

    const activos = await listarItems(db, "origenes");
    expect(activos.find((i) => i.id === creada.id)?.activo).toBe(true);

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, creada.id));
    const cambiosActivo = log.filter((l) => l.campo === "activo");
    // uno true->false (desactivar) y otro false->true (reactivar).
    expect(cambiosActivo).toHaveLength(2);
    expect(cambiosActivo.map((l) => l.valorNuevo).sort()).toEqual(["false", "true"]);
  });

  it("un input invalido (solo espacios) es un error de validacion, no un 500", async () => {
    const { crearItem } = await ops();
    const error = await crearItem(db, "plataformas", { nombre: "   " }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("un id que NO es uuid se rechaza como validacion (400), no como error interno", async () => {
    const { renombrarItem, desactivarItem, reactivarItem } = await ops();
    for (const llamada of [
      () => renombrarItem(db, "plataformas", "no-es-uuid", { nombre: "X" }),
      () => desactivarItem(db, "plataformas", "no-es-uuid"),
      () => reactivarItem(db, "plataformas", "no-es-uuid"),
    ]) {
      const error = await llamada().catch((e) => e);
      expect(error).toBeInstanceOf(ErrorDeApp);
      expect((error as ErrorDeApp).status).toBe(400);
    }
  });

  it("un slug de catalogo desconocido se rechaza como validacion (400)", async () => {
    const { crearItem } = await ops();
    const error = await crearItem(db, "inventado", { nombre: "X" }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});
