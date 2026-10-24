import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NOMBRE_DE_AREA } from "@/lib/atribucion/canal";
import { num, pct } from "@/lib/format";
import type { FilaOrigenCanal, FilaOrigenUtm, VistaOrigen } from "@/lib/queries/origen";
import { TablaDeOrigen } from "@/components/dashboard/tabla-de-origen";
import { TablaDePlantillas } from "@/components/dashboard/tabla-de-plantillas";
import type { PeriodoResuelto } from "@/lib/periodo";
import { urlDeLista } from "@/lib/queries/vista-metrica";

type FiltrosOrigen = {
  source?: string | null;
  medium?: string | null;
  categoria?: "con_utm" | "sin_utm" | "macro";
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
  return urlDeLista({ slug, metrica, periodo: { ...periodo, b: null }, origen, filtrosDeOrigen: filtros });
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

// Los niveles N3 a N1 de la traza (`emparejar`) son internos: la pantalla los dice en palabras.
const PRECISION_PAID = [
  { nivel: "N3", titulo: "Hasta el anuncio", detalle: "Se sabe el anuncio exacto que trajo el registro." },
  { nivel: "N2", titulo: "Hasta la campaña o el conjunto", detalle: "Se sabe la campaña o el conjunto, pero no el anuncio." },
  { nivel: "N1", titulo: "Solo que es pauta", detalle: "Llegó por pauta, pero sin datos para ubicar la campaña." },
] as const;

const DESCRIPCIONES_DE_PLANTILLA = {
  vieja: "facebook / cpc con ad_id: la de Retia antes del 29-sep. Se rastrea hasta el anuncio, pero content y term significan conjunto y anuncio.",
  pauta: "paid_social con utm_id={{ad.id}}: la plantilla oficial (ADR 0099).",
  otra: "Trae algún id pero no es ninguna de las dos; revisar.",
  sinId: "El anuncio no tiene parámetros de URL o no trae ad_id ni utm_id: sus registros no se pueden atribuir al anuncio.",
} as const;

export function Origen({ vista, slug, periodo, origen, soloConteos = false }: { vista: VistaOrigen; slug: string; periodo: PeriodoResuelto; origen: string; soloConteos?: boolean }) {
  const totalPaid = vista.trazaPaid.N3 + vista.trazaPaid.N2 + vista.trazaPaid.N1;
  const enlaces = (filtros: FiltrosOrigen) => ({
    registros: hrefDeLista(slug, periodo, origen, "registros", filtros),
    agendas: hrefDeLista(slug, periodo, origen, "agendas_creadas", filtros),
  });
  const canales = vista.canales.map((fila) => ({
    ...fila,
    enlaces: enlaces(filtrosDelCanal(fila)),
    nombreDeArea: NOMBRE_DE_AREA[fila.area],
    pares: fila.pares.map((par) => ({ ...par, enlaces: enlaces(filtrosDelPar(fila, par)) })),
  }));
  return <section className="space-y-4">
    <TablaDeOrigen canales={canales} totalEnvios={vista.totalEnvios} soloConteos={soloConteos} />

    <Card><CardHeader className="space-y-1">
      <CardTitle className="text-base">¿Hasta dónde sabemos de qué anuncio vino cada registro pagado?</CardTitle>
      <p className="text-xs text-muted-foreground">Entre más registros identificados hasta el anuncio, más exacto es el costo por anuncio.</p>
    </CardHeader><CardContent className="grid gap-4 sm:grid-cols-3">
      {PRECISION_PAID.map(({ nivel, titulo, detalle }) => <div key={nivel} className="space-y-1">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="cifra text-lg">{num(vista.trazaPaid[nivel])}{soloConteos ? null : <span className="text-muted-foreground"> · {pct(totalPaid === 0 ? 0 : vista.trazaPaid[nivel] / totalPaid)}</span>}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>)}
    </CardContent></Card>

    <TablaDePlantillas plantillas={vista.plantillas} descripciones={DESCRIPCIONES_DE_PLANTILLA} />
  </section>;
}
