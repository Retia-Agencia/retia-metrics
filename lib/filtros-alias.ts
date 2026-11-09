/**
 * Nombres viejos de parametros de lista que siguen funcionando (ticket 360, regla 5 de
 * `components/filtros/declaracion.ts`). Un enlace guardado antes del renombre
 * (`?owner=`, `?leadQuality=`, `?leadValue=`) se traduce al nombre vigente; si vienen
 * ambos, gana el vigente. PURO: lo usan la consulta (`parsearFiltros`) y la pagina
 * (que redirige al nombre vigente para que el chip refleje el filtro).
 */
export const ALIAS_DE_PARAMETROS: Readonly<Record<string, string>> = {
  owner: "closer",
  leadQuality: "calidad",
  leadValue: "valor",
};

type Busqueda = Record<string, string | string[] | undefined>;

/** La busqueda con los nombres vigentes. No muta la entrada. */
export function conNombresVigentes(busqueda: Busqueda): Busqueda {
  const salida: Busqueda = { ...busqueda };
  for (const [viejo, vigente] of Object.entries(ALIAS_DE_PARAMETROS)) {
    if (!(viejo in salida)) continue;
    const valor = salida[viejo];
    delete salida[viejo];
    const actual = salida[vigente];
    if (actual === undefined || actual === "") salida[vigente] = valor;
  }
  return salida;
}

/** ¿Trae algun nombre viejo? Decide si la pagina redirige. */
export function traeNombresViejos(busqueda: Busqueda): boolean {
  return Object.keys(ALIAS_DE_PARAMETROS).some((viejo) => viejo in busqueda);
}

/** La query string con los nombres vigentes (arreglos repetidos incluidos). */
export function queryConNombresVigentes(busqueda: Busqueda): string {
  const u = new URLSearchParams();
  for (const [clave, valor] of Object.entries(conNombresVigentes(busqueda))) {
    if (Array.isArray(valor)) valor.forEach((v) => u.append(clave, v));
    else if (valor !== undefined) u.set(clave, valor);
  }
  return u.toString();
}
