"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rutaAlCambiarDePrograma } from "@/lib/nav";

type Programa = { slug: string; nombre: string };

/**
 * El selector de programa, arriba de la barra (ADR 0050, ticket 097). Los programas
 * nunca se suman ni se promedian entre si, asi que se navega de uno a otro: elegir otro
 * cambia la URL y mantiene la tab (`rutaAlCambiarDePrograma`). La lista llega ya acotada
 * al alcance de la sesion (ADR 0048) y como dato (ADR 0012): este componente no conoce
 * ningun programa. Ofrecer solo los visibles es comodidad; la reja es el 404 de la ruta.
 */
export function ProgramSwitcher({
  programas,
  actual,
}: {
  programas: readonly Programa[];
  /** El programa de la URL, o el que abren las tabs de programa si la ruta no tiene uno. */
  actual: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();

  if (programas.length === 0 || !actual) return null;

  return (
    <Select
      value={actual}
      // Sin `items`, Base UI pinta el VALOR (el slug) en el trigger, no el nombre.
      items={programas.map((p) => ({ value: p.slug, label: p.nombre }))}
      onValueChange={(slug) => {
        if (typeof slug === "string" && slug !== actual) {
          router.push(rutaAlCambiarDePrograma(pathname, slug));
        }
      }}
    >
      <SelectTrigger className="w-full" aria-label="Programa">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {programas.map((p) => (
          <SelectItem key={p.slug} value={p.slug}>
            {p.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
