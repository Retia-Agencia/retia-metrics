import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cuentasPublicitarias, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cuentasDelPrograma, cuentasDisponibles, vincularCuenta } from "@/lib/catalogo/meta";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";

let db: Db;
let vaciar: () => Promise<void>;
let cerrar: () => Promise<void>;
let actorId: string;
let programId: string;
const TOKEN = "meta-token";

beforeAll(async () => {
  ({ db, vaciar, cerrar } = await crearBaseReutilizable());
});
beforeEach(async () => {
  await vaciar();
  const [actor] = await db.insert(users).values({ email: "meta@retia.test", rol: "gerente" }).returning();
  actorId = actor.id;
  const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "meta", nombre: "Meta", ticketUsd: "1000" }).returning();
  programId = programa.id;
  await sembrarIntegracion(db, programId, "meta", { token: TOKEN }, { nombre: "Retia" });
});
afterAll(async () => cerrar());

const f = vi.fn(async (_entrada: unknown, init?: RequestInit) => {
  expect(new Headers(init?.headers).get("Authorization")).toBe(`Bearer ${TOKEN}`);
  return Response.json({ data: [{ account_id: "101", name: "Cuenta", currency: "COP", timezone_name: "America/Bogota" }] });
}) as typeof globalThis.fetch;

describe("cuentas de Meta por programa", () => {
  it("consulta y vincula con el token de la integración del programa", async () => {
    expect(await cuentasDisponibles(db, programId, f)).toHaveLength(1);
    await vincularCuenta(db, actorId, programId, "101", f);
    expect(await cuentasDelPrograma(db, programId)).toMatchObject([{ idMeta: "101", nombre: "Cuenta" }]);
    expect(await db.select().from(cuentasPublicitarias)).toHaveLength(1);
  });
});
