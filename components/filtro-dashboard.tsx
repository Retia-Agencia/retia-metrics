"use client";

import { SelectorPeriodo } from "@/components/selector-periodo";
import { BarraDeLista } from "@/components/filtros/barra-de-lista";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { OpcionDeCloser } from "@/lib/queries/dashboard";

/**
 * Filtro del dashboard sobre la barra de lista (ticket 005, migrado por el ticket 202):
 * el periodo (chip compacto) y el closer, los dos a la vista; sin popover (no hace
 * falta). No lleva conteo de resultados: un dashboard no es una lista de un solo total.
 *
 * Vive en la URL, no en estado del componente: así un dashboard filtrado se puede
 * compartir o recargar, y el servidor arma la vista sin un ida y vuelta de cliente. El
 * closer de la URL es su `users.id` (Decisión 5, ticket 167); ningún dato personal de un
 * lead pasa por acá. Las claves de periodo que se limpian son las mismas de siempre.
 */

const CLAVES_DE_PERIODO = ["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta", "rango", "desde", "hasta"];

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
          aVista: true,
          opciones: closers.map((c) => ({ value: c.id, label: c.label })),
        },
      ]
    : [];

  return (
    <BarraDeLista
      filtros={filtros}
      compuestosAVista={
        <SelectorPeriodo
          periodo={periodo}
          cohorteDisponible={cohorteDisponible}
          anteriorDisponible={anteriorDisponible}
          variante="chip"
        />
      }
      clavesCompuestas={CLAVES_DE_PERIODO}
      compuestoActivo={false}
      aviso={periodo.aviso ? periodo.aviso : undefined}
    />
  );
}
