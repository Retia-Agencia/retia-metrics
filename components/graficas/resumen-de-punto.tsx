"use client";

import { useCallback, useState, useTransition } from "react";
import { detalleDePuntoAccion } from "@/app/(app)/p/[programa]/hub/acciones-graficas";
import { ResumenDeCifra } from "@/components/cifra-con-lista";
import type { ModeloDeGrafica } from "@/components/graficas/contrato";
import { GraficaDinamica } from "@/components/graficas/grafica-dinamica";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { num } from "@/lib/format";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

export function GraficaConResumen({ modelo, titulo, slug, origen, titulos }: {
  modelo: ModeloDeGrafica;
  titulo: string;
  slug: string;
  origen: string;
  titulos: string[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [detalle, setDetalle] = useState<DetalleDeCifra | null>(null);
  const [error, setError] = useState(false);
  const [seleccion, setSeleccion] = useState<{ titulo: string; descripcionCantidad?: string } | null>(null);
  const [, iniciar] = useTransition();
  const onPunto = useCallback((serieIndex: number, puntoIndex: number) => {
    const resumen = modelo.series[serieIndex]?.resumenes?.[puntoIndex];
    if (!resumen) return;
    const cupos = modelo.series[serieIndex]?.valores[puntoIndex];
    setSeleccion({
      titulo: titulos[puntoIndex] ?? titulo,
      descripcionCantidad: resumen.metrica === "caja"
        ? cupos === null || cupos === undefined ? "abonos" : `abonos de ${num(cupos)} cupos con caja`
        : undefined,
    });
    setDetalle(null);
    setError(false);
    setAbierto(true);
    iniciar(async () => {
      try {
        setDetalle(await detalleDePuntoAccion({ slug, origen, ...resumen }));
      } catch {
        setError(true);
      }
    });
  }, [modelo, origen, slug, titulo, titulos]);

  const tituloDelDialogo = seleccion?.titulo ?? titulo;

  return <>
    <GraficaDinamica modelo={modelo} titulo={titulo} onPunto={onPunto} />
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        {detalle ? <ResumenDeCifra titulo={tituloDelDialogo} detalle={detalle} descripcionCantidad={seleccion?.descripcionCantidad} /> : <>
          <DialogTitle>{tituloDelDialogo}</DialogTitle>
          <p className="text-sm text-muted-foreground">{error ? "No se pudo cargar el resumen." : "Cargando…"}</p>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}
