import type { JSX } from "react";
import { InterruptoresDeGrafica } from "@/components/graficas/interruptores";
import { crearModeloGrafica, type ExplicacionDeSerie, type SerieDeGrafica } from "@/components/graficas/contrato";
import { GraficaConExplicacion } from "@/components/graficas/grafica-con-explicacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { cop, fecha, num, usd } from "@/lib/format";
import { leerCumplimientoDeCohorte } from "@/lib/metas/cumplimiento-de-cohorte";
import { explicacionDePauta } from "@/lib/metricas/explicaciones-de-pauta";
import type { PeriodoResuelto } from "@/lib/periodo";
import * as agenda from "@/lib/queries/hechos/agenda";
import type { PuntoDiarioPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import { costoPorAgendaDeVentana } from "@/lib/semaforo/costo-por-agenda";
import {
  configDeGraficaEnOrigen,
  desplazarAlEjeDeA,
  etiquetaDeTramo,
  pasoPorDefecto,
  tramosDe,
  valoresPorTramo,
  type ConfigDeGrafica,
  type Tramo,
} from "@/lib/series-pasos";
import { VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";

/**
 * "¿Cómo se mueve día a día?" (420, diseño §4.4): una sola gráfica con sus tres interruptores en la URL
 * (`?g_pauta-diaria=inversion,dia,paso`). Lee la serie diaria de la tabla semanal (`cargarPautaSemanal`, la misma que
 * suma cada celda), así que no vuelve a contar nada; solo las agendas de Meta, que la tabla da por semana, se leen
 * por tramo con el mismo `costoPorAgendaDeVentana`. Toda serie abre su explicación al hacer clic en un punto.
 */
export const CLAVE_GRAFICA_DIARIA = "pauta-diaria";
const UNIDADES_DE_LA_GRAFICA = ["inversion", "cupos", "plata"] as const;
const PASOS_DE_LA_GRAFICA = ["dia", "semana"] as const;
/** Más tramos que esto no se piden a Meta uno por uno: la serie de agendas de Meta se omite y la gráfica lo dice. */
const TRAMOS_MAXIMOS_SEGUN_META = 45;

const SERIE = {
  inversion: VOCABULARIO_PAUTA_SEMANAL.inversion,
  agendas: "Agendadas",
  agendasMeta: "Agendas de Meta",
  ventas: "Ventas",
  vendido: "Vendido",
  anterior: "Agendadas · periodo anterior",
} as const;

function acumular(valores: Array<number | null>, forma: ConfigDeGrafica["forma"]): Array<number | null> {
  if (forma !== "acum") return valores;
  let total = 0;
  return valores.map((valor) => valor === null ? null : (total += valor));
}

async function agendasSegunMeta(p: PropsMovimiento, tramos: readonly Tramo[]): Promise<Array<number | null> | null> {
  if (tramos.length > TRAMOS_MAXIMOS_SEGUN_META) return null;
  const costos = await Promise.all(tramos.map((tramo) => costoPorAgendaDeVentana(db, {
    programId: p.programId, desde: tramo.desde, hasta: tramo.hasta, cohorteId: p.cohorteId,
  })));
  return costos.map((costo) => costo.agendasMeta);
}

interface PropsMovimiento {
  programId: string;
  programa?: string;
  cohorte?: string;
  rango: { desde: string; hasta: string };
  periodo: PeriodoResuelto;
  origen: string;
  hoy: string;
  cohorteId: string | null;
  dias: PuntoDiarioPautaSemanal[];
}

export async function MovimientoDiario(p: PropsMovimiento): Promise<JSX.Element> {
  const config = configDeGraficaEnOrigen(p.origen, CLAVE_GRAFICA_DIARIA, {
    unidad: "inversion",
    paso: pasoPorDefecto(p.rango) === "dia" ? "dia" : "semana",
    forma: "paso",
  });
  if (config.paso === "mes") config.paso = "semana";
  if (config.unidad !== "cupos" && config.unidad !== "plata") config.unidad = "inversion";
  const tramos = tramosDe(p.rango, config.paso, p.hoy);
  const porDia = <K extends keyof PuntoDiarioPautaSemanal>(campo: K) =>
    new Map(p.dias.flatMap((punto) => typeof punto[campo] === "number" ? [[punto.dia, punto[campo] as number] as const] : []));
  const serie = (campo: "inversionCop" | "agendas" | "ventas" | "vendidoUsd") => valoresPorTramo(porDia(campo), tramos, config.forma);

  const [cumplimiento, anterior, segunMeta] = await Promise.all([
    leerCumplimientoDeCohorte(p.programId, p.cohorteId, p.hoy),
    p.periodo.b && config.unidad !== "plata"
      ? agenda.agendasDePauta(db, { programId: p.programId, rango: p.periodo.b, cohorteId: p.cohorteId })
      : Promise.resolve(null),
    config.unidad === "cupos" ? agendasSegunMeta(p, tramos) : Promise.resolve(null),
  ]);

  const series: SerieDeGrafica[] = [];
  if (config.unidad === "inversion") {
    series.push({ clave: SERIE.inversion, valores: serie("inversionCop"), tipo: "barra", eje: 0, unidad: "" });
    series.push({ clave: SERIE.agendas, valores: serie("agendas"), tipo: "linea", eje: 1 });
  } else if (config.unidad === "cupos") {
    series.push({ clave: SERIE.ventas, valores: serie("ventas"), tipo: "barra" });
    series.push({ clave: SERIE.agendas, valores: serie("agendas"), tipo: "linea", color: 1 });
    if (segunMeta) series.push({ clave: SERIE.agendasMeta, valores: acumular(segunMeta, config.forma), tipo: "linea", color: 2 });
  } else {
    series.push({ clave: SERIE.inversion, valores: serie("inversionCop"), tipo: "barra", eje: 0, unidad: "" });
    series.push({ clave: SERIE.vendido, valores: serie("vendidoUsd"), tipo: "linea", eje: 1, unidad: "" });
  }
  if (anterior && p.periodo.b) {
    const desplazado = desplazarAlEjeDeA(new Map(anterior.map((fila) => [fila.dia!, fila.agendas] as const)), p.rango, p.periodo.b);
    series.push({ clave: SERIE.anterior, valores: valoresPorTramo(desplazado.porDia, tramos, config.forma, desplazado.hastaDatos), tipo: "linea", eje: config.unidad === "inversion" ? 1 : 0, punteada: true });
  }

  const filtros: Array<readonly [string, string]> = [];
  if (p.programa) filtros.push(["Programa", p.programa]);
  filtros.push(["Área", "Paid"]);
  if (p.cohorte) filtros.push(["Cohorte", p.cohorte]);
  const porDiaTexto = config.paso === "dia";
  const explicacion = (concepto: Parameters<typeof explicacionDePauta>[0], motivoVacio: string): ExplicacionDeSerie => ({
    entrada: { concepto, explicacion: explicacionDePauta(concepto), filtros },
    paso: porDiaTexto ? "Día" : "Semana",
    anterior: porDiaTexto ? "el día anterior" : "la semana anterior",
    prefijo: config.forma === "acum" ? "acumulado hasta" : undefined,
    motivoVacio,
  });
  const explicaciones: Record<string, ExplicacionDeSerie> = {
    [SERIE.inversion]: explicacion("inversion", "Sin gasto de Meta cargado ese día."),
    [SERIE.agendas]: explicacion("agendas", "Sin agendas ese día."),
    [SERIE.agendasMeta]: explicacion("agendas_meta", "Meta no reporta agendas de este programa."),
    [SERIE.ventas]: explicacion("ventas", "Sin ventas ese día."),
    [SERIE.vendido]: explicacion("facturacion", "Sin ventas ese día."),
  };

  const unidadPrincipal = config.unidad === "cupos" ? "cantidad" : "COP";
  const modelo = crearModeloGrafica({
    tipo: "linea",
    unidad: unidadPrincipal,
    unidadSecundaria: config.unidad === "inversion" ? "agendas" : config.unidad === "plata" ? "USD" : undefined,
    dias: tramos.map((tramo) => tramo.desde),
    etiquetas: tramos.map(etiquetaDeTramo),
    series,
    escribir: (valor) => num(valor),
    formatos: { [SERIE.inversion]: cop, [SERIE.vendido]: usd },
    zoom: porDiaTexto && tramos.length > 14,
    pista: "Clic para ver cómo se calcula",
    comparacion: anterior ? { texto: "Contra el periodo anterior", pares: [{ actual: SERIE.agendas, referencia: SERIE.anterior }] } : undefined,
  });
  const metaPorDia = cumplimiento.requeridos?.agendasDia.valor ?? null;
  const titulo = porDiaTexto ? "¿Cómo se mueve día a día?" : "¿Cómo se mueve semana a semana?";
  const tieneDatos = series.some((s) => s.valores.some((valor) => valor !== null && valor !== 0));
  const omitioMeta = config.unidad === "cupos" && segunMeta === null;

  return (
    <Card aria-labelledby="movimiento-diario" data-testid="movimiento-diario">
      <CardHeader className="space-y-1">
        <CardTitle id="movimiento-diario">
          {titulo}
          {metaPorDia !== null && config.unidad !== "plata" && porDiaTexto
            ? <span className="font-normal text-muted-foreground"> · meta: <span className="cifra font-medium text-foreground">{num(metaPorDia, 1)}</span> agendas por día</span>
            : null}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pasa el mouse para ver cada {porDiaTexto ? "día" : "semana"}; clic en un punto para abrir esa cifra; clic en la leyenda para prender o apagar una serie{porDiaTexto && tramos.length > 14 ? "; arrastra abajo para acercar" : ""}.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <InterruptoresDeGrafica origen={p.origen} clave={CLAVE_GRAFICA_DIARIA} config={config} unidades={UNIDADES_DE_LA_GRAFICA} pasos={PASOS_DE_LA_GRAFICA} />
        {tieneDatos
          ? <GraficaConExplicacion modelo={modelo} explicaciones={explicaciones}
            titulo={`${titulo} Ejes lineales con cero visible.`}
            tituloDeTabla={`${titulo}, por ${porDiaTexto ? "día" : "semana"}`}
            frescura={`Datos hasta el ${fecha(p.rango.hasta < p.hoy ? p.rango.hasta : p.hoy)}.${omitioMeta ? " Las agendas de Meta se ven por semana con periodos largos." : ""}`} />
          : <p className="text-sm text-muted-foreground">Sin inversión, agendas ni ventas de Paid en este periodo.</p>}
      </CardContent>
    </Card>
  );
}
