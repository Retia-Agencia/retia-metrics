import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, programs, proveedorFormularioEnum, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  activarFuente,
  crearFuente,
  editarFuente,
  listarFuentes,
  rotarSecretoDeFuente,
  rutaDelWebhook,
} from "@/lib/catalogo/fuentes";
import { PROVEEDORES_FORMULARIO } from "@/lib/catalogo/fuentes-webhook";
import { fuentesParaAdmin } from "@/lib/queries/fuentes";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 105 (ADR 0055): la fuente webhook. Lo que este archivo muerde:
 *  - Un formulario es una fila: se crea por el molde, sin hoja, con su proveedor.
 *  - El secreto NUNCA sale: ni en `change_log`, ni en lo que devuelve el catalogo, ni
 *    en la lectura de la pantalla. Solo `rotarSecretoDeFuente` lo devuelve, una vez.
 *  - Un closer no toca nada de esto (la regla vive en la logica, no en la pantalla).
 *  - El sync de Sheets no confunde un webhook activo con su hoja.
 */

vi.mock("@/lib/sheets/leer", () => ({ leerPestana: vi.fn(async () => []) }));

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let gerenteId: string;
let closerId: string;

const actorGerente = () => ({ id: gerenteId, rol: "gerente" as const });
const actorCloser = () => ({ id: closerId, rol: "closer" as const });

const entradaWebhook = () => ({
  programId,
  nombre: "Typeform ComunicArte",
  tipo: "webhook" as const,
  proveedor: "typeform" as const,
});

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
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa", nombre: "Programa", ticketUsd: "1000" })
    .returning();
  programId = p.id;
});

afterEach(async () => {
  await cerrar();
});

async function secretoEnLaBase(id: string): Promise<string | null> {
  const [f] = await db.select({ s: sources.secretoWebhook }).from(sources).where(eq(sources.id, id));
  return f.s;
}

it("la lista de proveedores de la pantalla es la del enum de la base", () => {
  expect([...PROVEEDORES_FORMULARIO]).toEqual(proveedorFormularioEnum.enumValues);
});

describe("crear una fuente webhook", () => {
  it("nace inactiva, sin hoja, con su proveedor y sin secreto", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    expect(f).toMatchObject({ tipo: "webhook", proveedor: "typeform", sheetId: null, tab: null });
    expect(f.activo).toBe(false);
    expect(f.tieneSecreto).toBe(false);
  });

  it("sin proveedor no se crea (400)", async () => {
    const sinProveedor = { programId, nombre: "Sin proveedor", tipo: "webhook" };
    await expect(
      crearFuente(db, actorGerente(), sinProveedor as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("la base tambien lo rechaza, no solo zod (CHECK)", async () => {
    await expect(
      db.insert(sources).values({ programId, nombre: "x", tipo: "webhook" }),
    ).rejects.toThrow();
  });

  it("una hoja se sigue creando como antes", async () => {
    const f = await crearFuente(db, actorGerente(), {
      programId,
      nombre: "Hoja",
      sheetId: "sheet-1",
      tab: "Hoja",
    });
    expect(f).toMatchObject({ tipo: "google_sheet", proveedor: null });
  });

  it("la ruta es derivada del id opaco", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    expect(rutaDelWebhook(f.id)).toBe(`/api/webhooks/formularios/${f.id}`);
  });
});

describe("el secreto", () => {
  it("se genera una vez, se devuelve y queda guardado", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    const secreto = await rotarSecretoDeFuente(db, actorGerente(), f.id);
    expect(secreto.length).toBeGreaterThanOrEqual(40);
    expect(await secretoEnLaBase(f.id)).toBe(secreto);
  });

  it("rotar lo cambia", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    const uno = await rotarSecretoDeFuente(db, actorGerente(), f.id);
    const dos = await rotarSecretoDeFuente(db, actorGerente(), f.id);
    expect(dos).not.toBe(uno);
    expect(await secretoEnLaBase(f.id)).toBe(dos);
  });

  it("no aparece en change_log, pero el cambio si queda", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    const secreto = await rotarSecretoDeFuente(db, actorGerente(), f.id);
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, f.id));
    expect(JSON.stringify(log)).not.toContain(secreto);
    const fila = log.find((l) => l.campo === "secreto_webhook");
    expect(fila).toMatchObject({ valorNuevo: "(oculto)", userId: gerenteId });
  });

  it("no sale en lo que devuelve el catalogo ni en la lectura de la pantalla", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    const secreto = await rotarSecretoDeFuente(db, actorGerente(), f.id);
    const lista = await listarFuentes(db, programId);
    expect(JSON.stringify(lista)).not.toContain(secreto);
    expect(lista[0].tieneSecreto).toBe(true);
    const { fuentes } = await fuentesParaAdmin(db);
    expect(JSON.stringify(fuentes)).not.toContain(secreto);
    expect(fuentes[0]).toMatchObject({ tieneSecreto: true });
    expect("secretoWebhook" in fuentes[0]).toBe(false);
  });

  it("una hoja no tiene secreto (422)", async () => {
    const f = await crearFuente(db, actorGerente(), {
      programId,
      nombre: "Hoja",
      sheetId: "sheet-1",
      tab: "Hoja",
    });
    await expect(rotarSecretoDeFuente(db, actorGerente(), f.id)).rejects.toMatchObject({ status: 422 });
  });
});

describe("permisos: un closer no toca fuentes webhook", () => {
  it("ni crea", async () => {
    await expect(crearFuente(db, actorCloser(), entradaWebhook())).rejects.toMatchObject({ status: 403 });
  });

  it("ni rota el secreto, y la base no se mueve", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    await expect(rotarSecretoDeFuente(db, actorCloser(), f.id)).rejects.toMatchObject({ status: 403 });
    expect(await secretoEnLaBase(f.id)).toBeNull();
  });
});

describe("activar y editar", () => {
  it("sin secreto no se activa (422)", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    await expect(activarFuente(db, actorGerente(), f.id)).rejects.toMatchObject({ status: 422 });
  });

  it("con secreto se activa sin probar ninguna hoja", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    await rotarSecretoDeFuente(db, actorGerente(), f.id);
    const a = await activarFuente(db, actorGerente(), f.id);
    expect(a.activo).toBe(true);
  });

  it("el tipo no se cambia al editar (422)", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    await expect(
      editarFuente(db, actorGerente(), f.id, { programId, nombre: "x", sheetId: "s", tab: "t" }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it("editar el nombre de un webhook activo no pide hoja", async () => {
    const f = await crearFuente(db, actorGerente(), entradaWebhook());
    await rotarSecretoDeFuente(db, actorGerente(), f.id);
    await activarFuente(db, actorGerente(), f.id);
    const e = await editarFuente(db, actorGerente(), f.id, { ...entradaWebhook(), nombre: "Nuevo" });
    expect(e.nombre).toBe("Nuevo");
    expect(await secretoEnLaBase(f.id)).not.toBeNull();
  });
});
