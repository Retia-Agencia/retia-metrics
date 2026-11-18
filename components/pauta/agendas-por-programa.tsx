import type { JSX } from "react";
import { InterruptoresDeGrafica } from "@/components/graficas/interruptores";
import { crearModeloGrafica, type ExplicacionDeSerie, type SerieDeGrafica } from "@/components/graficas/contrato";
import { GraficaConExplicacion } from "@/components/graficas/grafica-con-explicacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num } from "@/lib/format";
import { explicacionDe } from "@/lib/metricas/explicacion";
import type { PuntoDiarioPautaSemanal } from "@/lib/queries/hechos/pauta-semanal";
import {
  configDeGraficaEnOrigen, etiquetaDeTramo, pasoPorDefecto, tramosDe, valoresPorTramo, type ConfigDeGrafica,
} from "@/lib/series-pasos";

/**
 * «Agendas por programa» en `/hub` (422, DT-2 y X-4): una línea por programa, solo cantidades (ADR 0048). Los dos
 * interruptores que aplican a una cantidad (Paso y Forma) viven en la URL (`?g_pauta-programas=…`); la unidad no se
 * ofrece porque agendas es la única unidad que cruza programas. Cada punto abre la explicación de «Agendadas» de ese
 * programa y ese día. Lee la serie diaria que la tabla de cada programa ya trae: no vuelve a contar nada.
 */
export const CLAVE_GRAFICA_AGENDAS_POR_PROGRAMA = "pauta-programas";
const PASOS = ["dia", "semana"] as const;

export function AgendasPorPrograma(p: {
  programas: ReadonlyArray<{ nombre: string; dias: readonly PuntoDiarioPautaSemanal[] }>;
  rango: { desde: string; hasta: string };
  origen: string;
  hoy: string;
}): JSX.Element {
  const config = configDeGraficaEnOrigen(p.origen, CLAVE_GRAFICA_AGENDAS_POR_PROGRAMA, {
    unidad: "cupos", paso: pasoPorDefecto(p.rango) === "dia" ? "dia" : "semana", forma: "paso",
  });
  if (config.paso === "mes") config.paso = "semana";
  const tramos = tramosDe(p.rango, config.paso, p.hoy);
  const porDia = (dias: readonly PuntoDiarioPautaSemanal[]) => new Map(dias.map((punto) => [punto.dia, punto.agendas] as const));
  const series: SerieDeGrafica[] = p.programas.map((programa, i) => ({
    clave: programa.nombre, valores: valoresPorTramo(porDia(programa.dias), tramos, config.forma), tipo: "linea", color: i,
  }));
  const porDiaTexto = config.paso === "dia";
  const explicaciones: Record<string, ExplicacionDeSerie> = Object.fromEntries(p.programas.map((programa) => [programa.nombre, {
    entrada: {
      concepto: "agendadas", explicacion: explicacionDe("agendadas"),
      filtros: [["Programa", programa.nombre], ["Área", "Paid"]],
    },
    paso: porDiaTexto ? "Día" : "Semana",
    anterior: porDiaTexto ? "el día anterior" : "la semana anterior",
    prefijo: config.forma === "acum" ? "acumulado hasta" : undefined,
    motivoVacio: "Sin agendas ese día.",
  }]));
  const modelo = crearModeloGrafica({
    tipo: "linea", unidad: "agendas", dias: tramos.map((tramo) => tramo.desde), etiquetas: tramos.map(etiquetaDeTramo),
    series, escribir: (valor) => num(valor), zoom: porDiaTexto && tramos.length > 14, pista: "Clic para ver cómo se calcula",
  });
  const titulo = "¿Cuántas agendas trae cada programa?";
  const tieneDatos = series.some((s) => s.valores.some((valor) => valor !== null && valor !== 0));
  return (
    <Card aria-labelledby="agendas-por-programa" data-testid="agendas-por-programa">
      <CardHeader className="space-y-1">
        <CardTitle id="agendas-por-programa">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">
          Una línea por programa, solo agendas de Paid: las cantidades se pueden comparar, las tasas no. Clic en un punto para abrir esa cifra.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <InterruptoresDeGrafica origen={p.origen} clave={CLAVE_GRAFICA_AGENDAS_POR_PROGRAMA} config={config as ConfigDeGrafica} sinUnidad pasos={PASOS} />
        {tieneDatos
          ? <GraficaConExplicacion modelo={modelo} explicaciones={explicaciones} titulo={`${titulo} Eje lineal con cero visible.`}
            tituloDeTabla={`${titulo}, por ${porDiaTexto ? "día" : "semana"}`}
            frescura={`Datos hasta el ${fecha(p.rango.hasta < p.hoy ? p.rango.hasta : p.hoy)}.`} />
          : <p className="text-sm text-muted-foreground">Sin agendas de Paid en este periodo.</p>}
      </CardContent>
    </Card>
  );
}
