import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { buscarCodigo } from "@/lib/oauth/codigos";
import { consumirCodigoYEmitirParOauth, revocarPorCodigo, rotarRefresh } from "@/lib/oauth/emision";
import { urlDelRecurso } from "@/lib/oauth/origen";
import { verificarPkce } from "@/lib/oauth/pkce";

export const runtime = "nodejs";
const CABECERAS = { "cache-control": "no-store", pragma: "no-cache" };

function error(codigo: "invalid_grant" | "invalid_request" | "unsupported_grant_type" | "invalid_client", descripcion: string) {
  return Response.json({ error: codigo, error_description: descripcion }, { status: 400, headers: CABECERAS });
}
function ok(par: { accessToken: string; refreshToken: string; scope: string }) {
  return Response.json({ access_token: par.accessToken, token_type: "Bearer", expires_in: 3600,
    refresh_token: par.refreshToken, scope: par.scope }, { headers: CABECERAS });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) {
    return error("invalid_request", "Se requiere application/x-www-form-urlencoded.");
  }
  const form = new URLSearchParams(await request.text());
  const grant = form.get("grant_type");
  const clientId = form.get("client_id");
  if (!clientId) return error("invalid_client", "Falta client_id.");
  if (grant === "authorization_code") {
    const codigoValor = form.get("code");
    const redirectUri = form.get("redirect_uri");
    const verificador = form.get("code_verifier");
    if (!codigoValor || !redirectUri || !verificador) return error("invalid_request", "Faltan parámetros del código de autorización.");
    const codigo = await buscarCodigo(db, codigoValor);
    if (!codigo) return error("invalid_grant", "El código no es válido.");
    if (codigo.usadoEn) {
      await revocarPorCodigo(db, codigo.id);
      return error("invalid_grant", "El código ya fue usado.");
    }
    const resource = form.get("resource");
    if (codigo.venceEn <= new Date() || codigo.clientId !== clientId || codigo.redirectUri !== redirectUri
      || (resource !== null && resource !== urlDelRecurso()) || codigo.resource !== urlDelRecurso()
      || !verificarPkce(verificador, codigo.codeChallenge)) {
      return error("invalid_grant", "El código no es válido.");
    }
    const [usuario] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, codigo.userId), eq(users.activo, true))).limit(1);
    if (!usuario) return error("invalid_grant", "La persona ya no está activa.");
    const par = await consumirCodigoYEmitirParOauth(db, { codigoId: codigo.id, userId: codigo.userId,
      clientId, resource: codigo.resource, scope: codigo.scope });
    if (!par) {
      await revocarPorCodigo(db, codigo.id);
      return error("invalid_grant", "El código ya fue usado.");
    }
    return ok(par);
  }
  if (grant === "refresh_token") {
    const refreshToken = form.get("refresh_token");
    if (!refreshToken) return error("invalid_request", "Falta refresh_token.");
    const par = await rotarRefresh(db, { refreshToken, clientId });
    return par ? ok(par) : error("invalid_grant", "El refresh token no es válido.");
  }
  return error("unsupported_grant_type", "grant_type no está soportado.");
}
