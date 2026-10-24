import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabla } from "@/components/dashboard/piezas";
import { NOMBRE_DE_AREA } from "@/lib/atribucion/canal";
import { num, pct } from "@/lib/format";
import type { FilaOrigenCanal, FilaOrigenUtm, VistaOrigen } from "@/lib/queries/origen";
import { TablaDeOrigen } from "@/components/dashboard/tabla-de-origen";
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

    <Card><CardHeader><CardTitle className="text-base">Plantillas en uso por cuenta</CardTitle></CardHeader><CardContent>
      {vista.plantillas.length === 0 ? <p className="text-sm text-muted-foreground">Sin anuncios activos guardados.</p> : <Tabla cabeceras={["Cuenta", "Vieja", "Pauta", "Otra", "Sin id de anuncio"]}>
        {vista.plantillas.map((fila) => <tr key={fila.cuenta}><td className="py-2">{fila.cuenta}</td><td className="cifra text-right">{num(fila.vieja)}</td><td className="cifra text-right">{num(fila.pauta)}</td><td className="cifra text-right">{num(fila.otra)}</td><td className="cifra text-right">{num(fila.sinId)}</td></tr>)}
      </Tabla>}
    </CardContent></Card>
  </section>;
}
