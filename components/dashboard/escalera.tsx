import { useId } from "react";
import { BarraApilada100, LeyendaDeBarras, type TonoDeBarra } from "@/components/graficas/barras";
import { EnlaceAInfo } from "@/components/hub/info-de-pagina";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CifraDeMetrica } from "@/lib/metricas/cifra";
import type { cifrasDeEscalera } from "@/lib/hub/cifras-de-recorridos";
import { Cifra as CifraMetrica, CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { num, pct } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";
import { ESCALONES, NOMBRE_DE_ESCALON, type Escalon, type GrupoDeCierre } from "@/lib/escalones";
import type { CeldaDeEscalera, FilaDeEscalera, VistaDeEscalera } from "@/lib/queries/vista-escalera";

export const GRUPOS_PRINCIPALES = [
  ["cerro_en_la_llamada", "Cerró en la llamada", "exito"],
  ["cerro_con_seguimiento", "Cerró con seguimiento", "info"],
  ["no_cerro", "No cerró", "peligro"],
] as const satisfies readonly (readonly [GrupoDeCierre, string, TonoDeBarra])[];

const LEYENDA = GRUPOS_PRINCIPALES.map(([, etiqueta, tono]) => ({ etiqueta, tono }));

type CifrasDeEscalera = ReturnType<typeof cifrasDeEscalera>;
type FilaDeCifras = CifrasDeEscalera["principal"];

function Cifra({ celda, titulo, cifra }: { celda: CeldaDeEscalera; titulo: string; cifra?: CifraDeMetrica }) {
  if (cifra) return <CifraMetrica cifra={cifra} tamano="celda" />;
  return <CifraConLista titulo={titulo} detalle={celda.detalle ?? undefined}><span className="cifra">{num(celda.deals)}</span></CifraConLista>;
}

export function BarraDeCierre({ fila, leyenda = false, cifras }: { fila: FilaDeEscalera; leyenda?: boolean; cifras?: FilaDeCifras }) {
  const segmentos = GRUPOS_PRINCIPALES.map(([clave, etiqueta, tono]) => ({ clave, etiqueta, tono, cantidad: fila.grupos[clave].deals, cifra: cifras?.grupos[clave], detalle: fila.grupos[clave].detalle ?? undefined }));
  return <div className={leyenda ? "space-y-2" : ""}>{leyenda ? <LeyendaDeBarras items={LEYENDA} /> : null}<BarraApilada100 segmentos={segmentos} compacta={!leyenda} /></div>;
}

function TablaPorCalidad({ filas, visibles, cifras }: { filas: FilaDeEscalera[]; visibles: readonly Escalon[]; cifras?: FilaDeCifras[] }) {
  if (filas.length === 0) return null;
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <caption className="pb-2 text-left font-medium">Por calidad</caption>
    <thead><tr className="text-left text-muted-foreground"><th>Calidad</th>{visibles.map((e) => <th key={e} className="text-right">{NOMBRE_DE_ESCALON[e]}</th>)}</tr></thead>
    <tbody className="divide-y">{filas.map((fila) => <tr key={fila.clave}><td className="py-2">{fila.etiqueta}</td>{visibles.map((e) => <td key={e} className="text-right"><Cifra celda={fila.celdas[e]} titulo={`${NOMBRE_DE_ESCALON[e]} · ${fila.etiqueta}`} cifra={cifras?.find((c) => c.clave === fila.clave)?.celdas[e].cantidad} /></td>)}</tr>)}</tbody>
  </table></div>;
}

export function DetalleDeEscalera({ vista, periodo, cifras }: { vista: VistaDeEscalera; periodo: PeriodoResuelto; cifras?: CifrasDeEscalera }) {
  const visibles = vista.sinCorte ? ESCALONES.filter((escalon) => escalon !== "pago_rapido") : ESCALONES;
  return <div className="space-y-4">
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th>Escalón</th><th className="text-right">Deals</th><th className="text-right">%</th><th className="text-right">Días hábiles medianos</th>{vista.hayComparacion ? <th className="text-right">Cambio</th> : null}</tr></thead>
      <tbody className="divide-y">{visibles.map((escalon) => {
        const celda = vista.principal.celdas[escalon];
        return <tr key={escalon}><td className="py-2">{NOMBRE_DE_ESCALON[escalon]}</td><td className="text-right"><Cifra celda={celda} titulo={NOMBRE_DE_ESCALON[escalon]} cifra={cifras?.principal.celdas[escalon].cantidad} /></td><td className="cifra text-right">{cifras ? <CifraMetrica cifra={cifras.principal.celdas[escalon].porcentaje} tamano="celda" /> : celda.porcentaje.valor === null ? "—" : pct(celda.porcentaje.valor / 100)}</td><td className="cifra text-right">{cifras ? <CifraMetrica cifra={cifras.principal.celdas[escalon].diasMedianos} tamano="celda">{celda.diasMedianos === null ? "—" : num(celda.diasMedianos, celda.diasMedianos % 1 === 0 ? 0 : 1)}</CifraMetrica> : celda.diasMedianos === null ? "—" : num(celda.diasMedianos, celda.diasMedianos % 1 === 0 ? 0 : 1)}</td>{vista.hayComparacion ? <td className="text-right">{celda.anterior === null ? "—" : <Variacion actual={celda.deals} anterior={celda.anterior} periodo={periodo} />}</td> : null}</tr>;
      })}</tbody>
    </table></div>
    {vista.principal.citaSinResultado.deals > 0 ? (
      <p className="text-sm text-muted-foreground">
        <Cifra celda={vista.principal.citaSinResultado} titulo="Cita pasada sin resultado" cifra={cifras?.principal.citaSinResultado} /> con la cita pasada y sin resultado marcado. Están dentro de los escalones de arriba, no son faltas de asistencia: el closer no marcó la llamada.
      </p>
    ) : null}
    <TablaPorCalidad filas={vista.porCalidad} visibles={visibles} cifras={cifras?.porCalidad} />
  </div>;
}

export function Escalera({ vista, programa, cifras }: { cifras?: CifrasDeEscalera; vista: VistaDeEscalera; periodo?: PeriodoResuelto; programa?: string; contexto?: string }) {
  const idDelTitulo = useId();
  const titulo = "¿Cómo cierra cada llamada?";
  return <Card id={cifras ? "como-cierra" : undefined} className={cifras ? "scroll-mt-4" : undefined} aria-labelledby={idDelTitulo}>
    <CardHeader><div className="flex flex-wrap items-center gap-2">
      <CardTitle id={idDelTitulo} className="flex items-center gap-1.5 text-base">{titulo}{programa ? ` · ${programa}` : ""}{cifras ? null : <EnlaceAInfo seccion="escalera" etiqueta={titulo} />}</CardTitle>
      {vista.sinCorte ? <Badge variant="alerta">Sin corte de pago rápido</Badge> : null}
    </div>{cifras ? <p className="text-xs text-muted-foreground">Cerró en la llamada: el primer pago cae el mismo día (Bogotá) que la llamada con show. Cerró con seguimiento: el primer pago llega días hábiles después de esa llamada. No cerró: tuvo show y no hay venta. Nadie lo etiqueta: se calcula con la llamada marcada y el primer abono. Una cita sin marcar no entra. Las ventas sin llamada registrada van aparte. Cada deal lo dice en su ficha.</p> : null}</CardHeader>
    <CardContent><BarraDeCierre fila={vista.principal} cifras={cifras?.principal} leyenda /></CardContent>
  </Card>;
}
