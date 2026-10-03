"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  activarProgramaDesdeFichaAccion,
  conectarCalendlyAccion,
  desactivarProgramaAccion,
  editarProgramaAccion,
} from "@/app/(app)/ajustes/programas/acciones";
import {
  FormularioPrograma,
  aBorrador,
  aEntrada,
  type Borrador,
  type ProgramaVista,
} from "@/components/programas-admin";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type Resultado = { ok: true } | { ok: false; error: string };

export function EditarPrograma({
  programa,
  trigger,
}: {
  programa: ProgramaVista;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [pendiente, startTransition] = useTransition();

  function correr(accion: () => Promise<Resultado>, mensaje: string, cerrar = false) {
    startTransition(async () => {
      const resultado = await accion();
      if (!resultado.ok) {
        toast.error("No se pudo guardar", { description: resultado.error });
        return;
      }
      toast.success(mensaje);
      if (cerrar) setAbierto(false);
      router.refresh();
    });
  }

  function guardar(borrador: Borrador) {
    correr(
      () => editarProgramaAccion(programa.id, aEntrada(borrador), borrador.tokenCalendly),
      "Programa actualizado",
      true,
    );
  }

  return (
    <Dialog open={abierto} onOpenChange={setAbierto}>
      <DialogTrigger render={<Button size="sm" variant={trigger ? "ghost" : "secondary"} />}>
        {trigger ?? "Editar"}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogTitle>Editar programa</DialogTitle>
        <DialogDescription>
          El token guardado nunca se muestra. Déjalo vacío para conservarlo.
        </DialogDescription>
        <FormularioPrograma
          inicial={aBorrador(programa)}
          pendiente={pendiente}
          slugBloqueado
          tieneTokenCalendly={programa.tieneTokenCalendly}
          onCancelar={() => setAbierto(false)}
          onGuardar={guardar}
        />
        <div className="flex flex-wrap justify-between gap-2">
          {programa.activo ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={pendiente}
              onClick={() => correr(() => desactivarProgramaAccion(programa.id), "Programa desactivado", true)}
            >
              Desactivar programa
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pendiente}
            onClick={() => correr(() => conectarCalendlyAccion(programa.id), "Webhook rehecho")}
          >
            Rehacer webhook
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ActivarPrograma({ id, habilitado }: { id: string; habilitado: boolean }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={!habilitado || pendiente}
      onClick={() =>
        startTransition(async () => {
          const resultado = await activarProgramaDesdeFichaAccion(id);
          if (!resultado.ok) {
            toast.error("No se pudo activar", { description: resultado.error });
            return;
          }
          toast.success("Programa activado");
          router.refresh();
        })
      }
    >
      Activar
    </Button>
  );
}
