import type { Db } from "@/lib/db/tipos";
import { obtenerClienteCimd } from "./cimd";
import { FORMATO_CHALLENGE_PKCE } from "./pkce";
import { coincideRedireccion } from "./redireccion";
import { urlDelRecurso } from "./origen";
import { parsearScopePedido } from "./scope";

export class ErrorDeAutorizar extends Error {
  constructor(
    public readonly codigo: "invalid_request" | "invalid_client" | "unsupported_response_type",
    descripcion: string,
    public readonly redirigir: boolean,
    public readonly redirectUri?: string,
    public readonly state?: string,
  ) { super(descripcion); }
}

type Parametros = URLSearchParams | Record<string, string | null | undefined>;
function valor(params: Parametros, clave: string): string | undefined {
  const encontrado = params instanceof URLSearchParams ? params.get(clave) : params[clave];
  return encontrado ?? undefined;
}

export async function validarPeticionDeAutorizar(
  db: Db,
  params: Parametros,
  dependencias: Parameters<typeof obtenerClienteCimd>[2] = {},
) {
  const clientId = valor(params, "client_id");
  const redirectUri = valor(params, "redirect_uri");
  const state = valor(params, "state");
  if (!clientId) throw new ErrorDeAutorizar("invalid_client", "Falta client_id.", false);
  let cliente;
  try { cliente = await obtenerClienteCimd(db, clientId, dependencias); }
  catch { throw new ErrorDeAutorizar("invalid_client", "El cliente no es válido.", false); }
  if (!redirectUri || !coincideRedireccion(redirectUri, cliente.redirectUris)) {
    throw new ErrorDeAutorizar("invalid_request", "redirect_uri no está permitido.", false);
  }
  const error = (codigo: ErrorDeAutorizar["codigo"], descripcion: string): never => {
    throw new ErrorDeAutorizar(codigo, descripcion, true, redirectUri, state);
  };
  if (valor(params, "response_type") !== "code") error("unsupported_response_type", "response_type debe ser code.");
  if (valor(params, "code_challenge_method") !== "S256") error("invalid_request", "code_challenge_method debe ser S256.");
  const codeChallenge = valor(params, "code_challenge");
  if (!codeChallenge || !FORMATO_CHALLENGE_PKCE.test(codeChallenge)) error("invalid_request", "code_challenge no es válido.");
  const resource = valor(params, "resource") ?? urlDelRecurso();
  if (resource !== urlDelRecurso()) error("invalid_request", "resource no corresponde al MCP del CRM.");
  const scopePedido = [...parsearScopePedido(valor(params, "scope"))].join(" ") || "lectura";
  return { cliente: { clientId: cliente.clientId, nombre: cliente.nombre }, redirectUri, codeChallenge, scopePedido, resource, state };
}
