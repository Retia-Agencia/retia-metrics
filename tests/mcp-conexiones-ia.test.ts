import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, mcpTokens, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal, hashDeToken } from "@/lib/mcp/token";
import { puedeConectarIa, puedeCrearTokenPersonal, ROLES, type Rol } from "@/lib/auth/roles";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

const auth = vi.fn();
vi.mock("@/lib/auth", () => ({ auth }));

let db: Db;
vi.mock("@/lib/db", () => ({
  get db() {
    return db;
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (nombre: string) => nombre === "next-action" ? "accion" : null }),
  cookies: async () => ({ get: () => undefined }),
}));

let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let developerId: string;
let otroDeveloperId: string;
let closerId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  auth.mockReset();
  const insertados = await db.insert(users).values([
    { email: "dev-mcp@retia.test", nombre: "Dev MCP", rol: "developer" },
    { email: "otro-dev-mcp@retia.test", nombre: "Otro Dev", rol: "developer" },
    { email: "closer-mcp@retia.test", nombre: "Closer", rol: "closer" },
  ]).returning();
  developerId = insertados[0].id;
  otroDeveloperId = insertados[1].id;
  closerId = insertados[2].id;
});

afterAll(async () => cerrar());

function sesion(id: string, rol: Rol) {
  return { user: { id, rol, email: `${rol}@retia.test`, operaComoCloser: false } };
}

async function acciones() {
  return import("@/app/(app)/mi-espacio/acciones");
}

describe("capacidad para conectar una IA", () => {
  it("todos conectan una IA y solo developer crea claves personales", () => {
    expect(ROLES.every((rol) => puedeConectarIa(rol))).toBe(true);
    expect(ROLES.filter((rol) => rol !== "developer").every((rol) => !puedeCrearTokenPersonal(rol))).toBe(true);
    expect(puedeCrearTokenPersonal("developer")).toBe(true);
  });
});

describe("acciones de conexiones de IA", () => {
  it("rechaza una llamada forjada de otro rol sin tocar la base", async () => {
    auth.mockResolvedValue(sesion(closerId, "closer"));
    const { emitirMiTokenAccion } = await acciones();

    const resultado = await emitirMiTokenAccion({
      userId: developerId,
      nombre: "Intento forjado",
      scope: "lectura",
    });

    expect(resultado).toEqual({ ok: false, error: "No tienes permiso para crear claves personales." });
    expect(await db.select().from(mcpTokens)).toHaveLength(0);
  });

  it("crea para la persona de la sesión, devuelve el valor una vez y deja rastro sin el secreto", async () => {
    auth.mockResolvedValue(sesion(developerId, "developer"));
    const { emitirMiTokenAccion } = await acciones();

    const resultado = await emitirMiTokenAccion({ nombre: "Claude de mi Mac", scope: "lectura" });
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) throw new Error(resultado.error);

    const [fila] = await db.select().from(mcpTokens);
    expect(fila).toMatchObject({ userId: developerId, nombre: "Claude de mi Mac", scope: "lectura" });
    expect(fila.hash).toBe(hashDeToken(resultado.token.valor));
    expect(resultado.token.comando).toContain(`Authorization: Bearer ${resultado.token.valor}`);

    const logs = await db.select().from(changeLog).where(eq(changeLog.registroId, fila.id));
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ campo: "creado", userId: developerId, valorNuevo: "lectura" });
    expect(JSON.stringify(logs)).not.toContain(resultado.token.valor);
    expect(JSON.stringify(logs)).not.toContain(fila.hash);
  });

  it("revoca un token propio", async () => {
    const token = await emitirTokenPersonal(db, {
      userId: developerId, actorId: developerId, nombre: "Propio", scope: "lectura",
    });
    auth.mockResolvedValue(sesion(developerId, "developer"));
    const { revocarMiTokenAccion } = await acciones();

    expect(await revocarMiTokenAccion(token.id)).toEqual({ ok: true });
    const [fila] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, token.id));
    expect(fila.revocadoEn).toBeInstanceOf(Date);
    expect(fila.revocadoPorUserId).toBe(developerId);
  });

  it("rechaza revocar el token de otra persona y lo deja activo", async () => {
    const ajeno = await emitirTokenPersonal(db, {
      userId: otroDeveloperId, actorId: otroDeveloperId, nombre: "Ajeno", scope: "lectura",
    });
    auth.mockResolvedValue(sesion(developerId, "developer"));
    const { revocarMiTokenAccion } = await acciones();

    expect(await revocarMiTokenAccion(ajeno.id)).toEqual({
      ok: false,
      error: "Solo puedes revocar tus propias conexiones.",
    });
    const [fila] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, ajeno.id));
    expect(fila.revocadoEn).toBeNull();
  });
});
