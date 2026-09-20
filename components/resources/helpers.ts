import type { EnlaceUI } from "./types";

export const TODOS = "todos";
export const GLOBAL = "__global__";

/** Agrupa los enlaces por programa y, dentro, por producto (o "Sin producto"). */
export function agruparEnlaces(enlaces: EnlaceUI[]) {
  const porPrograma = new Map<string, Map<string, EnlaceUI[]>>();
  for (const enlace of enlaces) {
    const programa = enlace.programaNombre ?? "Sin programa";
    const producto = enlace.productoNombre ?? "Sin producto";
    if (!porPrograma.has(programa)) porPrograma.set(programa, new Map());
    const productos = porPrograma.get(programa)!;
    if (!productos.has(producto)) productos.set(producto, []);
    productos.get(producto)!.push(enlace);
  }
  return [...porPrograma.entries()].map(([programa, productos]) => ({
    programa,
    productos: [...productos.entries()].map(([producto, enlaces]) => ({ producto, enlaces })),
  }));
}
