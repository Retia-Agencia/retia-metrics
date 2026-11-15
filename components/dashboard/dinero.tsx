import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Cifra } from "@/components/cifra-con-lista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CargarResumenDePunto } from "@/components/graficas/resumen-de-punto";
import { GraficasDeDinero } from "@/components/dashboard/graficas-de-dinero";
import type { SeriesDeDinero } from "@/lib/queries/series-dinero";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { CifrasDeDinero, CifrasDeCohorte } from "@/lib/hub/cifras-de-dinero";
import { Tabla } from "@/components/dashboard/piezas";
import { TarjetaDeCifrasDeDinero } from "@/components/dashboard/dinero-de-ventas";
import { EsqueletoDeGraficas } from "@/components/hub/esqueleto-del-hub";
import { nombreCorto } from "@/lib/vocabulario-metricas";

async function GraficasDeDineroPendientes({ series, ...resto }: { series: Promise<SeriesDeDinero> } & Omit<React.ComponentProps<typeof GraficasDeDinero>, "datos">) {
  return <GraficasDeDinero datos={await series} {...resto} />;
}

/** Responde: ¿cuánto vendimos, cuánto ya se recaudó, cuánto falta y de qué cohorte? */
export function Dinero({
  vista,
  cifras,
  cohortes,
  fraccionRecaudada,
  slug,
  series,
  origen,
  hoy,
  veEquipo = true,
  cargarResumenDePunto,
}: {
  vista: VistaDelDashboard;
  cifras: CifrasDeDinero;
  cohortes: CifrasDeCohorte[];
  fraccionRecaudada: number | null;
  slug: string;
  /** Una promesa: las gráficas llegan por streaming y no frenan las cifras de arriba. */
  series?: Promise<SeriesDeDinero>;
  origen: string;
  /** Hoy en Bogotá: el eje de las gráficas no pasa de aquí. */
  hoy: string;
  /** Sin equipo comercial (paid trafficker, ticket 102): sin comisión y sin enlaces a listas. */
  veEquipo?: boolean;
  /** La server action que abre el resumen de un punto; la pasa la página. */
  cargarResumenDePunto?: CargarResumenDePunto;
}) {
  return (
    <section id="dinero" className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-semibold">Dinero</h2>
      <div className="grid gap-3 lg:grid-cols-4">
        <TarjetaDeCifrasDeDinero cifras={cifras} fraccion={fraccionRecaudada} />
        <div className="grid min-w-0 content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {cifras.entroACaja.map((cifra) => <Cifra key={cifra.unidad} cifra={cifra} className="[&_.cifra]:break-words" />)}
        </div>
      </div>

      {series ? (
        <Suspense fallback={<EsqueletoDeGraficas />}>
          <GraficasDeDineroPendientes series={series} vista={vista} slug={slug} origen={origen} hoy={hoy} conListas={veEquipo} cargarResumenDePunto={cargarResumenDePunto} />
        </Suspense>
      ) : null}

      {vista.filtroDeCohorte.cohorteId === null ? <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por cohorte</CardTitle>
          </CardHeader>
          <CardContent>
            {vista.ventasPorCohorte.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
            ) : (
              <Tabla cabeceras={["Cohorte", "Ventas", nombreCorto("vendido"), nombreCorto("recaudado"), nombreCorto("por_cobrar")]}>
                {cohortes.map((fila) => <tr key={fila.clave}>
                  <td className="py-2">{fila.cohorte}</td>
                  {[fila.ventas, fila.vendido, fila.recaudado, fila.porCobrar].map((cifra) =>
                    <td key={cifra.concepto} className="py-2 text-right"><Cifra cifra={cifra} tamano="celda" />{cifra.etiquetas.includes("Parcial") ? <Badge variant="alerta" className="ml-1">Parcial</Badge> : null}</td>)}
                </tr>)}
              </Tabla>
            )}
          </CardContent>
        </Card>

      </div> : null}

      {vista.claveCloser !== null ? (
        <p className="text-sm text-muted-foreground">
          Filtrado por{" "}
          {vista.closers.find((closer) => closer.id === vista.claveCloser)?.label
            ?? "este closer"}: la meta es del programa entero.
        </p>
      ) : null}
    </section>
  );
}
