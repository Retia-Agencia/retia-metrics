import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { changeLog, mcpTokens, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

const PREFIJO = "retia_mcp_";
const FORMATO = /^retia_mcp_[A-Za-z0-9_-]{43}$/;

export type McpScope = "lectura" | "escritura";

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
