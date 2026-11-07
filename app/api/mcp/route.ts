import type { AuthInfo } from "@modelcontextprotocol/server";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { db } from "@/lib/db";
import { INSTRUCCIONES_MCP } from "@/lib/mcp/instrucciones";
import { registrarHerramientas } from "@/lib/mcp/servidor";
import { sesionDeToken } from "@/lib/mcp/sesion";
import { verificarToken, type McpScope } from "@/lib/mcp/token";

export const runtime = "nodejs";

const RUTA_METADATA = "/.well-known/oauth-protected-resource/api/mcp";

async function verificar(_request: Request, valor?: string): Promise<AuthInfo | undefined> {
  if (!valor) return undefined;
  const token = await verificarToken(db, valor);
  if (!token) return undefined;
  return {
    token: valor,
    clientId: token.userId,
    scopes: [token.scope],
    extra: token,
  };
}

async function atender(request: Request): Promise<Response> {
  const auth = request.auth;
  const extra = auth?.extra as
    | { tokenId: string; userId: string; scope: McpScope }
    | undefined;
  if (!extra) return new Response(null, { status: 401 });
  const sesion = await sesionDeToken(db, { userId: extra.userId, scope: extra.scope });
  const handler = createMcpHandler(
    (server) => registrarHerramientas(server, {
      db,
      session: sesion.session,
      rol: sesion.rol,
      tokenId: extra.tokenId,
      escritura: sesion.escritura,
    }),
    { serverInfo: { name: "retia-crm", version: "1.0.0" }, instructions: INSTRUCCIONES_MCP },
  );
  return handler(request);
}

async function manejar(request: Request): Promise<Response> {
  const protegido = withMcpAuth(atender, verificar, {
    required: true,
    resourceMetadataPath: RUTA_METADATA,
  });
  const response = await protegido(request);
  if (response.status !== 401) return response;
  // `withMcpAuth` arma el challenge correcto; el CRM no entrega un cuerpo útil.
  return new Response(null, { status: 401, headers: response.headers });
}

export const GET = manejar;
export const POST = manejar;
