import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { DatoOVacio } from "@/components/dato-o-vacio";
import { Grafica } from "@/components/graficas/grafica";
import { InterruptoresDeGrafica } from "@/components/graficas/interruptores";
import { Variacion } from "@/components/variacion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { db } from "@/lib/db";
import { cop, fecha, num } from "@/lib/format";
import { colorDeObjetivo } from "@/lib/objetivos/semaforo";
import type { MetricaObjetivo } from "@/lib/objetivos/metricas";
import type { PeriodoResuelto } from "@/lib/periodo";
import { etiquetaDeSemana, textoDeValorSemanal } from "@/lib/pauta/csv-tabla-semanal";
import {
  cargarPautaSemanal,
  type CeldaPautaSemanal,
  type ClavePautaSemanal,
  type FilaPautaSemanal,
} from "@/lib/queries/hechos/pauta-semanal";
import { urlDeLista } from "@/lib/queries/vista-metrica";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import {
  configDeGraficaEnOrigen,
  etiquetaDeTramo,
  pasoPorDefecto,
  tramosDe,
  valoresPorTramo,
} from "@/lib/series-pasos";
import { VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";

const LISTAS: Partial<Record<ClavePautaSemanal, Metrica>> = {
  agendas: "agendas_creadas",
  ventas: "cierres",
  facturacion: "contratado",
  show: "shows",
};

const METRICAS_DE_OBJETIVO: Partial<Record<ClavePautaSemanal, MetricaObjetivo>> = {
  costo_agenda_crm: "costo_por_agenda",
  costo_agenda_meta: "costo_por_agenda",
  roas: "roas",
  agenda_venta: "conversion_agenda_venta",
};

const NOMBRE_DE_BLOQUE = { general: "General", comercial: "Comercial", trafico: "Tráfico" } as const;
const ETIQUETA_COLOR = { exito: "En meta", alerta: "En seguimiento", peligro: "Rezagado" } as const;

function periodoDelRango(rango: { desde: string; hasta: string }): PeriodoResuelto {
  return { preset: "custom", a: rango, b: null, comparaciones: [] };
}

function hrefDeCelda(args: {
  fila: FilaPautaSemanal;
  rango: { desde: string; hasta: string };
  slug: string;
  origen: string;
  cohorteId: string | null;
}): string | null {
  const metrica = LISTAS[args.fila.clave];
  if (!metrica) return null;
  return urlDeLista({
    slug: args.slug,
    metrica,
    periodo: periodoDelRango(args.rango),
    origen: args.origen,
    cohorteId: args.cohorteId,
    filtrosDeOrigen: { area: "paid" },
  });
}

function Cifra({ celda, fila, href }: { celda: CeldaPautaSemanal; fila: FilaPautaSemanal; href: string | null }) {
  const contenido = (
    <span className="cifra whitespace-nowrap">
      <DatoOVacio valor={celda.valor} motivo={celda.cobertura.razon ?? undefined}>
        {(valor) => textoDeValorSemanal(valor, fila.unidad)}
      </DatoOVacio>
    </span>
  );
  return href && celda.valor !== null
    ? <Link href={href} className="rounded-lg text-primary underline underline-offset-2 hover:opacity-70 focus-visible:outline-2 focus-visible:outline-ring">{contenido}</Link>
    : contenido;
}

function EstadoDeObjetivo({
  fila,
  celda,
  objetivos,
}: {
  fila: FilaPautaSemanal;
  celda: CeldaPautaSemanal;
  objetivos: Awaited<ReturnType<typeof objetivosDeCohortes>>;
}) {
  const metrica = METRICAS_DE_OBJETIVO[fila.clave];
  if (!metrica || celda.valor === null) return null;
  const candidatas = objetivos.filter((objetivo) => objetivo.activo && objetivo.metrica === metrica && (objetivo.area === null || objetivo.area === "paid"));
  const objetivo = candidatas.find((fila) => fila.area === "paid") ?? candidatas.find((fila) => fila.area === null);
  if (!objetivo) return null;
  if (metrica === "costo_por_agenda" && objetivo.moneda !== "COP") return null;
  const valor = fila.unidad === "porcentaje" ? celda.valor * 100 : celda.valor;
  const color = colorDeObjetivo({ metrica, meta: objetivo.meta, aceptable: objetivo.aceptable, valor });
  return <Badge variant={color}>{ETIQUETA_COLOR[color]}</Badge>;
}

function Celda({
  fila,
  celda,
  rango,
  anterior,
  slug,
  origen,
  cohorteId,
  objetivos,
}: {
  fila: FilaPautaSemanal;
  celda: CeldaPautaSemanal;
  rango: { desde: string; hasta: string };
  anterior?: CeldaPautaSemanal;
  slug: string;
  origen: string;
  cohorteId: string | null;
  objetivos: Awaited<ReturnType<typeof objetivosDeCohortes>>;
}) {
  return (
    <div className="space-y-1 text-right">
      <Cifra celda={celda} fila={fila} href={hrefDeCelda({ fila, rango, slug, origen, cohorteId })} />
      <div className="flex flex-wrap items-center justify-end gap-1">
        {celda.cobertura.estado === "parcial" ? <Badge variant="info">Parcial</Badge> : null}
        <EstadoDeObjetivo fila={fila} celda={celda} objetivos={objetivos} />
      </div>
      {anterior?.valor !== null && anterior?.valor !== undefined && celda.valor !== null
        ? <p className="text-xs text-muted-foreground"><Variacion actual={celda.valor} anterior={anterior.valor} comparacion="contra la semana anterior" decimales={fila.unidad === "conteo" ? 0 : 2} /></p>
        : null}
      {celda.otrasCampanasCop !== undefined
        ? <p className="text-xs text-muted-foreground">{VOCABULARIO_PAUTA_SEMANAL.otras_campaignas}: <span className="cifra">{cop(celda.otrasCampanasCop)}</span></p>
        : null}
    </div>
  );
}

function filasPorBloque(filas: FilaPautaSemanal[], bloque: FilaPautaSemanal["bloque"]): FilaPautaSemanal[] {
  return filas.filter((fila) => fila.bloque === bloque);
}

export async function TablaSemanalDePauta(p: { programId: string; slug: string; rango: { desde: string; hasta: string }; periodo: PeriodoResuelto; origen: string; hoy: string; cohorteId: string | null }): Promise<JSX.Element> {
  const [vista, objetivos] = await Promise.all([
    cargarPautaSemanal(db, { programId: p.programId, rango: p.rango, hoy: p.hoy, cohorteId: p.cohorteId }),
    p.cohorteId ? objetivosDeCohortes(db, [p.cohorteId]) : Promise.resolve([]),
  ]);
  const config = configDeGraficaEnOrigen(p.origen, "pauta-semanal", {
    unidad: "plata",
    paso: pasoPorDefecto(p.rango),
    forma: "paso",
  });
  const tramos = tramosDe(p.rango, config.paso, p.hoy);
  const porDiaInversion = new Map(vista.dias.flatMap((punto) => punto.inversionCop === null ? [] : [[punto.dia, punto.inversionCop] as const]));
  const porDiaAgendas = new Map(vista.dias.map((punto) => [punto.dia, punto.agendas] as const));
  const etiquetas = tramos.map(etiquetaDeTramo);
  const paramsCsv = new URLSearchParams({ a_desde: p.rango.desde, a_hasta: p.rango.hasta });
  if (p.cohorteId) paramsCsv.set("cohorte", p.cohorteId);
  const hrefCsv = `/p/${encodeURIComponent(p.slug)}/hub/pauta-semanal.csv?${paramsCsv}`;
  const bloques = ["general", "comercial", "trafico"] as const;

  return (
    <Card aria-labelledby="tabla-semanal-pauta">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle id="tabla-semanal-pauta" className="text-base">¿Cómo cambió Pauta cada semana?</CardTitle>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={hrefCsv} />}>Exportar CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">Métricas de Paid Media del periodo y por semana, de lunes a domingo en Bogotá.</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="px-2 py-2 font-medium">Métrica</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Total</th>
                {vista.semanas.map((semana) => <th scope="col" key={semana.desde} className="px-2 py-2 text-right font-medium">{etiquetaDeSemana(semana)}</th>)}
              </tr>
            </thead>
            <tbody>
              {bloques.flatMap((bloque) => {
                const filas = filasPorBloque(vista.filas, bloque);
                const titulo: ReactNode = <tr key={`${bloque}-titulo`} className="border-b bg-muted/50"><th scope="rowgroup" colSpan={vista.semanas.length + 2} className="px-2 py-2 text-left text-xs font-medium">{NOMBRE_DE_BLOQUE[bloque]}</th></tr>;
                return [titulo, ...filas.map((fila) => (
                  <tr key={fila.clave} className="border-b last:border-0">
                    <th scope="row" className="px-2 py-3 text-left font-normal">{fila.nombre}</th>
                    <td className="px-2 py-3"><Celda fila={fila} celda={fila.celdas.total} rango={p.rango} slug={p.slug} origen={p.origen} cohorteId={p.cohorteId} objetivos={objetivos} /></td>
                    {fila.celdas.porSemana.map((celda, i) => (
                      <td key={vista.semanas[i].desde} className="px-2 py-3">
                        <Celda fila={fila} celda={celda} anterior={i > 0 ? fila.celdas.porSemana[i - 1] : undefined} rango={vista.semanas[i]} slug={p.slug} origen={p.origen} cohorteId={p.cohorteId} objetivos={objetivos} />
                      </td>
                    ))}
                  </tr>
                ))];
              })}
            </tbody>
          </table>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer rounded-lg px-2 py-1 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">Cómo se calcula</summary>
          <p className="mt-2 text-muted-foreground">% presentación a zoom = % de show; % cierre zoom a cliente = Cierre de ventas; % cierre agenda a cliente = Agenda → venta.</p>
        </details>

        <section aria-labelledby="grafica-pauta-semanal" className="space-y-4">
          <h3 id="grafica-pauta-semanal" className="font-medium">¿Cómo se movieron la inversión y las agendas?</h3>
          <InterruptoresDeGrafica origen={p.origen} clave="pauta-semanal" config={config} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Grafica
              tipo="barra"
              titulo="Inversión"
              unidad="COP"
              frescura={`Datos hasta ${fecha(p.rango.hasta)}.`}
              etiquetas={etiquetas}
              formato={cop}
              datos={{ dias: tramos.map((tramo) => tramo.desde), series: [{ clave: "Inversión", valores: valoresPorTramo(porDiaInversion, tramos, config.forma) }] }}
            />
            <Grafica
              tipo="linea"
              titulo="Agendadas"
              unidad="agendas"
              frescura={`Datos hasta ${fecha(p.rango.hasta)}.`}
              etiquetas={etiquetas}
              formato={(valor) => num(valor)}
              datos={{ dias: tramos.map((tramo) => tramo.desde), series: [{ clave: "Agendadas", valores: valoresPorTramo(porDiaAgendas, tramos, config.forma) }] }}
            />
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
