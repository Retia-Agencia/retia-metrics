import { sinTildes } from "@/lib/busqueda-sin-tildes";

export function slugDesdeNombre(nombre: string): string {
  return sinTildes(nombre)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
