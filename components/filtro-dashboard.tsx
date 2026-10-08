"use client";

import { SelectorPeriodo } from "@/components/selector-periodo";
import { BarraDeLista } from "@/components/filtros/barra-de-lista";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { OpcionDeCloser } from "@/lib/queries/dashboard";

/**
 * Filtro del dashboard sobre la barra de lista (ticket 005, migrado por el ticket 202):
 * el periodo es el marco de comparación A vs B y el closer vive en el popover. No lleva
 * conteo de resultados: un dashboard no es una lista de un solo total.
 *
 * Vive en la URL, no en estado del componente: así un dashboard filtrado se puede
 * compartir o recargar, y el servidor arma la vista sin un ida y vuelta de cliente. El
 * closer de la URL es su `users.id` (Decisión 5, ticket 167); ningún dato personal de un
 * lead pasa por acá. El periodo no se limpia junto con los filtros: no es un filtro.
 */

export interface FiltroProps {
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
  /** El closer elegido: su `users.id`, o null si se mira todo el programa. */
  claveCloser: string | null;
  closers: readonly OpcionDeCloser[];
  /** Solo se ofrece el rango de la cohorte si hay una vendiendo con ventana (ADR 0022). */
  cohorteDisponible: boolean;
  /** Sin equipo comercial (paid trafficker, ticket 102) no hay filtro de closer. */
  filtraCloser?: boolean;
}

export function FiltroDashboard({
  periodo,
  anteriorDisponible,
  claveCloser,
  closers,
  cohorteDisponible,
  filtraCloser = true,
}: FiltroProps) {
  void claveCloser; // El valor vigente lo lee la barra de la URL.
  const filtros: FiltroDeclarado[] = filtraCloser
    ? [
        {
          tipo: "select",
          nombre: "closer",
          etiqueta: "Closer",
          todos: "Todos los closers",
          opciones: closers.map((c) => ({ value: c.id, label: c.label })),
        },
      ]
    : [];

  return (
    <BarraDeLista
      filtros={filtros}
      marco={
        <SelectorPeriodo
          periodo={periodo}
          cohorteDisponible={cohorteDisponible}
          anteriorDisponible={anteriorDisponible}
          variante="chip"
        />
      }
      aviso={periodo.aviso ? periodo.aviso : undefined}
    />
  );
}
