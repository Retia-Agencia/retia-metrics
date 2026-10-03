export function siguienteQuery(
  actual: URLSearchParams | string,
  cambios: Record<string, string | null>,
): string {
  const params = new URLSearchParams(typeof actual === "string" ? actual : actual.toString());

  for (const [nombre, valor] of Object.entries(cambios)) {
    if (valor === null || valor === "") params.delete(nombre);
    else params.set(nombre, valor);
  }

  params.delete("pagina");
  return params.toString();
}

export function hayFiltrosActivos(actual: URLSearchParams | string, nombres: string[]): boolean {
  const params = new URLSearchParams(typeof actual === "string" ? actual : actual.toString());
  return nombres.some((nombre) => {
    const valor = params.get(nombre);
    return valor !== null && valor !== "";
  });
}
