import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { mcpTokens, oauthCodigos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { validarPeticionDeAutorizar } from "@/lib/oauth/autorizar";
import { crearCodigoDeAutorizacion } from "@/lib/oauth/codigos";
import { emitirParOauth } from "@/lib/oauth/emision";
import { challengeS256 } from "@/lib/oauth/pkce";
import { scopeConcedido } from "@/lib/oauth/scope";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let userId: string;
const clientId = "https://cliente.example/oauth.json";
const redirectUri = "http://localhost:4567/callback";
const verifier = "v".repeat(43);
const resource = "http://localhost:3000/api/mcp";

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  estado.db = db;
});
beforeEach(async () => {
  await vaciar();
  process.env.AUTH_URL = "http://localhost:3000";
  const [usuario] = await db.insert(users).values({ email: "oauth@retia.test", nombre: "OAuth", rol: "developer" }).returning();
  userId = usuario.id;
});
afterAll(async () => { estado.db = null; delete process.env.AUTH_URL; await cerrar(); });

async function codigo(cambios: Partial<Parameters<typeof crearCodigoDeAutorizacion>[1]> = {}) {
  return crearCodigoDeAutorizacion(db, { userId, clientId, redirectUri,
    codeChallenge: challengeS256(verifier)!, scope: "escritura", resource, ...cambios });
}
async function token(form: Record<string, string>) {
  const { POST } = await import("@/app/api/oauth/token/route");
  return POST(new Request("http://localhost:3000/api/oauth/token", { method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) }));
}
async function canjear(valor: string, cambios: Record<string, string> = {}) {
  return token({ grant_type: "authorization_code", code: valor, client_id: clientId,
    redirect_uri: redirectUri, code_verifier: verifier, resource, ...cambios });
}
async function cuerpo(response: Response) { return response.json() as Promise<Record<string, string | number>>; }
async function mcp(accessToken: string) {
  const { POST } = await import("@/app/api/mcp/route");
  return POST(new Request(resource, { method: "POST", headers: { authorization: `Bearer ${accessToken}`,
    "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "1", method: "tools/list", params: {} }) }));
}

describe("flujo OAuth MCP", () => {
  it("descubre, canjea, usa el MCP, rota y sigue funcionando", async () => {
    const metadata = await (await import("@/app/.well-known/oauth-authorization-server/route")).GET();
    expect(await metadata.json()).toMatchObject({ issuer: "http://localhost:3000", scopes_supported: ["lectura", "escritura", "offline_access"] });
    const inicial = await cuerpo(await canjear(await codigo()));
    expect(inicial.token_type).toBe("Bearer");
    expect(inicial.expires_in).toBe(3600);
    expect((await mcp(String(inicial.access_token))).status).toBe(200);
    const rotado = await cuerpo(await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: String(inicial.refresh_token) }));
    expect((await mcp(String(rotado.access_token))).status).toBe(200);
    expect((await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: String(inicial.refresh_token) })).status).toBe(400);
  });

  it("el refresh viejo tras rotar responde invalid_grant", async () => {
    const inicial = await cuerpo(await canjear(await codigo()));
    await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: String(inicial.refresh_token) });
    const repetido = await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: String(inicial.refresh_token) });
    expect(repetido.status).toBe(400);
    expect(await cuerpo(repetido)).toMatchObject({ error: "invalid_grant" });
  });

  it("rechaza PKCE malo, código vencido, otro redirect, otro cliente y resource ajeno", async () => {
    const malo = await codigo();
    expect((await canjear(malo, { code_verifier: "x".repeat(43) })).status).toBe(400);
    const vencido = await codigo();
    await db.update(oauthCodigos).set({ venceEn: new Date(0) }).where(eq(oauthCodigos.hash, (await import("@/lib/mcp/token")).hashDeToken(vencido)));
    expect((await canjear(vencido)).status).toBe(400);
    expect((await canjear(await codigo(), { redirect_uri: "http://localhost:9999/otro" })).status).toBe(400);
    expect((await canjear(await codigo(), { client_id: "https://otro.example/cimd" })).status).toBe(400);
    expect((await canjear(await codigo(), { resource: "https://ajeno.test/api/mcp" })).status).toBe(400);
  });

  it("reusar el código revoca el acceso emitido", async () => {
    const valor = await codigo();
    const emitido = await cuerpo(await canjear(valor));
    expect((await mcp(String(emitido.access_token))).status).toBe(200);
    expect((await canjear(valor)).status).toBe(400);
    expect((await mcp(String(emitido.access_token))).status).toBe(401);
  });

  it("rechaza refresh vencido y usuario desactivado", async () => {
    const primero = await cuerpo(await canjear(await codigo()));
    await db.update(mcpTokens).set({ refreshVenceEn: new Date(0) });
    expect((await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: String(primero.refresh_token) })).status).toBe(400);
    const segundo = await cuerpo(await canjear(await codigo()));
    await db.update(users).set({ activo: false }).where(eq(users.id, userId));
    expect((await token({ grant_type: "refresh_token", client_id: clientId, refresh_token: String(segundo.refresh_token) })).status).toBe(400);
  });

  it("rechaza método plain y concede solo lectura al paid trafficker", async () => {
    const params = { response_type: "code", client_id: clientId, redirect_uri: "http://localhost/callback",
      code_challenge_method: "plain", code_challenge: "a".repeat(43), resource };
    await expect(validarPeticionDeAutorizar(db, params, {
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      fetch: async () => new Response(JSON.stringify({ client_id: clientId, client_name: "Cliente", redirect_uris: ["http://localhost/callback"] }), { headers: { "content-type": "application/json" } }),
    })).rejects.toMatchObject({ redirigir: true, codigo: "invalid_request" });
    expect(scopeConcedido("paid_trafficker", "escritura offline_access")).toBe("lectura");
  });

  it("un token OAuth de otro resource responde 401", async () => {
    const par = await emitirParOauth(db, { userId, clientId, resource: "https://ajeno.test/api/mcp",
      scope: "lectura", codigoId: (await db.select().from(oauthCodigos).limit(1))[0]?.id ?? (await db.insert(oauthCodigos).values({
        hash: "h-otro", userId, clientId, redirectUri, codeChallenge: "a".repeat(43), scope: "lectura",
        resource, venceEn: new Date(Date.now() + 60_000),
      }).returning())[0].id });
    expect((await mcp(par.accessToken)).status).toBe(401);
  });
});
