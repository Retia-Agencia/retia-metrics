import { origenDeLaApp } from "@/lib/oauth/origen";

export const runtime = "nodejs";

export function GET() {
  const origen = origenDeLaApp();
  return Response.json({
    issuer: origen,
    authorization_endpoint: `${origen}/oauth/autorizar`,
    token_endpoint: `${origen}/api/oauth/token`,
    revocation_endpoint: `${origen}/api/oauth/revocar`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    scopes_supported: ["lectura", "escritura", "offline_access"],
  });
}
