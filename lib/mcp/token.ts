import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import { changeLog, mcpTokens, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { urlDelRecurso } from "@/lib/oauth/origen";

const PREFIJO = "retia_mcp_";
const FORMATO = /^retia_mcp_[A-Za-z0-9_-]{43}$/;

export type McpScope = "lectura" | "escritura";

/** Una sola lista visible de scopes, exhaustiva respecto del contrato de `McpScope`. */
export const ETIQUETA_MCP_SCOPE = {
  lectura: "Solo lectura",
  escritura: "Lectura y escritura",
} satisfies Record<McpScope, string>;

export const MCP_SCOPES = Object.entries(ETIQUETA_MCP_SCOPE).map(([valor, etiqueta]) => ({
  valor: valor as McpScope,
  etiqueta,
}));

export function esMcpScope(valor: unknown): valor is McpScope {
  return typeof valor === "string" && Object.hasOwn(ETIQUETA_MCP_SCOPE, valor);
}

export type TokenPersonalVisible = {
  id: string;
  nombre: string;
  scope: McpScope;
  creadoEn: Date;
  ultimoUsoEn: Date | null;
  revocadoEn: Date | null;
  venceEn: Date | null;
};

/** La lectura para Mi espacio selecciona explicitamente solo campos seguros. */
export async function listarTokensPersonales(db: Db, userId: string): Promise<TokenPersonalVisible[]> {
  return db
    .select({
      id: mcpTokens.id,
      nombre: mcpTokens.nombre,
      scope: mcpTokens.scope,
      creadoEn: mcpTokens.creadoEn,
      ultimoUsoEn: mcpTokens.ultimoUsoEn,
      revocadoEn: mcpTokens.revocadoEn,
      venceEn: mcpTokens.venceEn,
    })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.userId, userId), eq(mcpTokens.tipo, "personal")))
    .orderBy(desc(mcpTokens.creadoEn));
}

export function hashDeToken(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

export function generarToken(): { valor: string; hash: string } {
  const valor = `${PREFIJO}${randomBytes(32).toString("base64url")}`;
  return { valor, hash: hashDeToken(valor) };
}

export async function emitirTokenPersonal(
  db: Db,
  entrada: { userId: string; nombre: string; scope: McpScope; actorId: string },
): Promise<{ id: string; valor: string }> {
  const id = randomUUID();
  const { valor, hash } = generarToken();
  await db.transaction(async (tx) => {
    await tx.insert(mcpTokens).values({
      id,
      userId: entrada.userId,
      nombre: entrada.nombre,
      hash,
      scope: entrada.scope,
      tipo: "personal",
      venceEn: new Date(Date.now() + 365 * 24 * 60 * 60_000),
    });
    await tx.insert(changeLog).values({
      tabla: "mcp_tokens",
      registroId: id,
      etiqueta: entrada.nombre,
      campo: "creado",
      valorNuevo: entrada.scope,
      origen: "app",
      userId: entrada.actorId,
    });
  });
  return { id, valor };
}

export async function revocarToken(
  db: Db,
  entrada: { tokenId: string; actorId: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [revocado] = await tx
      .update(mcpTokens)
      .set({ revocadoEn: new Date(), revocadoPorUserId: entrada.actorId })
      .where(and(eq(mcpTokens.id, entrada.tokenId), isNull(mcpTokens.revocadoEn)))
      .returning();
    if (!revocado) return;
    await tx.insert(changeLog).values({
      tabla: "mcp_tokens",
      registroId: revocado.id,
      etiqueta: revocado.nombre,
      campo: "revocado",
      valorNuevo: "si",
      origen: "app",
      userId: entrada.actorId,
    });
  });
}

export async function verificarToken(
  db: Db,
  valor: string,
): Promise<{ tokenId: string; userId: string; scope: McpScope } | null> {
  if (!FORMATO.test(valor)) return null;
  const [fila] = await db
    .select({
      tokenId: mcpTokens.id,
      userId: mcpTokens.userId,
      scope: mcpTokens.scope,
    })
    .from(mcpTokens)
    .innerJoin(users, eq(users.id, mcpTokens.userId))
    .where(and(
      eq(mcpTokens.hash, hashDeToken(valor)),
      isNull(mcpTokens.revocadoEn),
      eq(users.activo, true),
      or(isNull(mcpTokens.venceEn), gt(mcpTokens.venceEn, new Date())),
      or(eq(mcpTokens.tipo, "personal"), and(eq(mcpTokens.tipo, "oauth"), eq(mcpTokens.resource, urlDelRecurso()))),
    ))
    .limit(1);
  if (!fila) return null;

  const haceUnMinuto = new Date(Date.now() - 60_000);
  await db
    .update(mcpTokens)
    .set({ ultimoUsoEn: new Date() })
    .where(and(
      eq(mcpTokens.id, fila.tokenId),
      isNull(mcpTokens.revocadoEn),
      // El operador de Drizzle mapea la fecha; nunca llega un Date crudo a `sql`.
      or(isNull(mcpTokens.ultimoUsoEn), lt(mcpTokens.ultimoUsoEn, haceUnMinuto)),
    ));

  return fila;
}
