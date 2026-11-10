import Link from "next/link";
import { BarraDeAvance } from "@/components/hub/barra-de-avance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cop, fecha, num, pct, usd } from "@/lib/format";
import {
  ETIQUETA_POR_ESTADO,
  VARIANTE_POR_ESTADO,
  leerCumplimientoDeCohorte,
  type BarraDeCumplimiento,
  type CumplimientoDeCohorteLeido,
} from "@/lib/metas/cumplimiento-de-cohorte";

export interface PropsCumplimientoDeCohorte {
  programId: string;
  slug: string;
  cohorteId: string | null;
  hoy: string;
}

const TONO_POR_ESTADO = {
  en_meta: "bg-tono-exito",
  en_seguimiento: "bg-tono-alerta",
  rezagado: "bg-tono-peligro",
} as const;

function Configurar({ slug }: { slug: string }) {
  const href = `/p/${encodeURIComponent(slug)}/programa?seccion=ventas`;
  return <Button size="sm" variant="link" nativeButton={false} render={<Link href={href} />}>Configurar</Button>;
}

function Desfase({ valor, formato, unidad }: { valor: number | null; formato: (n: number) => string; unidad?: string }) {
  if (valor === null || valor === 0) return null;
  return <p className="text-xs text-muted-foreground">
    {valor > 0 ? "Atraso" : "Adelanto"} de <span className="cifra">{formato(Math.abs(valor))}</span>{unidad ? ` ${unidad}` : ""}
  </p>;
}

function Barra({ titulo, datos, unidad, universo }: { titulo: string; datos: BarraDeCumplimiento; unidad: "agendas" | "cupos"; universo?: string }) {
  const { cupos, usd: dolares } = datos;
  const estado = cupos.cumplimiento?.estado;
  return <section className="space-y-2" aria-label={titulo}>
    <h3 className="text-sm font-medium">{titulo}</h3>
    {universo ? <p className="text-xs text-muted-foreground">{universo}</p> : null}
    <BarraDeAvance
      llevamos={cupos.llevamos}
      objetivo={cupos.meta}
      unidad={` ${unidad}`}
      tono={estado ? TONO_POR_ESTADO[estado] : "bg-primary"}
    />
    <p className="text-sm">
      Llevamos <span className="cifra">{num(cupos.llevamos)}</span> de <span className="cifra">{num(cupos.meta)}</span> ({pct(cupos.llevamos / cupos.meta)})
    </p>
    <p className="text-xs text-muted-foreground">Esperado a hoy: <span className="cifra">{cupos.esperado === null ? "—" : num(cupos.esperado, 1)}</span></p>
    <div className="flex flex-wrap items-center gap-2">
      {estado ? <Badge variant={VARIANTE_POR_ESTADO[estado]}>{ETIQUETA_POR_ESTADO[estado]}</Badge> : null}
      <Desfase valor={cupos.desfase} formato={(valor) => num(valor, 1)} unidad={unidad} />
    </div>
    {dolares ? <div className="space-y-1 rounded-lg bg-muted p-3 text-xs">
      <p>Vendido: <span className="cifra">{usd(dolares.llevamos)}</span> de <span className="cifra">{usd(dolares.meta)}</span> ({pct(dolares.llevamos / dolares.meta)})</p>
      <p className="text-muted-foreground">Esperado a hoy: <span className="cifra">{dolares.esperado === null ? "—" : usd(dolares.esperado)}</span></p>
      <Desfase valor={dolares.desfase} formato={usd} />
    </div> : null}
  </section>;
}

export function CumplimientoVista({ datos, slug }: { datos: CumplimientoDeCohorteLeido; slug: string }) {
  if (!datos.cohorte) return <Card data-testid="cumplimiento-cohorte">
    <CardHeader><CardTitle>Cumplimiento de la cohorte</CardTitle></CardHeader>
    <CardContent><p className="text-sm text-muted-foreground">Sin cohorte activa</p></CardContent>
  </Card>;
  return <Card data-testid="cumplimiento-cohorte">
    <CardHeader>
      <CardTitle>Cumplimiento de la cohorte {datos.cohorte.codigo}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-6">
      {datos.agendas
        ? <Barra titulo="Agendadas" datos={datos.agendas} unidad="agendas" universo="De la cohorte, de todos los orígenes (no solo Paid), desde que empezó a venderse." />
        : <section className="space-y-1"><p className="text-sm">Sin meta de agendas para esta cohorte</p><Configurar slug={slug} /></section>}
      {datos.ventasPauta
        ? <Barra titulo="Ventas de pauta" datos={datos.ventasPauta} unidad="cupos" />
        : <section className="space-y-1"><p className="text-sm">Sin meta de ventas de pauta para esta cohorte</p><Configurar slug={slug} /></section>}
      {datos.ventasTotales ? <Barra titulo="Ventas totales" datos={datos.ventasTotales} unidad="cupos" /> : null}
      {datos.inversion ? <p className="text-sm">Inversión: llevamos <span className="cifra">{cop(datos.inversion.llevamos)}</span> de <span className="cifra">{cop(datos.inversion.meta)}</span></p> : null}
      {datos.cohorte.cerrada ? <p className="text-sm font-medium">La cohorte ya cerró</p> : null}
      {datos.requeridos ? <section className="space-y-2 rounded-lg bg-muted p-3" aria-label="Requeridos">
        {datos.requeridos.metaCumplida
          ? <p className="text-sm font-medium">Meta cumplida: no hace falta más inversión</p>
          : <>
            <p className="text-sm">
              {datos.requeridos.agendasDia.valor === null
                ? datos.requeridos.agendasDia.razon ?? "—"
                : <>Requiere <span className="cifra">{num(datos.requeridos.agendasDia.valor, 1)}</span> agendas/día hasta el {fecha(datos.requeridos.cierre)}</>}
            </p>
            <p className="text-xs text-muted-foreground">Inversión/día al costo meta: <span className="cifra">{datos.requeridos.inversionDiaMeta === null ? "—" : cop(datos.requeridos.inversionDiaMeta)}</span></p>
            <p className="text-xs text-muted-foreground">Inversión/día al promedio de la cohorte: <span className="cifra">{datos.requeridos.inversionDiaPromedio === null ? "—" : cop(datos.requeridos.inversionDiaPromedio)}</span></p>
          </>}
      </section> : null}
    </CardContent>
  </Card>;
}

export async function CumplimientoDeCohorte(props: PropsCumplimientoDeCohorte) {
  const datos = await leerCumplimientoDeCohorte(props.programId, props.cohorteId, props.hoy);
  return <CumplimientoVista datos={datos} slug={props.slug} />;
}
