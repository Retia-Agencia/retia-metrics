"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Descargar PDF" del reporte diario (373): `window.print()` del navegador, sin librería (ADR 0006).
 */
export function DescargarReporte() {
  const abiertosParaImprimir = useRef<HTMLDetailsElement[]>([]);

  useEffect(() => {
    const abrirDetalles = () => {
      // Acumula: un segundo `beforeprint` sin su `afterprint` no debe olvidar los que abrió el primero.
      const cerrados = Array.from(document.querySelectorAll<HTMLDetailsElement>("#reporte-diario details:not([open])"));
      for (const detalle of cerrados) detalle.open = true;
      abiertosParaImprimir.current.push(...cerrados);
    };
    const restaurarDetalles = () => {
      for (const detalle of abiertosParaImprimir.current) detalle.open = false;
      abiertosParaImprimir.current = [];
    };
    window.addEventListener("beforeprint", abrirDetalles);
    window.addEventListener("afterprint", restaurarDetalles);
    return () => {
      window.removeEventListener("beforeprint", abrirDetalles);
      window.removeEventListener("afterprint", restaurarDetalles);
    };
  }, []);

  return (
    <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      Descargar PDF
    </Button>
  );
}

/**
 * El pie de CADA página impresa: cuándo se sacaron los datos y la URL que produjo el reporte, para que
 * cualquiera vea las mismas cifras. Va en el margen de la página (`@page`, ver `globals.css`) y no como un
 * elemento fijo, que se encimaba con el contenido; el texto llega por una variable CSS que se pone solo
 * mientras se imprime. En pantalla no se ve.
 */
export function PieDeImpresion({ generado }: { generado: string }) {
  useEffect(() => {
    const poner = () => document.documentElement.style.setProperty("--pie-impresion", JSON.stringify(`Datos del CRM al ${generado} (Bogotá) · ${window.location.href}`));
    const quitar = () => document.documentElement.style.removeProperty("--pie-impresion");
    window.addEventListener("beforeprint", poner);
    window.addEventListener("afterprint", quitar);
    return () => {
      window.removeEventListener("beforeprint", poner);
      window.removeEventListener("afterprint", quitar);
    };
  }, [generado]);
  return null;
}
