"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { programaDeRuta } from "@/lib/nav";
import { Badge } from "@/components/ui/badge";
import { EVENTO_NOTIFICACIONES } from "@/lib/mi-espacio/aviso-notificaciones";

/**
 * El "número sin ver" de Mi espacio (ticket 223): un circulito con cuántos deals del closer
 * tienen algo nuevo (Calendly sin leer, nuevos sin abrir, seguimientos/reagendas vencidos).
 *
 * El layout NO se re-renderiza en una navegación del cliente, así que el número se pide
 * aparte a `/api/mi-espacio/sin-ver` y se refresca al cambiar de ruta o de filtros, al volver
 * a la pestaña (`visibilitychange`) y cuando una acción avisa (`EVENTO_NOTIFICACIONES`, que
 * dispararán Anotar y Mover). El programa sale de la URL (`/p/<programa>/...`); fuera de una
 * ruta de programa se usa el que el menú ya tiene como respaldo (`programaDeRespaldo`).
 *
 * Con 0 no se pinta nada; más de 99 dice "99+". Tono de acento del sistema Tinta.
 */
export function NumeroSinVer({ programaDeRespaldo }: { programaDeRespaldo: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [total, setTotal] = useState(0);

  const slug = programaDeRuta(pathname) ?? programaDeRespaldo;

  // Pide el número y lo guarda. Siempre pasa por un `await` antes de tocar el estado (nunca
  // un setState síncrono dentro del efecto); sin programa, resuelve a 0 por la misma vía.
  const pedir = useCallback(async (): Promise<number> => {
    if (!slug) return 0;
    try {
      const r = await fetch(`/api/mi-espacio/sin-ver?programa=${encodeURIComponent(slug)}`, {
        cache: "no-store",
      });
      if (!r.ok) return 0;
      const datos = (await r.json()) as { total?: number };
      return typeof datos.total === "number" ? datos.total : 0;
    } catch {
      return 0;
    }
  }, [slug]);

  // Al cambiar de ruta o de filtros. `activo` evita escribir estado tras desmontar.
  useEffect(() => {
    let activo = true;
    void pedir().then((n) => {
      if (activo) setTotal(n);
    });
    return () => {
      activo = false;
    };
  }, [pedir, pathname, searchParams]);

  // Al volver a la pestaña y cuando una acción avisa que algo cambió.
  useEffect(() => {
    const refrescar = () => {
      void pedir().then(setTotal);
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") refrescar();
    };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener(EVENTO_NOTIFICACIONES, refrescar);
    return () => {
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener(EVENTO_NOTIFICACIONES, refrescar);
    };
  }, [pedir]);

  if (total <= 0) return null;

  return (
    <Badge variant="default" className="cifra ml-auto" aria-label={`${total} notificaciones sin ver`}>
      {total > 99 ? "99+" : total}
    </Badge>
  );
}
