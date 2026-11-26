"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function AvisoVersionNueva() {
  const [hayVersionNueva, setHayVersionNueva] = useState(false);

  useEffect(() => {
    const versionCargada = document.documentElement.dataset.dplId;
    if (!versionCargada) return;

    let vigente = true;
    const consultarVersion = () => {
      fetch("/api/version", { cache: "no-store" })
        .then((respuesta) => respuesta.ok ? respuesta.json() as Promise<{ deploymentId: string | null }> : null)
        .then((datos) => {
          if (!vigente || !datos) return;
          setHayVersionNueva(datos.deploymentId != null && datos.deploymentId !== versionCargada);
        })
        .catch(() => undefined);
    };
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible") consultarVersion();
    };

    consultarVersion();
    const intervalo = window.setInterval(consultarVersion, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    return () => {
      vigente = false;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    };
  }, []);

  if (!hayVersionNueva) return null;

  return <div className="fixed bottom-4 inset-x-0 mx-auto w-fit z-50 rounded-md border bg-background p-3 shadow-sm" role="status">
    <div className="flex items-center gap-3">
      <span className="text-sm">Hay una versión nueva del CRM.</span>
      <Button type="button" size="sm" onClick={() => window.location.reload()}>Recargar</Button>
    </div>
  </div>;
}
