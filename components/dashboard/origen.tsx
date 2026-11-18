import { nombreDeCanalOrigen, type FilaOrigenCanal, type FilaOrigenUtm, type VistaOrigen } from "@/lib/queries/origen";
import type { PeriodoResuelto } from "@/lib/periodo";
import { urlDeLista } from "@/lib/queries/vista-metrica";

type FiltrosOrigen = {
  source?: string | null;
  medium?: string | null;
  categoria?: "con_utm" | "sin_utm" | "macro" | "pieza_desconocida";
  tipo?: "completo" | "parcial";
  area?: string;
  canal?: string | null;
};

function hrefDeLista(
  slug: string,
  periodo: PeriodoResuelto,
  origen: string,
  metrica: "registros" | "agendas_creadas",
  filtros: FiltrosOrigen,
) {
  // Origen cuenta registros completos (agruparTrazas): su lista de envíos se acota a los completos para cuadrar.
  return urlDeLista({ slug, metrica, periodo: { ...periodo, b: null }, origen, filtrosDeOrigen: metrica === "registros" ? { ...filtros, tipo: "completo" } : filtros });
}

function filtrosDelCanal(fila: FilaOrigenCanal): FiltrosOrigen {
  return fila.categoria
    ? { categoria: fila.categoria }
    // Los pares con macros viven en su propia fila: la lista del canal los deja fuera para cuadrar con la cifra.
    : { area: fila.area, canal: fila.canalClave, categoria: "con_utm" };
}

function filtrosDelPar(fila: FilaOrigenCanal, par: FilaOrigenUtm): FiltrosOrigen {
  const categoria = par.macros ? "macro" : fila.categoria === "sin_utm" ? undefined : "con_utm";
  return { source: par.source, medium: par.medium, ...(categoria ? { categoria } : {}) };
}

/** Los canales de Origen con el enlace a la lista de cada cifra: los pinta `TablaDeOrigen`. */
export function canalesConEnlaces(vista: VistaOrigen, slug: string, periodo: PeriodoResuelto, origen: string) {
  const enlaces = (filtros: FiltrosOrigen) => ({
    registros: hrefDeLista(slug, periodo, origen, "registros", filtros),
    agendas: hrefDeLista(slug, periodo, origen, "agendas_creadas", filtros),
  });
  return vista.canales.map((fila) => ({
    ...fila,
    enlaces: enlaces(filtrosDelCanal(fila)),
    nombre: nombreDeCanalOrigen(fila),
    pares: fila.pares.map((par) => ({ ...par, enlaces: enlaces(filtrosDelPar(fila, par)) })),
  }));
}

/** El enlace a la lista de los envíos de contenido con código que no reconocemos. */
export function hrefDePiezasDesconocidas(slug: string, periodo: PeriodoResuelto, origen: string) {
  return hrefDeLista(slug, periodo, origen, "registros", { categoria: "pieza_desconocida" });
}
