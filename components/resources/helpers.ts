import type { EnlaceUI } from "./types";

/** Agrupa los enlaces por programa. */
export function agruparEnlaces(enlaces: EnlaceUI[]) {
  const porPrograma = new Map<string, EnlaceUI[]>();
  for (const enlace of enlaces) {
    const programa = enlace.programaNombre ?? "Sin programa";
    if (!porPrograma.has(programa)) porPrograma.set(programa, []);
    porPrograma.get(programa)!.push(enlace);
  }
  return [...porPrograma.entries()].map(([programa, enlacesDelPrograma]) => ({
    programa,
    enlaces: enlacesDelPrograma,
  }));
}
