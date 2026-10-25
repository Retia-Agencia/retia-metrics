"use client";

import { useEffect, useRef } from "react";
import { BarChart, LineChart } from "echarts/charts";
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from "echarts/components";
import * as echartsCore from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { crearOpcionGrafica, type ModeloDeGrafica } from "@/components/graficas/contrato";

echartsCore.use([LineChart, BarChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, SVGRenderer]);

let versionTema = 0;

function coloresDeTinta(elemento: HTMLElement) {
  const estilos = getComputedStyle(elemento);
  const token = (nombre: string) => estilos.getPropertyValue(nombre).trim();
  return {
    series: ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"].map(token),
    texto: token("--foreground"),
    textoSecundario: token("--muted-foreground"),
    divisor: token("--border"),
    fondo: token("--card"),
  };
}

export default function LienzoGrafica({ modelo, titulo }: { modelo: ModeloDeGrafica; titulo: string }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const elemento = contenedor.current;
    if (!elemento) return;
    const montar = () => {
      const colores = coloresDeTinta(elemento);
      const nombreTema = `tinta-${versionTema++}`;
      echartsCore.registerTheme(nombreTema, { color: colores.series, textStyle: { color: colores.texto }, backgroundColor: "transparent" });
      const instancia = echartsCore.init(elemento, nombreTema, { renderer: "svg" });
      instancia.setOption(crearOpcionGrafica(modelo, colores), true);
      return instancia;
    };
    let grafica = montar();

    const redimension = new ResizeObserver(() => grafica.resize());
    redimension.observe(elemento);
    const tema = new MutationObserver(() => {
      grafica.dispose();
      grafica = montar();
    });
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => {
      tema.disconnect();
      redimension.disconnect();
      grafica.dispose();
    };
  }, [modelo]);

  return <div ref={contenedor} className="h-72 w-full" role="img" aria-label={titulo} />;
}
