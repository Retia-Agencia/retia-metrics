import { CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct, usd } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import type { FilaDeMetrica } from "@/lib/queries/metricas-con-filas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { definicion, nombreCorto } from "@/lib/vocabulario-metricas";

/**
 * La tarjeta Vendido (ticket 369, G-3): Vendido · Recaudado · Por cobrar lado a lado, sobre el MISMO conjunto
 * de ventas que dejan pasar los filtros del Hub. Cada cifra abre la lista de esas ventas, que lleva las tres
 * columnas. Lo recaudado es a hoy y no por fecha de abono: esa pregunta es "Entró a caja".
 */
export function TarjetaVendido({ dinero, anterior, periodo, detalle }: {
  dinero: DineroDeVentas;
  anterior: DineroDeVentas | null;
  periodo: PeriodoResuelto;
  detalle?: DetalleDeCifra;
}) {
  const cifras = [
    { clave: "vendido", valor: dinero.vendido, antes: anterior?.vendido ?? null },
    { clave: "recaudado", valor: dinero.recaudado, antes: anterior?.recaudado ?? null },
    { clave: "por_cobrar", valor: dinero.porCobrar, antes: anterior?.porCobrar ?? null },
  ] as const;
  const fraccion = dinero.vendido > 0 ? Math.min(1, dinero.recaudado / dinero.vendido) : null;
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-normal text-muted-foreground">
          {nombreCorto("vendido")} · {nombreCorto("recaudado")} · {nombreCorto("por_cobrar")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {cifras.map(({ clave, valor, antes }) => (
            <div key={clave} className="min-w-0" title={definicion(clave)}>
              <p className="text-xs text-muted-foreground">{nombreCorto(clave)}</p>
              <p className="cifra break-words text-xl font-semibold">
                <CifraConLista titulo={nombreCorto(clave)} detalle={detalle}>{usd(valor)}</CifraConLista>
              </p>
              {antes === null ? null : <p className="text-xs text-muted-foreground"><Variacion actual={valor} anterior={antes} decimales={2} periodo={periodo} /></p>}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          <div
            role="img"
            aria-label={fraccion === null ? "Sin ventas con valor vendido" : `${pct(fraccion)} recaudado, ${pct(1 - fraccion)} por cobrar`}
            className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            {fraccion === null ? null : <>
              <div className="bg-primary" style={{ width: `${fraccion * 100}%` }} />
              <div className="bg-tono-alerta-suave" style={{ width: `${(1 - fraccion) * 100}%` }} />
            </>}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="cifra">{fraccion === null ? "—" : pct(fraccion)}</span> recaudado de lo vendido, a hoy
            {dinero.sobrepago > 0 ? <> · <span className="cifra">{usd(dinero.sobrepago)}</span> de sobrepago, aparte</> : null}
          </p>
          {dinero.sinSaldoCalculable > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="cifra">{num(dinero.sinSaldoCalculable)}</span> ventas sin saldo calculable (sin valor vendido o con abonos en otra moneda)
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Las tres cabeceras de toda lista de ventas, en este orden (369). */
export function CabecerasDeVentas() {
  return <>
    <th className="text-right">{nombreCorto("vendido")}</th>
    <th className="text-right">{nombreCorto("recaudado")}</th>
    <th className="text-right">{nombreCorto("por_cobrar")}</th>
  </>;
}

const cifra = (valor: number | null | undefined) => (valor === null || valor === undefined ? "—" : usd(valor));

/** Las tres celdas de una venta. Sin saldo calculable las tres se dicen con raya, nunca con cero. */
export function CeldasDeVentas({ fila }: { fila: Pick<FilaDeMetrica, "monto" | "recaudado" | "porCobrar"> }) {
  return <>
    <td className="cifra text-right">{cifra(fila.monto)}</td>
    <td className="cifra text-right">{cifra(fila.recaudado)}</td>
    <td className="cifra text-right">{cifra(fila.porCobrar)}</td>
  </>;
}

/** El total de TODA la lista (todas las páginas), al pie. `columnasAntes` y `columnasDespues` son las columnas a cada lado de las tres de dinero. */
export function PieDeVentas({ dinero, columnasAntes, columnasDespues = 0 }: { dinero: DineroDeVentas | undefined; columnasAntes: number; columnasDespues?: number }) {
  if (!dinero) return null;
  return (
    <tfoot>
      <tr className="border-t font-medium">
        <td colSpan={columnasAntes} className="py-3">Total de la lista · {num(dinero.ventas)} {dinero.ventas === 1 ? "venta" : "ventas"}</td>
        <td className="cifra text-right">{usd(dinero.vendido)}</td>
        <td className="cifra text-right">{usd(dinero.recaudado)}</td>
        <td className="cifra text-right">{usd(dinero.porCobrar)}</td>
        {columnasDespues > 0 ? <td colSpan={columnasDespues} /> : null}
      </tr>
    </tfoot>
  );
}
