"use client";

import { useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { buscarDealsAccion } from "@/app/(app)/p/[programa]/deals/acciones";
import { Input } from "@/components/ui/input";
import { useBusquedaDeDeals } from "./busqueda-de-deals";

/**
 * `idsDelTablero` son los deals que el tablero ya carga con los filtros de la URL: el
 * contador cuenta las tarjetas que se ven, no todas las coincidencias del programa.
 */
export function BuscadorDeDeals({ programaSlug, idsDelTablero }: { programaSlug: string; idsDelTablero: string[] }) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [buscando, empezarBusqueda] = useTransition();
  const ultimaBusqueda = useRef(0);
  const temporizador = useRef<number | undefined>(undefined);
  const { idsVisibles, mostrar } = useBusquedaDeDeals();

  function buscar(textoBuscado: string) {
    const consulta = textoBuscado.trim();
    if (consulta.length < 2) {
      ultimaBusqueda.current += 1;
      mostrar(null);
      setError(null);
      return;
    }

    const numero = ++ultimaBusqueda.current;
    empezarBusqueda(async () => {
      const resultado = await buscarDealsAccion({ programaSlug, texto: consulta });
      if (numero !== ultimaBusqueda.current) return;
      if (!resultado.ok) {
        setError(resultado.error);
        mostrar([]);
        return;
      }
      setError(null);
      mostrar(resultado.dealIds);
    });
  }

  const coinciden = idsVisibles === null ? 0 : idsDelTablero.filter((id) => idsVisibles.has(id)).length;
  const mensaje = error
    ? error
    : buscando
      ? "Buscando…"
      : idsVisibles === null
        ? null
        : coinciden === 0
          ? "Ningún deal coincide"
          : `${coinciden} ${coinciden === 1 ? "deal coincide" : "deals coinciden"}`;

  return (
    <form
      className="flex min-w-0 flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        window.clearTimeout(temporizador.current);
        buscar(texto);
      }}
    >
      <div className="relative min-w-0">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texto}
          onChange={(event) => {
            const valor = event.target.value;
            setTexto(valor);
            window.clearTimeout(temporizador.current);
            temporizador.current = window.setTimeout(() => buscar(valor), 400);
          }}
          placeholder="Buscar por nombre, correo o teléfono"
          aria-label="Buscar deals"
          autoComplete="off"
          className="pl-9"
        />
      </div>
      {mensaje ? (
        <span className="shrink-0 text-xs text-muted-foreground" aria-live="polite">
          {mensaje}
        </span>
      ) : null}
    </form>
  );
}
