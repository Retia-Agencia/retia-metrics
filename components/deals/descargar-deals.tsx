"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * "Descargar deals": elige las etapas y baja un CSV con lo básico de cada lead. Todas arrancan
 * marcadas; un clic en una etapa la quita o la pone. La descarga es un enlace a la ruta CSV
 * (el servidor aplica programa y alcance), no una server action.
 */
export interface DescargarDealsProps {
  programaSlug: string;
  etapas: readonly { valor: string; nombre: string }[];
}

export function DescargarDeals({ programaSlug, etapas }: DescargarDealsProps) {
  const [abierto, setAbierto] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(etapas.map((e) => e.valor)));

  function alternar(valor: string) {
    setElegidas((previas) => {
      const siguientes = new Set(previas);
      if (siguientes.has(valor)) siguientes.delete(valor);
      else siguientes.add(valor);
      return siguientes;
    });
  }

  const todas = elegidas.size === etapas.length;
  const href = `/p/${encodeURIComponent(programaSlug)}/deals/descargar.csv?etapas=${etapas
    .filter((e) => elegidas.has(e.valor))
    .map((e) => e.valor)
    .join(",")}`;

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Download className="size-4" />
        Descargar deals
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Descargar deals</DialogTitle>
          <DialogDescription>
            Elige las etapas. El CSV trae una fila por deal con teléfono, correo, dueño y datos del lead.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Etapas a descargar">
          {etapas.map((etapa) => {
            const activa = elegidas.has(etapa.valor);
            return (
              <button
                key={etapa.valor}
                type="button"
                aria-pressed={activa}
                onClick={() => alternar(etapa.valor)}
                className={cn(
                  "rounded-full border px-3 py-1 text-sm transition-colors",
                  activa
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground line-through hover:bg-muted",
                )}
              >
                {etapa.nombre}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setElegidas(todas ? new Set() : new Set(etapas.map((e) => e.valor)))}
        >
          {todas ? "Quitar todas" : "Marcar todas"}
        </button>
        <DialogFooter>
          <Button
            nativeButton={false}
            disabled={elegidas.size === 0}
            render={elegidas.size === 0 ? undefined : <a href={href} download onClick={() => setAbierto(false)} />}
          >
            <Download className="size-4" />
            Descargar CSV ({elegidas.size} {elegidas.size === 1 ? "etapa" : "etapas"})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
