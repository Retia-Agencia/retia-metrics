import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, usd } from "@/lib/format";
import type { CargarResumenDePunto } from "@/components/graficas/resumen-de-punto";
import { GraficasDeDinero } from "@/components/dashboard/graficas-de-dinero";
import type { SeriesDeDinero } from "@/lib/queries/series-dinero";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { urlDeLista, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { CajaConVariacion, Tabla } from "@/components/dashboard/piezas";
import { TarjetaVendido } from "@/components/dashboard/dinero-de-ventas";
import { EsqueletoDeGraficas } from "@/components/hub/esqueleto-del-hub";
import { nombreCorto } from "@/lib/vocabulario-metricas";

async function GraficasDeDineroPendientes({ series, ...resto }: { series: Promise<SeriesDeDinero> } & Omit<React.ComponentProps<typeof GraficasDeDinero>, "datos">) {
  return <GraficasDeDinero datos={await series} {...resto} />;
}

/** Responde: ¿cuánto vendimos, cuánto ya se recaudó, cuánto falta y de qué cohorte? */
export function Dinero({
  vista,
  detalles,
  slug,
  series,
  origen,
  hoy,
  veEquipo = true,
  cargarResumenDePunto,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
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
      <div className="grid gap-4 lg:grid-cols-3">
        <TarjetaVendido dinero={vista.dinero} anterior={vista.anterior?.dinero ?? null} periodo={vista.periodo}
          detalle={detalles?.contratado} />
        <CajaConVariacion vista={vista} detalles={detalles} />
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
                {vista.ventasPorCohorte.map((fila) => {
                  const href = veEquipo && fila.cohorteId
                    ? urlDeLista({
                        slug,
                        metrica: "contratado",
                        periodo: vista.periodo,
                        origen,
                        claveCloser: vista.claveCloser,
                        cohorteId: fila.cohorteId,
                      })
                    : null;
                  return (
                    <tr key={fila.cohorteId ?? "sin-cohorte"}>
                      <td className="py-2">{fila.codigo ?? "Sin cohorte"}</td>
                      <td className="py-2 text-right">
                        {href ? (
                          <Button
                            variant="link"
                            className="cifra h-auto p-0"
                            nativeButton={false}
                            render={<Link href={href} />}
                          >
                            {num(fila.ventas)}
                          </Button>
                        ) : (
                          num(fila.ventas)
                        )}
                      </td>
                      {[fila.dinero.vendido, fila.dinero.recaudado, fila.dinero.porCobrar].map((valor, i) => (
                        <td key={i} className="py-2 text-right">
                          {href ? (
                            <Button
                              variant="link"
                              className="cifra h-auto p-0"
                              nativeButton={false}
                              render={<Link href={href} />}
                            >
                              {usd(valor)}
                            </Button>
                          ) : (
                            usd(valor)
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
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
