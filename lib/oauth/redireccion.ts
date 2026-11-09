import { isIP } from "node:net";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function urlValida(valor: string): URL | null {
  try { return new URL(valor); } catch { return null; }
}

export function esRedireccionPermitida(valor: string): boolean {
  const url = urlValida(valor);
  if (!url || url.username || url.password || url.hash) return false;
  if (url.protocol === "https:") return true;
  return url.protocol === "http:" && LOOPBACK.has(url.hostname);
}

export function coincideRedireccion(pedida: string, publicadas: readonly string[]): boolean {
  if (publicadas.includes(pedida)) return true;
  const solicitud = urlValida(pedida);
  if (!solicitud || solicitud.protocol !== "http:" || !LOOPBACK.has(solicitud.hostname)) return false;
  return publicadas.some((valor) => {
    const publicada = urlValida(valor);
    return publicada?.protocol === "http:"
      && LOOPBACK.has(publicada.hostname)
      && publicada.pathname === solicitud.pathname
      && publicada.search === solicitud.search;
  });
}

export function esHostIp(host: string): boolean {
  return isIP(host.replace(/^\[|\]$/g, "")) !== 0;
}
