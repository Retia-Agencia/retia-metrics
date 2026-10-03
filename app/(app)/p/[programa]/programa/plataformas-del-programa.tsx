"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  asociarProgramaAccion,
  desasociarProgramaAccion,
} from "@/app/(app)/ajustes/catalogos/acciones";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Plataforma = { id: string; nombre: string };

export function PlataformasDelPrograma({
  programId,
  plataformas,
  disponibles,
}: {
  programId: string;
  plataformas: Plataforma[];
  disponibles: Plataforma[];
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [plataformaId, setPlataformaId] = useState<string | null>(null);

  function guardar(accion: () => Promise<{ ok: true } | { ok: false; error: string }>, exito: string) {
    startTransition(async () => {
      const resultado = await accion();
      if (resultado.ok) {
        toast.success(exito);
        setPlataformaId(null);
        router.refresh();
      } else {
        toast.error("No se pudo guardar", { description: resultado.error });
      }
    });
  }

  return (
    <div className="space-y-4">
      {plataformas.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Este programa todavía no tiene plataformas de pago.
        </p>
      ) : (
        <ul className="space-y-2">
          {plataformas.map((plataforma) => (
            <li key={plataforma.id} className="flex items-center justify-between gap-3">
              <span className="text-sm">{plataforma.nombre}</span>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                disabled={pendiente}
                onClick={() =>
                  guardar(
                    () => desasociarProgramaAccion(plataforma.id, programId),
                    "Plataforma desvinculada",
                  )
                }
                aria-label={`Quitar ${plataforma.nombre}`}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {disponibles.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={plataformaId}
            items={disponibles.map((plataforma) => ({
              value: plataforma.id,
              label: plataforma.nombre,
            }))}
            onValueChange={(valor: string | null) => setPlataformaId(valor)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecciona una plataforma" />
            </SelectTrigger>
            <SelectContent>
              {disponibles.map((plataforma) => (
                <SelectItem key={plataforma.id} value={plataforma.id}>
                  {plataforma.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={pendiente || !plataformaId}
            onClick={() => {
              if (plataformaId) {
                guardar(
                  () => asociarProgramaAccion(plataformaId, programId),
                  "Plataforma vinculada",
                );
              }
            }}
          >
            Vincular
          </Button>
        </div>
      ) : null}
    </div>
  );
}
