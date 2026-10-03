"use client";

import { SelectorPeriodo } from "@/components/selector-periodo";
import { BarraDeFiltros } from "@/components/filtros/barra-de-filtros";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
import type { PeriodoResuelto } from "@/lib/periodo";
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
  const { poner } = useFiltrosUrl();

  return (
    <BarraDeFiltros nombres={["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta", "rango", "desde", "hasta", "closer"]}>
      <SelectorPeriodo periodo={periodo} cohorteDisponible={cohorteDisponible} anteriorDisponible={anteriorDisponible} />

      <Select
        value={closerId ?? TODOS}
        onValueChange={(valor: string | null) =>
          poner({ closer: valor === null || valor === TODOS ? null : valor })
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
    </BarraDeFiltros>
  );
}
