"use client";

import dynamic from "next/dynamic";
import type { ModeloDeGrafica } from "@/components/graficas/contrato";

const LienzoGrafica = dynamic(() => import("@/components/graficas/lienzo-grafica"), {
  ssr: false,
  loading: () => <div className="h-72 rounded-xl bg-muted" aria-label="Cargando gráfica" />,
});

export function GraficaDinamica(props: { modelo: ModeloDeGrafica; titulo: string }) {
  return <LienzoGrafica {...props} />;
}
