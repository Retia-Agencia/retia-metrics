import Link from "next/link";
import type { ReactNode } from "react";
import { BarraDeAvance } from "@/components/hub/barra-de-avance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, usd } from "@/lib/format";
import { fraseDeAvance } from "@/lib/metas/frase-de-avance";
import { enlaceConVueltaAFragmento } from "@/lib/navegacion/volver";
import { nombreCorto } from "@/lib/vocabulario-metricas";
import { urlDeLista } from "@/lib/queries/vista-metrica";
import {
  leerVamosALlegar,
  type CeldaDeMeta,
  type CuadranteDeMeta,
  type TonoDeMeta,
  type VamosALlegar as DatosVamosALlegar,
} from "@/lib/queries/vamos-a-llegar";

export interface PropsVamosALlegar {
  programa: { id: string; slug: string; nombre: string };
  hoy: string;
  origen: string;
  conListas: boolean;
  configurar: { hrefBase: string; origen: string } | null;
  conNombre?: boolean;
}

const TONO_DE_BARRA: Record<TonoDeMeta, string> = {
  ok: "bg-tono-exito", atencion: "bg-tono-alerta", peligro: "bg-tono-peligro", neutro: "bg-primary",
};

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 text-sm">
    <dt className="text-muted-foreground">{rotulo}</dt>
    <dd className="cifra text-right">{children}</dd>
  </div>;
}

function BarraDeLaCelda({ celda }: { celda: CeldaDeMeta }) {
  // Sin objetivo no hay a qué medir la barra: no se dibuja.
  if (celda.meta === null) return null;
  return <BarraDeAvance llevamos={celda.llevamos} objetivo={celda.meta} esperado={celda.esperado} tono={TONO_DE_BARRA[celda.tono]} />;
}

function DetalleDeCelda({ celda, unidad, conProyeccion }: {
  celda: CeldaDeMeta;
  unidad: "cupos" | "usd";
  conProyeccion: boolean;
}) {
  const f = (valor: number) => unidad === "usd" ? usd(valor) : num(valor);
  return <section className="space-y-1">
    <h4 className="text-xs font-medium text-muted-foreground">{unidad === "usd" ? `${nombreCorto("vendido")} (USD)` : "Cupos"}</h4>
    <Dato rotulo="Llevamos">{f(celda.llevamos)}{celda.meta === null ? "" : ` de ${f(celda.meta)}`}</Dato>
    <Dato rotulo={nombreCorto("faltan")}>{celda.faltan === null ? "—" : f(celda.faltan)}</Dato>
    <Dato rotulo={nombreCorto("esperado_a_hoy")}>{celda.esperado === null ? "—" : f(celda.esperado)}</Dato>
    <Dato rotulo={nombreCorto("por_dia_habil")}>{celda.porDiaHabil === null ? "—" : f(celda.porDiaHabil)}</Dato>
    {conProyeccion ? <Dato rotulo={nombreCorto("proyeccion")}>{celda.proyeccion === null ? "—" : f(celda.proyeccion)}</Dato> : null}
  </section>;
}

function Fila({ titulo, cierre, cuadrante, href, conProyeccion, aviso }: {
  titulo: string;
  cierre: string | null;
  cuadrante: CuadranteDeMeta;
  href: string | null;
  conProyeccion: boolean;
  aviso: ReactNode;
}) {
  const frase = fraseDeAvance(cuadrante.cupos, { cierre });
  return <section aria-label={titulo} className="space-y-3">
    <h3 className="text-sm font-medium">{titulo}</h3>
    <BarraDeLaCelda celda={cuadrante.cupos} />
    <div>
      {href ? <Link className="font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring" href={href}>{frase}</Link> : <p className="font-medium">{frase}</p>}
    </div>
    {aviso}
    {cuadrante.ventasSinValorVendido > 0
      ? <Badge variant="alerta">{num(cuadrante.ventasSinValorVendido)} sin valor vendido: el total está incompleto</Badge>
      : null}
    <div className="grid gap-4 rounded-lg bg-muted p-3 text-sm sm:grid-cols-2">
      <DetalleDeCelda celda={cuadrante.cupos} unidad="cupos" conProyeccion={conProyeccion} />
      <DetalleDeCelda celda={cuadrante.usd} unidad="usd" conProyeccion={conProyeccion} />
    </div>
  </section>;
}

export function VamosALlegarVista({ datos, props }: { datos: DatosVamosALlegar; props: PropsVamosALlegar }) {
  const { programa, hoy, origen, conListas, configurar, conNombre } = props;
  const periodo = (desde: string) => ({ preset: "custom" as const, a: { desde, hasta: hoy }, b: null });
  const hrefMes = conListas ? urlDeLista({ slug: programa.slug, metrica: "cierres", periodo: periodo(`${datos.mes.clave}-01`), origen }) : null;
  const hrefCohorte = conListas && datos.cohorte
    ? urlDeLista({ slug: programa.slug, metrica: "cierres", periodo: periodo(datos.cohorte.desdeLista), origen, cohorteId: datos.cohorte.id })
    : null;
  const configurarLink = configurar
    ? <Button size="sm" variant="link" nativeButton={false} render={<Link href={enlaceConVueltaAFragmento(configurar.hrefBase, configurar.origen, "cohortes")} />}>Configurar</Button>
    : null;
  const mesNombre = datos.mes.nombre.split(" ")[0];
  return <Card data-testid="vamos-a-llegar">
    <CardHeader className="space-y-1">
      <CardTitle>¿Vamos a llegar?{conNombre ? ` · ${programa.nombre}` : ""}</CardTitle>
      <p className="text-sm text-muted-foreground">Mes de {mesNombre}{datos.cohorte ? ` y cohorte ${datos.cohorte.codigo}` : ""} · no cambia con los filtros ni con la fecha</p>
    </CardHeader>
    <CardContent className="space-y-6">
      <Fila titulo={`Mes de ${mesNombre}`} cierre={datos.mes.cierre} cuadrante={datos.mes.cuadrante} href={hrefMes} conProyeccion={false} aviso={datos.mes.sinMeta ? configurarLink : null} />
      {datos.cohorte ? <Fila
        titulo={`Cohorte ${datos.cohorte.codigo}${datos.cohorte.cierre ? ` · cierra ${fecha(datos.cohorte.cierre)}` : ""}`}
        cierre={datos.cohorte.cierre}
        cuadrante={datos.cohorte.cuadrante}
        href={hrefCohorte}
        conProyeccion
        aviso={<>{datos.cohorte.cuadrante.cupos.proyeccion === null && datos.cohorte.razonProyeccion
          ? <p className="text-xs text-muted-foreground">{datos.cohorte.razonProyeccion}</p> : null}{datos.cohorte.sinMeta ? configurarLink : null}</>}
      /> : <section aria-label="Cohorte" className="space-y-1">
        <h3 className="text-sm font-medium">Cohorte</h3>
        <p className="text-sm text-muted-foreground">Sin cohorte activa</p>
        {configurarLink}
      </section>}
    </CardContent>
  </Card>;
}

export async function VamosALlegar(props: PropsVamosALlegar) {
  const datos = await leerVamosALlegar(props.programa.id, props.hoy);
  return <VamosALlegarVista datos={datos} props={props} />;
}
