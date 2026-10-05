export const COOKIE_PROGRAMA_PREFERIDO = "programa_preferido";

export function slugParaRecordar(
  pathname: string,
  searchParams: URLSearchParams,
): string | null {
  const dePrograma = pathname.match(/^\/p\/([^/]+)(?:\/|$)/)?.[1];
  if (dePrograma) return dePrograma;

  if (pathname !== "/mi-espacio") return null;
  const deMiEspacio = searchParams.get("programa");
  return deMiEspacio && deMiEspacio !== "todos" ? deMiEspacio : null;
}

export function elegirPrograma<T extends { slug: string }>(
  visibles: readonly T[],
  preferido: string | null | undefined,
): T | null {
  return visibles.find((programa) => programa.slug === preferido) ?? visibles[0] ?? null;
}
