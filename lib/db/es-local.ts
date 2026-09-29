/**
 * "¿Esta URL de base apunta a una base LOCAL?" — UNA sola respuesta (regla dura de
 * AGENTS.md: si dos lugares responden la misma pregunta, la respuesta vive en un
 * modulo y los dos la importan).
 *
 * La preguntan dos lugares: la guardia de `scripts/db-local-url.ts` (que ademas LANZA
 * para abortar una operacion contra una base remota) y el proveedor de login local
 * (`lib/auth/`, que solo se registra si la base es local). Antes vivia solo en el
 * script; moverla aqui evita una segunda copia que se desincronice, justo el peligro
 * que el proveedor de login abriria si volviera a escribir el mismo check a mano.
 *
 * No depende de nada del entorno ni de la base: es un predicado puro sobre un string.
 */

/**
 * `true` solo si `urlStr` es una URL valida que apunta a `localhost`/`127.0.0.1` y no
 * contiene ninguna referencia a Supabase o a la produccion de este repo. Un string
 * invalido, un host remoto o una pista de produccion devuelven `false`.
 *
 * Es el predicado que `esUrlLocal` usa para decidir, y `exigirUrlLocal` para abortar:
 * la LISTA de razones vive en un solo lugar.
 */
export function esUrlLocal(urlStr: string): boolean {
  return razonNoLocal(urlStr) === null;
}

/**
 * La razon por la que `urlStr` NO es local, o `null` si lo es. Se expone para que la
 * guardia del script lance un mensaje que diga QUE falla, sin duplicar la logica.
 */
export function razonNoLocal(urlStr: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return `URL de conexión inválida: "${urlStr}"`;
  }

  const host = parsed.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    return (
      `La URL "${urlStr}" apunta a "${host}", que no es localhost ni 127.0.0.1. ` +
      `Operación abortada inmediatamente para proteger bases remotas y producción.`
    );
  }

  if (
    urlStr.includes("supabase.com") ||
    urlStr.includes("pooler.supabase.com") ||
    urlStr.includes("hfqmiyiuyqapdsbywrag")
  ) {
    return "La URL contiene referencias a Supabase/producción.";
  }

  return null;
}
