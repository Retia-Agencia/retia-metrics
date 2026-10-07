"use client";

import { SelectorPeriodo } from "@/components/selector-periodo";
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

/** Todas las claves de la URL que mueve este filtro: para que "Quitar todo" las limpie (ticket 202). */
export const CLAVES_DE_FECHA_LISTA = ["fecha", ...CLAVES_DE_PERIODO, ...CLAVES_VIEJAS];

interface FiltroFechaListaProps {
  /** Los campos que la lista sabe filtrar, con su etiqueta. */
  campos: readonly { valor: string; etiqueta: string }[];
  /** El filtro vigente, resuelto en el servidor con `filtroDeFechaDeLaUrl`; `null` si no hay. */
  filtro: { campo: string; periodo: PeriodoResuelto } | null;
}

/**
 * El filtro de fecha de una lista (ticket 141), ahora como piezas compactas para la barra
 * de lista (ticket 202): un chip de 32 px con el campo ("Fecha: Creado") y, cuando hay
 * campo, el chip del periodo (`SelectorPeriodo variante="chip"`, modo "solo A"). Sin el
 * contenedor `BarraDeFiltros` de antes: la barra las ubica en `compuestosAVista` y limpia
 * sus claves con "Quitar todo".
 *
 * Vive en la URL como el resto de los filtros; el cliente nunca calcula el día, lo
 * resuelve el servidor en Bogotá. Elegir un campo sin periodo arranca en "Este mes";
 * quitarlo borra también el periodo, para que la URL no guarde un rango que ya no filtra.
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

  const activo = filtro != null;

  return (
    <>
      <Select
        value={filtro?.campo ?? SIN_FECHA}
        // Sin `items`, Base UI pinta el valor crudo en el disparador.
        items={[{ value: SIN_FECHA, label: "Sin filtro de fecha" }, ...campos.map((c) => ({ value: c.valor, label: c.etiqueta }))]}
        onValueChange={elegirCampo}
      >
        <SelectTrigger
          size="sm"
          aria-label="Filtrar por fecha"
          className={activo ? "border-marca/50 text-marca-texto" : undefined}
        >
          <span className="text-muted-foreground">Fecha:</span>
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
        <SelectorPeriodo
          periodo={filtro.periodo}
          soloA
          cohorteDisponible={false}
          anteriorDisponible={false}
          variante="chip"
        />
      ) : null}
    </>
  );
}
