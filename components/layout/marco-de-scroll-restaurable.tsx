"use client";

import { useEffect, useRef, type ReactNode, type UIEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Posicion = { x: number; y: number };

/** Conserva los scrolls internos de una pantalla fija, separados por su URL exacta. */
export function MarcoDeScrollRestaurable({ children, className }: { children: ReactNode; className: string }) {
  const raiz = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clave = `retia:scroll:${pathname}?${searchParams.toString()}`;

  function rutaDe(elemento: HTMLElement): string | null {
    const indices: number[] = [];
    let actual: HTMLElement | null = elemento;
    while (actual && actual !== raiz.current) {
      const padre: HTMLElement | null = actual.parentElement;
      if (!padre) return null;
      indices.unshift([...padre.children].indexOf(actual));
      actual = padre;
    }
    return actual === raiz.current ? indices.join(".") : null;
  }

  function elementoDe(ruta: string): HTMLElement | null {
    let actual: Element | null = raiz.current;
    for (const indice of ruta.split(".").filter(Boolean).map(Number)) actual = actual?.children.item(indice) ?? null;
    return actual instanceof HTMLElement ? actual : null;
  }

  useEffect(() => {
    try {
      const guardado = window.sessionStorage.getItem(clave);
      if (!guardado) return;
      const posiciones = JSON.parse(guardado) as Record<string, Posicion>;
      requestAnimationFrame(() => {
        for (const [ruta, posicion] of Object.entries(posiciones)) {
          const elemento = elementoDe(ruta);
          if (elemento) elemento.scrollTo(posicion.x, posicion.y);
        }
      });
    } catch {
      window.sessionStorage.removeItem(clave);
    }
  }, [clave]);

  function guardar(event: UIEvent<HTMLDivElement>) {
    const elemento = event.target;
    if (!(elemento instanceof HTMLElement) || elemento === raiz.current) return;
    const ruta = rutaDe(elemento);
    if (ruta === null) return;
    try {
      const posiciones = JSON.parse(window.sessionStorage.getItem(clave) ?? "{}") as Record<string, Posicion>;
      posiciones[ruta] = { x: elemento.scrollLeft, y: elemento.scrollTop };
      window.sessionStorage.setItem(clave, JSON.stringify(posiciones));
    } catch {
      // sessionStorage puede estar deshabilitado; la navegación sigue funcionando sin él.
    }
  }

  return <div ref={raiz} className={className} onScrollCapture={guardar}>{children}</div>;
}
