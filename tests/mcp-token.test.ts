import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { changeLog, mcpTokens, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  emitirTokenPersonal,
  generarToken,
  hashDeToken,
  listarTokensPersonales,
  revocarToken,
  verificarToken,
} from "@/lib/mcp/token";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let userId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  vi.useRealTimers();
  await vaciar();
  const [usuario] = await db.insert(users).values({
    email: "mcp-token@retia.test",
    nombre: "MCP Token",
    rol: "developer",
  }).returning();
  userId = usuario.id;
});

afterAll(async () => cerrar());

describe("tokens personales del MCP", () => {
  it("genera el formato acordado y un hash sha256 hexadecimal", () => {
    const token = generarToken();
    expect(token.valor).toMatch(/^retia_mcp_[A-Za-z0-9_-]{43}$/);
    expect(token.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(token.hash).toBe(hashDeToken(token.valor));
  });

  it("verifica un token vivo y rechaza un valor con otro formato", async () => {
    const emitido = await emitirTokenPersonal(db, {
      userId, actorId: userId, nombre: "Mi computador", scope: "lectura",
    });
    expect(await verificarToken(db, emitido.valor)).toMatchObject({
      tokenId: emitido.id, userId, scope: "lectura",
    });
    expect(await verificarToken(db, `otro_${emitido.valor}`)).toBeNull();
  });

  it("un token revocado o de un usuario desactivado deja de verificar", async () => {
    const revocado = await emitirTokenPersonal(db, {
      userId, actorId: userId, nombre: "Revocado", scope: "lectura",
    });
    await revocarToken(db, { tokenId: revocado.id, actorId: userId });
    expect(await verificarToken(db, revocado.valor)).toBeNull();

    const inactivo = await emitirTokenPersonal(db, {
      userId, actorId: userId, nombre: "Inactivo", scope: "lectura",
    });
    await db.update(users).set({ activo: false }).where(eq(users.id, userId));
    expect(await verificarToken(db, inactivo.valor)).toBeNull();
  });

  it("no reescribe ultimo_uso_en dentro de sesenta segundos", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T15:00:00.000Z"));
    const emitido = await emitirTokenPersonal(db, {
      userId, actorId: userId, nombre: "Uso", scope: "lectura",
    });
    await verificarToken(db, emitido.valor);
    const [primera] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, emitido.id));

    vi.setSystemTime(new Date("2026-11-06T15:00:30.000Z"));
    await verificarToken(db, emitido.valor);
    const [segunda] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, emitido.id));
    expect(segunda.ultimoUsoEn?.getTime()).toBe(primera.ultimoUsoEn?.getTime());
  });

  it("emitir y revocar dejan rastro sin guardar el valor ni el hash", async () => {
    const emitido = await emitirTokenPersonal(db, {
      userId, actorId: userId, nombre: "Claude local", scope: "escritura",
    });
    await revocarToken(db, { tokenId: emitido.id, actorId: userId });
    await revocarToken(db, { tokenId: emitido.id, actorId: userId });

    const logs = await db.select().from(changeLog).where(eq(changeLog.registroId, emitido.id));
    expect(logs.map((fila) => fila.campo)).toEqual(["creado", "revocado"]);
    expect(logs[0]).toMatchObject({
      tabla: "mcp_tokens", etiqueta: "Claude local", valorNuevo: "escritura",
      origen: "app", userId,
    });
    const [token] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, emitido.id));
    // La tabla de tokens guarda el hash por diseño; la bitácora no guarda ni hash ni valor.
    expect(JSON.stringify({ token, logs })).not.toContain(emitido.valor);
    expect(JSON.stringify(logs)).not.toContain(hashDeToken(emitido.valor));
  });

  it("la lista visible nunca expone valor ni hash", async () => {
    const emitido = await emitirTokenPersonal(db, {
      userId, actorId: userId, nombre: "Claude de escritorio", scope: "lectura",
    });

    const lista = await listarTokensPersonales(db, userId);

    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: emitido.id, nombre: "Claude de escritorio", scope: "lectura" });
    expect(Object.keys(lista[0])).not.toContain("hash");
    expect(Object.keys(lista[0])).not.toContain("valor");
    expect(JSON.stringify(lista)).not.toContain(emitido.valor);
    expect(JSON.stringify(lista)).not.toContain(hashDeToken(emitido.valor));
  });
});
