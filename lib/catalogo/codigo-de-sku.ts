import { normalizarProducto } from "./normalizar-producto";

/** Código estable que la UI puede anticipar sin consultar la base. */
export function codigoDeSku(programSlug: string, nombre: string, n: number): string {
  return `${programSlug.replaceAll("-", "_")}_${normalizarProducto(nombre)}_c${n}`;
}
