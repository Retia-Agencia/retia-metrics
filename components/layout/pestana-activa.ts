export function pestanaActiva<T extends { id: string; total?: number }>(
  pedida: string | undefined,
  pestanas: readonly T[],
  porDefecto?: string,
): string {
  if (pedida && pestanas.some((pestana) => pestana.id === pedida)) return pedida;
  if (porDefecto && pestanas.some((pestana) => pestana.id === porDefecto)) return porDefecto;
  return pestanas.find((pestana) => (pestana.total ?? 0) > 0)?.id ?? pestanas[0]?.id ?? "";
}

export function urlConSeccion(
  base: string,
  query: Record<string, string | string[] | undefined>,
  valor: string | null,
  opciones: { parametro?: string; limpiar?: string[] } = {},
): string {
  const parametro = opciones.parametro ?? "seccion";
  const descartadas = new Set([parametro, ...(opciones.limpiar ?? [])]);
  const params = new URLSearchParams();

  for (const [clave, contenido] of Object.entries(query)) {
    if (descartadas.has(clave) || contenido === undefined) continue;
    if (Array.isArray(contenido)) contenido.forEach((item) => params.append(clave, item));
    else params.set(clave, contenido);
  }

  if (valor !== null) params.set(parametro, valor);
  const queryString = params.toString();
  return queryString ? `${base}?${queryString}` : base;
}
