import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearProducto,
  desactivarProducto,
  editarProducto,
  esquemaProducto,
  listarProductos,
  productoPorId,
  productosActivos,
  reactivarProducto,
} from "@/lib/catalogo/productos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 017 — productos por programa (ADR 0016, ADR 0012).
 *
 * Un producto es una instancia del molde colgada de un programa. Lo especial de
 * este catalogo frente a los globales (plataformas, motivos, origenes):
 *  - Gerentes Y closers lo administran (ADR 0016), unica config que un closer toca.
 *  - Un closer solo ve/edita productos de programas donde tiene membresia activa;
 *    tocar otro programa es un 403.
 *  - El nombre es unico POR programa sin distinguir mayusculas.
 *  - Un producto desactivado sale del listado para registrar una venta, pero la
 *    consulta por id lo devuelve igual (las ventas viejas lo siguen mostrando).
 *
 * Base PGlite nueva por test: cada caso mira `change_log` y conteos.
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerenteId: string;
let closerId: string;
let developerId: string;
let programaA: string;
let programaB: string;

const actorGerente = () => ({ id: gerenteId, rol: "gerente" as const });
const actorCloser = () => ({ id: closerId, rol: "closer" as const });
const actorDeveloper = () => ({ id: developerId, rol: "developer" as const });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  const [g] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = g.id;

  const [c] = await db
    .insert(users)
    .values({ email: "closer@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
    .returning();
  closerId = c.id;

  // Developer SIN membresias, a proposito: pasa toda guarda por el ADR 0025 y no
  // es miembro de ningun programa. Es el caso que el chequeo a mano dejaba afuera.
  const [d] = await db
    .insert(users)
    .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" })
    .returning();
  developerId = d.id;

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

  // El closer solo es miembro (activo) del programa A.
  await db
    .insert(miembrosPrograma)
    .values({ userId: closerId, programId: programaA, activo: true });
});

afterEach(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

const productoValido = (programId: string) => ({
  programId,
  nombre: "Programa completo",
  precioLista: "797.00",
  moneda: "USD" as const,
});

// ─────────────────────────────────────────────────────────── esquema

describe("esquema de producto", () => {
  it("acepta un producto valido y normaliza el nombre", () => {
    const datos = esquemaProducto.parse({
      programId: "00000000-0000-0000-0000-000000000000",
      nombre: "  Programa completo  ",
      precioLista: "797.00",
      moneda: "USD",
    });
    expect(datos.nombre).toBe("Programa completo");
    expect(datos.moneda).toBe("USD");
  });

  it("la moneda por defecto es USD", () => {
    const datos = esquemaProducto.parse({
      programId: "00000000-0000-0000-0000-000000000000",
      nombre: "Reserva",
      precioLista: "400",
    });
    expect(datos.moneda).toBe("USD");
  });

  it("rechaza un programId que no es uuid", () => {
    expect(
      esquemaProducto.safeParse({ ...productoValido("no-uuid") }).success,
    ).toBe(false);
  });

  it("rechaza un precio de cero o negativo", () => {
    const base = { programId: "00000000-0000-0000-0000-000000000000", nombre: "X", moneda: "USD" };
    expect(esquemaProducto.safeParse({ ...base, precioLista: "0" }).success).toBe(false);
    expect(esquemaProducto.safeParse({ ...base, precioLista: "-10" }).success).toBe(false);
  });

  it("rechaza un precio con mas de dos decimales", () => {
    expect(
      esquemaProducto.safeParse({
        programId: "00000000-0000-0000-0000-000000000000",
        nombre: "X",
        precioLista: "10.999",
        moneda: "USD",
      }).success,
    ).toBe(false);
  });

  it("rechaza una moneda fuera del enum", () => {
    expect(
      esquemaProducto.safeParse({
        programId: "00000000-0000-0000-0000-000000000000",
        nombre: "X",
        precioLista: "10",
        moneda: "EUR",
      }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────── crear

describe("crear producto", () => {
  it("un closer crea un producto en SU programa y queda en change_log con su userId", async () => {
    const creado = await crearProducto(db, actorCloser(), productoValido(programaA));
    expect(creado.activo).toBe(true);

    const log = await logDe(creado.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.userId === closerId)).toBe(true);
    expect(log[0].tabla).toBe("productos");
  });

  it("un closer NO puede crear un producto en un programa donde no es miembro (403)", async () => {
    const error = await crearProducto(db, actorCloser(), productoValido(programaB)).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
  });

  it("un gerente crea un producto en cualquier programa", async () => {
    const enA = await crearProducto(db, actorGerente(), productoValido(programaA));
    const enB = await crearProducto(db, actorGerente(), productoValido(programaB));
    expect(enA.programId).toBe(programaA);
    expect(enB.programId).toBe(programaB);
  });

  // ADR 0025: el developer administra igual que el gerente, y NO es miembro de
  // ningun programa. Preguntar `rol === "gerente"` a mano lo mandaba al chequeo de
  // membresia y le devolvia 403 "no vendes en este programa", que ademas es falso:
  // el developer no vende en ninguno. La respuesta vive en `esAdministrador`.
  it("un developer sin membresias crea un producto en cualquier programa (ADR 0025)", async () => {
    const enA = await crearProducto(db, actorDeveloper(), productoValido(programaA));
    const enB = await crearProducto(db, actorDeveloper(), productoValido(programaB));
    expect(enA.programId).toBe(programaA);
    expect(enB.programId).toBe(programaB);

    // Y queda firmado por el developer, no por nadie mas.
    const log = await logDe(enA.id);
    expect(log.every((l) => l.userId === developerId)).toBe(true);
  });

  it("un precio <= 0 es un 400", async () => {
    const error = await crearProducto(db, actorGerente(), {
      ...productoValido(programaA),
      precioLista: "0",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("una moneda invalida es un 400", async () => {
    const error = await crearProducto(db, actorGerente(), {
      ...productoValido(programaA),
      moneda: "EUR" as never,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("nombre duplicado en el MISMO programa (sin distinguir mayusculas) es un error claro", async () => {
    await crearProducto(db, actorGerente(), productoValido(programaA));
    const error = await crearProducto(db, actorGerente(), {
      ...productoValido(programaA),
      nombre: "programa COMPLETO",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(409);
    expect((error as ErrorDeApp).message.length).toBeGreaterThan(0);
  });

  it("el mismo nombre en OTRO programa se permite", async () => {
    await crearProducto(db, actorGerente(), productoValido(programaA));
    const enB = await crearProducto(db, actorGerente(), productoValido(programaB));
    expect(enB.programId).toBe(programaB);
  });

  it("un programId que no es uuid es un 400", async () => {
    const error = await crearProducto(db, actorGerente(), {
      ...productoValido(programaA),
      programId: "no-es-uuid",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────── editar

describe("editar producto", () => {
  it("un closer edita un producto de su programa y registra el cambio", async () => {
    const creado = await crearProducto(db, actorGerente(), productoValido(programaA));
    const editado = await editarProducto(db, actorCloser(), creado.id, {
      ...productoValido(programaA),
      precioLista: "897.00",
    });
    expect(String(editado.precioLista)).toBe("897.00");
    const log = await logDe(creado.id);
    expect(log.some((l) => l.campo === "precioLista" && l.valorNuevo === "897.00")).toBe(true);
  });

  it("un closer NO puede editar un producto de otro programa (403)", async () => {
    const enB = await crearProducto(db, actorGerente(), productoValido(programaB));
    const error = await editarProducto(db, actorCloser(), enB.id, {
      ...productoValido(programaB),
      precioLista: "999.00",
    }).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
  });

  it("un id que no es uuid es un 400", async () => {
    const error = await editarProducto(db, actorGerente(), "no-uuid", productoValido(programaA)).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────── desactivar / listar

describe("desactivar y listados", () => {
  it("un producto desactivado sale de los activos pero la consulta por id lo devuelve", async () => {
    const creado = await crearProducto(db, actorGerente(), productoValido(programaA));
    await desactivarProducto(db, actorGerente(), creado.id);

    const activos = await productosActivos(db, programaA);
    expect(activos.some((p) => p.id === creado.id)).toBe(false);

    const porId = await productoPorId(db, creado.id);
    expect(porId).toBeDefined();
    expect(porId!.id).toBe(creado.id);
    expect(porId!.activo).toBe(false);
  });

  it("un closer NO puede desactivar un producto de otro programa (403)", async () => {
    const enB = await crearProducto(db, actorGerente(), productoValido(programaB));
    const error = await desactivarProducto(db, actorCloser(), enB.id).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(403);
  });

  it("reactivar devuelve el producto a los activos", async () => {
    const creado = await crearProducto(db, actorGerente(), productoValido(programaA));
    await desactivarProducto(db, actorGerente(), creado.id);
    await reactivarProducto(db, actorGerente(), creado.id);
    const activos = await productosActivos(db, programaA);
    expect(activos.some((p) => p.id === creado.id)).toBe(true);
  });

  it("listarProductos devuelve activos e inactivos del programa", async () => {
    const a = await crearProducto(db, actorGerente(), productoValido(programaA));
    const b = await crearProducto(db, actorGerente(), {
      ...productoValido(programaA),
      nombre: "Reserva de cupo",
      precioLista: "400.00",
    });
    await desactivarProducto(db, actorGerente(), b.id);
    const lista = await listarProductos(db, programaA);
    expect(lista.find((p) => p.id === a.id)!.activo).toBe(true);
    expect(lista.find((p) => p.id === b.id)!.activo).toBe(false);
  });

  it("productosActivos solo trae los del programa pedido", async () => {
    await crearProducto(db, actorGerente(), productoValido(programaA));
    await crearProducto(db, actorGerente(), productoValido(programaB));
    const activosA = await productosActivos(db, programaA);
    expect(activosA.every((p) => p.programId === programaA)).toBe(true);
  });

  it("productoPorId con un id que no es uuid es un 400", async () => {
    const error = await productoPorId(db, "no-uuid").catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});
