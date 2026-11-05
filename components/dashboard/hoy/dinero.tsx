import { CifraConLista } from "@/components/cifra-con-lista";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabla } from "@/components/dashboard/piezas";
import { Lado } from "@/components/dashboard/hoy/comunes";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";
import { fecha, monto, num, usd } from "@/lib/format";
import { ETIQUETA_DE_NACIMIENTO, type NacimientoDeVenta } from "@/lib/queries/reporte-diario";
import { nombreCorto } from "@/lib/vocabulario-metricas";

const NACIMIENTOS: NacimientoDeVenta[] = ["agenda_del_dia", "seguimiento", "sin_llamada"];

function Importe({ rotulo, valor, abre }: { rotulo: string; valor: number; abre: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className="cifra text-xl font-semibold">{abre ?? usd(valor)}</div>
    </div>
  );
}

/**
 * Dinero del día (378): lo vendido hoy en sus tres cifras de siempre (vendido, recaudado, por cobrar) y,
 * aparte, de dónde salió la caja. El total de la caja ya está arriba y no se repite.
 */
export function DineroDelDia({ programas, veEquipo }: { programas: ProgramaDelReporte[]; veEquipo: boolean }) {
  return (
    <Lado programas={programas}>{({ reporte, detalles }) => {
      const ventas = reporte.ventas;
      const suma = (campo: "vendido" | "recaudado" | "porCobrar") => ventas.reduce((t, v) => t + (v[campo] ?? 0), 0);
      const sinValor = ventas.filter((v) => v.vendido === null).length;
      const abrir = (valor: number) => (
        <CifraConLista titulo="Cupos vendidos hoy" detalle={detalles?.cierres}>{usd(valor)}</CifraConLista>
      );
      return (
        <Card className="partible">
          <CardContent className="space-y-4">
            {ventas.length === 0 ? <p className="text-sm text-muted-foreground">Hoy no hay cupos vendidos.</p> : <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Importe rotulo={`${nombreCorto("vendido")} hoy`} valor={suma("vendido")} abre={abrir(suma("vendido"))} />
                <Importe rotulo={nombreCorto("recaudado")} valor={suma("recaudado")} abre={abrir(suma("recaudado"))} />
                <Importe rotulo={nombreCorto("por_cobrar")} valor={suma("porCobrar")} abre={abrir(suma("porCobrar"))} />
              </div>
              <p className="text-xs text-muted-foreground">
                {num(ventas.length)} {ventas.length === 1 ? "cupo vendido" : "cupos vendidos"}
                {NACIMIENTOS.map((n) => ({ n, c: ventas.filter((v) => v.nacio === n).length })).filter((x) => x.c > 0)
                  .map((x) => ` · ${x.c} ${ETIQUETA_DE_NACIMIENTO[x.n].toLowerCase()}`).join("")}
              </p>
              {sinValor > 0 ? <Badge variant="alerta">{num(sinValor)} sin valor vendido: el total está incompleto</Badge> : null}
              {veEquipo ? (
                <Tabla cabeceras={["Persona · closer", nombreCorto("vendido"), nombreCorto("recaudado"), nombreCorto("por_cobrar"), "Cómo nació"]}>
                  {ventas.map((v) => (
                    <tr key={v.id}>
                      <td className="py-2">{v.persona ?? "Sin nombre"} <span className="text-muted-foreground">· {v.closer ?? "Sin closer"}</span></td>
                      <td className="py-2 text-right">{v.vendido === null ? "—" : usd(v.vendido)}</td>
                      <td className="py-2 text-right">{v.recaudado === null ? "—" : usd(v.recaudado)}</td>
                      <td className="py-2 text-right">{v.porCobrar === null ? "—" : usd(v.porCobrar)}</td>
                      <td className="py-2 pl-2 text-right">{ETIQUETA_DE_NACIMIENTO[v.nacio]}</td>
                    </tr>
                  ))}
                </Tabla>
              ) : null}
            </>}

            <div className="space-y-2 border-t pt-3">
              <h4 className="text-sm font-medium">De dónde salió la caja del día</h4>
              {reporte.caja.length === 0 ? <p className="text-sm text-muted-foreground">Hoy no se registró ningún abono.</p> : <>
                <Tabla cabeceras={["Moneda", "De ventas de hoy", "Completan ventas anteriores"]}>
                  {reporte.caja.map((fila) => (
                    <tr key={fila.moneda}>
                      <td className="py-2">{fila.moneda}</td>
                      <td className="py-2 text-right">{monto(fila.deVentasDeHoy, fila.moneda)}</td>
                      <td className="py-2 text-right">{monto(fila.deVentasAnteriores, fila.moneda)}</td>
                    </tr>
                  ))}
                </Tabla>
                {veEquipo ? (
                  <Tabla cabeceras={["Quién abonó", "Abono", "Por qué"]}>
                    {reporte.detalleDeCaja.map((a) => (
                      <tr key={a.id}>
                        <td className="py-2">{a.persona ?? "Sin nombre"}</td>
                        <td className="py-2 text-right">{monto(a.monto, a.moneda)}</td>
                        <td className="py-2 pl-2 text-right text-muted-foreground">
                          {a.origen === "venta_nueva" ? "Venta de hoy"
                            : a.origen === "adicional" ? "Abono adicional (1:1)"
                            : `Completa la venta del ${fecha(a.ventaDelDia ?? "")}${a.closerDeLaVenta ? ` de ${a.closerDeLaVenta}` : ""}`}
                        </td>
                      </tr>
                    ))}
                  </Tabla>
                ) : null}
              </>}
            </div>
          </CardContent>
        </Card>
      );
    }}</Lado>
  );
}
