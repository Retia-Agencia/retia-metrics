import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { oauthClientes } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorCimd, esDireccionPrivada, obtenerClienteCimd } from "@/lib/oauth/cimd";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
beforeEach(async () => vaciar());
afterAll(async () => cerrar());

const CLIENTE = "https://cliente.example/oauth.json";
const lookupPublico = vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]);
function documento(cambios: Record<string, unknown> = {}) {
  return { client_id: CLIENTE, client_name: "Cliente", redirect_uris: ["http://localhost/callback"], ...cambios };
}
function respuesta(cuerpo: unknown, init: ResponseInit = {}) {
  return new Response(typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo), {
    status: 200, headers: { "content-type": "application/json" }, ...init,
  });
}

describe("CIMD", () => {
  it.each(["http://cliente.example/c", "https://localhost/c", "https://127.0.0.1/c", "https://[::1]/c", "https://10.1.2.3/c", "https://0.0.0.0/c"])("rechaza client_id no público: %s", async (clientId) => {
    await expect(obtenerClienteCimd(db, clientId, { lookup: lookupPublico, fetch: vi.fn() })).rejects.toBeInstanceOf(ErrorCimd);
  });

  it.each(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.169.254", "0.0.0.0", "::1", "0:0:0:0:0:0:0:1", "fc00::1", "fe80::1", "::ffff:127.0.0.1"])("rechaza DNS que incluya %s", async (address) => {
    const fetchFalso = vi.fn();
    await expect(obtenerClienteCimd(db, CLIENTE, {
      lookup: async () => [{ address, family: address.includes(":") ? 6 : 4 }], fetch: fetchFalso,
    })).rejects.toBeInstanceOf(ErrorCimd);
    expect(fetchFalso).not.toHaveBeenCalled();
    expect(esDireccionPrivada(address)).toBe(true);
  });

  it("rechaza si cualquiera de las direcciones DNS es privada", async () => {
    await expect(obtenerClienteCimd(db, CLIENTE, { lookup: async () => [
      { address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 },
    ], fetch: vi.fn() })).rejects.toBeInstanceOf(ErrorCimd);
  });

  it("usa timeout, redirect manual y exige JSON", async () => {
    const fetchFalso = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return respuesta("texto", { headers: { "content-type": "text/plain" } });
    });
    await expect(obtenerClienteCimd(db, CLIENTE, { lookup: lookupPublico, fetch: fetchFalso })).rejects.toThrow("JSON");
  });

  it("rechaza redirecciones HTTP", async () => {
    await expect(obtenerClienteCimd(db, CLIENTE, { lookup: lookupPublico,
      fetch: vi.fn(async () => respuesta("", { status: 302, headers: { location: "https://otro.test" } })) })).rejects.toThrow("redirigir");
  });

  it("corta el stream al superar 64 KB", async () => {
    await expect(obtenerClienteCimd(db, CLIENTE, { lookup: lookupPublico,
      fetch: vi.fn(async () => respuesta("x".repeat(64 * 1024 + 1))) })).rejects.toThrow("64 KB");
  });

  it.each([
    { client_id: "https://otro.example", client_name: "Cliente", redirect_uris: ["https://cliente.example/c"] },
    { client_id: CLIENTE, client_name: "", redirect_uris: ["https://cliente.example/c"] },
    { client_id: CLIENTE, client_name: "Cliente", redirect_uris: [] },
    { client_id: CLIENTE, client_name: "Cliente", redirect_uris: Array.from({ length: 21 }, (_, i) => `https://cliente.example/${i}`) },
    { client_id: CLIENTE, client_name: "Cliente", redirect_uris: ["http://cliente.example/c"] },
  ])("valida los campos obligatorios del documento", async (cuerpo) => {
    await expect(obtenerClienteCimd(db, CLIENTE, { lookup: lookupPublico,
      fetch: vi.fn(async () => respuesta(cuerpo)) })).rejects.toBeInstanceOf(ErrorCimd);
  });

  it("cachea una hora y un bloqueo prevalece siempre", async () => {
    const fetchFalso = vi.fn(async () => respuesta(documento()));
    await obtenerClienteCimd(db, CLIENTE, { lookup: lookupPublico, fetch: fetchFalso });
    await obtenerClienteCimd(db, CLIENTE, { lookup: lookupPublico, fetch: fetchFalso });
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    await db.update(oauthClientes).set({ bloqueadoEn: new Date() });
    await expect(obtenerClienteCimd(db, CLIENTE, { lookup: lookupPublico, fetch: fetchFalso })).rejects.toThrow("bloqueado");
  });
});
