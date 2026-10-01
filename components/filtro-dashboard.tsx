"use client";

import { SelectorPeriodo } from "@/components/selector-periodo";
import type { PeriodoResuelto } from "@/lib/periodo";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Filtro del dashboard: rango de fechas y closer (ticket 005).
 *
 * Vive en la URL, no en estado del componente: asi un dashboard filtrado se puede
 * compartir o recargar, y el servidor arma la vista sin un ida y vuelta de cliente.
 * Los identificadores que van a la URL son el preset, las dos fechas y el closerId
 * (texto del closer, ADR 0011): ningun dato personal de un lead (correo, telefono)
 * pasa por aca.
 */

const TODOS = "todos";

export interface FiltroProps {
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
  closerId: string | null;
  closers: readonly string[];
  /** Solo se ofrece el rango de la cohorte si hay una vendiendo con ventana (ADR 0022). */
  cohorteDisponible: boolean;
}

export function FiltroDashboard({
  periodo,
  anteriorDisponible,
  closerId,
  closers,
  cohorteDisponible,
}: FiltroProps) {
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();

  function navegar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(busqueda.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) params.delete(clave);
      else params.set(clave, valor);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <SelectorPeriodo periodo={periodo} cohorteDisponible={cohorteDisponible} anteriorDisponible={anteriorDisponible} />

      <Select
        value={closerId ?? TODOS}
        onValueChange={(valor: string | null) =>
          navegar({ closer: valor === null || valor === TODOS ? null : valor })
        }
      >
        <SelectTrigger className="w-44" aria-label="Closer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los closers</SelectItem>
          {closers.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
