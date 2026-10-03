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

const SIN_FECHA = "sin_fecha";
const CLAVES_DE_PERIODO = ["periodo", "a_desde", "a_hasta", "b_desde", "b_hasta"];
/** Las claves de antes del 136 (`desde`, `hasta`, `rango`): un marcador viejo no debe decidir el periodo. */
const CLAVES_VIEJAS = ["rango", "desde", "hasta"];

interface FiltroFechaListaProps {
  /** Los campos que la lista sabe filtrar, con su etiqueta. */
  campos: readonly { valor: string; etiqueta: string }[];
  /** El filtro vigente, resuelto en el servidor con `filtroDeFechaDeLaUrl`; `null` si no hay. */
  filtro: { campo: string; periodo: PeriodoResuelto } | null;
}

/**
 * El filtro de fecha de una lista (ticket 141): sobre qué fecha, y el mismo selector de periodo
 * del dashboard (136) en modo "solo A". Vive en la URL como el resto de los filtros; el cliente
 * nunca calcula el día, lo resuelve el servidor en Bogotá.
 *
 * Elegir un campo sin periodo arranca en "Este mes"; quitarlo borra también el periodo, para que
 * la URL no guarde un rango que ya no filtra nada.
 */
export function FiltroFechaLista({ campos, filtro }: FiltroFechaListaProps) {
  const { busqueda, poner } = useFiltrosUrl();

  function elegirCampo(valor: string | null) {
    const cambios: Record<string, string | null> = Object.fromEntries(CLAVES_VIEJAS.map((clave) => [clave, null]));
    if (!valor || valor === SIN_FECHA) {
      cambios.fecha = null;
      CLAVES_DE_PERIODO.forEach((clave) => { cambios[clave] = null; });
    } else {
      cambios.fecha = valor;
      if (!CLAVES_DE_PERIODO.some((clave) => busqueda.has(clave))) cambios.periodo = "este_mes";
    }
    poner(cambios);
  }

  return (
    <BarraDeFiltros nombres={["fecha", ...CLAVES_DE_PERIODO, ...CLAVES_VIEJAS]}>
      <Select
        value={filtro?.campo ?? SIN_FECHA}
        // Sin `items`, Base UI pinta el valor crudo en el disparador.
        items={[{ value: SIN_FECHA, label: "Sin filtro de fecha" }, ...campos.map((c) => ({ value: c.valor, label: c.etiqueta }))]}
        onValueChange={elegirCampo}
      >
        <SelectTrigger className="w-52" aria-label="Filtrar por fecha">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN_FECHA}>Sin filtro de fecha</SelectItem>
          {campos.map((c) => (
            <SelectItem key={c.valor} value={c.valor}>
              {c.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {filtro ? (
        <SelectorPeriodo periodo={filtro.periodo} soloA cohorteDisponible={false} anteriorDisponible={false} />
      ) : null}
    </BarraDeFiltros>
  );
}
