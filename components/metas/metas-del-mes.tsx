import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monto, num, pct } from "@/lib/format";
import { enlaceConVueltaAFragmento } from "@/lib/navegacion/volver";
import type { MetasDelMes } from "@/lib/queries/metas";

export type ConfigurarMetas = { hrefBase: string; origen: string } | null;

type Props = {
  metas: MetasDelMes;
  hrefVentasMes: string;
  hrefVentasSemana: string | null;
  configurar: ConfigurarMetas;
  /**
   * Si la cifra abre su lista. Sin el equipo comercial (paid trafficker, ticket 102) la lista
   * no es suya: la cifra se pinta igual, pero como texto.
   */
  conListas?: boolean;
};

/** La cifra abre su lista solo si la sesión ve las listas; si no, es texto. */
function Cifra({ href, enlaza, className, children }: { href: string; enlaza: boolean; className: string; children: ReactNode }) {
  return enlaza ? <Link className={className} href={href}>{children}</Link> : <span className={className}>{children}</span>;
}

function porcentaje(valor: number | null): string {
  return valor === null ? "—" : pct(valor);
}

function EnlaceConfigurar({ configurar, fragmento }: { configurar: Exclude<ConfigurarMetas, null>; fragmento: string }) {
  return (
    <Button
      size="sm"
      variant="link"
      nativeButton={false}
      render={<Link href={enlaceConVueltaAFragmento(configurar.hrefBase, configurar.origen, fragmento)} />}
    >
      Configurar
    </Button>
  );
}

export function MetasDelMes({ metas, hrefVentasMes, hrefVentasSemana, configurar, conListas = true }: Props) {
  return (
    <div className="space-y-6">
      {metas.mesSinVentana ? (
        <Badge variant="neutro">Ninguna ventana de ventas toca este mes</Badge>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-tarjeta">
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle>Meta del mes</CardTitle>
            {configurar ? <EnlaceConfigurar configurar={configurar} fragmento="cohortes" /> : null}
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="cifra text-2xl font-semibold">{num(metas.metaCupos, 2)} cupos</p>
            <p className="cifra text-sm text-muted-foreground">{monto(metas.metaUsd, "USD")}</p>
          </CardContent>
        </Card>
        <Card className="shadow-tarjeta">
          <CardHeader><CardTitle>Vendido</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <Cifra enlaza={conListas} className="cifra text-2xl font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={hrefVentasMes}>
              {num(metas.vendidos)} {metas.vendidos === 1 ? "cupo" : "cupos"}
            </Cifra>
            <p className="cifra text-sm text-muted-foreground">{porcentaje(metas.avancePct)} de la meta del mes</p>
            <p className="cifra text-sm text-muted-foreground">{monto(metas.contratadoUsd, "USD")} contratado</p>
            {metas.ventasSinValorVendido > 0 ? (
              <Badge variant="alerta">{num(metas.ventasSinValorVendido)} sin valor vendido</Badge>
            ) : null}
          </CardContent>
        </Card>
        <Card className="shadow-tarjeta">
          <CardHeader><CardTitle>Deuda a hoy</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            <p className="cifra text-2xl font-semibold">{num(metas.deuda, 2)} cupos</p>
            <p className="cifra text-sm text-muted-foreground">{porcentaje(metas.deudaPct)} del esperado</p>
            <p className="cifra text-sm text-muted-foreground">esperado {num(metas.esperado, 2)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-tarjeta">
          <CardHeader><CardTitle>Compensación esta semana</CardTitle></CardHeader>
          <CardContent>
            {metas.compensacionSemanal && hrefVentasSemana ? (
              <div className="space-y-2">
                {metas.compensacionSemanal.diasHabilesRestantes > 0 ? (
                  <>
                    <p className="cifra text-2xl font-semibold">{num(metas.compensacionSemanal.porDia, 2)} por día hábil</p>
                    <p className="cifra text-sm text-muted-foreground">
                      faltan {num(metas.compensacionSemanal.faltan, 2)} en {metas.compensacionSemanal.diasHabilesRestantes} días hábiles
                    </p>
                  </>
                ) : (
                  // Fin de semana: ya no quedan hábiles en la semana, así que no hay ritmo que pedir; se dice lo que quedó.
                  <p className="cifra text-2xl font-semibold">{num(metas.compensacionSemanal.faltan, 2)} sin vender</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Meta {num(metas.compensacionSemanal.meta, 2)} ·{" "}
                  <Cifra enlaza={conListas} className="cifra underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={hrefVentasSemana}>
                    {num(metas.compensacionSemanal.vendidos)} vendidas
                  </Cifra>
                </p>
              </div>
            ) : <p className="text-sm text-muted-foreground">Solo se calcula para el mes actual.</p>}
          </CardContent>
        </Card>
        <Card className="shadow-tarjeta">
          <CardHeader><CardTitle>Compensación de la cohorte activa</CardTitle></CardHeader>
          <CardContent>
            {metas.compensacionCohorte ? (
              <div className="space-y-2">
                <p className="cifra text-2xl font-semibold">{num(metas.compensacionCohorte.porDia, 2)} por día hábil</p>
                <Badge variant="info">{metas.compensacionCohorte.codigo}</Badge>
              </div>
            ) : <p className="text-sm text-muted-foreground">No hay una cohorte activa con ventana.</p>}
          </CardContent>
        </Card>
      </section>

      <Card className="shadow-tarjeta">
        <CardHeader><CardTitle>Meta por cohorte</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Cohorte</th>
                <th className="px-6 py-3 text-right font-medium">Meta del mes</th>
                <th className="px-6 py-3 text-right font-medium">Vendidas</th>
                <th className="px-6 py-3 text-right font-medium">Esperado</th>
                <th className="px-6 py-3 text-right font-medium">Cumplimiento</th>
                <th className="px-6 py-3 text-right font-medium">Deuda</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {metas.filas.map((fila) => (
                <tr key={fila.cohorteId ?? "sin-cohorte"}>
                  <td className="px-6 py-3 font-medium">
                    {fila.codigo}
                    {configurar && fila.cohorteId ? (
                      <span className="block">
                        <EnlaceConfigurar configurar={configurar} fragmento={`cohorte-${fila.cohorteId}`} />
                      </span>
                    ) : null}
                  </td>
                  <td className="cifra px-6 py-3 text-right">
                    {num(fila.metaCupos, 2)}<span className="block text-xs text-muted-foreground">{monto(fila.metaUsd, "USD")}</span>
                  </td>
                  <td className="cifra px-6 py-3 text-right">{num(fila.vendidos)}</td>
                  <td className="cifra px-6 py-3 text-right">{num(fila.esperado, 2)}</td>
                  <td className="cifra px-6 py-3 text-right">{porcentaje(fila.cumplimiento)}</td>
                  <td className="cifra px-6 py-3 text-right">{num(fila.deuda, 2)}<span className="block text-xs text-muted-foreground">{porcentaje(fila.deudaPct)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {metas.cohortesSinVentana.length > 0 ? (
        <Card className="shadow-tarjeta">
          <CardHeader><CardTitle>Cohortes sin ventana de ventas</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {metas.cohortesSinVentana.map((cohorte) => configurar ? (
              <Link
                key={cohorte.id}
                href={enlaceConVueltaAFragmento(configurar.hrefBase, configurar.origen, `cohorte-${cohorte.id}`)}
              >
                <Badge variant="neutro">{cohorte.codigo}</Badge>
              </Link>
            ) : <Badge key={cohorte.id} variant="neutro">{cohorte.codigo}</Badge>)}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
