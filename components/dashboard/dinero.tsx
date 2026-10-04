import Link from "next/link";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct, usd } from "@/lib/format";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { urlDeLista, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { CajaConVariacion, Tabla, Tarjeta } from "@/components/dashboard/piezas";

/** Responde: ¿cuánto entró, cuánto falta y de qué cohorte? */
export function Dinero({
  vista,
  detalles,
  slug,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  slug: string;
}) {
  return (
    <section id="dinero" className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-semibold">Dinero</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta
          titulo="Contratado"
          valor={
            <CifraConLista titulo="Contratado" detalle={detalles?.contratado}>
              {usd(vista.contratadoUsd)}
            </CifraConLista>
          }
          nota={vista.sinValorVendido > 0
            ? `${num(vista.sinValorVendido)} sin valor vendido`
            : undefined}
        />
        <CajaConVariacion vista={vista} detalles={detalles} />
        <Tarjeta
          titulo="Comisión del periodo"
          valor={
            <CifraConLista titulo="Ventas de la comisión" detalle={detalles?.contratado}>
              {usd(vista.comision.totalUsd)}
            </CifraConLista>
          }
          nota={vista.comision.ventasSinComision > 0
            ? `${num(vista.comision.ventasSinComision)} sin % o sin valor`
            : undefined}
        />
        <Tarjeta
          titulo="Descuento promedio"
          valor={
            <CifraConLista titulo="Ventas del descuento" detalle={detalles?.contratado}>
              {vista.descuento.promedioPct === null
                ? "—"
                : pct(vista.descuento.promedioPct)}
            </CifraConLista>
          }
          nota={vista.descuento.promedioUsd === null
            ? "Sin ventas con ticket y valor"
            : `${usd(vista.descuento.promedioUsd)} · de ${num(vista.descuento.ventas)} ${vista.descuento.ventas === 1 ? "venta" : "ventas"}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ventas por cohorte</CardTitle>
          </CardHeader>
          <CardContent>
            {vista.ventasPorCohorte.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin ventas en el periodo.</p>
            ) : (
              <Tabla cabeceras={["Cohorte", "Ventas", "Contratado"]}>
                {vista.ventasPorCohorte.map((fila) => {
                  const href = fila.cohorteId
                    ? urlDeLista(
                        slug,
                        "contratado",
                        vista.periodo,
                        vista.claveCloser,
                        undefined,
                        fila.cohorteId,
                      )
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
                      <td className="py-2 text-right">
                        {href ? (
                          <Button
                            variant="link"
                            className="cifra h-auto p-0"
                            nativeButton={false}
                            render={<Link href={href} />}
                          >
                            {usd(fila.contratadoUsd)}
                          </Button>
                        ) : (
                          usd(fila.contratadoUsd)
                        )}
                      </td>
                    </tr>
                  );
                })}
              </Tabla>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cartera</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="cifra break-words text-2xl font-semibold">
              <CifraConLista titulo="Cartera" detalle={detalles?.cartera}>
                {num(vista.cartera.deals)} deals · {usd(vista.cartera.saldoUsd)}
              </CifraConLista>
            </p>
            <p className="text-sm">
              <span className="cifra">{num(vista.cartera.vencidos)}</span> vencidos ·{" "}
              <span className="cifra">{num(vista.cartera.sinFechaDeReferencia)}</span>{" "}
              sin fecha de referencia
            </p>
            {vista.cartera.sinSaldoCalculable > 0 ? (
              <p className="text-sm text-muted-foreground">
                <span className="cifra">{num(vista.cartera.sinSaldoCalculable)}</span>{" "}
                sin saldo calculable
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              A hoy, no depende del periodo. Es del programa entero.
            </p>
          </CardContent>
        </Card>
      </div>

      {vista.claveCloser !== null ? (
        <p className="text-xs text-muted-foreground">
          Filtrado por{" "}
          {vista.closers.find((closer) => closer.id === vista.claveCloser)?.label
            ?? "este closer"}. Los leads y la cartera son del programa entero: no se parten
          por closer.
        </p>
      ) : null}
    </section>
  );
}
