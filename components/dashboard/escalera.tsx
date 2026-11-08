import { useId } from "react";
import { BarraApilada100, LeyendaDeBarras, type TonoDeBarra } from "@/components/graficas/barras";
import { EnlaceAInfo } from "@/components/hub/info-de-pagina";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { num, pct } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";
import { ESCALONES, NOMBRE_DE_ESCALON, type Escalon, type GrupoDeCierre } from "@/lib/queries/escalera";
import type { CeldaDeEscalera, FilaDeEscalera, VistaDeEscalera } from "@/lib/queries/vista-escalera";

export const GRUPOS_PRINCIPALES = [
  ["cerro_en_la_llamada", "Cerró en la llamada", "exito"],
  ["cerro_con_seguimiento", "Cerró con seguimiento", "info"],
  ["no_cerro", "No cerró", "peligro"],
] as const satisfies readonly (readonly [GrupoDeCierre, string, TonoDeBarra])[];

const LEYENDA = GRUPOS_PRINCIPALES.map(([, etiqueta, tono]) => ({ etiqueta, tono }));

function Cifra({ celda, titulo }: { celda: CeldaDeEscalera; titulo: string }) {
  return <CifraConLista titulo={titulo} detalle={celda.detalle ?? undefined}><span className="cifra">{num(celda.deals)}</span></CifraConLista>;
}

export function BarraDeCierre({ fila, leyenda = false }: { fila: FilaDeEscalera; leyenda?: boolean }) {
  const segmentos = GRUPOS_PRINCIPALES.map(([clave, etiqueta, tono]) => ({ clave, etiqueta, tono, cantidad: fila.grupos[clave].deals, detalle: fila.grupos[clave].detalle ?? undefined }));
  return <div className={leyenda ? "space-y-2" : ""}>{leyenda ? <LeyendaDeBarras items={LEYENDA} /> : null}<BarraApilada100 segmentos={segmentos} compacta={!leyenda} /></div>;
}

function TablaPorCalidad({ filas, visibles }: { filas: FilaDeEscalera[]; visibles: readonly Escalon[] }) {
  if (filas.length === 0) return null;
  return <div className="overflow-x-auto"><table className="w-full text-sm">
    <caption className="pb-2 text-left font-medium">Por calidad</caption>
    <thead><tr className="text-left text-muted-foreground"><th>Calidad</th>{visibles.map((e) => <th key={e} className="text-right">{NOMBRE_DE_ESCALON[e]}</th>)}</tr></thead>
    <tbody className="divide-y">{filas.map((fila) => <tr key={fila.clave}><td className="py-2">{fila.etiqueta}</td>{visibles.map((e) => <td key={e} className="text-right"><Cifra celda={fila.celdas[e]} titulo={`${NOMBRE_DE_ESCALON[e]} · ${fila.etiqueta}`} /></td>)}</tr>)}</tbody>
  </table></div>;
}

export function DetalleDeEscalera({ vista, periodo }: { vista: VistaDeEscalera; periodo: PeriodoResuelto }) {
  const visibles = vista.sinCorte ? ESCALONES.filter((escalon) => escalon !== "pago_rapido") : ESCALONES;
  return <div className="space-y-4">
    <div className="overflow-x-auto"><table className="w-full text-sm">
      <thead><tr className="text-left text-muted-foreground"><th>Escalón</th><th className="text-right">Deals</th><th className="text-right">%</th><th className="text-right">Días hábiles medianos</th>{vista.hayComparacion ? <th className="text-right">Cambio</th> : null}</tr></thead>
      <tbody className="divide-y">{visibles.map((escalon) => {
        const celda = vista.principal.celdas[escalon];
        return <tr key={escalon}><td className="py-2">{NOMBRE_DE_ESCALON[escalon]}</td><td className="text-right"><Cifra celda={celda} titulo={NOMBRE_DE_ESCALON[escalon]} /></td><td className="cifra text-right">{celda.porcentaje.valor === null ? "—" : pct(celda.porcentaje.valor / 100)}</td><td className="cifra text-right">{celda.diasMedianos === null ? "—" : num(celda.diasMedianos, celda.diasMedianos % 1 === 0 ? 0 : 1)}</td>{vista.hayComparacion ? <td className="text-right">{celda.anterior === null ? "—" : <Variacion actual={celda.deals} anterior={celda.anterior} periodo={periodo} />}</td> : null}</tr>;
      })}</tbody>
    </table></div>
    {vista.principal.citaSinResultado.deals > 0 ? (
      <p className="text-sm text-muted-foreground">
        <Cifra celda={vista.principal.citaSinResultado} titulo="Cita pasada sin resultado" /> con la cita pasada y sin resultado marcado. Están dentro de los escalones de arriba, no son faltas de asistencia: el closer no marcó la llamada.
      </p>
    ) : null}
    <TablaPorCalidad filas={vista.porCalidad} visibles={visibles} />
  </div>;
}

export function Escalera({ vista, programa }: { vista: VistaDeEscalera; periodo?: PeriodoResuelto; programa?: string; contexto?: string }) {
  const idDelTitulo = useId();
  const titulo = "¿Cómo cierra cada llamada?";
  return <Card aria-labelledby={idDelTitulo}>
    <CardHeader><div className="flex flex-wrap items-center gap-2">
      <CardTitle id={idDelTitulo} className="flex items-center gap-1.5 text-base">{titulo}{programa ? ` · ${programa}` : ""}<EnlaceAInfo seccion="escalera" etiqueta={titulo} /></CardTitle>
      {vista.sinCorte ? <Badge variant="alerta">Sin corte de pago rápido</Badge> : null}
    </div></CardHeader>
    <CardContent><BarraDeCierre fila={vista.principal} leyenda /></CardContent>
  </Card>;
}
