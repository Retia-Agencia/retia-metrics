import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, getTableColumns } from "drizzle-orm";
import { areas as tablaAreas, changeLog, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { areas } from "@/lib/catalogo/areas";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let userId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [usuario] = await db
    .insert(users)
    .values({ email: "areas@retiagrowth.com", rol: "gerente" })
    .returning();
  userId = usuario.id;
});

afterEach(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

describe("catalogo de areas (ticket 083)", () => {
  it("crear escribe una fila de change_log para areas", async () => {
    const creada = await areas(db).crear(userId, { nombre: "Paid" });
    const log = await logDe(creada.id);

    expect(log).toHaveLength(1);
    expect(log[0].tabla).toBe("areas");
    expect(log[0].campo).toBe("nombre");
  });

  it("rechaza un nombre duplicado sin distinguir mayusculas con ErrorDeApp 409", async () => {
    const cat = areas(db);
    await cat.crear(userId, { nombre: "Paid" });
    const error = await cat.crear(userId, { nombre: "PAID" }).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(409);
    expect((error as ErrorDeApp).message).toBe("Ya existe un área con ese nombre.");
  });

  it("editar cambia el nombre y lo registra", async () => {
    const cat = areas(db);
    const creada = await cat.crear(userId, { nombre: "Pago" });
    const editada = await cat.editar(userId, creada.id, { nombre: "Paid" });
    const cambio = (await logDe(creada.id)).find(
      (fila) => fila.campo === "nombre" && fila.valorAnterior === "Pago",
    );

    expect(editada.nombre).toBe("Paid");
    expect(cambio?.valorNuevo).toBe("Paid");
  });

  it("desactivar marca el area como inactiva", async () => {
    const cat = areas(db);
    const creada = await cat.crear(userId, { nombre: "Orgánico" });
    await cat.desactivar(userId, creada.id);

    const fila = (await cat.listar()).find((area) => area.id === creada.id);
    expect(fila?.activo).toBe(false);
  });

  it("borrarSiNoSeUso elimina de verdad un area sin referencias", async () => {
    const cat = areas(db);
    const creada = await cat.crear(userId, { nombre: "Referidos" });

    expect(await cat.borrarSiNoSeUso(userId, creada.id)).toEqual({ borrado: true });
    expect((await cat.listar()).find((area) => area.id === creada.id)).toBeUndefined();
  });

  it("un area que solo usa un deal como declarada no se borra y dice su conteo (ticket 121)", async () => {
    const cat = areas(db);
    const creada = await cat.crear(userId, { nombre: "Referidos" });
    const [programa] = await db.insert(programs).values({ slug: "uno", nombre: "Uno", ticketUsd: "797" }).returning();
    const [lead] = await db.insert(leads).values({ programId: programa.id, emailNormalizado: "a@correo.co" }).returning();
    await db.insert(deals).values({ leadId: lead.id, programId: programa.id, etapa: "ganado_parcial", areaDeclaradaId: creada.id });

    expect(await cat.borrarSiNoSeUso(userId, creada.id)).toEqual({ borrado: false, referencias: 1 });
    expect((await cat.listar()).find((area) => area.id === creada.id)).toBeDefined();
  });

  it("la tabla no tiene program_id", () => {
    expect(Object.keys(getTableColumns(tablaAreas))).not.toContain("programId");
  });
});
