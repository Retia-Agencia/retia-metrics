import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  activarFuente,
  crearFuente,
  desactivarFuente,
  editarFuente,
  listarFuentes,
  probarFuente,
} from "@/lib/catalogo/fuentes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 016 / ADR 0019 — fuentes por el molde de catalogo, con prueba antes de
 * activar.
 *
 * Lo que este archivo muerde en particular:
 *  - Permisos (ADR 0025): administra quien cumple `esAdministrador` (gerente y
 *    developer). Un closer NO administra fuentes; el developer SI. Es donde este
 *    repo se equivoco dos veces escribiendo el rol a mano.
 *  - Una fuente NACE inactiva y solo se activa si su prueba pasa EN ESE MOMENTO. Un
 *    mapeo que no cuadra falla con 422 y la fuente queda inactiva (sin bandera que
 *    envejezca).
 *
 * `leerPestana` sale a Google, asi que se mockea por (sheetId|tab).
 */

const filasPorFuente = new Map<string, string[][]>();

vi.mock("@/lib/sheets/leer", () => ({
  leerPestana: vi.fn(async (sheetId: string, tab: string) => {
    return filasPorFuente.get(`${sheetId}|${tab}`) ?? [];
  }),
}));

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let gerenteId: string;
let closerId: string;
let developerId: string;

const actorGerente = () => ({ id: gerenteId, rol: "gerente" as const });
const actorCloser = () => ({ id: closerId, rol: "closer" as const });
const actorDeveloper = () => ({ id: developerId, rol: "developer" as const });

/** Encabezados que cumplen OBLIGATORIOS_FORMULARIO (correo + submitted at). */
const ENCABEZADOS_OK = ["correo electronico", "submitted at", "nombre completo"];
/** Encabezados a los que les falta el correo obligatorio. */
const ENCABEZADOS_MALOS = ["telefono", "submitted at"];

beforeEach(async () => {
  filasPorFuente.clear();
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
  const [d] = await db
    .insert(users)
    .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" })
    .returning();
  developerId = d.id;

  const [p] = await db
    .insert(programs)
    .values({ slug: "programa", nombre: "Programa", ticketUsd: "1000" })
    .returning();
  programId = p.id;
});

afterEach(async () => {
  await cerrar();
});

const entradaBase = () => ({
  programId,
  nombre: "Formulario",
  sheetId: "sheet-1",
  tab: "Hoja",
  destino: "people" as const,
  mapeoColumnas: {},
});

describe("permisos (ADR 0025)", () => {
  it("un closer no puede crear una fuente (403)", async () => {
    await expect(crearFuente(db, actorCloser(), entradaBase())).rejects.toMatchObject({
      status: 403,
    });
  });

  it("un gerente puede crear una fuente", async () => {
    const f = await crearFuente(db, actorGerente(), entradaBase());
    expect(f.nombre).toBe("Formulario");
  });

  it("el developer SI puede administrar fuentes (es el dueño, ADR 0025)", async () => {
    const f = await crearFuente(db, actorDeveloper(), entradaBase());
    expect(f.nombre).toBe("Formulario");
    // Y tambien desactivar.
    const d = await desactivarFuente(db, actorDeveloper(), f.id);
    expect(d.activo).toBe(false);
  });
});

describe("nace inactiva", () => {
  it("una fuente recien creada esta inactiva y deja rastro en change_log", async () => {
    const f = await crearFuente(db, actorGerente(), entradaBase());
    expect(f.activo).toBe(false);

    const filas = await listarFuentes(db, programId);
    expect(filas).toHaveLength(1);
    expect(filas[0].activo).toBe(false);

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, f.id));
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((c) => c.tabla === "sources")).toBe(true);
  });
});

describe("activar corre la prueba en ese momento", () => {
  it("activar con un mapeo que cuadra deja la fuente activa", async () => {
    filasPorFuente.set("sheet-1|Hoja", [ENCABEZADOS_OK]);
    const f = await crearFuente(db, actorGerente(), entradaBase());
    const activa = await activarFuente(db, actorGerente(), f.id);
    expect(activa.activo).toBe(true);
  });

  it("activar con un mapeo que NO cuadra falla con 422 y la fuente queda inactiva", async () => {
    filasPorFuente.set("sheet-1|Hoja", [ENCABEZADOS_MALOS]);
    const f = await crearFuente(db, actorGerente(), entradaBase());

    await expect(activarFuente(db, actorGerente(), f.id)).rejects.toMatchObject({ status: 422 });

    // La garantia clave: la fuente no se activo.
    const [fila] = await db.select().from(sources).where(eq(sources.id, f.id));
    expect(fila.activo).toBe(false);
  });

  it("probar no cambia el estado de la fuente", async () => {
    filasPorFuente.set("sheet-1|Hoja", [ENCABEZADOS_OK]);
    const f = await crearFuente(db, actorGerente(), entradaBase());
    const res = await probarFuente(db, actorGerente(), f.id);
    expect(res.columnas.length).toBeGreaterThan(0);
    // Cada columna dice de que nivel salio su patron.
    expect(res.columnas.every((c) => ["fuente", "programa", "defecto"].includes(c.origen))).toBe(
      true,
    );

    const [fila] = await db.select().from(sources).where(eq(sources.id, f.id));
    expect(fila.activo).toBe(false);
  });

  it("un closer no puede activar (403), aunque el mapeo cuadre", async () => {
    filasPorFuente.set("sheet-1|Hoja", [ENCABEZADOS_OK]);
    const f = await crearFuente(db, actorGerente(), entradaBase());
    await expect(activarFuente(db, actorCloser(), f.id)).rejects.toMatchObject({ status: 403 });
  });
});

describe("una fuente ACTIVA siempre tiene un mapeo que cuadra", () => {
  it("editar una fuente activa la deja activa", async () => {
    filasPorFuente.set("sheet-1|Hoja", [ENCABEZADOS_OK]);
    const f = await crearFuente(db, actorGerente(), entradaBase());
    await activarFuente(db, actorGerente(), f.id);

    const editada = await editarFuente(db, actorGerente(), f.id, {
      ...entradaBase(),
      nombre: "Formulario renombrado",
    });
    expect(editada.nombre).toBe("Formulario renombrado");
    expect(editada.activo).toBe(true);
  });

  // El invariante de verdad no es "se probo al activar" —eso deja editar la fuente
  // despues y dejarla activa y rota, que es el mismo estado rancio que se evito al
  // no guardar una bandera de "ultima prueba ok", entrando por la otra puerta.
  it("editar una fuente ACTIVA a un mapeo que no cuadra se rechaza (422) y no toca la fila", async () => {
    filasPorFuente.set("sheet-1|Hoja", [ENCABEZADOS_OK]);
    filasPorFuente.set("sheet-1|Rota", [ENCABEZADOS_MALOS]);
    const f = await crearFuente(db, actorGerente(), entradaBase());
    await activarFuente(db, actorGerente(), f.id);

    await expect(
      editarFuente(db, actorGerente(), f.id, { ...entradaBase(), tab: "Rota" }),
    ).rejects.toMatchObject({ status: 422 });

    // Ni el cambio entro ni la fuente se desactivo: sigue exactamente como estaba.
    const [fila] = await db.select().from(sources).where(eq(sources.id, f.id));
    expect(fila.tab).toBe("Hoja");
    expect(fila.activo).toBe(true);
  });

  // La otra mitad del mordisco: la reja NO puede estorbar el trabajo legitimo. Una
  // fuente que el sync no esta leyendo se edita libremente, incluso a medio configurar.
  it("una fuente INACTIVA si se puede editar a un mapeo que no cuadra", async () => {
    filasPorFuente.set("sheet-1|Rota", [ENCABEZADOS_MALOS]);
    const f = await crearFuente(db, actorGerente(), entradaBase());

    const editada = await editarFuente(db, actorGerente(), f.id, {
      ...entradaBase(),
      tab: "Rota",
    });
    expect(editada.tab).toBe("Rota");
    expect(editada.activo).toBe(false);
  });
});

describe("errores de app, nunca 500", () => {
  it("un programa inexistente al crear es 404", async () => {
    await expect(
      crearFuente(db, actorGerente(), {
        ...entradaBase(),
        programId: "99999999-9999-9999-9999-999999999999",
      }),
    ).rejects.toBeInstanceOf(ErrorDeApp);
  });
});
