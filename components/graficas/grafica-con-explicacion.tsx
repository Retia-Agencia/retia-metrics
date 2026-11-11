"use client";

import { useCallback, useState } from "react";
import { ExplicacionDeCifra } from "@/components/como-se-calcula";
import { filasDeTabla, type ExplicacionDeSerie, type ModeloDeGrafica } from "@/components/graficas/contrato";
import { GraficaDinamica } from "@/components/graficas/grafica-dinamica";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { armarCifra, type CifraDeMetrica } from "@/lib/metricas/cifra";
import { cn } from "@/lib/utils";

/**
 * Una gráfica cuyos puntos abren su explicación (420, diseño §4.4): el clic en un punto o una barra, o en una celda de la
 * tabla alternativa, arma la Cifra de esa serie en ese punto (`armarCifra`, la misma pieza del 419) y la abre en el panel
 * lateral, con "Contra el día anterior" y "Calculada con: Día · 1 nov". No calcula nada: el valor es el del modelo.
 */
export function cifraDelPunto(modelo: ModeloDeGrafica, explicaciones: Readonly<Record<string, ExplicacionDeSerie>>, serieIndex: number, i: number): CifraDeMetrica | null {
  const serie = modelo.series[serieIndex];
  const e = serie ? explicaciones[serie.clave] : undefined;
  if (!serie || !e) return null;
  const valor = serie.valores[i] ?? null;
  const etiqueta = modelo.etiquetas[i] ?? modelo.dias[i];
  const anterior = i > 0 ? serie.valores[i - 1] ?? null : undefined;
  return armarCifra({
    ...e.entrada,
    valor,
    motivo: valor === null ? e.motivoVacio : undefined,
    periodo: `${e.prefijo ? `${e.prefijo} ` : ""}${etiqueta}`,
    filtros: [...e.entrada.filtros, [e.paso, etiqueta]],
    comparacion: anterior === undefined ? undefined : { referencia: e.anterior, valor: anterior },
  });
}

export function GraficaConExplicacion({ modelo, titulo, explicaciones, tituloDeTabla, frescura }: {
  modelo: ModeloDeGrafica;
  titulo: string;
  /** Al pie, a la izquierda: de cuándo son los datos. */
  frescura: string;
  explicaciones: Readonly<Record<string, ExplicacionDeSerie>>;
  tituloDeTabla: string;
}) {
  const [cifra, setCifra] = useState<CifraDeMetrica | null>(null);
  const [comoTabla, setComoTabla] = useState(false);
  const abrir = useCallback((serieIndex: number, i: number) => setCifra(cifraDelPunto(modelo, explicaciones, serieIndex, i)), [modelo, explicaciones]);
  const filas = filasDeTabla(modelo);
  return (
    <>
      {comoTabla ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <caption className="sr-only">{tituloDeTabla}</caption>
            <thead><tr className="border-b text-xs text-muted-foreground">
              <th scope="col" className="px-2 py-2 text-left font-medium">{modelo.dias.length && modelo.etiquetas[0] !== modelo.dias[0] ? "Punto" : "Día"}</th>
              {modelo.series.map((serie) => <th key={serie.clave} scope="col" className="px-2 py-2 text-right font-medium">{serie.clave}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {filas.map((fila, i) => (
                <tr key={fila.dia}>
                  <th scope="row" className="px-2 py-1.5 text-left font-normal">{fila.etiqueta}</th>
                  {modelo.series.map((serie, s) => (
                    <td key={serie.clave} className="px-2 py-1 text-right">
                      {explicaciones[serie.clave]
                        ? <button type="button" onClick={() => abrir(s, i)} data-abre-explicacion=""
                          aria-label={`${serie.clave}, ${fila.etiqueta}: ${serie.textos[i] ?? "—"}. Abrir cómo se calcula`}
                          className="cifra rounded-md px-1 py-0.5 transition-colors duration-150 outline-none hover:bg-marca-suave focus-visible:outline-2 focus-visible:outline-marca">
                          {serie.textos[i] ?? "—"}
                        </button>
                        : <span className="cifra">{serie.textos[i] ?? "—"}</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <GraficaDinamica modelo={modelo} titulo={titulo} onPunto={abrir} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{frescura}</p>
        <button type="button" aria-pressed={comoTabla} onClick={() => setComoTabla((v) => !v)}
          className={cn("rounded-full border px-3 py-1 text-xs transition-colors duration-150 outline-none hover:bg-marca-suave focus-visible:outline-2 focus-visible:outline-marca", comoTabla && "border-marca bg-marca-suave text-marca-texto")}>
          {comoTabla ? "Ver como gráfica" : "Ver como tabla"}
        </button>
      </div>
      <Sheet open={cifra !== null} onOpenChange={(abierto) => { if (!abierto) setCifra(null); }}>
        {cifra ? <SheetContent><ExplicacionDeCifra cifra={cifra} /></SheetContent> : null}
      </Sheet>
    </>
  );
}
