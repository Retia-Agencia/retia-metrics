import { z } from "zod";

import { ErrorDeApp } from "@/lib/errors";

/**
 * Traduce los errores de validacion de zod al contrato de `lib/errors`.
 *
 * El molde de catalogo y los esquemas lanzan `ZodError` cuando la entrada no
 * valida; el llamador (una server action, un route handler, un script) tiene que
 * recibir siempre un `ErrorDeApp` con `status`, nunca un error crudo que se
 * filtre al navegador. La misma pregunta —"¿como sale una entrada invalida hacia
 * el cliente?"— vivia copiada byte a byte en NUEVE modulos de `lib/catalogo/` y
 * `lib/mutations/`; por la regla de AGENTS.md ("si dos lugares responden la MISMA
 * pregunta, la respuesta vive en un modulo y los dos la importan") vive aca y
 * ellos la importan.
 *
 * Vive fuera de `lib/errors.ts` a proposito: ese modulo no importa nada, y todo
 * route handler que solo necesita `ErrorDeApp` no tiene por que arrastrar zod.
 * Es el mismo reparto que ya existe con `lib/db/errores.ts` para los codigos de
 * Postgres.
 */
export async function normalizando<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ErrorDeApp) throw error;
    if (error instanceof z.ZodError) {
      throw new ErrorDeApp(error.issues[0]?.message ?? "Petición inválida.", 400);
    }
    throw error;
  }
}
