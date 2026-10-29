import { useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { num, pct } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";
import { MINIMO_DE_DEALS_PARA_CALOR, tonosDeFila, type TonoDeCalor } from "@/lib/queries/calor-escalera";
import { ESCALONES, NOMBRE_DE_ESCALON, type Escalon } from "@/lib/queries/escalera";
import type { CeldaDeEscalera, FilaDeEscalera, VistaDeEscalera } from "@/lib/queries/vista-escalera";

/**
 * "Ventas por escalón" (ticket 320, ADR 0109): en qué escalón paga, o se queda, cada deal del
 * periodo. Una distribución por programa; nunca se suma entre programas. Cada cifra abre su lista.
 */

/** Con corte nulo "pagó rápido" no existe: su fila se esconde y su descripción lo dice. */
function escalonesVisibles(sinCorte: boolean): readonly Escalon[] {
  return sinCorte ? ESCALONES.filter((escalon) => escalon !== "pago_rapido") : ESCALONES;
}

function Cifra({ celda, titulo }: { celda: CeldaDeEscalera; titulo: string }) {
  return (
    <CifraConLista titulo={titulo} detalle={celda.detalle ?? undefined}>
      <span className="cifra">{num(celda.deals)}</span>
    </CifraConLista>
  );
}

const CLASE_DE_TONO: Record<TonoDeCalor, string> = {
  0: "",
  1: "bg-primary/10",
  2: "bg-primary/25",
  3: "bg-primary/40",
};

function TablaPorDimension({ titulo, filas, visibles }: { titulo: string; filas: FilaDeEscalera[]; visibles: readonly Escalon[] }) {
  if (filas.length === 0) return null;
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{titulo}</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1.5 pr-3 font-normal">{titulo.replace("Por ", "").replace(/^./, (c) => c.toUpperCase())}</th>
              {visibles.map((escalon) => <th key={escalon} className="px-2 py-1.5 text-right font-normal">{NOMBRE_DE_ESCALON[escalon]}</th>)}
              <th className="pl-2 py-1.5 text-right font-normal">Deals</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((fila) => {
              const tonos = tonosDeFila(fila);
              return (
                <tr key={fila.clave}>
                  <td className="py-1.5 pr-3">{fila.etiqueta}</td>
                  {visibles.map((escalon) => {
                    const tono = tonos[escalon];
                    return (
                      <td key={escalon} className={`px-2 py-1.5 text-right ${tono === null ? "" : CLASE_DE_TONO[tono]}`}>
                        <Cifra celda={fila.celdas[escalon]} titulo={`${NOMBRE_DE_ESCALON[escalon]} · ${fila.etiqueta}`} />
                        <span className={`cifra block text-xs ${tono === 3 ? "text-foreground" : "text-muted-foreground"}`}>
                          {fila.celdas[escalon].porcentaje.valor === null ? "—" : pct(fila.celdas[escalon].porcentaje.valor / 100, 0)}
                        </span>
                      </td>
                    );
                  })}
                  <td className="cifra pl-2 py-1.5 text-right">{num(fila.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        El color es el porcentaje de cada fila sobre sus propios deals. Sin color: «Sin closer» y filas con menos de {num(MINIMO_DE_DEALS_PARA_CALOR)} deals.
      </p>
    </section>
  );
}

export function Escalera({ vista, periodo, programa }: { vista: VistaDeEscalera; periodo: PeriodoResuelto; programa?: string }) {
  // Un id por tarjeta: en todos los programas hay una por programa en la misma página.
  const idDelTitulo = useId();
  const visibles = escalonesVisibles(vista.sinCorte);
  const { principal } = vista;
  return (
    <Card aria-labelledby={idDelTitulo}>
      <CardHeader className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle id={idDelTitulo} className="text-base">Ventas por escalón{programa ? ` · ${programa}` : ""}</CardTitle>
          {vista.sinCorte ? <Badge variant="alerta">Sin corte de pago rápido</Badge> : null}
        </div>
        <p className="text-xs text-muted-foreground">
          En qué escalón paga, o se queda, cada deal. Las ventas del periodo se reparten en los cuatro primeros escalones; los deals
          creados en el periodo y sin vender, en los otros tres. «Pagó sin llamada registrada» son ventas sin una llamada atendida antes del pago (traspasos de las hojas o deals creados a mano): no hay contra qué medirlas.
          {vista.sinCorte
            ? " Este programa no definió el corte de pago rápido (Programa): los pagos posteriores a la llamada van juntos en «Pagó después»."
            : ` «Pagó rápido» es hasta ${num(vista.corteDias ?? 0)} días hábiles después de la llamada.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1.5 pr-3 font-normal">Escalón</th>
                <th className="px-2 py-1.5 text-right font-normal">Deals</th>
                <th className="px-2 py-1.5 text-right font-normal">%</th>
                <th className="px-2 py-1.5 text-right font-normal">Días hábiles medianos</th>
                {vista.hayComparacion ? <th className="pl-2 py-1.5 text-right font-normal">Cambio</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibles.map((escalon) => {
                const celda = principal.celdas[escalon];
                return (
                  <tr key={escalon}>
                    <td className="py-1.5 pr-3">{NOMBRE_DE_ESCALON[escalon]}</td>
                    <td className="px-2 py-1.5 text-right"><Cifra celda={celda} titulo={NOMBRE_DE_ESCALON[escalon]} /></td>
                    <td className="cifra px-2 py-1.5 text-right">{celda.porcentaje.valor === null ? "—" : pct(celda.porcentaje.valor / 100)}</td>
                    <td className="cifra px-2 py-1.5 text-right">{celda.diasMedianos === null ? "—" : num(celda.diasMedianos, celda.diasMedianos % 1 === 0 ? 0 : 1)}</td>
                    {vista.hayComparacion && celda.anterior !== null ? (
                      <td className="px-2 py-1.5 text-right"><Variacion actual={celda.deals} anterior={celda.anterior} periodo={periodo} /></td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t">
                <td className="py-1.5 pr-3 font-medium">Total</td>
                <td className="cifra px-2 py-1.5 text-right font-medium">{num(principal.total)}</td>
                <td colSpan={vista.hayComparacion ? 3 : 2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <TablaPorDimension titulo="Por closer" filas={vista.porCloser} visibles={visibles} />
        <TablaPorDimension titulo="Por calidad" filas={vista.porCalidad} visibles={visibles} />
      </CardContent>
    </Card>
  );
}
