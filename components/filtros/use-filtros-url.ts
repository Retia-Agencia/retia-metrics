"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { siguienteQuery } from "@/components/filtros/query";

export function useFiltrosUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();

  function poner(cambios: Record<string, string | null>) {
    const query = siguienteQuery(busqueda, cambios);
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function quitar(nombres: string[]) {
    poner(Object.fromEntries(nombres.map((nombre) => [nombre, null])));
  }

  return { busqueda, poner, quitar };
}
