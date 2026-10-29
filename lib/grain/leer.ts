import { ErrorDeGrain } from "./errores";
import { parsearPaginaDeGrain, type TranscriptCrudo } from "./parser";

/**
 * Lee el transcript de un link de Grain (ADR 0112 punto 1). EL unico lugar que habla con
 * Grain por la red: si Grain cambia o se paga su API (plan B), cambia solo `lib/grain/`.
 * Solo lectura, sin sesion ni token. Solo https hacia grain.com: el link lo pega un humano y
 * el servidor lo visita, asi que no se sigue ningun otro host (SSRF).
 */

const HOSTS = new Set(["grain.com", "www.grain.com"]);
const RUTA = /^\/(note|share\/recording)\//;
export const TIMEOUT_GRAIN_MS = 20_000;

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

export function linkDeGrainValido(link: string): URL | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  return url.protocol === "https:" && HOSTS.has(url.hostname) && RUTA.test(url.pathname) ? url : null;
}

export async function leerTranscriptDeGrain(link: string, fetcher: Fetcher = fetch): Promise<TranscriptCrudo> {
  const url = linkDeGrainValido(link);
  if (!url) throw new ErrorDeGrain("link_invalido");
  let respuesta: Response;
  try {
    respuesta = await fetcher(url.toString(), {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_GRAIN_MS),
      headers: { "user-agent": "Mozilla/5.0 (compatible; RetiaCRM/1.0)", accept: "text/html" },
    });
  } catch (error) {
    throw new ErrorDeGrain("red", error instanceof Error ? error.name : "fallo");
  }
  if (respuesta.status >= 300 && respuesta.status < 400) {
    // Un redireccion a login es una grabacion privada; a otro host nunca se sigue.
    throw new ErrorDeGrain("bloqueado", `redireccion ${respuesta.status}`);
  }
  if (respuesta.status === 404 || respuesta.status === 410) throw new ErrorDeGrain("no_encontrado");
  if (respuesta.status === 401 || respuesta.status === 403) throw new ErrorDeGrain("bloqueado", String(respuesta.status));
  if (!respuesta.ok) throw new ErrorDeGrain("red", `http ${respuesta.status}`);
  return parsearPaginaDeGrain(await respuesta.text());
}
