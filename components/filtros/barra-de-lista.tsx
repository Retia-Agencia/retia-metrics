"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { ArrowUpDown, Loader2, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { num } from "@/lib/format";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
import {
  activosEnPopover,
  cambiosParaQuitar,
  etiquetasActivas,
  valorDeFiltro,
  type FiltroDeclarado,
} from "@/components/filtros/declaracion";

const TODOS = "todos";
const InformarOrdenPendiente = createContext<(pendiente: boolean) => void>(() => {});

/**
 * La barra de lista (ticket 202, A-105): una sola fila de herramientas de 32 px —búsqueda,
 * el popover "Filtros · n", orden aparte y un slot de
 * acciones de vista— más una línea de estado con el conteo, los filtros activos con × y
 * "Quitar todo". Es UNA pieza reutilizable que escala por declaración: cada pantalla
 * declara sus filtros (`FiltroDeclarado[]`) y la barra deriva chips, popover, conteo,
 * etiquetas y las claves de "Quitar todo" de esa lista (regla 4). Un filtro nuevo es una
 * entrada, no un componente.
 *
 * Todo vive en la URL con `useFiltrosUrl` (ADR 0023); los nombres de los parámetros NO
 * cambian (regla 5). Las piezas compuestas (periodo, rango de fechas) no se reescriben:
 * llegan ya pintadas como nodos (`compuestosPopover`) y sus claves
 * extra se declaran en `clavesCompuestas` para que "Quitar todo" también las limpie.
 *
 * Sigue Tinta (§9): sin color/sombra/radio a mano, el acento morado solo para un chip
 * activo (vía `aria-expanded`/foco del Button y el token `marca`), las cifras en `cifra`.
 */
export interface BarraDeListaProps {
  /**
   * El total de resultados tras aplicar los filtros ("N resultados"). Opcional: el
   * dashboard no es una lista con un conteo único, así que lo omite y la línea de estado
   * solo muestra los filtros activos.
   */
  total?: number;
  /** Singular/plural del sustantivo contado. Por defecto "resultado"/"resultados". */
  sustantivo?: { singular: string; plural: string };
  /** Los filtros declarados (seleccion simple). La barra deriva todo de aquí. */
  filtros: FiltroDeclarado[];
  /** El buscador, ya pintado (conserva su server action y debounce). Opcional. */
  buscador?: ReactNode;
  /** El marco de la comparación, no un filtro. Solo lo usa el Dashboard para A vs B. */
  marco?: ReactNode;
  /** Piezas compuestas que van DENTRO del popover (p. ej. un rango de fechas). */
  compuestosPopover?: ReactNode;
  /** Las claves de la URL de las piezas compuestas, para que "Quitar todo" las limpie. */
  clavesCompuestas?: string[];
  /** ¿Hay alguna pieza compuesta ACTIVA? La barra no puede saberlo (es un nodo opaco). */
  compuestoActivo?: boolean;
  /** El control de orden, ya pintado y separado de los filtros. Opcional. */
  orden?: ReactNode;
  /** Acciones de vista a la derecha (p. ej. Tarjetas/Tabla de Leads). Opcional. */
  acciones?: ReactNode;
  /** Un resumen para la línea de estado cuando NO hay filtros activos (p. ej. Students). */
  resumen?: ReactNode;
  /** Un aviso (p. ej. el del periodo que cayó a Hoy). Va al final de la línea de estado. */
  aviso?: ReactNode;
}

export function BarraDeLista({
  total,
  sustantivo = { singular: "resultado", plural: "resultados" },
  filtros,
  buscador,
  marco,
  compuestosPopover,
  clavesCompuestas = [],
  compuestoActivo = false,
  orden,
  acciones,
  resumen,
  aviso,
}: BarraDeListaProps) {
  const { busqueda, poner, pendiente } = useFiltrosUrl();
  const [ordenPendiente, setOrdenPendiente] = useState(false);
  const leer = (nombre: string) => busqueda.get(nombre);

  const nPopover = activosEnPopover(filtros, leer) + (compuestoActivo ? 1 : 0);
  const activas = etiquetasActivas(filtros, leer);
  const hayActivos = activas.length > 0 || compuestoActivo;
  const hayNavegacionPendiente = pendiente || ordenPendiente;

  const quitarTodos = {
    ...cambiosParaQuitar(filtros),
    ...Object.fromEntries(clavesCompuestas.map((clave) => [clave, null])),
  };

  return (
    <InformarOrdenPendiente value={setOrdenPendiente}>
      <div
        className="space-y-2 transition-opacity data-[pendiente=true]:opacity-60"
        data-pendiente={hayNavegacionPendiente}
      >
      <div className="flex flex-wrap items-center gap-2">
        {marco}

        {buscador ? <div className="min-w-48 flex-1 basis-56">{buscador}</div> : null}

        {filtros.length > 0 || compuestosPopover ? (
          <Popover>
            <PopoverTrigger
              render={<Button type="button" variant="outline" size="sm" className="aria-expanded:border-ring" />}
              aria-busy={pendiente}
            >
              {pendiente ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <SlidersHorizontal aria-hidden />}
              Filtros
              {nPopover > 0 ? (
                <>
                  {" · "}
                  <span className="cifra">{num(nPopover)}</span>
                </>
              ) : null}
            </PopoverTrigger>
            <PopoverContent aria-label="Más filtros">
              <div className="space-y-3">
                {filtros.map((filtro) => (
                  <FilaDeFiltro key={filtro.nombre} filtro={filtro} valor={valorDeFiltro(filtro, leer)} onElegir={poner} />
                ))}
                {compuestosPopover}
                {nPopover > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => poner({
                      ...cambiosParaQuitar(filtros),
                      ...Object.fromEntries(clavesCompuestas.map((clave) => [clave, null])),
                    })}
                  >
                    <X aria-hidden />
                    Quitar filtros
                  </Button>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        ) : null}

        {orden ? <span className="inline-flex items-center">{orden}</span> : null}

        {acciones ? <div className="ml-auto">{acciones}</div> : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {total !== undefined ? (
          <span>
            <span className="cifra font-semibold text-foreground">{num(total)}</span>{" "}
            {total === 1 ? sustantivo.singular : sustantivo.plural}
          </span>
        ) : null}

        {activas.map((activa) => (
          <button
            key={activa.nombre}
            type="button"
            onClick={() => poner(activa.cambiosAlQuitar)}
            className="inline-flex items-center gap-1 rounded-full border border-marca/40 bg-secondary px-2 py-0.5 text-marca-texto transition-colors duration-150 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Quitar filtro ${activa.etiqueta}: ${activa.texto}`}
          >
            <span className="font-medium">{activa.etiqueta}:</span>
            <span>{activa.texto}</span>
            <X aria-hidden className="size-3" />
          </button>
        ))}

        {hayActivos ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => poner(quitarTodos)}>
            Quitar todo
          </Button>
        ) : (
          resumen ?? null
        )}

        {aviso ? <span role="status">{aviso}</span> : null}
      </div>
      </div>
    </InformarOrdenPendiente>
  );
}

/** Una fila de filtro dentro del popover: la etiqueta pequeña encima y el select. */
function FilaDeFiltro({
  filtro,
  valor,
  onElegir,
}: {
  filtro: FiltroDeclarado;
  valor: string | null;
  onElegir: (cambios: Record<string, string | null>) => void;
}) {
  const todos = filtro.todos ?? "Todos";
  const opciones = filtro.opciones.map((opcion) =>
    opcion.value === filtro.porDefecto?.valor ? { ...opcion, label: filtro.porDefecto.etiqueta } : opcion,
  );

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {filtro.etiqueta}
      <Select
        value={valor ?? TODOS}
        items={[{ value: TODOS, label: todos }, ...opciones]}
        onValueChange={(elegido: string | null) =>
          onElegir({
            [filtro.nombre]:
              !elegido || elegido === filtro.porDefecto?.valor
                ? null
                : elegido === TODOS
                  ? (filtro.valorTodos ?? filtro.porDefecto?.valorTodos ?? null)
                  : elegido,
          })
        }
      >
        <SelectTrigger className="w-full" aria-label={filtro.etiqueta}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{todos}</SelectItem>
          {opciones.map((opcion) => (
            <SelectItem key={opcion.value} value={opcion.value}>
              {opcion.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

/**
 * Un control de orden de la barra (ticket 202): un chip con ícono y el orden vigente en
 * su `aria-label` y tooltip, separado de los filtros. Elegir aplica en el acto en la URL.
 */
export function ControlDeOrden({
  nombre,
  sentido,
  valor,
  opciones,
  etiqueta = "Orden",
}: {
  /** El parámetro del campo de orden en la URL. */
  nombre: string;
  /** El parámetro del sentido (asc/desc), si el orden lo lleva aparte. */
  sentido?: string;
  /** El valor vigente, serializado como lo espera `opciones` (p. ej. "actividad:desc"). */
  valor: string;
  opciones: { value: string; label: string }[];
  etiqueta?: string;
}) {
  const { poner, pendiente } = useFiltrosUrl();
  const informarPendiente = useContext(InformarOrdenPendiente);
  const actual = opciones.find((o) => o.value === valor);

  useEffect(() => {
    informarPendiente(pendiente);
    return () => informarPendiente(false);
  }, [informarPendiente, pendiente]);

  return (
    <Select
      value={valor}
      items={opciones}
      onValueChange={(elegido: string | null) => {
        if (!elegido) return;
        if (sentido) {
          const [campo, sent] = elegido.split(":");
          poner({ [nombre]: campo, [sentido]: sent, pagina: null });
        } else {
          poner({ [nombre]: elegido, pagina: null });
        }
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={`${etiqueta}: ${actual?.label ?? valor}`}
        aria-busy={pendiente}
        title={`${etiqueta}: ${actual?.label ?? valor}`}
      >
        {pendiente ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <ArrowUpDown aria-hidden />}
        <span>Ordenar: {actual?.label ?? valor}</span>
      </SelectTrigger>
      <SelectContent>
        {opciones.map((opcion) => (
          <SelectItem key={opcion.value} value={opcion.value}>
            {opcion.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
