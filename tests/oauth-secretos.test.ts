import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { changeLog, mcpLlamadas, oauthCodigos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearCodigoDeAutorizacion } from "@/lib/oauth/codigos";
import { challengeS256 } from "@/lib/oauth/pkce";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));
let db: Db;
let cerrar: () => Promise<void>;
beforeAll(async () => {
  ({ db, cerrar } = await crearBaseReutilizable());
  estado.db = db;
});
afterAll(async () => { estado.db = null; await cerrar(); });

describe("secretos OAuth", () => {
  it("no escribe códigos ni tokens en change_log o mcp_llamadas", async () => {
    process.env.AUTH_URL = "http://localhost:3000";
    const [usuario] = await db.insert(users).values({ email: "secretos@retia.test", nombre: "Secretos", rol: "developer" }).returning();
    const verifier = "s".repeat(43);
    const code = await crearCodigoDeAutorizacion(db, { userId: usuario.id, clientId: "https://cliente.example/cimd",
      redirectUri: "http://localhost/callback", codeChallenge: challengeS256(verifier)!, scope: "lectura",
      resource: "http://localhost:3000/api/mcp" });
    const { POST: token } = await import("@/app/api/oauth/token/route");
    const respuesta = await token(new Request("http://localhost:3000/api/oauth/token", { method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code",
        code, client_id: "https://cliente.example/cimd", redirect_uri: "http://localhost/callback", code_verifier: verifier }) }));
    const par = await respuesta.json() as { access_token: string; refresh_token: string };
    const { POST: mcp } = await import("@/app/api/mcp/route");
    await mcp(new Request("http://localhost:3000/api/mcp", { method: "POST", headers: { authorization: `Bearer ${par.access_token}`,
      "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: "1",
      method: "tools/call", params: { name: "programas_visibles", arguments: {} } }) }));
    const rastros = JSON.stringify({ cambios: await db.select().from(changeLog), llamadas: await db.select().from(mcpLlamadas) });
    expect(rastros).not.toContain(code);
    expect(rastros).not.toContain(par.access_token);
    expect(rastros).not.toContain(par.refresh_token);
    expect(await db.select().from(oauthCodigos)).toHaveLength(1);
    delete process.env.AUTH_URL;
  });
});
