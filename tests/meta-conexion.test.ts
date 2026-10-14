import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import {
  changeLog,
  cuentasPublicitarias,
  metaConexiones,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  cuentasDelPrograma,
  cuentasDisponibles,
  estadoConexionMeta,
  guardarTokenMeta,
  TOKEN_OCULTO,
  vincularCuenta,
} from "@/lib/catalogo/meta";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers({ "next-action": "prueba" }),
}));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let cerrar: () => Promise<void>;
let actorId: string;
let programaA: string;
let programaB: string;

const sesionCloser = {
  user: { id: "", email: "closer@retiagrowth.com", rol: "closer", closerId: "Ana" },
};
const sesionPauta = {
  user: { id: "", email: "pauta@retiagrowth.com", rol: "paid_trafficker", closerId: null },
};

const CUENTAS = [
  {
    account_id: "101",
    name: "ComunicArte COP",
    currency: "COP",
    timezone_name: "America/Bogota",
  },
  {
    account_id: "202",
    name: "ComunicArte USD",
    currency: "USD",
    timezone_name: "America/New_York",
  },
] as const;

function fetchDeMeta(tokenEsperado: string, cuentas = CUENTAS) {
  return vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" || entrada instanceof URL ? entrada : entrada.url);
    expect(url.toString()).not.toContain(tokenEsperado);
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${tokenEsperado}`);
    if (url.pathname.endsWith("/me/adaccounts")) {
      return new Response(JSON.stringify({ data: cuentas }), { status: 200 });
    }
    if (url.pathname.endsWith("/me")) {
      return new Response(JSON.stringify({ name: "retia-insights" }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: { message: "Ruta inesperada" } }), { status: 404 });
  }) as typeof globalThis.fetch;
}

beforeEach(async () => {
  auth.mockReset();
  ({ db, cerrar } = await crearBaseDePrueba());
  const [actor] = await db
    .insert(users)
    .values({ email: "pauta@retiagrowth.com", rol: "paid_trafficker", nombre: "Pauta" })
    .returning();
  actorId = actor.id;
  sesionPauta.user.id = actor.id;

  const [closer] = await db
    .insert(users)
    .values({ email: "closer@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
    .returning();
  sesionCloser.user.id = closer.id;

  const [a] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "comunicarte", nombre: "ComunícArte", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "tactical", nombre: "Tactical Investor", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await cerrar();
});

describe("conexión única con Meta", () => {
  it("prueba el token antes de escribir y deja la base intacta si Meta lo rechaza", async () => {
    const token = "token-rechazado";
    const f = vi.fn(async (entrada: string | URL | Request, init?: RequestInit) => {
      expect(String(entrada)).not.toContain(token);
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${token}`);
      return new Response(JSON.stringify({ error: { message: `Token inválido ${token}` } }), {
        status: 400,
      });
    }) as typeof globalThis.fetch;

    await expect(guardarTokenMeta(db, actorId, token, f)).rejects.toMatchObject({
      status: 422,
      message: "Meta rechazó la consulta: Token inválido (oculto)",
    });
    expect(await db.select().from(metaConexiones)).toHaveLength(0);
    expect(await db.select().from(changeLog).where(eq(changeLog.tabla, "meta_conexiones"))).toHaveLength(0);
  });

  it("guarda, reemplaza y audita sin revelar el token; la base impide dos activas", async () => {
    const primero = "token-uno";
    const segundo = "token-dos";
    expect(await guardarTokenMeta(db, actorId, primero, fetchDeMeta(primero))).toEqual({
      nombre: "retia-insights",
      cuentasVisibles: 2,
    });
    await guardarTokenMeta(db, actorId, segundo, fetchDeMeta(segundo));

    const conexiones = await db.select().from(metaConexiones);
    expect(conexiones).toHaveLength(1);
    expect(conexiones[0]?.tokenSecreto).toBe(segundo);
    const log = await db.select().from(changeLog).where(eq(changeLog.tabla, "meta_conexiones"));
    expect(log).toHaveLength(2);
    expect(log.every((fila) => fila.valorNuevo === TOKEN_OCULTO)).toBe(true);
    expect(JSON.stringify(log)).not.toContain(primero);
    expect(JSON.stringify(log)).not.toContain(segundo);

    await expect(
      db.insert(metaConexiones).values({ nombre: "otra", tokenSecreto: "otro-token" }),
    ).rejects.toBeDefined();
  });

  it("ninguna lectura devuelve el secreto", async () => {
    const token = "token-que-no-sale";
    const f = fetchDeMeta(token);
    await guardarTokenMeta(db, actorId, token, f);
    const salidas = [
      await estadoConexionMeta(db),
      await cuentasDelPrograma(db, programaA),
      await cuentasDisponibles(db, f),
    ];
    expect(JSON.stringify(salidas)).not.toContain(token);
  });
});

describe("cuentas publicitarias por programa", () => {
  beforeEach(async () => {
    await guardarTokenMeta(db, actorId, "token-bueno", fetchDeMeta("token-bueno"));
  });

  it("toma nombre, moneda y zona de Meta, deja rastro y marca la zona distinta", async () => {
    await vincularCuenta(db, actorId, programaA, "202", fetchDeMeta("token-bueno"));
    const cuentas = await cuentasDelPrograma(db, programaA);
    expect(cuentas).toEqual([
      expect.objectContaining({
        idMeta: "202",
        nombre: "ComunicArte USD",
        moneda: "USD",
        zonaHoraria: "America/New_York",
        zonaDistintaDeBogota: true,
      }),
    ]);
    const log = await db.select().from(changeLog).where(eq(changeLog.tabla, "cuentas_publicitarias"));
    expect(log.length).toBeGreaterThan(0);
  });

  it("rechaza una cuenta que el token no ve", async () => {
    await expect(
      vincularCuenta(db, actorId, programaA, "999", fetchDeMeta("token-bueno")),
    ).rejects.toMatchObject({
      status: 422,
      message: "Esa cuenta no la ve el token de Meta.",
    });
    expect(await db.select().from(cuentasPublicitarias)).toHaveLength(0);
  });

  it("rechaza la misma cuenta en otro programa y nombra el primero", async () => {
    const f = fetchDeMeta("token-bueno");
    await vincularCuenta(db, actorId, programaA, "101", f);
    await expect(vincularCuenta(db, actorId, programaB, "101", f)).rejects.toMatchObject({
      status: 409,
      message: "Esa cuenta ya está vinculada a ComunícArte.",
    });
  });
});

describe("rejas de las server actions", () => {
  it("un closer forjado recibe 403 y no mueve la base; paid trafficker sí puede", async () => {
    const token = "token-accion";
    vi.stubGlobal("fetch", fetchDeMeta(token));
    const { guardarTokenMetaAccion } = await import("@/app/(app)/ajustes/meta/acciones");
    const { vincularCuentaMetaAccion } = await import(
      "@/app/(app)/p/[programa]/programa/acciones-meta"
    );

    auth.mockResolvedValue(sesionCloser);
    const guardarProhibido = await guardarTokenMetaAccion(token);
    expect(guardarProhibido).toMatchObject({ ok: false, status: 403 });
    expect(await db.select().from(metaConexiones)).toHaveLength(0);

    auth.mockResolvedValue(sesionPauta);
    expect(await guardarTokenMetaAccion(token)).toMatchObject({ ok: true });

    auth.mockResolvedValue(sesionCloser);
    const vincularProhibido = await vincularCuentaMetaAccion(programaA, "101");
    expect(vincularProhibido).toMatchObject({ ok: false, status: 403 });
    expect(await db.select().from(cuentasPublicitarias)).toHaveLength(0);

    auth.mockResolvedValue(sesionPauta);
    expect(await vincularCuentaMetaAccion(programaA, "101")).toEqual({ ok: true });
    expect(await db.select().from(cuentasPublicitarias)).toHaveLength(1);
  });
});

it("una conexión ausente se explica antes de consultar Meta", async () => {
  await expect(cuentasDisponibles(db, fetchDeMeta("nunca-se-usa"))).rejects.toEqual(
    new ErrorDeApp("Primero conecta Meta en Ajustes.", 422),
  );
});
