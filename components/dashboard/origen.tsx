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

    <Card><CardHeader><CardTitle className="text-base">Traza de envíos Paid</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">
      {(["N3", "N2", "N1"] as const).map((nivel) => <div key={nivel}><p>{nivel}</p><p className="cifra text-lg">{num(vista.trazaPaid[nivel])}{soloConteos ? null : <> · {pct(totalPaid === 0 ? 0 : vista.trazaPaid[nivel] / totalPaid)}</>}</p></div>)}
    </CardContent></Card>

    <Card><CardHeader><CardTitle className="text-base">Plantillas en uso por cuenta</CardTitle></CardHeader><CardContent>
      {vista.plantillas.length === 0 ? <p className="text-sm text-muted-foreground">Sin anuncios activos guardados.</p> : <Tabla cabeceras={["Cuenta", "Vieja", "Pauta", "Otra", "Sin id de anuncio"]}>
        {vista.plantillas.map((fila) => <tr key={fila.cuenta}><td className="py-2">{fila.cuenta}</td><td className="cifra text-right">{num(fila.vieja)}</td><td className="cifra text-right">{num(fila.pauta)}</td><td className="cifra text-right">{num(fila.otra)}</td><td className="cifra text-right">{num(fila.sinId)}</td></tr>)}
      </Tabla>}
    </CardContent></Card>
  </section>;
}
