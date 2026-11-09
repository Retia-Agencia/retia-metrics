import { isIP } from "node:net";
import { lookup as lookupDns } from "node:dns/promises";
import { eq } from "drizzle-orm";
import { oauthClientes } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esRedireccionPermitida } from "./redireccion";

const MAXIMO_BYTES = 64 * 1024;

export class ErrorCimd extends Error {}
type Lookup = (host: string, opciones: { all: true; verbatim: true }) => Promise<Array<{ address: string; family: number }>>;

export function esDireccionPrivada(valor: string): boolean {
  const ip = valor.toLowerCase().split("%")[0];
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    // Privadas, loopback, link-local, CGNAT (100.64/10), pruebas (198.18/15) y multicast/reservadas (224+).
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (isIP(ip) === 6) {
    const mapeada = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapeada) return esDireccionPrivada(mapeada[1]);
    const lados = ip.split("::");
    const izquierda = lados[0] ? lados[0].split(":") : [];
    const derecha = lados[1] ? lados[1].split(":") : [];
    const grupos = lados.length === 2
      ? [...izquierda, ...Array(8 - izquierda.length - derecha.length).fill("0"), ...derecha]
      : izquierda;
    if (grupos.length !== 8) return true;
    const numeros = grupos.map((grupo) => Number.parseInt(grupo || "0", 16));
    if (numeros.slice(0, 7).every((grupo) => grupo === 0) && (numeros[7] === 0 || numeros[7] === 1)) return true;
    if ((numeros[0] & 0xfe00) === 0xfc00) return true; // fc00::/7
    if ((numeros[0] & 0xffc0) === 0xfe80) return true; // fe80::/10
    if (numeros.slice(0, 5).every((grupo) => grupo === 0) && numeros[5] === 0xffff) {
      return esDireccionPrivada(`${numeros[6] >>> 8}.${numeros[6] & 255}.${numeros[7] >>> 8}.${numeros[7] & 255}`);
    }
    return false;
  }
  return true;
}

async function leerConTope(response: Response): Promise<string> {
  if (!response.body) throw new ErrorCimd("El documento CIMD no tiene cuerpo.");
  const lector = response.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAXIMO_BYTES) {
      await lector.cancel();
      throw new ErrorCimd("El documento CIMD supera 64 KB.");
    }
    partes.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(partes));
}

export async function obtenerClienteCimd(
  db: Db,
  clientId: string,
  dependencias: { fetch?: typeof fetch; lookup?: Lookup; ahora?: Date } = {},
): Promise<{ clientId: string; nombre: string; redirectUris: string[] }> {
  let url: URL;
  try { url = new URL(clientId); } catch { throw new ErrorCimd("client_id debe ser una URL https."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new ErrorCimd("client_id debe ser una URL https.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || isIP(host) !== 0 || host.toLowerCase() === "metadata.google.internal") {
    throw new ErrorCimd("El host de client_id no es público.");
  }

  const ahora = dependencias.ahora ?? new Date();
  const [existente] = await db.select().from(oauthClientes).where(eq(oauthClientes.clientId, clientId)).limit(1);
  if (existente?.bloqueadoEn) throw new ErrorCimd("El cliente OAuth está bloqueado.");
  if (existente && existente.obtenidoEn >= new Date(ahora.getTime() - 3_600_000)) {
    return { clientId, nombre: existente.nombre, redirectUris: existente.redirectUris };
  }

  const lookup = dependencias.lookup ?? (lookupDns as Lookup);
  const direcciones = await lookup(host, { all: true, verbatim: true });
  if (direcciones.length === 0 || direcciones.some(({ address }) => esDireccionPrivada(address))) {
    throw new ErrorCimd("El host de client_id resuelve a una dirección no pública.");
  }
  const response = await (dependencias.fetch ?? fetch)(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
    headers: { accept: "application/json" },
  });
  if (response.status >= 300 && response.status < 400) throw new ErrorCimd("El documento CIMD no puede redirigir.");
  if (!response.ok) throw new ErrorCimd("No se pudo descargar el documento CIMD.");
  const tipo = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (tipo !== "application/json") throw new ErrorCimd("El documento CIMD debe ser JSON.");
  let documento: unknown;
  try { documento = JSON.parse(await leerConTope(response)); } catch (error) {
    if (error instanceof ErrorCimd) throw error;
    throw new ErrorCimd("El documento CIMD no contiene JSON válido.");
  }
  const objeto = documento as Record<string, unknown>;
  if (objeto.client_id !== clientId || typeof objeto.client_name !== "string" || !objeto.client_name.trim()) {
    throw new ErrorCimd("El documento CIMD no identifica al cliente.");
  }
  if (!Array.isArray(objeto.redirect_uris) || objeto.redirect_uris.length === 0 || objeto.redirect_uris.length > 20
    || objeto.redirect_uris.some((uri) => typeof uri !== "string" || !esRedireccionPermitida(uri))) {
    throw new ErrorCimd("Las redirect_uris del documento CIMD no son válidas.");
  }
  const redirectUris = objeto.redirect_uris as string[];
  const [guardado] = await db.insert(oauthClientes).values({ clientId, nombre: objeto.client_name, redirectUris, obtenidoEn: ahora })
    .onConflictDoUpdate({ target: oauthClientes.clientId, set: { nombre: objeto.client_name, redirectUris, obtenidoEn: ahora } })
    .returning();
  if (guardado.bloqueadoEn) throw new ErrorCimd("El cliente OAuth está bloqueado.");
  return { clientId, nombre: guardado.nombre, redirectUris: guardado.redirectUris };
}
