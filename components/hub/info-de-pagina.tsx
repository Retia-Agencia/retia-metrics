"use client";

import { useCallback, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { CircleHelpIcon, InfoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * El botón "Info" de cada página del Hub (Mani, 4-nov): arriba a la derecha, abre un panel con UNA tarjeta
 * visual por sección y cómo se calcula lo que hay en ella. El estado vive en la URL (`?info=<sección>`),
 * así que un enlace abre el panel en su apartado y el "?" de cada sección es solo otro enlace al mismo lugar.
 * Lo usan las cinco páginas del Hub; cada una pasa sus propias secciones.
 */
export interface SeccionDeInfo {
  id: string;
  titulo: string;
  contenido: ReactNode;
}

const PARAMETRO = "info";
const EVENTO = "info-de-pagina";

/**
 * El estado del Info vive en la URL para que el enlace se comparta, pero se escribe con
 * `history.replaceState` y NO con `router.replace`: éste vuelve a pedirle al servidor la página entera de
 * Hoy (todas las consultas del reporte) en cada gesto. Un evento propio avisa a todos los que lo leen (el
 * botón, el panel y cada "?"), y `useSyncExternalStore` los mantiene al día sin pasar por la red.
 */
const leerDeLaUrl = () => new URLSearchParams(window.location.search).get(PARAMETRO);
const suscribir = (avisar: () => void) => {
  window.addEventListener(EVENTO, avisar);
  window.addEventListener("popstate", avisar);
  return () => {
    window.removeEventListener(EVENTO, avisar);
    window.removeEventListener("popstate", avisar);
  };
};

function escribirEnLaUrl(valor: string | null) {
  const url = new URL(window.location.href);
  if (valor === null) url.searchParams.delete(PARAMETRO);
  else url.searchParams.set(PARAMETRO, valor);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  window.dispatchEvent(new Event(EVENTO));
}

/** Abre el Info en un apartado desde cualquier cliente (el panel de Configuración, por ejemplo). Sin red. */
export function abrirInfo(seccion: string) {
  escribirEnLaUrl(seccion);
}

function useInfoEnLaUrl() {
  const actual = useSyncExternalStore(suscribir, leerDeLaUrl, () => null);
  const cambiar = useCallback((valor: string | null) => escribirEnLaUrl(valor), []);
  return { actual, cambiar };
}

export function InfoDePagina({ titulo, secciones }: { titulo: string; secciones: SeccionDeInfo[] }) {
  const { actual, cambiar } = useInfoEnLaUrl();
  const abierto = actual !== null;

  useEffect(() => {
    if (!abierto) return;
    // El panel se pinta en un portal: se espera un cuadro para que la sección exista.
    const temporizador = window.setTimeout(() => {
      document.getElementById(`info-${actual}`)?.scrollIntoView({ block: "start" });
    }, 60);
    return () => window.clearTimeout(temporizador);
  }, [abierto, actual]);

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="print:hidden" onClick={() => cambiar(secciones[0]?.id ?? "")}>
        <InfoIcon className="size-4" aria-hidden="true" /> Info
      </Button>
      <Dialog open={abierto} onOpenChange={(abrir) => { if (!abrir) cambiar(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl gap-0 overflow-y-auto p-0">
          <div className="sticky top-0 z-10 space-y-2 border-b bg-card p-4 pr-12">
            <DialogTitle>{titulo}</DialogTitle>
            <DialogDescription className="sr-only">Qué hay en esta página y cómo se calcula cada cifra.</DialogDescription>
            <nav aria-label="Secciones de la ayuda" className="flex flex-wrap gap-1.5">
              {secciones.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => cambiar(s.id)}
                  aria-current={actual === s.id ? "true" : undefined}
                  className={`rounded-full px-2.5 py-1 text-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring ${actual === s.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                >
                  {s.titulo}
                </button>
              ))}
            </nav>
          </div>
          <div className="space-y-4 p-4">
            {secciones.map((s) => (
              <section key={s.id} id={`info-${s.id}`} className="scroll-mt-40 space-y-3 rounded-xl border p-4">
                <h3 className="text-sm font-semibold">{s.titulo}</h3>
                {s.contenido}
              </section>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** El "?" de una sección: abre el Info directo en su apartado. No se imprime. */
export function AyudaDeSeccion({ seccion, etiqueta }: { seccion: string; etiqueta: string }) {
  const { cambiar } = useInfoEnLaUrl();
  return (
    <button
      type="button"
      onClick={() => cambiar(seccion)}
      aria-label={`Cómo se calcula: ${etiqueta}`}
      title={`Cómo se calcula: ${etiqueta}`}
      className="inline-grid size-5 place-items-center rounded-full text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring print:hidden"
    >
      <CircleHelpIcon className="size-4" aria-hidden="true" />
    </button>
  );
}
