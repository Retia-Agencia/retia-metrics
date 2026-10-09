"use client";

import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";

/**
 * Un buscador que escribe `?q=` en la URL con ~300 ms de debounce (ticket o8-busqueda).
 *
 * A diferencia del `BuscadorDeDeals` —que llama una server action y pinta un contador—, este
 * solo mueve la URL: la página de servidor lee `q`, filtra con `leadsQueCasan` y vuelve a
 * renderizar. Va en el slot `buscador` de `BarraDeLista`. Al cambiar el texto resetea
 * `pagina` (la lista empieza desde el principio) y, al borrarlo, quita `q` de la URL.
 *
 * "Quitar todo" de la barra limpia `q` por su cuenta (declarado en `clavesCompuestas`); este
 * input se sincroniza con la URL por si el texto se borra desde afuera, ajustando el estado
 * en el render (patrón de React para "estado derivado de una prop"), no en un efecto.
 */
export function BuscadorUrl({ placeholder = "Buscar por nombre, correo o celular" }: { placeholder?: string }) {
  const { busqueda, poner } = useFiltrosUrl();
  const valorUrl = busqueda.get("q") ?? "";
  const [texto, setTexto] = useState(valorUrl);
  const [urlVista, setUrlVista] = useState(valorUrl);
  const temporizador = useRef<number | undefined>(undefined);

  // Si `q` cambió en la URL por fuera (p. ej. "Quitar todo" o navegación), reflejarlo en el
  // input durante el render, sin un efecto: así no se dispara una cascada de renders.
  if (valorUrl !== urlVista) {
    setUrlVista(valorUrl);
    setTexto(valorUrl);
  }

  function escribir(valor: string) {
    const consulta = valor.trim();
    poner({ q: consulta ? consulta : null, pagina: null });
  }

  return (
    <form
      className="flex min-w-0 items-center"
      onSubmit={(event) => {
        event.preventDefault();
        window.clearTimeout(temporizador.current);
        escribir(texto);
      }}
    >
      <div className="relative min-w-0 w-full">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texto}
          onChange={(event) => {
            const valor = event.target.value;
            setTexto(valor);
            window.clearTimeout(temporizador.current);
            temporizador.current = window.setTimeout(() => escribir(valor), 300);
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          autoComplete="off"
          className="pl-9"
        />
      </div>
    </form>
  );
}
