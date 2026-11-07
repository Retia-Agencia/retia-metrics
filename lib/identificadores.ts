import { z } from "zod";

export const ID_OPACO_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const idOpacoSchema = z.string().regex(ID_OPACO_REGEX, "Usa el id opaco que devuelve el CRM.");

export function esIdOpaco(valor: string): boolean {
  return ID_OPACO_REGEX.test(valor);
}
