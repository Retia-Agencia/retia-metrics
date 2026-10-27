import { createHash, timingSafeEqual } from "node:crypto";

function hash(valor: string): Buffer {
  return createHash("sha256").update(valor).digest();
}

export function secretoDeSemaforoValido(request: Request): boolean {
  const esperado = process.env.SEMAFORO_SECRETO;
  const recibido = request.headers.get("x-semaforo-secreto");
  return Boolean(esperado && recibido && timingSafeEqual(hash(esperado), hash(recibido)));
}
