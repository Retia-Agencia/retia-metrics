import { createHash, timingSafeEqual } from "node:crypto";

export const FORMATO_VERIFICADOR_PKCE = /^[A-Za-z0-9\-._~]{43,128}$/;
export const FORMATO_CHALLENGE_PKCE = /^[A-Za-z0-9_-]{43}$/;

export function challengeS256(verificador: string): string | null {
  if (!FORMATO_VERIFICADOR_PKCE.test(verificador)) return null;
  return createHash("sha256").update(verificador).digest("base64url");
}

export function verificarPkce(verificador: string, challenge: string): boolean {
  const calculado = challengeS256(verificador);
  if (!calculado || !FORMATO_CHALLENGE_PKCE.test(challenge)) return false;
  return timingSafeEqual(Buffer.from(calculado), Buffer.from(challenge));
}
