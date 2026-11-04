"use client";

import { useId } from "react";
import { SelectorPeriodo } from "@/components/selector-periodo";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { OpcionDeCloser } from "@/lib/queries/dashboard";

/**
 * La barra de filtros del Hub (377, G-1): cuatro controles, cada uno por su lado y siempre en este orden,
 * con su etiqueta escrita: Cohorte · Periodo · Closer · Comparar con. Daniel Tovar: "o es el periodo o es
 * el SKU, o son ambas cosas pero separadas". Un SKU es producto × cohorte; con un producto por programa,
 * Cohorte ES el filtro de SKU (cuando entre el 376 se suma Producto al lado, sin tocar este).
 *
 * Todo vive en la URL, no en estado del componente, así un Hub filtrado se comparte o se recarga y el
 * servidor arma la vista sin ida y vuelta de cliente. El closer de la URL es su `users.id` (Decisión 5,
 * ticket 167); la cohorte, su id o `todas`. Ningún dato personal de un lead pasa por aquí.
 */

export interface FiltroProps {
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
  /** El closer elegido: su `users.id`, o null si se mira todo el programa. */
  claveCloser: string | null;
  closers: readonly OpcionDeCloser[];
  /** Sin equipo comercial (paid trafficker, ticket 102) no hay filtro de closer. */
  filtraCloser?: boolean;
  /** La cohorte del filtro: `todas` o su id. Ausente = la pestaña no filtra por cohorte (Pauta y Origen). */
  cohorte?: { valor: string; opciones: readonly { id: string; codigo: string; activa: boolean }[] };
  /** La línea bajo el filtro Cohorte: cuándo se vende y cuándo fue la primera venta. */
  lineaDeCohorte?: string;
}

const TODAS = "todas";
const TODOS = "todos";
const claseEtiqueta = "text-muted-foreground";

function ControlConEtiqueta({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-center gap-1.5 text-sm" role="group" aria-labelledby={id}>
      <span id={id} className={claseEtiqueta}>{etiqueta}:</span>
      {children}
    </div>
  );
}

export function FiltroDashboard({
  periodo,
  anteriorDisponible,
  claveCloser,
  closers,
  filtraCloser = true,
  cohorte,
  lineaDeCohorte,
}: FiltroProps) {
  const { poner, pendiente } = useFiltrosUrl();

  return (
    <div className="space-y-1 transition-opacity data-[pendiente=true]:opacity-60" data-pendiente={pendiente}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Filtros del Hub">
        {cohorte ? (
          <ControlConEtiqueta etiqueta="Cohorte">
            <Select
              value={cohorte.valor}
              items={[{ value: TODAS, label: "Todas" }, ...cohorte.opciones.map((o) => ({ value: o.id, label: o.activa ? `${o.codigo} (activa)` : o.codigo }))]}
              onValueChange={(elegida: string | null) => { if (elegida) poner({ cohorte: elegida, pagina: null }); }}
            >
              <SelectTrigger size="sm" aria-label="Cohorte"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas</SelectItem>
                {cohorte.opciones.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.activa ? `${o.codigo} (activa)` : o.codigo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ControlConEtiqueta>
        ) : null}

        <SelectorPeriodo periodo={periodo} anteriorDisponible={anteriorDisponible} partes="periodo" variante="chip" />

        {filtraCloser ? (
          <ControlConEtiqueta etiqueta="Closer">
            <Select
              value={claveCloser ?? TODOS}
              items={[{ value: TODOS, label: "Todos los closers" }, ...closers.map((c) => ({ value: c.id, label: c.label }))]}
              onValueChange={(elegido: string | null) => poner({ closer: !elegido || elegido === TODOS ? null : elegido, pagina: null })}
            >
              <SelectTrigger size="sm" aria-label="Closer"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los closers</SelectItem>
                {closers.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </ControlConEtiqueta>
        ) : null}

        <SelectorPeriodo periodo={periodo} anteriorDisponible={anteriorDisponible} partes="comparacion" variante="chip" />
      </div>
      {lineaDeCohorte ? <p className="cifra text-xs text-muted-foreground">{lineaDeCohorte}</p> : null}
      {periodo.aviso ? <p role="status" className="text-xs text-muted-foreground">{periodo.aviso}</p> : null}
    </div>
  );
}
