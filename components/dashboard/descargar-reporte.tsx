"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

/**
 * "Descargar PDF" del reporte diario (373): `window.print()` del navegador, sin librería (ADR 0006).
 */
export function DescargarReporte() {
  return (
    <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      Descargar PDF
    </Button>
  );
}

const sinSuscripcion = () => () => {};

/**
 * El pie que sale en CADA página impresa (`position: fixed` se repite al imprimir): cuándo se sacaron los
 * datos y la URL que produjo el reporte, para que cualquiera vea las mismas cifras. En pantalla no se ve.
 */
export function PieDeImpresion({ generado }: { generado: string }) {
  const url = useSyncExternalStore(sinSuscripcion, () => window.location.href, () => "");
  return (
    <p className="fixed inset-x-0 bottom-0 hidden border-t bg-background px-2 py-1 text-[10px] text-muted-foreground print:block">
      Datos del CRM al {generado} (Bogotá) · {url}
    </p>
  );
}
