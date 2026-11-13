import { createHash, timingSafeEqual } from "node:crypto";

function hash(valor: string): Buffer {
  return createHash("sha256").update(valor).digest();
}

export function secretoDeSemaforoValido(request: Request): boolean {
  return secretoDeMaquinaValido(request, { header: "x-semaforo-secreto", variable: "SEMAFORO_SECRETO" });
}

export function secretoDeMaquinaValido(
  request: Request,
  { header, variable }: { header: string; variable: string },
): boolean {
  const esperado = process.env[variable];
  const recibido = request.headers.get(header);
  return Boolean(esperado && recibido && timingSafeEqual(hash(esperado), hash(recibido)));
}
