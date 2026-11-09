import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { AuthorizationError } from "@/lib/auth/roles";
import { listarUsuarios, type ActorDeUsuarios } from "@/lib/catalogo/usuarios";
import { mcpTokens, oauthClientes } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { revocarToken, type McpScope } from "@/lib/mcp/token";

export type ConexionOauthVisible = {
  id: string;
  clienteNombre: string;
  scope: McpScope;
  creadoEn: Date;
  ultimoUsoEn: Date | null;
  refreshVenceEn: Date | null;
};

/** Conexiones OAuth activas propias. Solo proyecta campos seguros para Mi espacio. */
export async function listarConexionesOauth(db: Db, userId: string): Promise<ConexionOauthVisible[]> {
  return db.select({
    id: mcpTokens.id,
    clienteNombre: oauthClientes.nombre,
    scope: mcpTokens.scope,
    creadoEn: mcpTokens.creadoEn,
    ultimoUsoEn: mcpTokens.ultimoUsoEn,
    refreshVenceEn: mcpTokens.refreshVenceEn,
  }).from(mcpTokens)
    .innerJoin(oauthClientes, eq(oauthClientes.clientId, mcpTokens.clientId))
    .where(and(eq(mcpTokens.userId, userId), eq(mcpTokens.tipo, "oauth"), isNull(mcpTokens.revocadoEn)))
    .orderBy(desc(mcpTokens.creadoEn));
}

export type ConexionOauthAdministrable = ConexionOauthVisible & { userId: string };

/** Conexiones activas de las personas que la pantalla ya resolvio dentro del alcance. */
export async function listarConexionesOauthDeUsuarios(
  db: Db,
  userIds: readonly string[],
): Promise<ConexionOauthAdministrable[]> {
  if (userIds.length === 0) return [];
  return db.select({
    id: mcpTokens.id,
    userId: mcpTokens.userId,
    clienteNombre: oauthClientes.nombre,
    scope: mcpTokens.scope,
    creadoEn: mcpTokens.creadoEn,
    ultimoUsoEn: mcpTokens.ultimoUsoEn,
    refreshVenceEn: mcpTokens.refreshVenceEn,
  }).from(mcpTokens)
    .innerJoin(oauthClientes, eq(oauthClientes.clientId, mcpTokens.clientId))
    .where(and(inArray(mcpTokens.userId, [...userIds]), eq(mcpTokens.tipo, "oauth"), isNull(mcpTokens.revocadoEn)))
    .orderBy(desc(mcpTokens.creadoEn));
}

/** El userId sale de la sesion, nunca del formulario. */
export async function revocarConexionOauthPropia(
  db: Db,
  entrada: { tokenId: string; userId: string },
): Promise<void> {
  const [propia] = await db.select({ id: mcpTokens.id }).from(mcpTokens).where(and(
    eq(mcpTokens.id, entrada.tokenId),
    eq(mcpTokens.userId, entrada.userId),
    eq(mcpTokens.tipo, "oauth"),
    isNull(mcpTokens.revocadoEn),
  )).limit(1);
  if (!propia) throw new AuthorizationError("Solo puedes desconectar tus propias conexiones.");
  await revocarToken(db, { tokenId: propia.id, actorId: entrada.userId });
}

/** Reusa listarUsuarios: la misma funcion decide alcance para la vista y la escritura. */
export async function revocarConexionOauthAdministrada(
  db: Db,
  entrada: { tokenId: string; actor: ActorDeUsuarios },
): Promise<void> {
  const usuarios = await listarUsuarios(db, entrada.actor);
  const idsPermitidos = usuarios.map((usuario) => usuario.id);
  const [conexion] = idsPermitidos.length === 0 ? [] : await db.select({
    id: mcpTokens.id,
    userId: mcpTokens.userId,
  }).from(mcpTokens).where(and(
    eq(mcpTokens.id, entrada.tokenId),
    inArray(mcpTokens.userId, idsPermitidos),
    eq(mcpTokens.tipo, "oauth"),
    isNull(mcpTokens.revocadoEn),
  )).limit(1);
  if (!conexion) throw new AuthorizationError("No puedes administrar esta conexion.");
  await revocarToken(db, { tokenId: conexion.id, actorId: entrada.actor.id });
}
