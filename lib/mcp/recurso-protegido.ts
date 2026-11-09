import { origenDeLaApp, urlDelRecurso } from "@/lib/oauth/origen";

export function recursoProtegido(_request?: Request) {
  return Response.json({
    resource: urlDelRecurso(),
    authorization_servers: [origenDeLaApp()],
    scopes_supported: ["lectura", "escritura"],
    bearer_methods_supported: ["header"],
  });
}
