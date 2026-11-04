import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct, usd } from "@/lib/format";
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

/**
 * Las props NO admiten periodo, cohorte ni closer: el bloque no se puede filtrar ni queriendo
 * (el molde del comparativo del ADR 0023). Solo el programa y el dia de hoy.
 */
export interface PropsVamosALlegar {
  programa: { id: string; slug: string; nombre: string };
  hoy: string;
  /** Ruta de la pantalla, para que la lista que abre cada cifra sepa volver. */
  origen: string;
  /** Si la sesion ve las listas del equipo comercial; si no, las cifras salen como texto. */
  conListas: boolean;
  /** Donde se configura la meta (Programa › Ventas), solo para quien administra. */
  configurar: { hrefBase: string; origen: string } | null;
  /** En "todos los programas" cada matriz lleva el nombre de su programa. */
  conNombre?: boolean;
}

const TONO: Record<TonoDeMeta, "exito" | "alerta" | "peligro" | "neutro"> = {
  ok: "exito", atencion: "alerta", peligro: "peligro", neutro: "neutro",
};

function Dato({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="flex items-baseline justify-between gap-3 text-sm">
    <dt className="text-muted-foreground">{rotulo}</dt>
    <dd className="cifra text-right">{children}</dd>
  </div>;
}

function Celda({ celda, unidad, href, conProyeccion }: {
  celda: CeldaDeMeta;
  unidad: "cupos" | "usd";
  href: string | null;
  conProyeccion: boolean;
}) {
  const f = (v: number) => (unidad === "usd" ? usd(v) : num(v, 2));
  const llevamos = href
    ? <Link className="cifra text-2xl font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href}>{unidad === "usd" ? usd(celda.llevamos) : num(celda.llevamos)}</Link>
    : <span className="cifra text-2xl font-semibold">{unidad === "usd" ? usd(celda.llevamos) : num(celda.llevamos)}</span>;
  if (celda.meta === null) {
    return <div className="space-y-1">
      {llevamos}
      <p className="text-sm text-muted-foreground">Sin meta: configúrala en Programa › Ventas</p>
    </div>;
  }
  return <div className="space-y-2">
    <div className="flex flex-wrap items-baseline gap-2">
      {llevamos}
      <span className="cifra text-sm text-muted-foreground">de {f(celda.meta)}</span>
      <Badge variant={TONO[celda.tono]}>{celda.pct === null ? "—" : pct(celda.pct)}</Badge>
    </div>
    <dl className="space-y-1">
      <Dato rotulo={nombreCorto("faltan")}>{celda.faltan === null ? "—" : f(celda.faltan)}</Dato>
      <Dato rotulo={nombreCorto("esperado_a_hoy")}>{celda.esperado === null ? "—" : f(celda.esperado)}</Dato>
      <Dato rotulo={nombreCorto("por_dia_habil")}>{celda.porDiaHabil === null ? "—" : f(celda.porDiaHabil)}</Dato>
      {conProyeccion ? <Dato rotulo={nombreCorto("proyeccion")}>{celda.proyeccion === null ? "—" : f(celda.proyeccion)}</Dato> : null}
    </dl>
  </div>;
}

function Fila({ titulo, cuadrante, hrefs, conProyeccion, aviso }: {
  titulo: string;
  cuadrante: CuadranteDeMeta;
  hrefs: string | null;
  conProyeccion: boolean;
  aviso: ReactNode;
}) {
  return <section aria-label={titulo} className="space-y-2">
    <h3 className="text-sm font-medium">{titulo}</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Cupos</p>
        <Celda celda={cuadrante.cupos} unidad="cupos" href={hrefs} conProyeccion={conProyeccion} />
      </div>
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{nombreCorto("vendido")} (USD)</p>
        <Celda celda={cuadrante.usd} unidad="usd" href={hrefs} conProyeccion={conProyeccion} />
        {cuadrante.ventasSinValorVendido > 0
          ? <Badge variant="alerta">{num(cuadrante.ventasSinValorVendido)} sin valor vendido: el total está incompleto</Badge>
          : null}
      </div>
    </div>
    {aviso}
  </section>;
}

/** Lo puro de la pantalla: recibe los datos ya calculados. Separado para poder probarlo sin base. */
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
  return <Card className="shadow-tarjeta" data-testid="vamos-a-llegar">
    <CardHeader className="space-y-1">
      <CardTitle>¿Vamos a llegar?{conNombre ? ` · ${programa.nombre}` : ""}</CardTitle>
      <p className="text-sm text-muted-foreground">
        Mes de {mesNombre}{datos.cohorte ? ` y cohorte ${datos.cohorte.codigo}` : ""} · no cambia con los filtros
      </p>
    </CardHeader>
    <CardContent className="space-y-6">
      <Fila
        titulo={`Mes de ${datos.mes.nombre}`}
        cuadrante={datos.mes.cuadrante}
        hrefs={hrefMes}
        conProyeccion={false}
        aviso={datos.mes.sinMeta ? configurarLink : null}
      />
      {datos.cohorte ? (
        <Fila
          titulo={`Cohorte ${datos.cohorte.codigo}`}
          cuadrante={datos.cohorte.cuadrante}
          hrefs={hrefCohorte}
          conProyeccion
          aviso={<>
            {datos.cohorte.cuadrante.cupos.proyeccion === null && datos.cohorte.razonProyeccion
              ? <p className="text-xs text-muted-foreground">{datos.cohorte.razonProyeccion}</p> : null}
            {datos.cohorte.sinMeta ? configurarLink : null}
          </>}
        />
      ) : (
        <section aria-label="Cohorte" className="space-y-1">
          <h3 className="text-sm font-medium">Cohorte</h3>
          <p className="text-sm text-muted-foreground">Sin cohorte activa</p>
          {configurarLink}
        </section>
      )}
    </CardContent>
  </Card>;
}

export async function VamosALlegar(props: PropsVamosALlegar) {
  const datos = await leerVamosALlegar(props.programa.id, props.hoy);
  return <VamosALlegarVista datos={datos} props={props} />;
}
