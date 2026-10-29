/**
 * Las redes en las que se publica contenido (ADR 0108, ticket 316). Es un TIPO del codigo y no
 * un catalogo: la red viaja como `utm_source` y el emparejador la compara, asi que escribirla
 * libre abriria `instagram`, `Instagram` e `ig` como tres redes (la leccion del ADR 0030).
 * Sumar una red es una linea aqui.
 */
export const REDES_DE_CONTENIDO = ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"] as const;
export type RedDeContenido = (typeof REDES_DE_CONTENIDO)[number];

export function esRedDeContenido(valor: unknown): valor is RedDeContenido {
  return typeof valor === "string" && (REDES_DE_CONTENIDO as readonly string[]).includes(valor);
}
