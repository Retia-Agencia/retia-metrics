import { z } from "zod";

export const IDENTIFICADORES_MCP = [
  "id_de_la_persona",
  "id_del_deal",
  "id_de_la_llamada",
  "id_del_abono",
  "id_del_envio",
  "id_de_la_cohorte",
  "id_del_usuario",
  "id_del_anuncio",
  "id_del_contacto",
  "programa",
] as const;

export const ALIAS_DE_IDENTIFICADORES = {
  lead_id: "id_de_la_persona",
  id_del_lead: "id_de_la_persona",
  deal_id: "id_del_deal",
} as const;

/** Acepta un alias retrocompatible, pero entrega siempre la clave canónica. */
export function conAlias<S extends z.ZodRawShape, C extends keyof S & string, A extends Record<string, C>>(
  esquemaStrict: z.ZodObject<S>,
  alias: A,
): z.ZodObject<S & { [K in keyof A]: z.ZodOptional<z.ZodUnknown> }> {
  const aliasShape = Object.fromEntries(Object.keys(alias).map((clave) => [clave, z.unknown().optional()]));
  const conAliasDeclarado = esquemaStrict.extend(aliasShape).strict().superRefine((valor, contexto) => {
    const recibido = valor as Record<string, unknown>;
    for (const [antiguo, canonico] of Object.entries(alias)) {
      if (recibido[antiguo] !== undefined && recibido[canonico] !== undefined) {
        contexto.addIssue({ code: "custom", path: [antiguo], message: `Usa ${canonico} o ${antiguo}, no ambos.` });
      }
    }
  }).overwrite((valor) => {
    const normalizado = { ...valor } as Record<string, unknown>;
    for (const [antiguo, canonico] of Object.entries(alias)) {
      if (normalizado[canonico] === undefined && normalizado[antiguo] !== undefined) normalizado[canonico] = normalizado[antiguo];
      delete normalizado[antiguo];
    }
    return normalizado as typeof valor;
  });
  return conAliasDeclarado as unknown as z.ZodObject<S & { [K in keyof A]: z.ZodOptional<z.ZodUnknown> }>;
}
