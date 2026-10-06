import Link from "next/link";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct, usd } from "@/lib/format";
import { SeriesLineales } from "@/components/series-lineales";
import { Variacion } from "@/components/variacion";
import type { SeriesDeDinero } from "@/lib/queries/series-dinero";
import type { Rango } from "@/lib/queries/dashboard";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { urlDeLista, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { CajaConVariacion, Tabla, Tarjeta } from "@/components/dashboard/piezas";

/** Responde: ¿cuánto entró, cuánto falta y de qué cohorte? */
export function Dinero({
  vista,
  detalles,
  slug,
  series,
  origen,
  veEquipo = true,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  slug: string;
  series?: SeriesDeDinero;
  origen?: string;
  /** Sin equipo comercial (paid trafficker, ticket 102): sin comisión y sin enlaces a listas. */
  veEquipo?: boolean;
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

      {series ? <GraficasDeDinero datos={series} slug={slug} claveCloser={vista.claveCloser} origen={origen} conListas={veEquipo} /> : null}

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
                  const href = veEquipo && fila.cohorteId
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

function GraficasDeDinero({ datos, slug, claveCloser, origen, conListas }: {
  datos: SeriesDeDinero;
  slug: string;
  claveCloser: string | null;
  origen?: string;
  conListas: boolean;
}) {
  const { meses, acumulado } = datos;
  const ultimo = meses[meses.length - 1];
  const monedas = [...new Set(meses.flatMap((mes) => mes.caja.map((caja) => caja.moneda)))];
  type Valores = SeriesDeDinero["meses"][number];
  const metricas = [
    { titulo: "Contratado", unidad: "USD", metrica: "contratado" as const,
      valor: (fila: Pick<Valores, "contratadoUsd" | "cupos" | "caja">) => fila.contratadoUsd,
      meta: (fila: Valores) => fila.metaUsd, decimales: 2, moneda: undefined },
    { titulo: "Cupos vendidos", unidad: "cupos", metrica: "cierres" as const,
      valor: (fila: Pick<Valores, "contratadoUsd" | "cupos" | "caja">) => fila.cupos,
      meta: (fila: Valores) => fila.metaCupos, decimales: 1, moneda: undefined },
    ...monedas.map((moneda) => ({ titulo: "Recaudo", unidad: moneda, metrica: "caja" as const,
      valor: (fila: Pick<Valores, "contratadoUsd" | "cupos" | "caja">) => fila.caja.find((caja) => caja.moneda === moneda)?.total ?? 0,
      // No existe una meta de recaudo: la caja se grafica sin meta.
      meta: (): number | null => null,
      decimales: moneda === "COP" ? 0 : 2, moneda })),
  ];
  const enlace = (metrica: "contratado" | "cierres" | "caja", rango: Rango, moneda?: string) => {
    if (!conListas || rango.desde > rango.hasta) return null;
    const href = urlDeLista(slug, metrica, { preset: "custom", a: rango, b: null }, claveCloser, moneda);
    return origen ? enlaceConVuelta(href, origen) : href;
  };
  const diaCorto = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>Últimos seis meses hasta {ultimo.mes}. Cada mes va desde el día 1; el último corta en {fecha(ultimo.rango.hasta)}. La caja usa la fecha del abono.</p>
        <p>La meta es del programa entero. Sin ventana de venta, la meta aparece como —.</p>
        {claveCloser ? <p>Contratado, cupos y caja muestran la contribución del closer seleccionado; la meta no se reparte.</p> : null}
        {meses.some((mes) => mes.sinValorVendido > 0) ? <p>Hay cupos sin valor vendido: cuentan como cupos, pero no aportan un monto a contratado.</p> : null}
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {metricas.map((m) => (
          <Card key={`${m.metrica}-${m.unidad}`} className="min-w-0">
            <CardContent className="pt-6">
              <SeriesLineales titulo={`${m.titulo} por mes`} unidad={m.unidad}
                etiquetas={meses.map((mes) => mes.mes)} formato={(valor) => num(valor, m.decimales)} mostrarTabla
                datos={{ dias: meses.map((mes) => `${mes.mes}-01`), series: [
                  { clave: m.titulo, valores: meses.map((mes) => mes.rango.desde <= mes.rango.hasta ? m.valor(mes) : null),
                    enlaces: meses.map((mes) => enlace(m.metrica, mes.rango, m.moneda)) },
                  ...(m.metrica === "caja" ? [] : [{ clave: "Meta del mes · programa", valores: meses.map(m.meta), punteada: true }]),
                ] }} />
            </CardContent>
          </Card>
        ))}
      </div>
      {monedas.length === 0 ? <p className="text-sm text-muted-foreground">Sin abonos vigentes en estos meses para el filtro elegido.</p> : null}
      {acumulado ? (
        <>
          <p className="text-sm text-muted-foreground">
            Acumulado desde {fecha(acumulado.a.desde)} hasta {fecha(acumulado.a.hasta)} contra el mes anterior al mismo día hábil.
            {acumulado.b ? ` Mes anterior: ${fecha(acumulado.b.desde)} a ${fecha(acumulado.b.hasta)}.` : " Aún no hay días hábiles comparables."}
            {" "}Los fines de semana sí conservan sus ventas y abonos. La línea anterior se corta si agota sus días hábiles.
            {" "}Esta comparación mensual usa el mes anterior, independientemente del periodo B del selector.
          </p>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            {metricas.map((m) => {
              const final = acumulado.puntos[acumulado.puntos.length - 1];
              const meta = m.meta(ultimo);
              return (
                <Card key={`${m.metrica}-${m.unidad}`} className="min-w-0">
                  <CardContent className="space-y-3 pt-6">
                    <SeriesLineales titulo={`${m.titulo} acumulado`} unidad={m.unidad}
                      formato={(valor) => num(valor, m.decimales)} mostrarTabla
                      etiquetas={acumulado.puntos.map((p) => `${diaCorto(p.dia)} / ${p.diaAnterior ? diaCorto(p.diaAnterior) : "—"}`)}
                      datos={{ dias: acumulado.puntos.map((p) => p.dia), series: [
                        { clave: ultimo.mes, valores: acumulado.puntos.map((p) => m.valor(p.actual)),
                          enlaces: acumulado.puntos.map((p) => enlace(m.metrica, { desde: acumulado.a.desde, hasta: p.dia }, m.moneda)) },
                        { clave: `${meses[meses.length - 2].mes} · mismo hábil`, color: 0, punteada: true,
                          valores: acumulado.puntos.map((p) => p.anterior ? m.valor(p.anterior) : null),
                          enlaces: acumulado.puntos.map((p) => acumulado.b && p.diaAnterior ? enlace(m.metrica, { desde: acumulado.b.desde, hasta: p.diaAnterior }, m.moneda) : null) },
                        ...(meta === null ? [] : [{
                          clave: "Meta del mes · programa",
                          color: 1, punteada: true, valores: acumulado.puntos.map(() => meta),
                        }]),
                      ] }} />
                    {final.anterior ? <p className="text-sm">{m.unidad}: <Variacion actual={m.valor(final.actual)} anterior={m.valor(final.anterior)} decimales={m.decimales} /></p> : null}
                    {m.metrica === "caja" ? (
                      <p className="text-xs text-muted-foreground">El recaudo no tiene meta propia.</p>
                    ) : meta !== null ? (
                      <p className="text-sm">Faltan para la meta: <span className="cifra">{num(Math.max(0, meta - m.valor(final.actual)), m.decimales)} {m.unidad} · {meta > 0 ? pct(Math.max(0, meta - m.valor(final.actual)) / meta) : "—"}</span></p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      ) : <p className="text-sm text-muted-foreground">El mes elegido aún no empieza: no hay acumulado a hoy.</p>}
    </div>
  );
}
