import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { changeLog, mcpTokens, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { generarToken, hashDeToken, type McpScope } from "@/lib/mcp/token";
import { marcarCodigoUsado } from "./codigos";

const HORA = 3_600_000;
const NOVENTA_DIAS = 90 * 24 * HORA;
function generarRefresh() {
  const valor = `retia_mcp_r_${randomBytes(32).toString("base64url")}`;
  return { valor, hash: hashDeToken(valor) };
}

async function rastro(db: Db, entrada: { id: string; etiqueta: string; campo: string; userId: string; valor: string }) {
  await db.insert(changeLog).values({ tabla: "mcp_tokens", registroId: entrada.id, etiqueta: entrada.etiqueta,
    campo: entrada.campo, valorNuevo: entrada.valor, origen: "app", userId: entrada.userId });
}

async function insertarParOauth(db: Db, entrada: {
  userId: string; clientId: string; resource: string; scope: McpScope; codigoId: string; ahora?: Date;
}) {
  const ahora = entrada.ahora ?? new Date();
  const id = randomUUID();
  const acceso = generarToken();
  const refresh = generarRefresh();
  await db.insert(mcpTokens).values({ id, userId: entrada.userId, nombre: entrada.clientId, hash: acceso.hash,
    scope: entrada.scope, tipo: "oauth", venceEn: new Date(ahora.getTime() + HORA), clientId: entrada.clientId,
    resource: entrada.resource, refreshHash: refresh.hash, refreshVenceEn: new Date(ahora.getTime() + NOVENTA_DIAS), codigoId: entrada.codigoId });
  await rastro(db, { id, etiqueta: entrada.clientId, campo: "creado", userId: entrada.userId, valor: entrada.scope });
  return { accessToken: acceso.valor, refreshToken: refresh.valor, scope: entrada.scope };
}

export async function emitirParOauth(db: Db, entrada: {
  userId: string; clientId: string; resource: string; scope: McpScope; codigoId: string; ahora?: Date;
}) {
  return db.transaction((tx) => insertarParOauth(tx, entrada));
}

export async function consumirCodigoYEmitirParOauth(db: Db, entrada: {
  codigoId: string; userId: string; clientId: string; resource: string; scope: McpScope; ahora?: Date;
}) {
  const ahora = entrada.ahora ?? new Date();
  return db.transaction(async (tx) => {
    const consumido = await marcarCodigoUsado(tx, entrada.codigoId, ahora);
    if (!consumido) return null;
    return insertarParOauth(tx, { ...entrada, ahora });
  });
}

export async function rotarRefresh(db: Db, entrada: { refreshToken: string; clientId: string; ahora?: Date }) {
  const ahora = entrada.ahora ?? new Date();
  const acceso = generarToken();
  const refresh = generarRefresh();
  return db.transaction(async (tx) => {
    const [vigente] = await tx.select({ id: mcpTokens.id }).from(mcpTokens)
      .innerJoin(users, eq(users.id, mcpTokens.userId))
      .where(and(eq(mcpTokens.refreshHash, hashDeToken(entrada.refreshToken)), eq(mcpTokens.clientId, entrada.clientId),
        eq(mcpTokens.tipo, "oauth"), isNull(mcpTokens.revocadoEn), gt(mcpTokens.refreshVenceEn, ahora), eq(users.activo, true)))
      .limit(1);
    if (!vigente) return null;
    const [fila] = await tx.update(mcpTokens).set({ hash: acceso.hash, refreshHash: refresh.hash,
      venceEn: new Date(ahora.getTime() + HORA), refreshVenceEn: new Date(ahora.getTime() + NOVENTA_DIAS) })
      .where(and(eq(mcpTokens.id, vigente.id), eq(mcpTokens.refreshHash, hashDeToken(entrada.refreshToken)),
        isNull(mcpTokens.revocadoEn))).returning();
    if (!fila) return null;
    await rastro(tx, { id: fila.id, etiqueta: fila.nombre, campo: "rotado", userId: fila.userId, valor: fila.scope });
    return { accessToken: acceso.valor, refreshToken: refresh.valor, scope: fila.scope };
  });
}

export async function revocarValorOauth(db: Db, valor: string, ahora = new Date()): Promise<void> {
  const hash = hashDeToken(valor);
  await db.transaction(async (tx) => {
    const [fila] = await tx.update(mcpTokens).set({ revocadoEn: ahora })
      .where(and(isNull(mcpTokens.revocadoEn), eq(mcpTokens.tipo, "oauth"),
        or(eq(mcpTokens.hash, hash), eq(mcpTokens.refreshHash, hash)))).returning();
    if (!fila) return;
    await rastro(tx, { id: fila.id, etiqueta: fila.nombre, campo: "revocado", userId: fila.userId, valor: "si" });
  });
}

export async function revocarPorCodigo(db: Db, codigoId: string, ahora = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const filas = await tx.update(mcpTokens).set({ revocadoEn: ahora })
      .where(and(eq(mcpTokens.codigoId, codigoId), isNull(mcpTokens.revocadoEn))).returning();
    for (const fila of filas) await rastro(tx, { id: fila.id, etiqueta: fila.nombre, campo: "revocado", userId: fila.userId, valor: "si" });
  });
}
