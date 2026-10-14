"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sincronizarMetaAccion } from "./acciones";

export function SincronizacionMeta({ deshabilitada = false }: { deshabilitada?: boolean }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  return (
    <Button
      type="button"
      disabled={deshabilitada || pendiente}
      onClick={() => startTransition(async () => {
        const resultado = await sincronizarMetaAccion();
        if (!resultado.ok) {
          toast.error("No se pudo sincronizar Meta", { description: resultado.error });
        } else if (resultado.estado === "error") {
          toast.error("La sincronización terminó con error", { description: resultado.error });
        } else {
          toast.success(`Meta sincronizado: ${resultado.filas} filas de gasto`);
        }
        router.refresh();
      })}
    >
      {pendiente ? "Sincronizando…" : "Sincronizar ahora"}
    </Button>
  );
}
