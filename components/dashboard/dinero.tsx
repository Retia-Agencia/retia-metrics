import { DatoOVacio } from "@/components/dato-o-vacio";
import Link from "next/link";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct, usd } from "@/lib/format";
import { GraficasDeDinero } from "@/components/dashboard/graficas-de-dinero";
import type { SeriesDeDinero } from "@/lib/queries/series-dinero";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { urlDeLista, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { CajaConVariacion, Tabla, Tarjeta } from "@/components/dashboard/piezas";
import { TarjetaVendido } from "@/components/dashboard/dinero-de-ventas";
import { nombreCorto } from "@/lib/vocabulario-metricas";

/** Responde: ¿cuánto vendimos, cuánto ya se recaudó, cuánto falta y de qué cohorte? */
export function Dinero({
  vista,
  detalles,
  slug,
  series,
  origen,
  hoy,
  veEquipo = true,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  slug: string;
  series?: SeriesDeDinero;
  origen: string;
  /** Hoy en Bogotá: el eje de las gráficas no pasa de aquí. */
  hoy: string;
  /** Sin equipo comercial (paid trafficker, ticket 102): sin comisión y sin enlaces a listas. */
  veEquipo?: boolean;
}) {
  return (
    <section id="dinero" className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-semibold">Dinero</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TarjetaVendido dinero={vista.dinero} anterior={vista.anterior?.dinero ?? null} periodo={vista.periodo}
          detalle={detalles?.contratado} sinValorVendido={vista.sinValorVendido} />
        <CajaConVariacion vista={vista} detalles={detalles} />
        {veEquipo ? <Tarjeta
          titulo="Comisión del periodo"
          valor={
            <CifraConLista titulo="Ventas de la comisión" detalle={detalles?.contratado}>
              {usd(vista.comision.totalUsd)}
            </CifraConLista>
          }
          nota={vista.comision.ventasSinComision > 0
            ? `${num(vista.comision.ventasSinComision)} sin % o sin valor`
            : undefined}
        /> : null}
        <Tarjeta
          titulo="Descuento promedio"
          valor={
            <CifraConLista titulo="Ventas del descuento" detalle={detalles?.contratado}>
              <DatoOVacio valor={vista.descuento.promedioPct} motivo="Ninguna venta del periodo tiene ticket y valor vendido">{pct}</DatoOVacio>
            </CifraConLista>
          }
          nota={vista.descuento.promedioUsd === null
            ? undefined
            : `${usd(vista.descuento.promedioUsd)} · de ${num(vista.descuento.ventas)} ${vista.descuento.ventas === 1 ? "venta" : "ventas"}`}
        />
      </div>

      {series ? <GraficasDeDinero datos={series} vista={vista} slug={slug} origen={origen} hoy={hoy} conListas={veEquipo} /> : null}

      <div className="grid gap-4">
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

      </div>

      {vista.claveCloser !== null ? (
        <p className="text-sm text-muted-foreground">
          Filtrado por{" "}
          {vista.closers.find((closer) => closer.id === vista.claveCloser)?.label
            ?? "este closer"}. Los leads son del programa entero: no se parten
          por closer.
        </p>
      ) : null}
    </section>
  );
}
