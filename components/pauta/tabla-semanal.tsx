import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { Cifra } from "@/components/cifra-con-lista";
import { Grafica } from "@/components/graficas/grafica";
import { InterruptoresDeGrafica } from "@/components/graficas/interruptores";
import { listaDeVentas } from "@/components/pauta/cumplimiento";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { db } from "@/lib/db";
import { cop, fecha, fechaCorta, num } from "@/lib/format";
import { leerEvidencia } from "@/lib/metas/cumplimiento-de-cohorte";
import type { CifraDeMetrica } from "@/lib/metricas/cifra";
import { cifraDeCeldaSemanal, type EntradaDeCeldaSemanal } from "@/lib/pauta/cifra-de-celda-semanal";
import type { PeriodoResuelto } from "@/lib/periodo";
import { etiquetaDeSemana } from "@/lib/pauta/csv-tabla-semanal";
import {
  cargarPautaSemanal,
  type CeldaPautaSemanal,
  type ClavePautaSemanal,
  type FilaPautaSemanal,
} from "@/lib/queries/hechos/pauta-semanal";
import { nombreDeEtapa, urlDeLista } from "@/lib/queries/vista-metrica";
import type { Metrica } from "@/lib/queries/metricas-con-filas";
import {
  configDeGraficaEnOrigen,
  etiquetaDeTramo,
  pasoPorDefecto,
  tramosDe,
  valoresPorTramo,
} from "@/lib/series-pasos";
import { nombreCorto, UNIVERSO_PAUTA, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";

const NOMBRE_DE_BLOQUE = { general: "General", comercial: "Comercial", trafico: "Tráfico" } as const;

/**
 * La lista que abre cada celda y que cuenta lo mismo que ella (419, ADR 0067): Agendadas abre las agendas creadas de
 * Paid; Ventas y Vendido, las ventas de Paid de esa columna; las tres tasas, la parte de arriba de su fórmula en el
 * grupo de citas de Paid (decisión de Mani del 11-nov). Lo vigila `tests/pauta-semanal.test.ts`. Solo se lee la
 * lista que la sesión puede abrir (`listasQueAbre`, la misma reja de la página de lista).
 */
const EVIDENCIA: Partial<Record<ClavePautaSemanal, { metrica: Metrica; nombre: string; articulo: "los" | "las"; parte?: "arriba" }>> = {
  agendas: { metrica: "agendas_creadas", nombre: "agendas", articulo: "las" },
  ventas: { metrica: "cierres", nombre: "ventas", articulo: "las" },
  facturacion: { metrica: "cierres", nombre: "ventas", articulo: "las" },
  show: { metrica: "grupo_shows", nombre: "deals que asistieron", articulo: "los", parte: "arriba" },
  cierre_ventas: { metrica: "grupo_vendidos", nombre: "deals que asistieron y compraron", articulo: "los", parte: "arriba" },
  agenda_venta: { metrica: "grupo_vendidos", nombre: "deals que asistieron y compraron", articulo: "los", parte: "arriba" },
};

/** Las listas que abre la tabla: la página decide con ellas cuáles puede abrir la sesión. */
export const LISTAS_DE_LA_TABLA_SEMANAL: readonly Metrica[] = [...new Set(Object.values(EVIDENCIA).map((e) => e.metrica))];

type Lista = NonNullable<EntradaDeCeldaSemanal["lista"]>;

function periodoDelRango(rango: { desde: string; hasta: string }): PeriodoResuelto {
  return { preset: "custom", a: rango, b: null, comparaciones: [] };
}

async function listaDelRango(p: PropsTabla, metrica: Metrica, rango: { desde: string; hasta: string }): Promise<Lista> {
  const seccion = await leerEvidencia(metrica, { programId: p.programId, cohorteId: p.cohorteId, desde: rango.desde, hasta: rango.hasta, hoy: p.hoy, area: "paid" });
  const href = urlDeLista({
    slug: p.slug,
    metrica,
    periodo: periodoDelRango(rango),
    origen: p.origen,
    cohorteId: p.cohorteId,
    filtrosDeOrigen: { area: "paid" },
  });
  if (metrica === "cierres") return listaDeVentas(seccion, href);
  return {
    href,
    nombre: "",
    total: seccion.subtotal.cantidad,
    filas: seccion.filas.slice(0, 5).map((fila) => [
      fila.persona?.nombre ?? "Sin nombre",
      fila.etapa ? nombreDeEtapa(fila.etapa) : "—",
      fechaCorta(fila.fecha),
    ]),
  };
}

function Celda({ cifra, celda }: { cifra: CifraDeMetrica; celda: CeldaPautaSemanal }) {
  return (
    <div className="flex flex-col items-end gap-0.5">
      <Cifra cifra={cifra} tamano="celda" />
      {celda.otrasCampanasCop !== undefined
        ? <p className="text-[11px] text-muted-foreground">{VOCABULARIO_PAUTA_SEMANAL.otras_campaignas}: <span className="cifra">{cop(celda.otrasCampanasCop)}</span></p>
        : null}
    </div>
  );
}

interface PropsTabla {
  programId: string;
  programa?: string;
  cohorte?: string;
  slug: string;
  rango: { desde: string; hasta: string };
  periodo: PeriodoResuelto;
  origen: string;
  hoy: string;
  cohorteId: string | null;
  /** Las listas que la sesión abre (la reja de la página de lista): solo esas celdas traen su evidencia. */
  listasQueAbre?: readonly Metrica[];
}

function filasPorBloque(filas: FilaPautaSemanal[], bloque: FilaPautaSemanal["bloque"]): FilaPautaSemanal[] {
  return filas.filter((fila) => fila.bloque === bloque);
}

export async function TablaSemanalDePauta(p: PropsTabla): Promise<JSX.Element> {
  const [vista, objetivos] = await Promise.all([
    cargarPautaSemanal(db, { programId: p.programId, rango: p.rango, hoy: p.hoy, cohorteId: p.cohorteId }),
    p.cohorteId ? objetivosDeCohortes(db, [p.cohorteId]) : Promise.resolve([]),
  ]);
  // Una lectura por lista y columna (Total y cada semana); Ventas y Vendido comparten la de ventas.
  const columnas = [p.rango, ...vista.semanas];
  const metricas = LISTAS_DE_LA_TABLA_SEMANAL.filter((m) => p.listasQueAbre?.includes(m));
  const leidas = new Map(await Promise.all(metricas.map(async (m) => [m, await Promise.all(columnas.map((rango) => listaDelRango(p, m, rango)))] as const)));
  const listaDe = (clave: ClavePautaSemanal, columna: number): Lista | undefined => {
    const e = EVIDENCIA[clave];
    const lista = e ? leidas.get(e.metrica)?.[columna] : undefined;
    return e && lista ? { ...lista, nombre: e.nombre, articulo: e.articulo, ...(e.parte ? { parte: e.parte } : {}) } : undefined;
  };
  const cifra = (fila: FilaPautaSemanal, columna: number) => {
    const esTotal = columna === 0;
    const rango = esTotal ? p.rango : vista.semanas[columna - 1];
    const celda = esTotal ? fila.celdas.total : fila.celdas.porSemana[columna - 1];
    const anterior = columna > 1 ? { celda: fila.celdas.porSemana[columna - 2], rango: vista.semanas[columna - 2] } : undefined;
    return cifraDeCeldaSemanal({
      fila, celda, rango, esTotal, anterior, hoy: p.hoy, objetivos, programa: p.programa, cohorte: p.cohorte,
      lista: listaDe(fila.clave, columna),
    });
  };
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
          <div><CardTitle id="tabla-semanal-pauta" className="text-base">¿Cómo cambió Pauta cada semana?</CardTitle><p className="text-xs text-muted-foreground">{UNIVERSO_PAUTA}</p></div>
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href={hrefCsv} />}>Exportar CSV</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">Agendadas y su costo cuentan solo las agendas de Paid creadas en cada semana. El cumplimiento de arriba cuenta todos los orígenes de la cohorte, por eso puede dar más.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">Métricas de Paid Media del periodo y por semana, de lunes a domingo en Bogotá.</caption>
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="px-2 py-2 font-medium">Métrica</th>
                <th scope="col" className="bg-marca-suave px-2 py-2 text-right font-medium">Total</th>
                {vista.semanas.map((semana) => <th scope="col" key={semana.desde} className="px-2 py-2 text-right font-medium">{etiquetaDeSemana(semana)}{semana.hasta >= p.hoy ? <span className="font-normal text-muted-foreground"> · en curso</span> : null}</th>)}
              </tr>
            </thead>
            <tbody>
              {bloques.flatMap((bloque) => {
                const filas = filasPorBloque(vista.filas, bloque);
                const titulo: ReactNode = <tr key={`${bloque}-titulo`} className="border-b bg-muted/50"><th scope="rowgroup" colSpan={vista.semanas.length + 2} className="px-2 py-2 text-left text-xs font-medium">{NOMBRE_DE_BLOQUE[bloque]}</th></tr>;
                return [titulo, ...filas.map((fila) => (
                  <tr key={fila.clave} className="border-b last:border-0">
                    <th scope="row" className="px-2 py-3 text-left font-normal">{fila.nombre}</th>
                    <td className="bg-marca-suave px-2 py-2 text-right font-semibold"><Celda cifra={cifra(fila, 0)} celda={fila.celdas.total} /></td>
                    {fila.celdas.porSemana.map((celda, i) => (
                      <td key={vista.semanas[i].desde} className="px-2 py-2 text-right">
                        <Celda cifra={cifra(fila, i + 1)} celda={celda} />
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
          <p className="mt-2 text-muted-foreground">% de show / % presentación a zoom = {nombreCorto("asistencia")}; % cierre zoom a cliente = {nombreCorto("cierre_de_ventas")}; % cierre agenda a cliente = {nombreCorto("cita_a_venta")}.</p>
        </details>

        <section aria-labelledby="grafica-pauta-semanal" className="space-y-4">
          <h3 id="grafica-pauta-semanal" className="font-medium">¿Cómo se movieron la inversión y las agendas?</h3>
          <InterruptoresDeGrafica origen={p.origen} clave="pauta-semanal" config={config} />
          <div className="grid gap-6 lg:grid-cols-2">
            <Grafica
              tipo="barra"
              titulo={VOCABULARIO_PAUTA_SEMANAL.inversion}
              unidad="COP"
              frescura={`Datos hasta ${fecha(p.rango.hasta)}.`}
              etiquetas={etiquetas}
              formato={cop}
              datos={{ dias: tramos.map((tramo) => tramo.desde), series: [{ clave: VOCABULARIO_PAUTA_SEMANAL.inversion, valores: valoresPorTramo(porDiaInversion, tramos, config.forma) }] }}
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
