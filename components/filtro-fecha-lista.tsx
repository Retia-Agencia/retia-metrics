"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SelectorPeriodo } from "@/components/selector-periodo";
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
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();

  function elegirCampo(valor: string | null) {
    const params = new URLSearchParams(busqueda.toString());
    params.delete("pagina");
    CLAVES_VIEJAS.forEach((clave) => params.delete(clave));
    if (!valor || valor === SIN_FECHA) {
      params.delete("fecha");
      CLAVES_DE_PERIODO.forEach((clave) => params.delete(clave));
    } else {
      params.set("fecha", valor);
      if (!CLAVES_DE_PERIODO.some((clave) => params.has(clave))) params.set("periodo", "este_mes");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
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
    </div>
  );
}
