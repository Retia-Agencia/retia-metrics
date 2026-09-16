import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ZodError } from "zod";
import { changeLog, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { plataformasDePago } from "@/lib/catalogo/plataformas";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 011 — el molde de catalogo, estrenado con plataformas de pago.
 *
 * Base PGlite NUEVA por test (beforeEach/afterEach): cada caso mira `change_log` y
 * conteos sembrados, asi que compartir base filtraria filas entre tests y volveria
 * las aserciones dependientes del orden. Una base en memoria por test es hermetica
 * y barata.
 */

let db: Db;
let cerrar: () => Promise<void>;
let userId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  // userId es FK de change_log.userId: insertamos un usuario de prueba directo.
  const [u] = await db
    .insert(users)
    .values({ email: "tester@retiagrowth.com", rol: "gerente" })
    .returning();
  userId = u.id;
});

afterEach(async () => {
  await cerrar();
});

/** Filas de change_log de una plataforma concreta. */
async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

describe("molde de catalogo — plataformas de pago", () => {
  it("a. la migracion deja sembradas las 7 plataformas activas", async () => {
    const cat = plataformasDePago(db);
    const filas = await cat.listar();
    expect(filas).toHaveLength(7);
    expect(filas.every((f) => f.activo)).toBe(true);
    expect(filas.map((f) => f.nombre).sort()).toEqual(
      ["Bancolombia", "DollarApp", "Global66", "Hotmart", "MercadoPago", "PayPal", "Zelle"].sort(),
    );
  });

  it("b. crear agrega una plataforma y deja change_log con origen app, userId y etiqueta", async () => {
    const cat = plataformasDePago(db);
    const creada = await cat.crear(userId, { nombre: "Wise" });

    expect(creada.nombre).toBe("Wise");
    expect(creada.activo).toBe(true);
    expect(await cat.listar()).toHaveLength(8);

    const log = await logDe(creada.id);
    expect(log).toHaveLength(1);
    expect(log[0].campo).toBe("nombre");
    expect(log[0].valorAnterior).toBeNull();
    expect(log[0].valorNuevo).toBe("Wise");
    expect(log[0].origen).toBe("app");
    expect(log[0].userId).toBe(userId);
    expect(log[0].etiqueta).toBe("Wise");
    expect(log[0].tabla).toBe("plataformas_pago");
  });

  it("c. crear rechaza input invalido (solo espacios) con ZodError y no escribe nada", async () => {
    const cat = plataformasDePago(db);
    const antes = await cat.listar();

    await expect(cat.crear(userId, { nombre: "   " })).rejects.toBeInstanceOf(ZodError);

    expect(await cat.listar()).toHaveLength(antes.length);
    // Ninguna fila nueva en change_log (solo el usuario, que no toca change_log).
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("d. crear rechaza un nombre duplicado sin distinguir mayusculas con ErrorDeApp 409", async () => {
    const cat = plataformasDePago(db);
    // 'paypal' choca con la semilla 'PayPal' por el indice lower(nombre).
    const error = await cat.crear(userId, { nombre: "paypal" }).catch((e) => e);

    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(409);
    expect((error as ErrorDeApp).message).toBe("Ya existe una plataforma de pago con ese nombre.");
    // No se agrego nada.
    expect(await cat.listar()).toHaveLength(7);
  });

  it("e. editar registra solo los campos que cambiaron; sin cambios no escribe", async () => {
    const cat = plataformasDePago(db);
    const creada = await cat.crear(userId, { nombre: "Payoneer" });
    const logTrasCrear = (await logDe(creada.id)).length;

    // Editar con el MISMO nombre: no cambia nada, no escribe en change_log.
    await cat.editar(userId, creada.id, { nombre: "Payoneer" });
    expect(await logDe(creada.id)).toHaveLength(logTrasCrear);

    // Editar con un nombre distinto: registra solo el campo 'nombre'.
    const editada = await cat.editar(userId, creada.id, { nombre: "Payoneer Global" });
    expect(editada.nombre).toBe("Payoneer Global");

    const log = await logDe(creada.id);
    const cambioNombre = log.filter((l) => l.campo === "nombre" && l.valorAnterior === "Payoneer");
    expect(cambioNombre).toHaveLength(1);
    expect(cambioNombre[0].valorNuevo).toBe("Payoneer Global");
    expect(cambioNombre[0].userId).toBe(userId);
  });

  it("f. editar un id inexistente lanza ErrorDeApp 404", async () => {
    const cat = plataformasDePago(db);
    const error = await cat
      .editar(userId, "00000000-0000-0000-0000-000000000000", { nombre: "X" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(404);
  });

  it("g. desactivar no borra la fila, la marca inactiva y registra activo true->false; dos veces no duplica", async () => {
    const cat = plataformasDePago(db);
    const creada = await cat.crear(userId, { nombre: "Skrill" });

    await cat.desactivar(userId, creada.id);

    // Sigue existiendo en la base (no DELETE), pero inactiva.
    const todas = await cat.listar();
    const enTodas = todas.find((f) => f.id === creada.id);
    expect(enTodas).toBeDefined();
    expect(enTodas!.activo).toBe(false);

    // Desaparece de los activos.
    const activas = await cat.listar({ soloActivos: true });
    expect(activas.find((f) => f.id === creada.id)).toBeUndefined();

    // Registro del cambio de activo.
    const cambiosActivo = (await logDe(creada.id)).filter((l) => l.campo === "activo");
    expect(cambiosActivo).toHaveLength(1);
    expect(cambiosActivo[0].valorAnterior).toBe("true");
    expect(cambiosActivo[0].valorNuevo).toBe("false");

    // Desactivar de nuevo no escribe otro registro.
    await cat.desactivar(userId, creada.id);
    expect((await logDe(creada.id)).filter((l) => l.campo === "activo")).toHaveLength(1);
  });
});

describe("guardian estatico — el molde nunca borra", () => {
  it("h. ningun archivo de lib/catalogo/ contiene .delete( ni delete from", () => {
    const dir = fileURLToPath(new URL("../lib/catalogo", import.meta.url));
    const archivos = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".ts"))
      .map((e) => path.join(dir, e.name));

    expect(archivos.length).toBeGreaterThan(0);

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(archivo, "utf8").toLowerCase();
      expect(contenido, `${path.basename(archivo)} no puede borrar`).not.toContain(".delete(");
      expect(contenido, `${path.basename(archivo)} no puede borrar`).not.toContain("delete from");
    }
  });
});
