import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { oauthCodigos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { hashDeToken, type McpScope } from "@/lib/mcp/token";

export async function crearCodigoDeAutorizacion(db: Db, entrada: {
  userId: string; clientId: string; redirectUri: string; codeChallenge: string; scope: McpScope; resource: string;
}): Promise<string> {
  const valor = `retia_mcp_c_${randomBytes(32).toString("base64url")}`;
  await db.insert(oauthCodigos).values({
    hash: hashDeToken(valor), userId: entrada.userId, clientId: entrada.clientId,
    redirectUri: entrada.redirectUri, codeChallenge: entrada.codeChallenge,
    scope: entrada.scope, resource: entrada.resource,
    venceEn: new Date(Date.now() + 10 * 60_000),
  });
  return valor;
}

export async function buscarCodigo(db: Db, valor: string) {
  const [codigo] = await db.select().from(oauthCodigos).where(eq(oauthCodigos.hash, hashDeToken(valor))).limit(1);
  return codigo ?? null;
}

export async function marcarCodigoUsado(db: Db, id: string, ahora: Date) {
  const [codigo] = await db.update(oauthCodigos).set({ usadoEn: ahora })
    .where(and(eq(oauthCodigos.id, id), isNull(oauthCodigos.usadoEn))).returning();
  return codigo ?? null;
}
