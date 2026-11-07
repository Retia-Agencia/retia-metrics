import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";
import { nombreDeCanalOrigen, PRECISION_PAID, type FilaOrigenCanal, type FilaOrigenUtm, type VistaOrigen } from "@/lib/queries/origen";
import { TablaDeOrigen } from "@/components/dashboard/tabla-de-origen";
import type { PeriodoResuelto } from "@/lib/periodo";
import { urlDeLista } from "@/lib/queries/vista-metrica";

type FiltrosOrigen = {
  source?: string | null;
  medium?: string | null;
  categoria?: "con_utm" | "sin_utm" | "macro" | "pieza_desconocida";
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
    nombre: nombreDeCanalOrigen(fila),
    pares: fila.pares.map((par) => ({ ...par, enlaces: enlaces(filtrosDelPar(fila, par)) })),
  }));
  return <section className="space-y-4">
    <TablaDeOrigen canales={canales} totalEnvios={vista.totalEnvios} soloConteos={soloConteos} />

    <Card><CardHeader className="space-y-1">
      <CardTitle className="text-base">Contenido con código que no reconocemos</CardTitle>
      <p className="text-xs text-muted-foreground">Registros que llegaron por un link de contenido, pero su código no es de ninguna pieza viva de este programa (descartada, de otro programa o mal copiado).</p>
    </CardHeader><CardContent className="space-y-2">
      {vista.piezasDesconocidas.envios === 0
        ? <p className="text-sm text-muted-foreground">Ninguno en este periodo.</p>
        : <>
            <p className="cifra text-lg"><a className="underline underline-offset-2" href={hrefDeLista(slug, periodo, origen, "registros", { categoria: "pieza_desconocida" })}>{num(vista.piezasDesconocidas.envios)}</a></p>
            <ul className="space-y-1 text-sm">
              {vista.piezasDesconocidas.lista.map((fila) => <li key={fila.codigo ?? "sin-codigo"} className="flex gap-2">
                <span className="font-mono">{fila.codigo ?? "sin código"}</span>
                <span className="cifra text-muted-foreground">{num(fila.envios)}</span>
              </li>)}
            </ul>
          </>}
    </CardContent></Card>

    <Card><CardHeader className="space-y-1">
      <CardTitle className="text-base">Calidad del rastreo: ¿de qué anuncio vino cada registro pagado?</CardTitle>
      <p className="text-xs text-muted-foreground">Entre más registros identificados hasta el anuncio, más exacto es el costo por anuncio.</p>
    </CardHeader><CardContent className="grid gap-4 sm:grid-cols-3">
      {PRECISION_PAID.map(({ nivel, titulo, detalle }) => <div key={nivel} className="space-y-1">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="cifra text-lg">{num(vista.trazaPaid[nivel])}{soloConteos ? null : <span className="text-muted-foreground"> · {pct(totalPaid === 0 ? 0 : vista.trazaPaid[nivel] / totalPaid)}</span>}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </div>)}
    </CardContent></Card>

  </section>;
}
