"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export function GuardarComoPdf({ generado }: { generado: string }) {
  useEffect(() => {
    const ponerPie = () => document.documentElement.style.setProperty(
      "--pie-impresion",
      JSON.stringify(`Datos del CRM al ${generado} (Bogotá) · ${window.location.href}`),
    );
    const quitarPie = () => document.documentElement.style.removeProperty("--pie-impresion");
    window.addEventListener("beforeprint", ponerPie);
    window.addEventListener("afterprint", quitarPie);
    return () => {
      window.removeEventListener("beforeprint", ponerPie);
      window.removeEventListener("afterprint", quitarPie);
      quitarPie();
    };
  }, [generado]);

  return <Button type="button" onClick={() => window.print()}>Guardar como PDF</Button>;
}
